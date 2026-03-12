/**
 * Gemini API wrapper.
 * Routes calls through the turnus-main-app backend proxy (VITE_GEMINI_PROXY_URL)
 * so the API key stays server-side and quota is shared with the turnus account.
 * Falls back to direct browser calls if the proxy URL is not configured.
 */

// Proxy: turnus backend — set VITE_GEMINI_PROXY_URL=http://localhost:8000/api/v1/gemini/generate
const GEMINI_PROXY_URL = import.meta.env.VITE_GEMINI_PROXY_URL as string | undefined;

// Direct fallback — only used when proxy is not configured
// gemini-2.5-flash-lite: 1500 RPD free tier (same model turnus uses for Excel)
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash-lite';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error('VITE_GEMINI_API_KEY is not set in .env');
  return key;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Strip markdown code fences and parse JSON safely. */
function parseJSON(raw: string): unknown {
  // Remove ```json ... ``` or ``` ... ``` wrappers Gemini sometimes adds
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Last resort: find the first { or [ and parse from there
    const start = stripped.search(/[\[{]/);
    if (start !== -1) return JSON.parse(stripped.slice(start));
    throw new SyntaxError(`Could not parse Gemini response as JSON:\n${raw.substring(0, 200)}`);
  }
}

/** Route through turnus proxy or fall back to direct Gemini call. */
async function chatCompletion(
  messages: { role: string; content: string }[],
  opts: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
  } = {},
): Promise<string> {
  if (GEMINI_PROXY_URL) {
    return chatCompletionViaProxy(messages, opts);
  }
  return chatCompletionDirect(messages, opts);
}

/** Call via turnus-main-app Gemini proxy (server-side key, higher quota). */
async function chatCompletionViaProxy(
  messages: { role: string; content: string }[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  let delay = 5000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(GEMINI_PROXY_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        json_mode: opts.json ?? false,
        temperature: opts.temperature ?? null,
      }),
    });

    if (res.status === 429) {
      if (attempt === 3) throw new Error('The API is currently busy. Please wait a minute and try again.');
      console.warn(`Proxy rate limited, retrying in ${delay / 1000}s…`);
      await sleep(delay);
      delay *= 2;
      continue;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini proxy error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.text as string;
  }
  throw new Error('Max retries exceeded');
}

/** Direct browser → Gemini API call (fallback when proxy not configured). */
async function chatCompletionDirect(
  messages: { role: string; content: string }[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const contents = nonSystem.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };

  const generationConfig: Record<string, unknown> = {};
  if (opts.json) generationConfig.responseMimeType = 'application/json';
  if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) generationConfig.maxOutputTokens = opts.maxTokens;
  if (Object.keys(generationConfig).length) body.generationConfig = generationConfig;

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${getApiKey()}`;

  let delay = 5000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      let errBody: any = {};
      try { errBody = await res.clone().json(); } catch { /* ignore */ }
      const errMsg: string = errBody?.error?.message || '';
      const isQuotaExhausted =
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('exceeded your') ||
        errBody?.error?.status === 'RESOURCE_EXHAUSTED';

      if (isQuotaExhausted) {
        throw new Error(
          'Your Gemini API quota has been exceeded. You can check your usage and quota limits at https://ai.google.dev — free-tier accounts reset daily.'
        );
      }

      if (attempt === 3) throw new Error('The API is currently busy. Please wait a minute and try again.');
      console.warn(`Rate limited, retrying in ${delay / 1000}s…`);
      await sleep(delay);
      delay *= 2;
      continue;
    }

    if (!res.ok) {
      let errBody: any = {};
      try { errBody = await res.clone().json(); } catch { /* ignore */ }
      const errMsg: string = errBody?.error?.message || '';
      console.error('Gemini API error:', res.status, errMsg || res.statusText);
      if (res.status === 403) {
        throw new Error('API key is invalid or does not have access to Gemini. Please check your VITE_GEMINI_API_KEY.');
      }
      throw new Error(errMsg || `Gemini API error ${res.status}`);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('Max retries exceeded');
}

// ────────────────────────────────────────────────────────────────────────────
// 1. extract-negative-points
// ────────────────────────────────────────────────────────────────────────────

export interface ExtractedPoint {
  title: string;
  description: string;
  category: string;
}

export async function extractNegativePoints(
  content: string,
  documentType: 'supplier_code' | 'nda',
): Promise<{ points: ExtractedPoint[] }> {
  const systemPrompt = `You are an expert in compliance document analysis.

