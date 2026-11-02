'use client';

import React, { useEffect, useState } from 'react';
import {
  QuestionComment,
  IssueCategory,
  ISSUE_LABELS,
  getCommentsForQuestion,
  addQuestionComment,
  toggleUpvoteComment,
  togglePinComment,
  deleteQuestionComment,
  submitErrorReport,
} from '@/lib/community';

interface QuestionCommunityBarProps {
  questionKey: string;
  sourceType: 'MOCK_TEST' | 'GA_QUIZ';
  sourceId: string;
  sourceTitle: string;
  questionNumber: number;
  section: string;
  questionPreview: string;
  userName?: string;
  userEmail?: string;
  isDarkTheme?: boolean;
}

const ADMIN_EMAIL = 'abhijeet9022102210@gmail.com';

export default function QuestionCommunityBar({
  questionKey,
  sourceType,
  sourceId,
  sourceTitle,
  questionNumber,
  section,
  questionPreview,
  userName = 'Aspirant',
  userEmail = '',
  isDarkTheme = true,
}: QuestionCommunityBarProps) {
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Comment Input State
  const [newCommentText, setNewCommentText] = useState('');

  // Report Form State
  const [issueType, setIssueType] = useState<IssueCategory>('WRONG_ANSWER_KEY');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSubmittedToast, setReportSubmittedToast] = useState(false);

  const isEducator = userEmail?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    setComments(getCommentsForQuestion(questionKey));
    setIsReportOpen(false);
    setReportSubmittedToast(false);
  }, [questionKey]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const updated = addQuestionComment({
      questionKey,
      sourceType,
      sourceId,
      sourceTitle,
      questionNumber,
      section,
      questionPreview: questionPreview.slice(0, 140),
      authorName: isEducator ? 'Abhijeet Sir (BankingSolutions)' : userName || 'Aspirant',
      authorRole: isEducator ? 'EDUCATOR' : 'STUDENT',
      content: newCommentText.trim(),
    });
    setComments(updated);
    setNewCommentText('');
  };

  const handleUpvote = (commentId: string) => {
    toggleUpvoteComment(commentId);
    setComments(getCommentsForQuestion(questionKey));
  };

  const handlePin = (commentId: string) => {
    togglePinComment(commentId);
    setComments(getCommentsForQuestion(questionKey));
  };

  const handleDelete = (commentId: string) => {
    deleteQuestionComment(commentId);
    setComments(getCommentsForQuestion(questionKey));
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitErrorReport({
      questionKey,
      sourceType,
      sourceId,
      sourceTitle,
      questionNumber,
      section,
      questionPreview: questionPreview.slice(0, 160),
      issueType,
      description: reportDesc.trim() || ISSUE_LABELS[issueType],
      reporterName: userName || 'Aspirant',
    });
    setReportDesc('');
    setIsReportOpen(false);
    setReportSubmittedToast(true);
    setTimeout(() => setReportSubmittedToast(false), 3500);
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsDiscussionOpen(!isDiscussionOpen);
              if (isReportOpen) setIsReportOpen(false);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition flex items-center gap-1.5 ${
              isDiscussionOpen
                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                : isDarkTheme
                ? 'bg-slate-900/90 text-slate-200 border-white/[0.1] hover:border-blue-400/50'
                : 'bg-slate-100 text-slate-800 border-slate-300 hover:border-blue-500'
            }`}
          >
            <span>💬</span>
            <span>Peer Discussion &amp; Short Tricks ({comments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsReportOpen(!isReportOpen);
              if (isDiscussionOpen) setIsDiscussionOpen(false);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              isReportOpen
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isDarkTheme
                ? 'bg-slate-900/80 text-slate-400 border-white/[0.08] hover:text-rose-300 hover:border-rose-500/35'
                : 'bg-slate-100 text-slate-600 border-slate-300 hover:text-rose-600'
            }`}
            title="Flag a typo, wrong answer key, or unclear explanation"
          >
            <span>🚩</span>
            <span>Report Question Error</span>
          </button>
        </div>

        {reportSubmittedToast && (
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-lg">
            ✓ Reported! Admin team will verify this question.
          </span>
        )}
      </div>

      {/* 🚩 Report Question Error Inline Panel */}
      {isReportOpen && (
        <form
          onSubmit={handleReportSubmit}
          className={`p-4 rounded-2xl border text-xs space-y-3 animate-fade-in ${
            isDarkTheme
              ? 'bg-slate-950/90 border-rose-500/30 text-slate-200'
              : 'bg-rose-50/70 border-rose-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <span>🚩</span> Report Issue in Question #{questionNumber}
            </span>
            <button
              type="button"
              onClick={() => setIsReportOpen(false)}
              className="text-slate-400 hover:text-white font-bold text-xs"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(ISSUE_LABELS) as IssueCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setIssueType(cat)}
                className={`p-2.5 rounded-xl border text-left font-bold text-[11px] transition flex items-center gap-2 ${
                  issueType === cat
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : isDarkTheme
                    ? 'bg-slate-900 border-white/[0.08] text-slate-400 hover:text-slate-200'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 border-current">
                  {issueType === cat && <span className="w-2 h-2 rounded-full bg-rose-400" />}
                </span>
                <span>{ISSUE_LABELS[cat]}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder="Optional: Describe what seems wrong (e.g. Option B should be 45%)..."
              className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs outline-none ${
                isDarkTheme
                  ? 'bg-slate-900 border-white/[0.1] text-white focus:border-rose-400'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow transition shrink-0"
            >
              Submit Report →
            </button>
          </div>
        </form>
      )}

      {/* 💬 Peer Discussion & Short Tricks Drawer */}
      {isDiscussionOpen && (
        <div
          className={`p-4 rounded-2xl border text-xs space-y-4 animate-fade-in ${
            isDarkTheme
              ? 'bg-slate-950/90 border-blue-500/25 text-slate-200'
              : 'bg-slate-50 border-slate-300 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <div>
              <span className="font-black uppercase tracking-wider text-blue-400 block">
                💬 Question #{questionNumber} — Doubts &amp; Student Short Tricks
              </span>
              <span className="text-[11px] text-slate-400">
                Share a faster approach, ratio shortcut, or ask a doubt on this question.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsDiscussionOpen(false)}
              className="text-slate-400 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>

          {/* Post New Comment / Trick Form */}
          <form onSubmit={handleAddComment} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={
                isEducator
                  ? 'Post an official Educator Shortcut or clarify student doubts...'
                  : 'Share your shortcut/approach or ask a doubt on Q' + questionNumber + '...'
              }
              className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs outline-none ${
                isDarkTheme
                  ? 'bg-slate-900 border-white/[0.1] text-white focus:border-blue-400'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow transition shrink-0"
            >
              Post Trick / Doubt →
            </button>
          </form>

          {/* Comments List */}
          {comments.length === 0 ? (
            <div className="text-center py-5 text-slate-400 text-xs">
              No shortcuts or doubts posted for Q{questionNumber} yet. Be the first to share your approach!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    c.isPinned
                      ? isDarkTheme
                        ? 'bg-amber-400/10 border-amber-400/35'
                        : 'bg-amber-50 border-amber-300'
                      : isDarkTheme
                      ? 'bg-slate-900/90 border-white/[0.06]'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-white">{c.authorName}</span>
                      {c.authorRole === 'EDUCATOR' && (
                        <span className="text-[9px] font-black uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                          ✓ Verified Educator
                        </span>
                      )}
                      {c.isPinned && (
                        <span className="text-[9px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          📌 Pinned Trick
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpvote(c.id)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 ${
                          c.upvotedByMe
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950/60 text-slate-400 border-white/[0.08] hover:text-white'
                        }`}
                      >
                        <span>👍</span>
                        <span>{c.upvotes}</span>
                      </button>

                      {isEducator && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePin(c.id)}
                            className="text-[10px] text-amber-400 hover:underline font-bold"
                          >
                            {c.isPinned ? 'Unpin' : '📌 Pin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            className="text-[10px] text-rose-400 hover:underline font-bold"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-line">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

