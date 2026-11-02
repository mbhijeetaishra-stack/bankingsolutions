'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface AttemptSummary {
  testId: string;
  testTitle: string;
  examType: string;
  score: number;
  totalMarks: number;
  accuracy?: number;
  completedAt?: string;
}

export default function MockAnalysisHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [allMocks, setAllMocks] = useState<any[]>([]);

  useEffect(() => {
    fetchAttemptsAndMocks();
  }, []);

  async function fetchAttemptsAndMocks() {
    setLoading(true);

    // 1. Fetch mock tests from Supabase
    const { data: mockData } = await supabase
      .from('mock_tests')
      .select('id, title, exam_type, total_marks, duration_minutes')
      .order('created_at', { ascending: false });

    const mockMap = new Map<string, any>();
    if (mockData) {
      setAllMocks(mockData);
      mockData.forEach((m) => mockMap.set(m.id, m));
    }

    const collectedAttempts: AttemptSummary[] = [];
    const seenTestIds = new Set<string>();

    // 2. Fetch logged-in user attempts from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: dbAttempts } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('completed_at', { ascending: false });

      if (dbAttempts && dbAttempts.length > 0) {
        dbAttempts.forEach((att) => {
          if (!seenTestIds.has(att.test_id)) {
            seenTestIds.add(att.test_id);
            const m = mockMap.get(att.test_id);
            collectedAttempts.push({
              testId: att.test_id,
              testTitle: m?.title || att.test_title || 'Banking CBT Mock Test',
              examType: m?.exam_type || 'BANKING',
              score: Number(att.score ?? 0),
              totalMarks: Number(att.total_marks ?? m?.total_marks ?? 100),
              completedAt: att.completed_at || att.created_at,
            });
          }
        });
      }
    }

    // 3. Fallback to LocalStorage attempts
    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      Object.keys(localSaved).forEach((tid) => {
        if (!seenTestIds.has(tid)) {
          seenTestIds.add(tid);
          const att = localSaved[tid];
          const m = mockMap.get(tid);
          collectedAttempts.push({
            testId: tid,
            testTitle: m?.title || 'Banking Practice Mock',
            examType: m?.exam_type || 'BANKING',
            score: Number(att.score ?? 0),
            totalMarks: Number(att.total_marks ?? m?.total_marks ?? 100),
            completedAt: att.completed_at || new Date().toISOString(),
          });
        }
      });
    } catch (e) {}

    setAttempts(collectedAttempts);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1">
              <Link href="/" className="hover:text-amber-400 transition">Home</Link>
              <span>/</span>
              <Link href="/tests" className="hover:text-amber-400 transition">Tests Portal</Link>
              <span>/</span>
              <span className="text-amber-400">Mock Analysis Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>📊 Mock Test Analysis & Performance Reports</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Review your question-by-question speed, accuracy matrix, time traps, and All-India percentile rank.
            </p>
          </div>

          <Link
            href="/tests"
            className="self-start sm:self-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2"
          >
            <span>⚡ Take New Mock</span>
            <span>→</span>
          </Link>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="w-9 h-9 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Loading Your Mock Reports...
            </p>
          </div>
        ) : attempts.length === 0 ? (
          /* Empty State */
          <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-10 text-center max-w-xl mx-auto space-y-5 my-12">
            <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-3xl mx-auto">
              📊
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">No Mock Attempts Found Yet</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Take a Full-Length or Sectional Mock Test to unlock detailed speed analytics, topper comparison, and mistake matrices.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/tests"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition"
              >
                <span>🚀 Browse Real CBT Mocks Now</span>
              </Link>
            </div>
          </div>
        ) : (
          /* List of Completed Mocks */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">
                Your Attempted Mock Tests ({attempts.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attempts.map((att) => {
                const percentage = att.totalMarks > 0 ? ((att.score / att.totalMarks) * 100).toFixed(1) : '0.0';
                return (
                  <div
                    key={att.testId}
                    className="bg-slate-900/80 hover:bg-slate-900 border border-white/[0.08] hover:border-amber-400/30 rounded-2xl p-5 transition space-y-4 shadow-lg group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          {att.examType}
                        </span>
                        <h3 className="text-base font-black text-white mt-1.5 truncate group-hover:text-amber-300 transition">
                          {att.testTitle}
                        </h3>
                        {att.completedAt && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Attempted on {new Date(att.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xl font-black text-emerald-400 block">
                          {att.score.toFixed(1)}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          / {att.totalMarks} marks ({percentage}%)
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2 border-t border-white/[0.06]">
                      <Link
                        href={`/mock-test/${att.testId}/result`}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow transition text-center flex items-center justify-center gap-1.5"
                      >
                        <span>📊 Detailed Analysis & Rank</span>
                      </Link>
                      <Link
                        href={`/mock-test/${att.testId}?mode=solution`}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 font-bold text-xs rounded-xl transition text-center"
                      >
                        <span>👁️ Solutions</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

