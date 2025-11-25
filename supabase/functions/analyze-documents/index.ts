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
    const systemPrompt = `Du bist ein Experte für Compliance-Analysen, spezialisiert auf den Vergleich von Lieferantenkodizes.
Deine Aufgabe ist es, zwei Lieferantenkodizes zu analysieren und Lücken zu identifizieren, bei denen der Kodex des Kunden die Baseline-Anforderungen nicht erfüllt.

KRITISCHE ANWEISUNGEN:
1. Vergleiche den Lieferantenkodex des Kunden mit dem Baseline-Kodex semantisch (bedeutungsbasiert, NICHT Wort-für-Wort)
2. Identifiziere Schlüsselanforderungen und Themen in beiden Dokumenten
3. Finde Lücken, bei denen der Kodex des Kunden Anforderungen hat, die fehlen, schwächer sind oder sich erheblich von der Baseline unterscheiden
4. Klassifiziere jede Lücke nach Schweregrad:
   - KRITISCH: Rechtliche/regulatorische Probleme, große Haftungsrisiken, grundlegende ethische Verstöße
   - MITTEL: Wichtige betriebliche oder ethische Bedenken, die Aufmerksamkeit erfordern
   - GERING: Kleinere Unterschiede oder Verbesserungsbereiche

Für jede gefundene Lücke gib an:
- Den Abschnitts-/Themennamen
- Den problematischen Text aus dem Kundendokument
- Die entsprechende Referenz aus der Baseline
- Eine klare Empfehlung
- Schweregrad-Klassifizierung mit kurzer Erklärung

Konzentriere dich auf wesentliche Unterschiede in Bedeutung und Anforderungen, nicht auf geringfügige Formulierungsvariationen.

WICHTIG: Alle deine Antworten müssen auf Deutsch sein.`;

    const userPrompt = `Vergleiche diese beiden Lieferantenkodizes und identifiziere Lücken:

BASELINE LIEFERANTENKODEX (Unsere Referenz):
${baselineContent}

KUNDEN LIEFERANTENKODEX (Zu vergleichen):
${comparisonContent}

Liefere eine umfassende Lückenanalyse im JSON-Format mit dieser Struktur:
{
  "overallCompliance": <Prozentsatz 0-100>,
  "gaps": [
    {
      "section": "Abschnittsname",
      "customerText": "Text aus Kundenkodex",
      "baselineText": "Text aus Baseline-Kodex",
      "recommendation": "Wie diese Lücke zu beheben ist",
      "severity": "KRITISCH|MITTEL|GERING",
      "explanation": "Kurze Erklärung, warum dies ein Problem ist"
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