TASK:
Analyze the following document and extract ALL individual points/requirements/clauses that are formulated as "no-go" criteria or critical requirements.

For each point found, create an object with:
- title: Short, concise summary (max. 60 characters)
- description: The full text of the point from the document
- category: Appropriate category based on the content

CATEGORIES for Supplier Code:
- Arbeitsbedingungen
- Arbeitszeit
- Vergütung
- Gesundheit und Sicherheit
- Umweltschutz
- Ethik und Compliance
- Haftung
- Kündigung
- Sonstiges

CATEGORIES for NDA/Confidentiality:
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

Return the result as a JSON array.`;

  const userPrompt = `Document type: ${documentType === 'supplier_code' ? 'Supplier Code of Conduct' : 'NDA / Confidentiality Agreement'}

Document content:
${content}

Extract all relevant points and return them as a JSON array.`;

  const raw = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { json: true },
  );

  const parsed = parseJSON(raw) as any;
  const points: ExtractedPoint[] = parsed.points || parsed.items || parsed;
  return { points };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. detect-document-type
// ────────────────────────────────────────────────────────────────────────────

export async function detectDocumentType(
  content: string,
): Promise<{ documentType: 'supplier_code' | 'nda' }> {
  const systemPrompt = `You are an expert in business document analysis.

Analyze the following document and determine which of these document types it is:

1. "supplier_code" - Supplier Code of Conduct
   Characteristics: ESG topics, compliance, working conditions, environmental protection, social standards, human rights,
   anti-corruption, business ethics, supply chain, sustainable procurement

2. "nda" - Non-Disclosure Agreement (NDA)
   Characteristics: confidentiality, trade secrets, information protection, confidential information,
   non-disclosure obligations, return obligations, contract duration, penalties

Respond ONLY with one of these two values: "supplier_code" or "nda"

If both characteristics appear or uncertain: choose the dominant type.`;

  const raw = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyze this document:\n\n${content.substring(0, 3000)}`,
      },
    ],
    { temperature: 0.1 },
  );

  const documentType = raw.trim().toLowerCase().includes('nda')
    ? 'nda'
    : 'supplier_code';
  return { documentType };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. analyze-documents
// ────────────────────────────────────────────────────────────────────────────

interface NegativeListItem {
  category: string;
  title: string;
  description: string;
}

export interface AnalysisGap {
  section: string;
  customerText: string;
  gapType: string;
  severity: string;
  aiRecommendation: string;
  reasoning: string;
  matchedNegativePoint: { title: string; description: string };
  matchConfidence: string;
  ownCodexCoverage: string;
  risksIfAccepted: string;
}

export interface AnalysisResultData {
  totalGaps: number;
  criticalGaps: number;
  mediumGaps: number;
  lowGaps: number;
  gaps: AnalysisGap[];
}

const BATCH_SIZE = 30; // gemini-2.5-flash supports 65K output tokens — no need to over-batch

