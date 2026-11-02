export interface NotebookItem {
  id: string;
  sourceType: 'MOCK_TEST' | 'GA_QUIZ';
  sourceId: string;
  sourceTitle: string;
  section: string;
  passageText?: string;
  questionText: string;
  imageUrl?: string;
  solutionImageUrl?: string;
  options: string[];
  correctOptionIndex: number;
  userSelectedOption?: number;
  explanation?: string;
  isBookmarked: boolean;
  isMistake: boolean;
  personalNote: string;
  mastered: boolean;
  savedAt: string;
}

const STORAGE_KEY = 'bs_revision_notebook_v1';

export function getNotebookItems(): NotebookItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveNotebookItems(items: NotebookItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {}
}

export function toggleBookmarkQuestion(
  item: Omit<NotebookItem, 'isBookmarked' | 'isMistake' | 'personalNote' | 'mastered' | 'savedAt'>
): { items: NotebookItem[]; isNowBookmarked: boolean } {
  const current = getNotebookItems();
  const existingIdx = current.findIndex((x) => x.id === item.id);

  if (existingIdx !== -1) {
    const existing = current[existingIdx];
    const nextBookmarked = !existing.isBookmarked;
    // If neither bookmarked nor a mistake and has no note, remove it cleanly
    if (!nextBookmarked && !existing.isMistake && !existing.personalNote.trim()) {
      const updated = current.filter((_, i) => i !== existingIdx);
      saveNotebookItems(updated);
      return { items: updated, isNowBookmarked: false };
    }
    const updated = [...current];
    updated[existingIdx] = {
      ...existing,
      ...item,
      isBookmarked: nextBookmarked,
    };
    saveNotebookItems(updated);
    return { items: updated, isNowBookmarked: nextBookmarked };
  } else {
    const newItem: NotebookItem = {
      ...item,
      isBookmarked: true,
      isMistake: false,
      personalNote: '',
      mastered: false,
      savedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...current];
    saveNotebookItems(updated);
    return { items: updated, isNowBookmarked: true };
  }
}

export function recordMistakeQuestions(
  mistakes: Omit<NotebookItem, 'isBookmarked' | 'isMistake' | 'personalNote' | 'mastered' | 'savedAt'>[]
): NotebookItem[] {
  if (!mistakes.length) return getNotebookItems();
  const current = getNotebookItems();
  const map = new Map<string, NotebookItem>();
  current.forEach((item) => map.set(item.id, item));

  mistakes.forEach((m) => {
    const existing = map.get(m.id);
    if (existing) {
      map.set(m.id, {
        ...existing,
        ...m,
        isMistake: true,
        mastered: false,
        savedAt: new Date().toISOString(),
      });
    } else {
      map.set(m.id, {
        ...m,
        isBookmarked: false,
        isMistake: true,
        personalNote: '',
        mastered: false,
        savedAt: new Date().toISOString(),
      });
    }
  });

  const updated = Array.from(map.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
  saveNotebookItems(updated);
  return updated;
}

export function updateNotebookNote(id: string, note: string, fallbackItem?: Omit<NotebookItem, 'isBookmarked' | 'isMistake' | 'personalNote' | 'mastered' | 'savedAt'>): NotebookItem[] {
  const current = getNotebookItems();
  const idx = current.findIndex((x) => x.id === id);

  if (idx !== -1) {
    const updated = [...current];
    updated[idx] = { ...updated[idx], personalNote: note };
    saveNotebookItems(updated);
    return updated;
  } else if (fallbackItem && note.trim()) {
    const newItem: NotebookItem = {
      ...fallbackItem,
      isBookmarked: true,
      isMistake: false,
      personalNote: note,
      mastered: false,
      savedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...current];
    saveNotebookItems(updated);
    return updated;
  }
  return current;
}

export function toggleMasteredStatus(id: string): NotebookItem[] {
  const current = getNotebookItems();
  const updated = current.map((item) =>
    item.id === id ? { ...item, mastered: !item.mastered } : item
  );
  saveNotebookItems(updated);
  return updated;
}

export function removeNotebookItem(id: string): NotebookItem[] {
  const current = getNotebookItems();
  const updated = current.filter((item) => item.id !== id);
  saveNotebookItems(updated);
  return updated;
}

