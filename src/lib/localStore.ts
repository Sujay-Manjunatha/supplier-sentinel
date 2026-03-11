/**
 * localStorage-based persistence replacing all Supabase DB tables.
 * Single-user — all data is stored under a fixed LOCAL_USER_ID.
 */

export const LOCAL_USER_ID = 'local';

const generateId = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ─── negative_list_items ─────────────────────────────────────────────────────

export interface NegativeListItem {
  id: string;
  user_id: string;
  document_type: 'supplier_code' | 'nda';
  title: string;
  description: string;
  category: string;
  source?: 'manual' | 'ai_generated' | 'review';
  created_at: string;
  updated_at: string;
}

const NLI_KEY = 'negative_list_items';

function getNLI(): NegativeListItem[] {
  try { return JSON.parse(localStorage.getItem(NLI_KEY) || '[]'); } catch { return []; }
}
function saveNLI(items: NegativeListItem[]) {
  localStorage.setItem(NLI_KEY, JSON.stringify(items));
}

export const negativeListStore = {
  getAll(documentType?: string): NegativeListItem[] {
    const items = getNLI();
    return documentType ? items.filter(i => i.document_type === documentType) : items;
  },
  count(documentType?: string): number {
    return this.getAll(documentType).length;
  },
  insert(items: Omit<NegativeListItem, 'id' | 'created_at' | 'updated_at'>[]): NegativeListItem[] {
    const all = getNLI();
    const now = new Date().toISOString();
    const newItems = items.map(i => ({ ...i, id: generateId(), created_at: now, updated_at: now }));
    saveNLI([...all, ...newItems]);
    return newItems;
  },
  update(id: string, updates: Partial<NegativeListItem>) {
    saveNLI(getNLI().map(i => i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i));
  },
  delete(id: string) {
    saveNLI(getNLI().filter(i => i.id !== id));
  },
  deleteByType(documentType: string) {
    saveNLI(getNLI().filter(i => i.document_type !== documentType));
  },
};

// ─── comparison_documents ─────────────────────────────────────────────────────

export interface ComparisonDocument {
  id: string;
  user_id: string;
  baseline_document_id: string;
  title: string;
  content: string;
  file_name: string;
  file_data_url?: string; // base64 data URL for in-browser PDF viewing
  created_at: string;
}

const CD_KEY = 'comparison_documents';

function getCD(): ComparisonDocument[] {
  try { return JSON.parse(localStorage.getItem(CD_KEY) || '[]'); } catch { return []; }
}

export const comparisonDocStore = {
  insert(doc: Omit<ComparisonDocument, 'id' | 'created_at'>): ComparisonDocument {
    const newDoc = { ...doc, id: generateId(), created_at: new Date().toISOString() };
    localStorage.setItem(CD_KEY, JSON.stringify([...getCD(), newDoc]));
    return newDoc;
  },
  getById(id: string): ComparisonDocument | null {
    return getCD().find(d => d.id === id) ?? null;
  },
};

// ─── gap_analyses ─────────────────────────────────────────────────────────────

export interface GapAnalysis {
  id: string;
  user_id: string;
  baseline_document_id: string;
  comparison_document_id: string;
  overall_compliance_percentage: number;
  total_gaps: number;
  critical_gaps: number;
  medium_gaps: number;
  low_gaps: number;
  gaps: any;
  caution_items?: any[];
  status?: string;
  document_type: string;
  created_at: string;
}

const GA_KEY = 'gap_analyses';

function getGA(): GapAnalysis[] {
  try { return JSON.parse(localStorage.getItem(GA_KEY) || '[]'); } catch { return []; }
}

export const gapAnalysisStore = {
  insert(analysis: Omit<GapAnalysis, 'id' | 'created_at'>): GapAnalysis {
    const newAnalysis = { ...analysis, id: generateId(), created_at: new Date().toISOString() };
    localStorage.setItem(GA_KEY, JSON.stringify([...getGA(), newAnalysis]));
    return newAnalysis;
  },
  getById(id: string): GapAnalysis | null {
    return getGA().find(a => a.id === id) ?? null;
  },
};

// ─── completed_evaluations ───────────────────────────────────────────────────

export interface CompletedEvaluation {
  id: string;
  user_id: string;
  comparison_document_id: string;
  customer_name: string;
  title: string;
  gaps: any[];
  decisions: Record<string, string>;
  email_template: string | null;
  overall_compliance: number;
  critical_gaps: number;
  medium_gaps: number;
  low_gaps: number;
  document_type?: string;
  completed_at: string;
  created_at: string;
}

const CE_KEY = 'completed_evaluations';

function getCE(): CompletedEvaluation[] {
  try { return JSON.parse(localStorage.getItem(CE_KEY) || '[]'); } catch { return []; }
}

export const completedEvaluationStore = {
  getAll(): CompletedEvaluation[] {
    return getCE().sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
  },
  insert(evaluation: Omit<CompletedEvaluation, 'id' | 'created_at' | 'completed_at'>): CompletedEvaluation {
    const now = new Date().toISOString();
    const newEval = { ...evaluation, id: generateId(), created_at: now, completed_at: now };
    localStorage.setItem(CE_KEY, JSON.stringify([...getCE(), newEval]));
    return newEval;
  },
  update(id: string, updates: Partial<Omit<CompletedEvaluation, 'id' | 'created_at'>>) {
    localStorage.setItem(CE_KEY, JSON.stringify(getCE().map(e => e.id === id ? { ...e, ...updates } : e)));
  },
  delete(id: string) {
    localStorage.setItem(CE_KEY, JSON.stringify(getCE().filter(e => e.id !== id)));
  },
};

// ─── draft email template (persists between phases) ──────────────────────────

const DRAFT_EMAIL_KEY = 'draft_email_template';

export const draftEmailStore = {
  save(template: string) {
    localStorage.setItem(DRAFT_EMAIL_KEY, template);
  },
  load(): string {
    return localStorage.getItem(DRAFT_EMAIL_KEY) ?? '';
  },
  clear() {
    localStorage.removeItem(DRAFT_EMAIL_KEY);
  },
};