async function analyzeDocumentsBatch(params: {
  documentContent: string;
  negativeListItems: NegativeListItem[];
  documentType: 'supplier_code' | 'nda';
  ownCodeOfConduct?: string | null;
  auxiliaryDocuments?: string[];
}): Promise<unknown[]> {
  const {
    documentContent,
    negativeListItems,
    documentType,
    ownCodeOfConduct,
    auxiliaryDocuments,
  } = params;

  const systemPrompt = `You are a careful contract lawyer, not a keyword search engine.

GOAL: Find only the places in the customer document where the content contradicts or fails to meet the negative list.
CONTEXT: You may receive the user's own Code of Conduct and supplementary documents. Use these as reference to better understand the user's position and identify conflicts more precisely.
IMPORTANT: Do NOT flag places where the customer document takes the same position as the user.

ANALYSIS PROCESS:

1. INTENT & POLARITY OF THE NEGATIVE POINT
For each negative point determine:
- Intent: What does the user want?
- Polarity:
  * NEGATIVE_VETO → "We do not accept X", "No X", "X is not permitted"
  * POSITIVE_REQUIREMENT → "We require X", "X must be included"
  * CONDITIONAL → "Only under condition Y"
- Core concept(s): Extract main topics
- Synonyms: 3-5 meaningful variants as keywords

2. FIND RELEVANT TEXT PASSAGES
- Search all sections with core concepts or synonyms
- Get context: 2-3 sentences before and after the finding
- Work with complete sentences, not just words

3. INTENT-DIRECTION CHECK (CRITICAL!)
For each found passage:
- Does the document share the user's position?
  → Same direction → NO conflict, do NOT flag!
  Example: Negative point "We do not accept penalties"
           + Document "Penalties are not permitted"
           → NO_CONFLICT

- Or does the document take the opposing position?
  → Opposing direction → Conflict, flag!
  Example: Negative point "We do not accept penalties"
           + Document "The provider may impose penalties"
           → CONFLICT

Polarity markers for rejection/prohibition: "not permitted", "not allowed", "is prohibited", "may not", "is excluded", "is not accepted"
Polarity markers for permission/obligation: "is permitted", "is allowed", "may", "can", "is entitled", "has the right", "must"

4. CONFIDENCE SCORE & FLAGGING
For each (negative point, document passage) pair:
- Semantic relevance: Is the topic actually addressed?
- Intent direction: Conflict or same position?
- Confidence score 0-100:
  * High relevance + clear conflict → > 80
  * Unclear/mixed statements → 40-70
  * Only loose mention → < 40

FLAGGING RULE (should_flag = true ONLY when):
- Core concept truly addressed AND
- Intent/direction in conflict AND
- Confidence ≥ 75

5. AVOID FALSE POSITIVES
- If negative point and document have the same direction → never flag as conflict
- If document only explains what is generally common practice → no conflict
- If uncertain (score 50-75) → match_type = "UNCLEAR", should_flag = false
- No purely keyword-based flags without context check

OUTPUT FORMAT:
JSON with detailed analysis per negative point.`;

  const negativeListText =
    negativeListItems && negativeListItems.length > 0
      ? negativeListItems
          .map(
            (item, index) =>
              `${index + 1}. [${item.category}] ${item.title}\n   ${item.description}`,
          )
          .join('\n\n')
      : 'No negative points defined';

  const ownCoCSection = ownCodeOfConduct
    ? `USER'S OWN CODE OF CONDUCT (reference document):\n${ownCodeOfConduct}\n\n---\n\n`
    : '';

  const auxSection =
    auxiliaryDocuments && auxiliaryDocuments.length > 0
      ? `USER'S SUPPLEMENTARY DOCUMENTS (policies, guidelines, compliance material):\n${auxiliaryDocuments.map((doc, i) => `--- Document ${i + 1} ---\n${doc}`).join('\n\n')}\n\n---\n\n`
      : '';

  const userPrompt = `NEGATIVE LIST (points that are NOT accepted):
${negativeListText}

---

${ownCoCSection}${auxSection}CUSTOMER DOCUMENT (${documentType === 'supplier_code' ? 'Supplier Code of Conduct' : 'NDA / Confidentiality Agreement'}):
${documentContent}

---

Analyze the customer document according to the described process.
Return the result as JSON with this structure:
{
  "results": [
    {
      "negative_point": "original text of the negative point",
      "analysis": {
        "intent": "REJECTION | REQUIREMENT | CONDITIONAL",
        "polarity": "NEGATIVE | POSITIVE | NEUTRAL",
        "core_concept": "short description"
      },
      "findings": [
        {
          "match_type": "CONFLICT | NO_CONFLICT | PARTIAL | UNCLEAR",
          "should_flag": true/false,
          "confidence_score": 0-100,
          "document_location": "§X.Y or section reference",
          "excerpt": "relevant passage (a few sentences)",
          "reasoning": "1-2 sentence explanation in English"
        }
      ]
    }
  ]
}

IMPORTANT: Only flag actual conflicts (should_flag=true). If the document and the negative point take the same position, set match_type="NO_CONFLICT" and should_flag=false.`;

  const raw = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { json: true },
  );

  const parsed = parseJSON(raw) as any;
  const results = parsed.results || parsed;

  if (!Array.isArray(results)) {
    throw new Error('Invalid response format from AI');
  }

  return results;
}

