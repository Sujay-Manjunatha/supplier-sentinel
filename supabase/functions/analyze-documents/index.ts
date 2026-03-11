import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Finding {
  match_type: 'CONFLICT' | 'NO_CONFLICT' | 'PARTIAL' | 'UNCLEAR';
  should_flag: boolean;
  confidence_score: number;
  document_location: string;
  excerpt: string;
  reasoning: string;
}

interface AnalysisResult {
  negative_point: string;
  analysis: {
    intent: string;
    polarity: string;
    core_concept: string;
  };
  findings: Finding[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, negativeListItems, documentType, ownCodeOfConduct, auxiliaryDocuments } = await req.json();
    console.log('Starting document analysis...');
    console.log('Document type:', documentType);
    console.log('Negative list items count:', negativeListItems?.length || 0);
    console.log('Own CoC provided:', !!ownCodeOfConduct);
    console.log('Auxiliary docs count:', auxiliaryDocuments?.length || 0);

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const systemPrompt = `Du bist ein sorgfältiger Vertragsjurist, nicht eine reine Schlagwortsuche.

ZIEL: Finde nur die Stellen im Kundendokument, an denen der Inhalt der Negativliste widerspricht oder sie nicht erfüllt.
KONTEXT: Du erhältst ggf. den eigenen Verhaltenskodex des Nutzers und ergänzende Dokumente. Nutze diese als Referenz, um die Position des Nutzers besser zu verstehen und Konflikte präziser zu erkennen.
WICHTIG: Flagge NICHT die Stellen, an denen das Kundendokument die gleiche Position wie der Nutzer einnimmt.

ANALYSE-PROZESS:

1. INTENT & POLARITY DES NEGATIVPUNKTS
Für jeden Negativpunkt bestimme:
- Intent: Was will der Nutzer inhaltlich?
- Polarity:
  * NEGATIVE_VETO → "Wir akzeptieren X nicht", "Keine X", "X ist unzulässig"
  * POSITIVE_REQUIREMENT → "Wir verlangen X", "X muss enthalten sein"
  * CONDITIONAL → "Nur unter Bedingung Y"
- Kernkonzept(e): Hauptthemen extrahieren
- Synonyme: 3-5 sinnvolle Varianten als Keywords

2. RELEVANTE TEXTSTELLEN FINDEN
- Suche alle Abschnitte mit Kernkonzepten oder Synonymen
- Hole Kontext: 2-3 Sätze vor und nach der Fundstelle
- Arbeite mit vollständigen Sätzen, nicht nur Wörtern

3. INTENT-DIRECTION CHECK (KRITISCH!)
Für jede gefundene Passage:
- Teilt das Dokument die Position des Nutzers?
  → Gleiche Richtung → KEIN Konflikt, NICHT flaggen!
  Beispiel: Negativpunkt "Wir akzeptieren keine Vertragsstrafen" 
           + Dokument "Vertragsstrafen sind unzulässig"
           → NO_CONFLICT

- Oder vertritt das Dokument die Gegenposition?
  → Gegensätzliche Richtung → Konflikt, flaggen!
  Beispiel: Negativpunkt "Wir akzeptieren keine Vertragsstrafen"
           + Dokument "Der Anbieter kann Vertragsstrafen verhängen"
           → CONFLICT

Polarity-Marker für Ablehnung/Verbot: "nicht zulässig", "unzulässig", "ist verboten", "darf nicht", "wird ausgeschlossen", "wird nicht akzeptiert"
Polarity-Marker für Erlaubnis/Verpflichtung: "ist zulässig", "ist erlaubt", "darf", "kann", "ist berechtigt", "hat das Recht", "muss"

4. KONFIDENZ-SCORE & FLAGGING
Für jedes (Negativpunkt, Dokumentpassage)-Paar:
- Semantische Relevanz: Thema wirklich getroffen?
- Intent-Richtung: Konflikt oder gleiche Position?
- Konfidenz-Score 0-100:
  * Hohe Nähe + klarer Konflikt → > 80
  * Unklare/gemischte Aussagen → 40-70
  * Nur lose Erwähnung → < 40

FLAGGING-REGEL (should_flag = true NUR wenn):
- Kernkonzept wirklich getroffen UND
- Intent/Richtung im Konflikt UND
- Konfidenz ≥ 75

5. FALSE POSITIVES VERMEIDEN
- Wenn Negativpunkt und Dokument inhaltlich dieselbe Richtung haben → niemals als Konflikt flaggen
- Wenn Dokument nur erklärt was allgemein üblich ist → kein Konflikt
- Bei Unsicherheit (Score 50-75) → match_type = "UNCLEAR", should_flag = false
- Keine rein keyword-basierten Flags ohne Kontextprüfung

OUTPUT-FORMAT:
JSON mit detaillierter Analyse pro Negativpunkt.`;

