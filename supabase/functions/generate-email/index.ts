import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RejectedGap {
  section: string;
  customerText: string;
  reasoning: string;
  severity: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rejectedGaps } = await req.json();
    
    console.log('Generating email template for rejected gaps...');
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `Du bist ein professioneller Business-Kommunikationsexperte.

AUFGABE:
Erstelle eine KURZE, DIREKTE E-Mail auf Deutsch an einen Lieferanten.

STRUKTUR (EXAKT SO):
1. "Sehr geehrter Lieferant,"
2. Eine Zeile: "Folgende Punkte in Ihrem Dokument können wir nicht akzeptieren:"
3. Bullet-Liste der abgelehnten Punkte (NUR der Abschnitt und der Text, KEINE Begründung)
4. "Vielen Dank für Ihr Verständnis."
5. "Mit freundlichen Grüßen"
6. "[Ihr Name]"

WICHTIG:
- KEINE langen Erklärungen
- KEINE Begründungen
- NUR die Liste der Punkte
- Maximal 10 Zeilen insgesamt
- Direkt und sachlich`;

    const rejectedGapsText = rejectedGaps
      .map((gap: RejectedGap) => 
        `- ${gap.section}: ${gap.customerText}`
      )
      .join('\n');

    const userPrompt = `Erstelle eine KURZE E-Mail für folgende abgelehnte Punkte:

${rejectedGapsText}

Halte dich EXAKT an die vorgegebene Struktur. KEINE langen Erklärungen!`;

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
    const emailTemplate = data.choices[0].message.content;
    
    console.log('Email template generated successfully');

    return new Response(
      JSON.stringify({ emailTemplate }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in generate-email function:', error);
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