export async function analyzeDocuments(params: {
  documentContent: string;
  negativeListItems: NegativeListItem[];
  documentType: 'supplier_code' | 'nda';
  ownCodeOfConduct?: string | null;
  auxiliaryDocuments?: string[];
}): Promise<AnalysisResultData> {
  const { negativeListItems, ...rest } = params;

  // Batch negative points to keep individual requests manageable
  const batches: NegativeListItem[][] = [];
  for (let i = 0; i < negativeListItems.length; i += BATCH_SIZE) {
    batches.push(negativeListItems.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map(batch => analyzeDocumentsBatch({ ...rest, negativeListItems: batch }))
  );
  const allResults: unknown[] = batchResults.flat();

  // Convert findings to gap format
  const gaps: AnalysisGap[] = [];

  for (const result of allResults as {
    negative_point: string;
    analysis: { intent: string; polarity: string; core_concept: string };
    findings: {
      should_flag: boolean;
      match_type: string;
      confidence_score: number;
      document_location: string;
      excerpt: string;
      reasoning: string;
    }[];
  }[]) {
    for (const finding of result.findings) {
      if (finding.should_flag) {
        gaps.push({
          section: finding.document_location,
          customerText: finding.excerpt,
          gapType: 'negative_match',
          severity:
            finding.confidence_score >= 85
              ? 'KRITISCH'
              : finding.confidence_score >= 75
                ? 'MITTEL'
                : 'GERING',
          aiRecommendation:
            finding.match_type === 'CONFLICT' ? 'REJECT' : 'REVIEW',
          reasoning: finding.reasoning,
          matchedNegativePoint: {
            title: result.negative_point,
            description: `Intent: ${result.analysis.intent}, Polarity: ${result.analysis.polarity}`,
          },
          matchConfidence:
            finding.confidence_score >= 85
              ? 'HOCH'
              : finding.confidence_score >= 75
                ? 'MITTEL'
                : 'NIEDRIG',
          ownCodexCoverage: result.analysis.core_concept,
          risksIfAccepted: `Match Type: ${finding.match_type}, Score: ${finding.confidence_score}`,
        });
      }
    }
  }

  const criticalGaps = gaps.filter((g) => g.severity === 'KRITISCH').length;
  const mediumGaps = gaps.filter((g) => g.severity === 'MITTEL').length;
  const lowGaps = gaps.filter((g) => g.severity === 'GERING').length;

  return {
    totalGaps: gaps.length,
    criticalGaps,
    mediumGaps,
    lowGaps,
    gaps,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. scan-for-cautions (proactive risk scan outside negative list)
// ────────────────────────────────────────────────────────────────────────────

export interface CautionItem {
  topic: string;
  section: string;
  excerpt: string;
  reason: string;
  suggestedTitle: string;
  suggestedDescription: string;
  severity?: 'KRITISCH' | 'MITTEL' | 'GERING';
}

export async function scanForCautions(
  documentContent: string,
  documentType: 'supplier_code' | 'nda',
): Promise<{ cautions: CautionItem[] }> {
  const systemPrompt = `You are an experienced contract lawyer helping suppliers with risk review.

TASK: Analyze the document and identify clauses that are problematic or unusual for the supplier — even if they are NOT in a negative list.

Look for:
- Unusually broad obligations or one-sided customer rights
- Audit or control rights without clear limits
- IP transfer or broad license clauses
- Liability risks or unclear liability allocation
- Data sharing with third parties
- Requirements going beyond legal minimum standards
- Automatic renewals or hard-to-exit commitments
- Jurisdiction or applicable law that is unfavorable for the supplier

Return a maximum of 8 of the most important points.

OUTPUT as JSON:
{
  "cautions": [
    {
      "topic": "Short topic (max 50 characters)",
      "section": "Section/paragraph reference",
      "excerpt": "Relevant text passage (1-3 sentences)",
      "reason": "Why this is relevant/risky for the supplier (1-2 sentences)",
      "suggestedTitle": "Short title for negative list entry",
      "suggestedDescription": "Description: We do not accept X / We require Y...",
      "severity": "KRITISCH | MITTEL | GERING"
    }
  ]
}`;

  const userPrompt = `Document type: ${documentType === 'supplier_code' ? 'Supplier Code of Conduct' : 'NDA / Confidentiality Agreement'}

Document:
${documentContent.substring(0, 8000)}

Identify the most important risk points for the supplier.`;

  const raw = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { json: true },
  );

  const parsed = parseJSON(raw) as any;
  return { cautions: parsed.cautions || [] };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. extract-company-name
// ────────────────────────────────────────────────────────────────────────────

export async function extractCompanyName(
  documentContent: string,
): Promise<{ companyName: string }> {
  const systemPrompt = `You are an AI assistant that extracts company names from documents.

Task:
- Analyze the document and find the name of the company/customer
- Return ONLY the company name, without additional explanations
- If multiple names appear, choose the main company/customer name
- If no clear name is found, respond with "Unknown Company"`;

  const userPrompt = `Extract the company name from this document:\n\n${documentContent}\n\nCompany name:`;

  const raw = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.3 },
  );

  return { companyName: raw.trim() };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. generate-email
// ────────────────────────────────────────────────────────────────────────────

interface RejectedGap {
  section: string;
  customerText: string;
  reasoning: string;
  severity: string;
  externalComment?: string;
}

export async function generateEmail(
  rejectedGaps: RejectedGap[],
): Promise<{ emailTemplate: string }> {
  const systemPrompt = `You are a professional business communication expert writing on behalf of a supplier.

TASK:
Write a SHORT, DIRECT email in English to a customer explaining which points in their document we cannot accept.

STRUCTURE (EXACTLY AS FOLLOWS):
1. "Dear [Customer],"
2. One line: "We are unable to accept the following points in your document:"
3. Bullet list of rejected points.
4. "Thank you for your understanding."
5. "Kind regards,"
6. "[Your Name]"

HOW TO HANDLE EACH BULLET POINT:
- Start with: "• [Section reference]: [brief description of the clause]"
- If a <reason> tag is present: add ONE professional business sentence on the next line explaining our position. This sentence must be written in formal, professional language — completely rewritten from the raw note. NEVER copy the raw note text.

EXAMPLE INPUT:
• §4.2 Audit Rights: Customer may perform unannounced audits at any time without restriction.
  <reason>we do not accept audits</reason>

EXAMPLE OUTPUT:
• §4.2 Audit Rights: Customer may perform unannounced audits at any time without restriction.
  We are unable to accept unrestricted audit rights, as this would place a disproportionate operational burden on our organisation.

RULES:
- The <reason> tag is a private internal note — NEVER include it or its raw text in the output
- Always rewrite into a formal, third-person or first-person-plural business statement
- Keep each bullet and its sentence concise (max 2 lines per point)`;

  const rejectedGapsText = rejectedGaps
    .map((gap) => {
      const line = `• ${gap.section}: ${gap.customerText}`;
      return gap.externalComment
        ? `${line}\n  <reason>${gap.externalComment}</reason>`
        : line;
    })
    .join('\n\n');

  const userPrompt = `Generate the email for the following rejected points:\n\n${rejectedGapsText}`;

  const raw = await chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return { emailTemplate: raw };
}
