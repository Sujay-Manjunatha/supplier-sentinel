/**
 * localStorage-based persistence for Foundation Documents (CoC + Auxiliary).
 * Keyed per user so different accounts on the same browser stay isolated.
 */

export interface StoredDocument {
  id: string;
  fileName: string;
  fileSize: number;
  content: string;          // extracted text
  createdAt: string;        // ISO date string
}

export interface FoundationStore {
  codeOfConduct: StoredDocument | null;
  auxiliary: StoredDocument[];
}

const STORAGE_KEY_PREFIX = 'foundation_docs_';

const getKey = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

const emptyStore = (): FoundationStore => ({
  codeOfConduct: null,
  auxiliary: [],
});

const generateId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ─── Read ───

export function getFoundationStore(userId: string): FoundationStore {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return emptyStore();
    return JSON.parse(raw) as FoundationStore;
  } catch {
    return emptyStore();
  }
}

// ─── Write (internal) ───

function saveStore(userId: string, store: FoundationStore) {
  localStorage.setItem(getKey(userId), JSON.stringify(store));
}

// ─── Code of Conduct ───

export function saveCodeOfConduct(
  userId: string,
  fileName: string,
  fileSize: number,
  content: string,
): StoredDocument {
  const store = getFoundationStore(userId);
  const doc: StoredDocument = {
    id: generateId(),
    fileName,
    fileSize,
    content,
    createdAt: new Date().toISOString(),
  };
  store.codeOfConduct = doc;
  saveStore(userId, store);
  return doc;
}

export function deleteCodeOfConduct(userId: string) {
  const store = getFoundationStore(userId);
  store.codeOfConduct = null;
  // Cascade: remove all auxiliary docs when CoC is deleted
  store.auxiliary = [];
  saveStore(userId, store);
}

// ─── Auxiliary Documents ───

export function addAuxiliaryDocument(
  userId: string,
  fileName: string,
  fileSize: number,
  content: string,
): StoredDocument {
  const store = getFoundationStore(userId);
  const doc: StoredDocument = {
    id: generateId(),
    fileName,
    fileSize,
    content,
    createdAt: new Date().toISOString(),
  };
  store.auxiliary.push(doc);
  saveStore(userId, store);
  return doc;
}

export function deleteAuxiliaryDocument(userId: string, docId: string) {
  const store = getFoundationStore(userId);
  store.auxiliary = store.auxiliary.filter(d => d.id !== docId);
  saveStore(userId, store);
}
