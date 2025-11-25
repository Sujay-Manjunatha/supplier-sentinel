import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Gap {
  section: string;
  customerText: string;
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  aiRecommendation: 'AKZEPTIEREN' | 'ABLEHNEN' | 'PRÜFEN';
  reasoning: string;
  risksIfAccepted: string;
  risksIfRejected: string;
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
- "MEIN KODEX" = Der eigene Lieferantenkodex des Benutzers (als Information/Hintergrund)
- "KUNDENKODEX" = Der Lieferantenkodex, den der Kunde vom Lieferanten fordert

DEINE AUFGABE:
Analysiere jede Anforderung aus dem KUNDENKODEX und bewerte:
1. Sollte der Lieferant diese Anforderung akzeptieren?
2. Welche Risiken entstehen bei Akzeptanz?
3. Welche Risiken entstehen bei Ablehnung?

Der eigene Kodex dient nur als Hintergrund-Information. Bewerte jede Kundenanforderung unabhängig.

BEWERTUNGSKRITERIEN:
- AKZEPTIEREN: Anforderung ist vernünftig, branchenüblich, keine erheblichen Risiken
- ABLEHNEN: Anforderung ist unrealistisch, zu kostspielig, rechtlich problematisch, oder wirtschaftlich unzumutbar
- PRÜFEN: Anforderung erfordert weitere Klärung, Verhandlung oder individuelle Prüfung

SCHWEREGRAD-KLASSIFIZIERUNG:
- KRITISCH: Rechtliche/regulatorische Risiken, große Haftung, grundlegende ethische Verstöße
- MITTEL: Wichtige betriebliche/ethische Bedenken, moderate Kosten
- GERING: Kleinere organisatorische Anpassungen, geringe Kosten

AUSGABEFORMAT für jeden Gap:
- section: Abschnitts-/Themenname
- customerText: Die konkrete Anforderung des Kunden
- severity: KRITISCH | MITTEL | GERING
- aiRecommendation: AKZEPTIEREN | ABLEHNEN | PRÜFEN
- reasoning: Detaillierte Begründung deiner Empfehlung (2-4 Sätze)
- risksIfAccepted: Konkrete Risiken bei Akzeptanz (rechtlich, operativ, finanziell)
- risksIfRejected: Konkrete Risiken bei Ablehnung (Geschäftsbeziehung, Wettbewerbsnachteile)

WICHTIG: 
- Alle Antworten auf Deutsch
- Sei präzise und praxisorientiert
- Berücksichtige reale Geschäftsbeziehungen zwischen Lieferant und Kunde
- Fokussiere auf machbare, realistische Einschätzungen`;

    const userPrompt = `Analysiere diese beiden Lieferantenkodizes aus Lieferantenperspektive:

MEIN EIGENER LIEFERANTENKODEX (nur als Hintergrund-Information):
${baselineContent}

KUNDENKODEX (Was der Kunde von mir als Lieferant fordert):
${comparisonContent}

Bewerte jede Anforderung aus dem KUNDENKODEX:
- Sollte ich als Lieferant diese Anforderung akzeptieren?
- Welche Risiken entstehen bei Akzeptanz?
- Welche Risiken entstehen bei Ablehnung?

Liefere eine umfassende Analyse im JSON-Format mit dieser Struktur:
{
  "overallCompliance": <Prozentsatz 0-100, wie viele Anforderungen realistisch akzeptierbar sind>,
  "gaps": [
    {
      "section": "Abschnittsname",
      "customerText": "Konkrete Anforderung aus dem Kundenkodex",
      "severity": "KRITISCH|MITTEL|GERING",
      "aiRecommendation": "AKZEPTIEREN|ABLEHNEN|PRÜFEN",
      "reasoning": "Detaillierte Begründung der Empfehlung",
      "risksIfAccepted": "Konkrete Risiken bei Akzeptanz dieser Anforderung",
      "risksIfRejected": "Konkrete Risiken bei Ablehnung dieser Anforderung"
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
        temperature: 0.3,
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
      overallCompliance: analysisResult.overallCompliance || 0,
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
