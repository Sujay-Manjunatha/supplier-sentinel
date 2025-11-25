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
  severity: 'critical' | 'medium' | 'low';
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
    const systemPrompt = `You are an expert compliance analyst specializing in supplier code comparison. Your task is to:

1. Analyze both supplier codes semantically (meaning-based, NOT word-for-word)
2. Identify key requirements and topics in both documents
3. Find gaps where the customer's code has requirements that are missing, weaker, or significantly different from the baseline
4. Classify each gap by severity:
   - CRITICAL: Legal/regulatory issues, major liability risks, fundamental ethical violations
   - MEDIUM: Important operational or ethical concerns that need attention
   - LOW: Minor differences or areas for improvement

For each gap found, provide:
- The section/topic name
- The problematic text from customer's document
- The corresponding reference from baseline
- A clear recommendation
- Severity classification with brief explanation

Focus on substantive differences in meaning and requirements, not minor wording variations.`;

    const userPrompt = `Compare these two supplier codes and identify gaps:

BASELINE SUPPLIER CODE (Our Reference):
${baselineContent}

CUSTOMER SUPPLIER CODE (To Compare):
${comparisonContent}

Provide a comprehensive gap analysis in JSON format with this structure:
{
  "overallCompliance": <percentage 0-100>,
  "gaps": [
    {
      "section": "Section name",
      "customerText": "Text from customer code",
      "baselineText": "Text from baseline code",
      "recommendation": "How to address this gap",
      "severity": "critical|medium|low",
      "explanation": "Brief explanation of why this is an issue"
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
    const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
    const mediumGaps = gaps.filter(g => g.severity === 'medium').length;
    const lowGaps = gaps.filter(g => g.severity === 'low').length;

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
