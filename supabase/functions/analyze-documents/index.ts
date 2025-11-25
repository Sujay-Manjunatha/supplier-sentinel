import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Gap {
  section: string;
  customerText: string;
  gapType: 'ZUSÄTZLICH' | 'STRENGER' | 'WIDERSPRUCH';
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: 'AKZEPTIEREN' | 'ABLEHNEN' | 'PRÜFEN';
  ownCodexCoverage: string;
  reasoning: string;
  risksIfAccepted: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baselineContent, comparisonContent } = await req.json();
    
    console.log('Starting document analysis...');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Use AI to analyze and compare documents semantically
    const systemPrompt = `Du bist ein Experte für Compliance-Analysen aus der Perspektive eines LIEFERANTEN.

KONTEXT:
- "MEIN KODEX" = Der eigene Lieferantenkodex des Benutzers
- "KUNDENKODEX" = Der Lieferantenkodex, den der Kunde vom Lieferanten fordert

DEINE AUFGABE:
Vergleiche den KUNDENKODEX mit MEIN KODEX und identifiziere NUR echte Abweichungen und Zusatzanforderungen:

1. **ZUSÄTZLICHE** Anforderungen: Im Kundenkodex gefordert, aber NICHT im eigenen Kodex abgedeckt
2. **STRENGERE** Anforderungen: Im Kundenkodex strenger/weitreichender formuliert als im eigenen Kodex
3. **WIDERSPRÜCHLICHE** Anforderungen: Im Kundenkodex anders/gegenteilig formuliert als im eigenen Kodex

WICHTIG - KEINE Gaps für:
❌ Anforderungen die bereits gleichwertig im eigenen Kodex erfüllt sind
❌ Standard-Anforderungen die beide Kodizes in ähnlicher Form teilen
❌ Anforderungen die der eigene Kodex sogar übertrifft

NUR ECHTE LÜCKEN UND ABWEICHUNGEN IDENTIFIZIEREN!

SCHWEREGRAD (bezogen auf das RISIKO für den Lieferanten bei Nicht-Erfüllung):
- KRITISCH: Erhebliches Risiko (rechtlich, finanziell, Reputationsschaden, Geschäftsbeziehung gefährdet)
- MITTEL: Moderate Risiken oder Aufwände bei Umsetzung
- GERING: Geringes Risiko, einfach umzusetzen, geringe Kosten

BEWERTUNGSKRITERIEN:
- AKZEPTIEREN: Anforderung ist vernünftig, umsetzbar, geringe Risiken
- ABLEHNEN: Anforderung ist unrealistisch, zu kostspielig, rechtlich/wirtschaftlich problematisch
- PRÜFEN: Anforderung erfordert weitere Klärung oder Verhandlung

AUSGABEFORMAT für jeden Gap:
- section: Abschnitts-/Themenname
- customerText: Die konkrete Anforderung aus dem Kundenkodex
- gapType: ZUSÄTZLICH | STRENGER | WIDERSPRUCH
- severity: KRITISCH | MITTEL | GERING
- aiRecommendation: AKZEPTIEREN | ABLEHNEN | PRÜFEN
- ownCodexCoverage: Was steht im eigenen Kodex zu diesem Thema? (Falls nichts: "Nicht abgedeckt")
- reasoning: Detaillierte Begründung deiner Empfehlung (2-4 Sätze) - erkläre warum dies ein Gap ist
- risksIfAccepted: Konkrete Risiken bei Akzeptanz (rechtlich, operativ, finanziell)

WICHTIG: 
- Alle Antworten auf Deutsch
- Sei streng bei der Gap-Identifikation - nur echte Lücken melden
- Qualität vor Quantität - lieber 5 echte Gaps als 20 irrelevante`;

    const userPrompt = `Analysiere diese beiden Lieferantenkodizes aus Lieferantenperspektive:

MEIN EIGENER LIEFERANTENKODEX:
${baselineContent}

KUNDENKODEX (Was der Kunde von mir als Lieferant fordert):
${comparisonContent}

Identifiziere NUR echte Abweichungen und Zusatzanforderungen:
- Welche Anforderungen im Kundenkodex sind NICHT oder UNZUREICHEND im eigenen Kodex abgedeckt?
- Welche Anforderungen im Kundenkodex sind STRENGER als im eigenen Kodex?
- Welche Anforderungen WIDERSPRECHEN dem eigenen Kodex?

IGNORIERE Anforderungen die bereits gleichwertig erfüllt sind!

Liefere eine fokussierte Analyse im JSON-Format mit dieser Struktur:
{
  "gaps": [
    {
      "section": "Abschnittsname",
      "customerText": "Konkrete Anforderung aus dem Kundenkodex",
      "gapType": "ZUSÄTZLICH|STRENGER|WIDERSPRUCH",
      "severity": "KRITISCH|MITTEL|GERING",
      "aiRecommendation": "AKZEPTIEREN|ABLEHNEN|PRÜFEN",
      "ownCodexCoverage": "Was steht im eigenen Kodex dazu?",
      "reasoning": "Warum ist dies ein Gap? Was fehlt oder weicht ab?",
      "risksIfAccepted": "Konkrete Risiken bei Akzeptanz"
    }
  ]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('AI Response:', aiResponse);
    
    let analysisResult;
    try {
      analysisResult = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      throw new Error('Failed to parse AI analysis result');
    }

    // Calculate gap statistics
    const gaps: Gap[] = analysisResult.gaps || [];
    const criticalGaps = gaps.filter(g => g.severity === 'KRITISCH').length;
    const mediumGaps = gaps.filter(g => g.severity === 'MITTEL').length;
    const lowGaps = gaps.filter(g => g.severity === 'GERING').length;

    const result = {
      overallCompliance: 0,
      totalGaps: gaps.length,
      criticalGaps,
      mediumGaps,
      lowGaps,
      gaps
    };

    console.log('Analysis complete:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in analyze-documents function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
