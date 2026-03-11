import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('Detecting document type for content length:', content.length);

    const systemPrompt = `Du bist ein Experte für die Analyse von Geschäftsdokumenten.

Analysiere das folgende Dokument und bestimme, ob es sich um einen der folgenden Dokumenttypen handelt:

1. "supplier_code" - Lieferantenkodex / Verhaltenskodex
   Merkmale: ESG-Themen, Compliance, Arbeitsbedingungen, Umweltschutz, Sozialstandards, Menschenrechte,
   Anti-Korruption, Geschäftsethik, Lieferkette, nachhaltige Beschaffung

2. "nda" - Geheimhaltungsvereinbarung (Non-Disclosure Agreement)
   Merkmale: Vertraulichkeit, Geschäftsgeheimnisse, Informationsschutz, vertrauliche Informationen,
   Geheimhaltungspflichten, Weitergabeverbot, Rückgabepflichten, Vertragslaufzeit, Sanktionen

Antworte NUR mit einem dieser beiden Werte: "supplier_code" oder "nda"

Wenn beide Merkmale vorkommen oder unsicher: Wähle den dominierenden Typ.`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analysiere dieses Dokument:\n\n${content.substring(0, 3000)}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const detectedType = data.choices[0].message.content.trim().toLowerCase();
    
    // Validate response
    const documentType = detectedType.includes('nda') ? 'nda' : 'supplier_code';
    
    console.log('Detected document type:', documentType);

    return new Response(
      JSON.stringify({ documentType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in detect-document-type:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
