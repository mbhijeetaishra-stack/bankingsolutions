export interface QuestionComment {
  id: string;
  questionKey: string;
  sourceType: 'MOCK_TEST' | 'GA_QUIZ';
  sourceId: string;
  sourceTitle: string;
  questionNumber: number;
  section: string;
  questionPreview: string;
  authorName: string;
  authorRole: 'STUDENT' | 'EDUCATOR';
  content: string;
  upvotes: number;
  upvotedByMe?: boolean;
  isPinned?: boolean;
  createdAt: string;
}

export type IssueCategory =
  | 'WRONG_ANSWER_KEY'
  | 'TYPO_MISSING_DATA'
  | 'UNCLEAR_EXPLANATION'
  | 'IMAGE_TABLE_ISSUE';

export interface QuestionErrorReport {
  id: string;
  questionKey: string;
  sourceType: 'MOCK_TEST' | 'GA_QUIZ';
  sourceId: string;
  sourceTitle: string;
  questionNumber: number;
  section: string;
  questionPreview: string;
  issueType: IssueCategory;
  description: string;
  reporterName: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  adminNote?: string;
  createdAt: string;
}

const COMMENTS_STORAGE_KEY = 'bs_question_comments_v1';
const REPORTS_STORAGE_KEY = 'bs_question_reports_v1';

export const ISSUE_LABELS: Record<IssueCategory, string> = {
  WRONG_ANSWER_KEY: 'Wrong Answer Key / Option',
  TYPO_MISSING_DATA: 'Typo or Missing Question Data',
  UNCLEAR_EXPLANATION: 'Explanation Needs More Clarity',
  IMAGE_TABLE_ISSUE: 'DI Graph / Table Not Clear',
};

export function getAllComments(): QuestionComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveAllComments(comments: QuestionComment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
  } catch (e) {
    console.error('Failed to save comments:', e);
  }
}

export function getCommentsForQuestion(questionKey: string): QuestionComment[] {
  const all = getAllComments().filter((c) => c.questionKey === questionKey);
  return all.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function addQuestionComment(
  input: Omit<QuestionComment, 'id' | 'upvotes' | 'upvotedByMe' | 'createdAt'>
): QuestionComment[] {
  const all = getAllComments();
  const newComment: QuestionComment = {
    ...input,
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    upvotes: 0,
    upvotedByMe: false,
    isPinned: input.authorRole === 'EDUCATOR' ? true : false,
    createdAt: new Date().toISOString(),
  };
  const updated = [newComment, ...all];
  saveAllComments(updated);
  return getCommentsForQuestion(input.questionKey);
}

export function toggleUpvoteComment(commentId: string): QuestionComment[] {
  const all = getAllComments().map((c) => {
    if (c.id === commentId) {
      const nextUpvoted = !c.upvotedByMe;
      return {
        ...c,
        upvotedByMe: nextUpvoted,
        upvotes: Math.max(0, c.upvotes + (nextUpvoted ? 1 : -1)),
      };
    }
    return c;
  });
  saveAllComments(all);
  return all;
}

export function togglePinComment(commentId: string): QuestionComment[] {
  const all = getAllComments().map((c) =>
    c.id === commentId ? { ...c, isPinned: !c.isPinned } : c
  );
  saveAllComments(all);
  return all;
}

export function deleteQuestionComment(commentId: string): QuestionComment[] {
  const all = getAllComments().filter((c) => c.id !== commentId);
  saveAllComments(all);
  return all;
}

export function getAllErrorReports(): QuestionErrorReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function saveAllErrorReports(reports: QuestionErrorReport[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(reports));
  } catch (e) {
    console.error('Failed to save error reports:', e);
  }
}

export function submitErrorReport(
  input: Omit<QuestionErrorReport, 'id' | 'status' | 'createdAt'>
): QuestionErrorReport[] {
  const all = getAllErrorReports();
  const newReport: QuestionErrorReport = {
    ...input,
    id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };
  const updated = [newReport, ...all];
  saveAllErrorReports(updated);
  return updated;
}

export function updateErrorReportStatus(
  reportId: string,
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED',
  adminNote?: string
): QuestionErrorReport[] {
  const all = getAllErrorReports().map((r) =>
    r.id === reportId
      ? { ...r, status, adminNote: adminNote !== undefined ? adminNote : r.adminNote }
      : r
  );
  saveAllErrorReports(all);
  return all;
}

export function deleteErrorReport(reportId: string): QuestionErrorReport[] {
  const all = getAllErrorReports().filter((r) => r.id !== reportId);
  saveAllErrorReports(all);
  return all;
}

