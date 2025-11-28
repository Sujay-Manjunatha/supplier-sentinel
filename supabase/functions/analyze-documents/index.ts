import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Match {
  section: string;
  customerText: string;
  matchedNegativePoint: {
    title: string;
    description: string;
  };
  matchConfidence: 'HOCH' | 'MITTEL' | 'NIEDRIG';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, negativeListItems, documentType } = await req.json();
    console.log('Starting document analysis...');
    console.log('Document type:', documentType);
    console.log('Negative list items count:', negativeListItems?.length || 0);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Du bist ein Experte für Dokumentenanalyse und Compliance-Prüfung.

AUFGABE:
Durchsuche das KUNDENDOKUMENT nach Anforderungen, Klauseln oder Bedingungen, die mit den Punkten aus der NEGATIVLISTE übereinstimmen oder diesen sehr ähnlich sind.

Die NEGATIVLISTE enthält Punkte, die NICHT akzeptiert werden können.

Für jeden gefundenen Treffer im Kundendokument:
1. Identifiziere die Textstelle im Kundendokument
2. Ordne sie einem passenden Negativpunkt zu
3. Bewerte die Übereinstimmung (HOCH/MITTEL/NIEDRIG)

ÜBEREINSTIMMUNGS-KRITERIEN:
- HOCH: Inhaltlich nahezu identisch oder direkt widersprechend
- MITTEL: Ähnliche Thematik, aber unterschiedliche Formulierung
- NIEDRIG: Thematisch verwandt, aber nicht eindeutig übereinstimmend

OUTPUT-FORMAT:
Erstelle ein JSON-Array mit allen gefundenen Treffern.`;

    const negativeListText = negativeListItems && negativeListItems.length > 0
      ? negativeListItems.map((item: any, index: number) => 
          `${index + 1}. [${item.category}] ${item.title}\n   ${item.description}`
        ).join('\n\n')
      : 'Keine Negativpunkte definiert';

    const userPrompt = `NEGATIVLISTE (Punkte die NICHT akzeptiert werden):
${negativeListText}

---

KUNDENDOKUMENT (${documentType === 'supplier_code' ? 'Lieferantenkodex' : 'NDA/Geheimhaltung'}):
${documentContent}

---

Durchsuche das Kundendokument und finde alle Stellen, die mit den Negativpunkten übereinstimmen oder diesen ähnlich sind.
Gib das Ergebnis als JSON-Array zurück mit der Struktur:
{
  "matches": [
    {
      "section": "Abschnitt im Kundendokument",
      "customerText": "Exakter Text aus dem Kundendokument",
      "matchedNegativePoint": {
        "title": "Titel des passenden Negativpunkts",
        "description": "Beschreibung des Negativpunkts"
      },
      "matchConfidence": "HOCH|MITTEL|NIEDRIG"
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
    const content_text = data.choices[0].message.content;
    console.log('AI response received, length:', content_text.length);
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(content_text);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content_text.substring(0, 500));
      throw new Error('Invalid JSON response from AI');
    }

    const matches = parsedResult.matches || parsedResult;
    
    if (!Array.isArray(matches)) {
      console.error('Expected array of matches, got:', typeof matches);
      throw new Error('Invalid response format from AI');
    }

    console.log(`Analysis complete. Found ${matches.length} matches with negative list`);

    // Convert matches to gap format for backwards compatibility
    const gaps = matches.map((match: Match) => ({
      section: match.section,
      customerText: match.customerText,
      gapType: 'negative_match',
      severity: match.matchConfidence === 'HOCH' ? 'KRITISCH' : match.matchConfidence === 'MITTEL' ? 'MITTEL' : 'GERING',
      aiRecommendation: 'ABLEHNEN',
      reasoning: `Übereinstimmung mit Negativpunkt: ${match.matchedNegativePoint.title}`,
      matchedNegativePoint: match.matchedNegativePoint,
      matchConfidence: match.matchConfidence,
      ownCodexCoverage: 'N/A',
      risksIfAccepted: 'Dieser Punkt steht auf Ihrer Negativliste'
    }));

    // Calculate statistics
    const criticalGaps = gaps.filter((gap: any) => gap.severity === 'KRITISCH').length;
    const mediumGaps = gaps.filter((gap: any) => gap.severity === 'MITTEL').length;
    const lowGaps = gaps.filter((gap: any) => gap.severity === 'GERING').length;

    const result = {
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