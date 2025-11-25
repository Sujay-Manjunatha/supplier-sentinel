import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Gap {
  section: string;
  customerText: string;
  baselineText: string;
  recommendation: string;
  severity: 'KRITISCH' | 'MITTEL' | 'GERING';
  explanation: string;
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
- "MEIN KODEX" = Der eigene Lieferantenkodex des Benutzers (Baseline/Referenz)
- "KUNDENKODEX" = Der Lieferantenkodex, den der Kunde vom Benutzer erwartet

DEINE AUFGABE:
Finde alle Anforderungen, die der KUNDE in seinem Kodex stellt, die im EIGENEN Kodex des Lieferanten entweder:
1. FEHLEN (= nicht vorhanden)
2. SCHWÄCHER formuliert sind (= weniger streng als beim Kunden)

NICHT RELEVANT (IGNORIERE DIESE):
- Anforderungen, die der Lieferant selbst hat, aber der Kunde NICHT fordert
- Wenn der eigene Kodex STRENGER ist als der Kundenkodex
- Das sind KEINE Gaps, da höhere eigene Standards kein Problem darstellen

NUR DIESE SIND GAPS:
- Kundenanforderungen, die im eigenen Kodex FEHLEN
- Kundenanforderungen, die STRENGER sind als im eigenen Kodex

SCHWEREGRAD-KLASSIFIZIERUNG:
- KRITISCH: Rechtliche/regulatorische Risiken, große Haftung, grundlegende ethische Verstöße
- MITTEL: Wichtige betriebliche/ethische Bedenken
- GERING: Kleinere Unterschiede, Verbesserungsbereiche

AUSGABEFORMAT für jeden Gap:
- section: Abschnitts-/Themenname
- customerText: Was der Kunde konkret fordert
- baselineText: Was im eigenen Kodex steht (oder "Nicht vorhanden")
- recommendation: Konkrete Handlungsempfehlung
- severity: KRITISCH | MITTEL | GERING
- explanation: Kurze Erklärung, warum dies ein Gap ist

WICHTIG: Alle Antworten müssen auf Deutsch sein. Konzentriere dich auf semantische Unterschiede, nicht auf Formulierungen.`;

    const userPrompt = `Analysiere diese beiden Lieferantenkodizes aus Lieferantenperspektive:

MEIN EIGENER LIEFERANTENKODEX (Baseline-Referenz):
${baselineContent}

KUNDENKODEX (Was der Kunde von mir als Lieferant fordert):
${comparisonContent}

Identifiziere alle Anforderungen, die der KUNDE stellt, die in MEINEM EIGENEN Kodex entweder FEHLEN oder SCHWÄCHER formuliert sind.

Liefere eine umfassende Gap-Analyse im JSON-Format mit dieser Struktur:
{
  "overallCompliance": <Prozentsatz 0-100, wie gut mein Kodex die Kundenanforderungen erfüllt>,
  "gaps": [
    {
      "section": "Abschnittsname",
      "customerText": "Konkrete Anforderung aus dem Kundenkodex",
      "baselineText": "Was ich in meinem eigenen Kodex habe (oder 'Nicht vorhanden')",
      "recommendation": "Was ich tun sollte, um diese Lücke zu schließen",
      "severity": "KRITISCH|MITTEL|GERING",
      "explanation": "Warum dies ein Gap ist und welche Risiken bestehen"
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
