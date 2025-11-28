import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedPoint {
  title: string;
  description: string;
  category: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, documentType } = await req.json();
    console.log('Extracting negative points from document, type:', documentType);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Du bist ein Experte für die Analyse von Compliance-Dokumenten.

AUFGABE:
Analysiere das folgende Dokument und extrahiere ALLE einzelnen Punkte/Anforderungen/Klauseln, die als "No-Go"-Kriterien oder kritische Anforderungen formuliert sind.

Für jeden gefundenen Punkt erstelle ein Objekt mit:
- title: Kurze, prägnante Zusammenfassung (max. 60 Zeichen)
- description: Der vollständige Text des Punktes aus dem Dokument
- category: Passende Kategorie basierend auf dem Inhalt

KATEGORIEN für Lieferantenkodex:
- Arbeitsbedingungen
- Arbeitszeit
- Vergütung
- Gesundheit und Sicherheit
- Umweltschutz
- Ethik und Compliance
- Haftung
- Kündigung
- Sonstiges

KATEGORIEN für NDA/Geheimhaltung:
- Geheimhaltungspflicht
- Vertrauliche Informationen
- Nutzungsbeschränkungen
- Weitergabeverbot
- Aufbewahrung und Löschung
- Laufzeit
- Vertragsstrafe
- Haftung
- Rückgabepflicht
- Sonstiges

Gib das Ergebnis als JSON-Array zurück.`;

    const userPrompt = `Dokumenttyp: ${documentType === 'supplier_code' ? 'Lieferantenkodex' : 'NDA/Geheimhaltungsvereinbarung'}

Dokumentinhalt:
${content}

Extrahiere alle relevanten Punkte und gib sie als JSON-Array zurück.`;

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
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit erreicht. Bitte versuchen Sie es später erneut.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Zahlungspflichtig. Bitte fügen Sie Guthaben zu Ihrem Lovable AI Workspace hinzu.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway Error:', response.status, errorText);
      throw new Error(`AI Gateway returned ${response.status}`);
    }

    const data = await response.json();
    const content_text = data.choices[0].message.content;
    
    let parsedResult;
    try {
      parsedResult = JSON.parse(content_text);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content_text);
      throw new Error('Invalid JSON response from AI');
    }

    const points: ExtractedPoint[] = parsedResult.points || parsedResult.items || parsedResult;
    
    console.log(`Extracted ${points.length} negative points`);

    return new Response(
      JSON.stringify({ points }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-negative-points:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});