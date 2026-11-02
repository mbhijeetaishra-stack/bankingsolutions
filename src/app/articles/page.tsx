import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchAllArticlesServerSide } from '@/lib/articles';

export const metadata: Metadata = {
  title:
    'Banking Exam Notifications, Exam Dates, Expected Cut-Offs & Syllabus 2026 | BankingSolutions',
  description:
    'Latest official notifications, Prelims & Mains exam dates, expected & previous year cut-offs, vacancy details, and syllabus guides for SBI PO, IBPS PO, IBPS Clerk, RRB PO & RBI exams.',
  keywords: [
    'SBI PO 2026 notification',
    'IBPS PO 2026 exam date',
    'IBPS RRB expected cutoff',
    'SBI Clerk notification 2026',
    'banking exam dates 2026',
    'expected cutoff banking exams',
  ],
};

export default async function AllExamArticlesDirectoryPage() {
  const articles = await fetchAllArticlesServerSide();

  const categoryLabels: Record<string, { label: string; badgeClass: string }> = {
    NOTIFICATION: {
      label: '📢 Official Notification',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
    EXAM_DATE: {
      label: '📅 Exam Date & Schedule',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    },
    EXPECTED_CUTOFF: {
      label: '🎯 Expected Cut-Off',
      badgeClass: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    },
    SYLLABUS_PATTERN: {
      label: '📋 Syllabus & Pattern',
      badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    },
    RESULT: {
      label: '🏆 Result Update',
      badgeClass: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    },
    EXAM_ANALYSIS: {
      label: '📊 Exam Analysis',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    },
    SALARY_JOB_PROFILE: {
      label: '💰 Salary & Career',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-emerald-500/10 blur-[140px] rounded-full z-0" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-lg shadow-lg">
              📰
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Banking Exam Notifications, Dates &amp; Expected Cut-Offs
              </h1>
              <p className="text-xs text-slate-400">
                Complete Exam Guides for SBI PO, IBPS PO, Clerk, RRB &amp; RBI Recruitment 2026
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/updates"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-amber-300 font-bold text-xs rounded-xl transition"
            >
              ⚡ Daily One-Liners Feed
            </Link>
            <Link
              href="/tests"
              className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow transition"
            >
              🚀 Mock Tests
            </Link>
            <Link
              href="/"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((art) => {
            const cat = categoryLabels[art.category] || {
              label: art.category,
              badgeClass: 'bg-slate-800 text-slate-300 border-white/10',
            };
            return (
              <article
                key={art.id}
                className="bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] hover:border-amber-400/40 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-xl transition group"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                        {art.examTag}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full border font-bold text-[10px] uppercase ${cat.badgeClass}`}
                      >
                        {cat.label}
                      </span>
                    </div>
                    <time
                      dateTime={art.updatedAt}
                      className="text-[11px] text-slate-400"
                    >
                      {new Date(art.updatedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  </div>

                  <Link href={`/articles/${art.slug}`} className="block">
                    <h2 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-400 transition leading-snug">
                      {art.title}
                    </h2>
                  </Link>

                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed line-clamp-3">
                    {art.summary}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    By <strong className="text-slate-200">{art.authorName}</strong>
                  </span>
                  <Link
                    href={`/articles/${art.slug}`}
                    className="px-4 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-400/35 font-black text-xs transition"
                  >
                    Read Full Guide →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

