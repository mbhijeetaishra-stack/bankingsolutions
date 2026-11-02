'use client';

import React, { useEffect, useState } from 'react';
import {
  QuestionComment,
  QuestionErrorReport,
  ISSUE_LABELS,
  getAllComments,
  getAllErrorReports,
  addQuestionComment,
  togglePinComment,
  deleteQuestionComment,
  updateErrorReportStatus,
  deleteErrorReport,
} from '@/lib/community';

export default function AdminReportsInbox() {
  const [subView, setSubView] = useState<'REPORTS' | 'DOUBTS'>('REPORTS');
  const [reports, setReports] = useState<QuestionErrorReport[]>([]);
  const [comments, setComments] = useState<QuestionComment[]>([]);
  const [reportFilter, setReportFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED' | 'DISMISSED'>('ALL');
  const [adminNotesMap, setAdminNotesMap] = useState<Record<string, string>>({});
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    const allR = getAllErrorReports();
    const allC = getAllComments();
    setReports(allR);
    setComments(allC);

    const notesInit: Record<string, string> = {};
    allR.forEach((r) => {
      if (r.adminNote) notesInit[r.id] = r.adminNote;
    });
    setAdminNotesMap(notesInit);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleStatusChange = (
    reportId: string,
    status: 'OPEN' | 'RESOLVED' | 'DISMISSED'
  ) => {
    const updated = updateErrorReportStatus(reportId, status, adminNotesMap[reportId] || '');
    setReports(updated);
    showToast(`✓ Report marked as ${status}`);
  };

  const handleDeleteReport = (reportId: string) => {
    const updated = deleteErrorReport(reportId);
    setReports(updated);
    showToast('🗑️ Report deleted');
  };

  const handlePinComment = (commentId: string) => {
    const updated = togglePinComment(commentId);
    setComments(updated);
    showToast('📌 Updated pin status');
  };

  const handleDeleteComment = (commentId: string) => {
    const updated = deleteQuestionComment(commentId);
    setComments(updated);
    showToast('🗑️ Comment deleted');
  };

  const handleEducatorReply = (parentComment: QuestionComment) => {
    const text = (replyTextMap[parentComment.id] || '').trim();
    if (!text) return;

    addQuestionComment({
      questionKey: parentComment.questionKey,
      sourceType: parentComment.sourceType,
      sourceId: parentComment.sourceId,
      sourceTitle: parentComment.sourceTitle,
      questionNumber: parentComment.questionNumber,
      section: parentComment.section,
      questionPreview: parentComment.questionPreview,
      authorName: 'Abhijeet Sir (BankingSolutions)',
      authorRole: 'EDUCATOR',
      content: `@${parentComment.authorName}: ${text}`,
    });

    setReplyTextMap((prev) => ({ ...prev, [parentComment.id]: '' }));
    setComments(getAllComments());
    showToast('✓ Posted Verified Educator reply & pinned to question!');
  };

  const openReportsCount = reports.filter((r) => r.status === 'OPEN').length;
  const filteredReports = reports.filter((r) =>
    reportFilter === 'ALL' ? true : r.status === reportFilter
  );

  return (
    <div className="space-y-6">
      {/* Header & KPI Bar */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block">
            Quality Control &amp; Doubt Resolution
          </span>
          <h2 className="text-xl font-black text-white mt-0.5">
            🚩 Question Error Reports &amp; Student Doubts Inbox
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review student-flagged question issues and reply to peer doubts or pin top short tricks.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setSubView('REPORTS')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              subView === 'REPORTS'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🚩 Error Reports ({reports.length})</span>
            {openReportsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                {openReportsCount} Open
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSubView('DOUBTS')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              subView === 'DOUBTS'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>💬 Student Doubts &amp; Tricks ({comments.length})</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          {toastMsg}
        </div>
      )}

      {subView === 'REPORTS' ? (
        <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Flagged Question Error Reports
            </h3>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'OPEN', 'RESOLVED', 'DISMISSED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReportFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    reportFilter === st
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-white/[0.06]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <div className="text-3xl">✅</div>
              <p className="text-sm font-bold text-white">No Flagged Question Reports Found</p>
              <p className="text-xs">
                When students click &ldquo;🚩 Report Question Error&rdquo; in Mock Tests or Daily Quizzes, reports appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          rep.status === 'OPEN'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : rep.status === 'RESOLVED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {rep.status}
                      </span>
                      <span className="text-xs font-black text-amber-400">
                        {rep.sourceTitle} • Q#{rep.questionNumber} ({rep.section})
                      </span>
                      <span className="text-[11px] bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-lg font-bold">
                        {ISSUE_LABELS[rep.issueType]}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Reported by <strong className="text-slate-200">{rep.reporterName}</strong> •{' '}
                      {new Date(rep.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-white/[0.06] text-xs text-slate-300">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                      Question Preview:
                    </span>
                    {rep.questionPreview}
                  </div>

                  <p className="text-xs text-rose-200 font-semibold">
                    Student Note: &ldquo;{rep.description}&rdquo;
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={adminNotesMap[rep.id] || ''}
                      onChange={(e) =>
                        setAdminNotesMap((prev) => ({ ...prev, [rep.id]: e.target.value }))
                      }
                      placeholder="Optional resolution note (e.g. Updated answer key to Option C)..."
                      className="flex-1 bg-slate-900 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-amber-400"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(rep.id, 'RESOLVED')}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition"
                      >
                        ✓ Mark Resolved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(rep.id, 'DISMISSED')}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReport(rep.id)}
                        className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs rounded-xl transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl">
          <div className="border-b border-white/[0.08] pb-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Student Doubts &amp; Peer Short Tricks Across All Questions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pin the best student approaches or reply as a Verified Educator.
            </p>
          </div>

          {comments.length === 0 ? (
            <div className="text-center py-12 space-y-2 text-slate-400">
              <div className="text-3xl">💬</div>
              <p className="text-sm font-bold text-white">No Student Comments Yet</p>
              <p className="text-xs">
                Comments and shortcuts posted in Mock Test Solution Mode or Daily Quizzes will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-white">{c.authorName}</span>
                      {c.authorRole === 'EDUCATOR' && (
                        <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                          ✓ Verified Educator
                        </span>
                      )}
                      {c.isPinned && (
                        <span className="text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                          📌 Pinned
                        </span>
                      )}
                      <span className="text-xs font-bold text-amber-400">
                        • {c.sourceTitle} (Q#{c.questionNumber} - {c.section})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-400 font-bold">👍 {c.upvotes}</span>
                      <button
                        type="button"
                        onClick={() => handlePinComment(c.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition"
                      >
                        {c.isPinned ? 'Unpin' : '📌 Pin Trick'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-slate-900 p-3.5 rounded-xl border border-white/[0.06]">
                    {c.content}
                  </p>

                  {c.authorRole !== 'EDUCATOR' && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={replyTextMap[c.id] || ''}
                        onChange={(e) =>
                          setReplyTextMap((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder={`Reply to ${c.authorName} as Verified Educator...`}
                        className="flex-1 bg-slate-900 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleEducatorReply(c)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition shrink-0"
                      >
                        Reply &amp; Pin →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

