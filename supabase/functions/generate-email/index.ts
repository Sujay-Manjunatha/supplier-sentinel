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

    const systemPrompt = `Du bist ein professioneller Business-Korrespondenz-Experte.
    
Erstelle eine höfliche, professionelle Email-Vorlage auf Deutsch für einen Lieferanten, der bestimmte Anforderungen aus dem Lieferantenkodex eines Kunden nicht akzeptieren kann.

WICHTIGE RICHTLINIEN:
- Höflicher, respektvoller Ton
- Wertschätzung der Geschäftsbeziehung
- Klare, aber diplomatische Formulierungen
- Konstruktiver Ansatz mit Dialogbereitschaft
- Professionelle Geschäftssprache

STRUKTUR:
1. Höfliche Anrede (generisch: "Sehr geehrte Damen und Herren")
2. Bezug auf den erhaltenen Lieferantenkodex
3. Auflistung der Punkte, die nicht akzeptiert werden können (mit kurzer, sachlicher Begründung)
4. Angebot zur weiteren Diskussion und gemeinsamen Lösungsfindung
5. Positive Betonung der weiteren Zusammenarbeit
6. Professioneller Abschluss

Die Email sollte komplett sein und direkt verwendbar.`;

    const userPrompt = `Erstelle eine professionelle Email-Vorlage für folgende abgelehnte Punkte:

${rejectedGaps.map((gap: RejectedGap, index: number) => `
${index + 1}. ${gap.section} (Schweregrad: ${gap.severity})
Kundenanforderung: ${gap.customerText}
Grund der Ablehnung: ${gap.reasoning}
`).join('\n')}

Die Email soll höflich erklären, dass wir als Lieferant diese Punkte nicht akzeptieren können, und Bereitschaft zur Diskussion signalisieren.`;

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
        temperature: 0.7,
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