    const negativeListText = negativeListItems && negativeListItems.length > 0
      ? negativeListItems.map((item: any, index: number) => 
          `${index + 1}. [${item.category}] ${item.title}\n   ${item.description}`
        ).join('\n\n')
      : 'Keine Negativpunkte definiert';

    const ownCoCSection = ownCodeOfConduct
      ? `EIGENER VERHALTENSKODEX (Referenzdokument des Nutzers):
${ownCodeOfConduct}

---

`
      : '';

    const auxSection = auxiliaryDocuments && auxiliaryDocuments.length > 0
      ? `ERGÄNZENDE DOKUMENTE DES NUTZERS (Richtlinien, Leitfäden, Compliance-Material):
${auxiliaryDocuments.map((doc: string, i: number) => `--- Dokument ${i + 1} ---\n${doc}`).join('\n\n')}

---

`
      : '';

    const userPrompt = `NEGATIVLISTE (Punkte die NICHT akzeptiert werden):
${negativeListText}

---

${ownCoCSection}${auxSection}KUNDENDOKUMENT (${documentType === 'supplier_code' ? 'Lieferantenkodex' : 'NDA/Geheimhaltung'}):
${documentContent}

---

Analysiere das Kundendokument gemäß dem beschriebenen Prozess.
Gib das Ergebnis als JSON zurück mit der Struktur:
{
  "results": [
    {
      "negative_point": "Originaltext des Negativpunkts",
      "analysis": {
        "intent": "ABLEHNUNG | ANFORDERUNG | CONDITIONAL",
        "polarity": "NEGATIVE | POSITIVE | NEUTRAL",
        "core_concept": "kurze Beschreibung"
      },
      "findings": [
        {
          "match_type": "CONFLICT | NO_CONFLICT | PARTIAL | UNCLEAR",
          "should_flag": true/false,
          "confidence_score": 0-100,
          "document_location": "§X.Y oder Abschnitt-Referenz",
          "excerpt": "relevante Passage (einige Sätze)",
          "reasoning": "1-2 Sätze Begründung"
        }
      ]
    }
  ]
}

WICHTIG: Flagge nur tatsächliche Konflikte (should_flag=true). Wenn Dokument und Negativpunkt die gleiche Position vertreten, setze match_type="NO_CONFLICT" und should_flag=false.`;

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
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Gemini API error: ${response.status}`);
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

    const results = parsedResult.results || parsedResult;
    
    if (!Array.isArray(results)) {
      console.error('Expected array of results, got:', typeof results);
      throw new Error('Invalid response format from AI');
    }

    console.log(`Analysis complete. Found ${results.length} negative points analyzed`);

    // Convert findings to gap format, filtering by should_flag
    const gaps: any[] = [];
    
    results.forEach((result: AnalysisResult) => {
      result.findings.forEach((finding: Finding) => {
        // Only include findings that should be flagged
        if (finding.should_flag) {
          gaps.push({
            section: finding.document_location,
            customerText: finding.excerpt,
            gapType: 'negative_match',
            severity: finding.confidence_score >= 85 ? 'KRITISCH' : finding.confidence_score >= 75 ? 'MITTEL' : 'GERING',
            aiRecommendation: finding.match_type === 'CONFLICT' ? 'ABLEHNEN' : 'PRÜFEN',
            reasoning: finding.reasoning,
            matchedNegativePoint: {
              title: result.negative_point,
              description: `Intent: ${result.analysis.intent}, Polarity: ${result.analysis.polarity}`
            },
            matchConfidence: finding.confidence_score >= 85 ? 'HOCH' : finding.confidence_score >= 75 ? 'MITTEL' : 'NIEDRIG',
            ownCodexCoverage: result.analysis.core_concept,
            risksIfAccepted: `Match Type: ${finding.match_type}, Score: ${finding.confidence_score}`
          });
        }
      });
    });

    console.log(`Flagged ${gaps.length} conflicts after filtering`);

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