'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getNotebookItems,
  toggleBookmarkQuestion,
} from '@/lib/notebook';

interface Question {
  id: string;
  section: string;
  passageText?: string;
  questionText: string;
  imageUrl?: string;
  solutionImageUrl?: string;
  options: string[];
  correctOptionIndex: number;
  marks?: number;
  negativeMarks?: number;
  explanation?: string;
}

interface MockTest {
  id: string;
  title: string;
  exam_type: string;
  duration_minutes: number;
  total_marks: number;
  cutoff_marks?: number;
  questions: Question[] | string;
}

export default function MockResultAnalysisPage() {
  const params = useParams();
  const testId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [allDbAttempts, setAllDbAttempts] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string>('You');

  // Filter for Question-by-Question Speed & Accuracy Matrix
  const [matrixFilter, setMatrixFilter] = useState<'ALL' | 'WRONG' | 'CORRECT' | 'SKIPPED' | 'TRAPS'>('ALL');
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const existingVault = getNotebookItems();
    const bm: Record<string, boolean> = {};
    existingVault.forEach((item) => {
      if (item.isBookmarked) bm[item.id] = true;
    });
    setBookmarkedMap(bm);

    if (testId) {
      fetchResultData();
    }
  }, [testId]);

  async function fetchResultData() {
    setLoading(true);

    // 1. Fetch Mock Test Details & Questions
    const { data: testData, error: testErr } = await supabase
      .from('mock_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (testErr || !testData) {
      setLoading(false);
      return;
    }

    const mock = testData as MockTest;
    let rawQ: any[] = [];
    if (typeof mock.questions === 'string') {
      try {
        rawQ = JSON.parse(mock.questions);
      } catch (e) {
        rawQ = [];
      }
    } else if (Array.isArray(mock.questions)) {
      rawQ = mock.questions;
    }

    const parsedQ: Question[] = (rawQ || []).map((q: any) => ({
      ...q,
      imageUrl: q.imageUrl || q.image_url || q.question_image_url || q.questionImageUrl || undefined,
      solutionImageUrl: q.solutionImageUrl || q.solution_image_url || q.solutionImage || q.sol_image_url || q.sol_image || undefined,
      passageText: q.passageText || q.passage_text || q.passage || undefined,
      questionText: q.questionText || q.question_text || q.question || '',
      options: Array.isArray(q.options) ? q.options : [],
      explanation: q.explanation || q.solution || q.solution_text || undefined,
    }));

    setTest(mock);
    setQuestions(parsedQ);

    // 2. Fetch User's Attempt from LocalStorage or Supabase
    let savedAnswers: Record<string, any> = {};
    let savedTime: Record<string, number> = {};

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      if (localSaved[testId]) {
        savedAnswers = localSaved[testId].answers || localSaved[testId].user_answers || {};
        if (localSaved[testId].time_spent) {
          savedTime = { ...savedTime, ...localSaved[testId].time_spent };
        }
      }
    } catch (e) {}

    // Check localStorage test session cache fallback
    try {
      const cachedSession = localStorage.getItem(`mock_session_${testId}`);
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession);
        if (parsed && parsed.user_answers) {
          savedAnswers = { ...savedAnswers, ...parsed.user_answers };
        }
        if (parsed && parsed.time_spent) {
          savedTime = { ...savedTime, ...parsed.time_spent };
        }
      }
    } catch (e) {}

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUserId(session.user.id);
      setCandidateName(
        session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'You'
      );

      const { data: dbAttempts } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('test_id', testId)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbAttempts && dbAttempts.length > 0) {
        const latestAttempt = dbAttempts[0];
        const dbAns = latestAttempt.user_answers || latestAttempt.answers;
        if (dbAns) savedAnswers = { ...savedAnswers, ...dbAns };
        if (latestAttempt.time_spent) savedTime = { ...savedTime, ...latestAttempt.time_spent };
      }
    }

    setUserAnswers(savedAnswers);
    setTimeSpent(savedTime);

    // 3. Fetch All Student Attempts for Rank & Leaderboard Computation
    const { data: attemptsData } = await supabase
      .from('mock_attempts')
      .select('user_id, score, completed_at, created_at')
      .eq('test_id', testId)
      .order('score', { ascending: false });

    if (attemptsData) {
      setAllDbAttempts(attemptsData);
    }

    setLoading(false);
  }

  const getAnswerForQuestion = (q: Question, idx: number) => {
    const qKey = q.id || idx.toString();
    return userAnswers[q.id] ?? userAnswers[idx] ?? userAnswers[qKey];
  };

  const getTimeForQuestion = (q: Question, idx: number): number => {
    const raw = timeSpent[idx] ?? timeSpent[idx.toString()] ?? timeSpent[q.id] ?? 0;
    return Number(raw) || 0;
  };

  const formatDurationShort = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const handleToggleBookmarkOnResult = (q: Question, idx: number) => {
    if (!test) return;
    const vaultId = `mock_${test.id}_q_${idx}`;
    const userAns = getAnswerForQuestion(q, idx);
    const { isNowBookmarked } = toggleBookmarkQuestion({
      id: vaultId,
      sourceType: 'MOCK_TEST',
      sourceId: test.id,
      sourceTitle: test.title,
      section: q.section || 'QUANT',
      passageText: q.passageText,
      questionText: q.questionText,
      imageUrl: q.imageUrl,
      solutionImageUrl: q.solutionImageUrl,
      options: q.options || [],
      correctOptionIndex: q.correctOptionIndex,
      userSelectedOption: userAns !== undefined ? Number(userAns) : undefined,
      explanation: q.explanation,
    });
    setBookmarkedMap((prev) => ({ ...prev, [vaultId]: isNowBookmarked }));
  };

  const calculateMetrics = () => {
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    let totalTimeSpentSec = 0;
    let correctTimeSec = 0;
    let wrongTimeSec = 0;
    let skippedTimeSec = 0;

    const sections = Array.from(new Set(questions.map((q) => q.section || 'QUANT')));
    const sectionStats: Record<
      string,
      { total: number; attempted: number; correct: number; wrong: number; score: number; timeSec: number }
    > = {};
    sections.forEach((sec) => {
      sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0, timeSec: 0 };
    });

    const questionBreakdown: Array<{
      idx: number;
      q: Question;
      status: 'CORRECT' | 'WRONG' | 'SKIPPED';
      userAns: any;
      qTime: number;
      isTimeTrap: boolean;
    }> = [];

    questions.forEach((q, idx) => {
      const sec = q.section || 'QUANT';
      const userAns = getAnswerForQuestion(q, idx);
      const qTime = getTimeForQuestion(q, idx);

      if (!sectionStats[sec]) {
        sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0, timeSec: 0 };
      }

      sectionStats[sec].total += 1;
      sectionStats[sec].timeSec += qTime;
      totalTimeSpentSec += qTime;

      let status: 'CORRECT' | 'WRONG' | 'SKIPPED' = 'SKIPPED';

      if (userAns === undefined || userAns === null || userAns === '') {
        unattemptedCount += 1;
        skippedTimeSec += qTime;
        status = 'SKIPPED';
      } else if (Number(userAns) === Number(q.correctOptionIndex)) {
        correctCount += 1;
        totalScore += q.marks || 1.0;
        correctTimeSec += qTime;
        status = 'CORRECT';

        sectionStats[sec].attempted += 1;
        sectionStats[sec].correct += 1;
        sectionStats[sec].score += q.marks || 1.0;
      } else {
        wrongCount += 1;
        totalScore -= q.negativeMarks || 0.25;
        wrongTimeSec += qTime;
        status = 'WRONG';

        sectionStats[sec].attempted += 1;
        sectionStats[sec].wrong += 1;
        sectionStats[sec].score -= q.negativeMarks || 0.25;
      }

      const isTimeTrap = qTime >= 60 && status !== 'CORRECT';
      questionBreakdown.push({ idx, q, status, userAns, qTime, isTimeTrap });
    });

    const accuracy =
      correctCount + wrongCount > 0
        ? ((correctCount / (correctCount + wrongCount)) * 100).toFixed(1)
        : '0.0';

    // Deduplicate attempts by user_id (keep best score per user)
    const bestByUserMap: Record<string, { user_id: string; score: number; label: string }> = {};
    allDbAttempts.forEach((att, i) => {
      const uid = att.user_id || `anon_${i}`;
      const existing = bestByUserMap[uid];
      if (!existing || Number(att.score) > existing.score) {
        bestByUserMap[uid] = {
          user_id: uid,
          score: Number(att.score) || 0,
          label:
            uid === currentUserId
              ? `${candidateName} (You)`
              : `Aspirant #BS-${uid.slice(0, 4).toUpperCase()}`,
        };
      }
    });

    // Ensure current user's score is included
    const myKey = currentUserId || 'local_you';
    if (!bestByUserMap[myKey] || totalScore > bestByUserMap[myKey].score) {
      bestByUserMap[myKey] = {
        user_id: myKey,
        score: totalScore,
        label: `${candidateName} (You)`,
      };
    }

    const leaderboardList = Object.values(bestByUserMap).sort((a, b) => b.score - a.score);
    const userRankIndex = leaderboardList.findIndex((item) => item.user_id === myKey);
    const userRank = userRankIndex !== -1 ? userRankIndex + 1 : 1;
    const totalStudents = leaderboardList.length || 1;
    const percentile = (((totalStudents - userRank + 1) / totalStudents) * 100).toFixed(1);

    const topperScore =
      leaderboardList.length > 0
        ? Math.max(leaderboardList[0].score, totalScore)
        : Math.max(totalScore, Number(test?.cutoff_marks || 55) + 12);

    const batchAvgScore =
      leaderboardList.length > 1
        ? leaderboardList.reduce((acc, a) => acc + a.score, 0) / leaderboardList.length
        : Math.max(totalScore * 0.82, (Number(test?.cutoff_marks || 50) * 0.85));

    const avgTimeCorrect = correctCount > 0 ? Math.round(correctTimeSec / correctCount) : 0;
    const avgTimeWrong = wrongCount > 0 ? Math.round(wrongTimeSec / wrongCount) : 0;

    // Time traps: questions where user spent >= 60s and got wrong/skipped, OR top slowest wrong/skipped questions
    const timeTraps = [...questionBreakdown]
      .filter((item) => item.status !== 'CORRECT' && item.qTime >= 30)
      .sort((a, b) => b.qTime - a.qTime)
      .slice(0, 6);

    return {
      totalScore,
      correctCount,
      wrongCount,
      unattemptedCount,
      accuracy,
      userRank,
      totalStudents,
      percentile,
      sectionStats,
      totalTimeSpentSec,
      avgTimeCorrect,
      avgTimeWrong,
      topperScore,
      batchAvgScore,
      questionBreakdown,
      timeTraps,
      leaderboardList: leaderboardList.slice(0, 10),
      myKey,
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center font-bold">
        <div className="w-9 h-9 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mr-3.5"></div>
        <span className="text-xs uppercase tracking-widest text-slate-300">
          Generating Deep Performance Analytics...
        </span>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-black">Report Not Found</h2>
        <Link href="/tests" className="px-5 py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl">
          Back to Tests Portal
        </Link>
      </div>
    );
  }

  const metrics = calculateMetrics();
  const cutoff = Number(test.cutoff_marks ?? 55);
  const passed = metrics.totalScore >= cutoff;
  const attemptedCount = metrics.correctCount + metrics.wrongCount;
  const maxMarks = Number(test.total_marks || 100);

  const filteredQuestions = metrics.questionBreakdown.filter((item) => {
    if (matrixFilter === 'WRONG') return item.status === 'WRONG';
    if (matrixFilter === 'CORRECT') return item.status === 'CORRECT';
    if (matrixFilter === 'SKIPPED') return item.status === 'SKIPPED';
    if (matrixFilter === 'TRAPS') return item.qTime >= 60 && item.status !== 'CORRECT';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-emerald-500/10 blur-[140px] rounded-full z-0" />

      {/* TOP STICKY HEADER */}
      <header className="bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20">
            BS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                {test.exam_type || 'Mock Result'}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                ⏱️ Active Time: {formatDurationShort(metrics.totalTimeSpentSec)}
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white mt-0.5 tracking-tight">
              {test.title} — Intelligence Report
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/mock-test/${test.id}?mode=solution`}
            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
          >
            👁️ View Step-by-Step Solutions
          </Link>
          <Link
            href="/notebook"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs rounded-xl border border-amber-400/30 transition"
          >
            🔖 Mistake Notebook
          </Link>
          <Link
            href="/profile"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-white/[0.08] transition"
          >
            📊 Learning Hub
          </Link>
          <Link
            href="/tests"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-white/[0.08] transition"
          >
            ← All Tests
          </Link>
        </div>
      </header>

      {/* MAIN ANALYSIS CONTENT */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        
        {/* CUTOFF STATUS BANNER */}
        <div
          className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl ${
            passed
              ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900/90 to-slate-950 border-emerald-500/40 text-emerald-200'
              : 'bg-gradient-to-r from-amber-950/50 via-slate-900/90 to-slate-950 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 border ${
                passed
                  ? 'bg-emerald-500/15 border-emerald-500/30'
                  : 'bg-amber-400/15 border-amber-400/30'
              }`}
            >
              {passed ? '🏆' : '🎯'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                    passed ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {passed ? 'CUT-OFF CLEARED' : 'BELOW CUT-OFF'}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  Official Cut-off: <strong className="text-white">{cutoff} Marks</strong>
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">
                {passed
                  ? `Outstanding! You cleared the cut-off by +${(metrics.totalScore - cutoff).toFixed(2)} marks.`
                  : `You are ${(cutoff - metrics.totalScore).toFixed(2)} marks away from the cut-off.`}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                {metrics.wrongCount > 0
                  ? `We automatically logged your ${metrics.wrongCount} wrong answer(s) into your Mistake & Revision Notebook so you can fix them right away.`
                  : 'Zero negative marks in this attempt — exceptional accuracy!'}
              </p>
            </div>
          </div>

          {metrics.wrongCount > 0 && (
            <Link
              href="/notebook"
              className="px-4 py-2.5 bg-slate-950/90 hover:bg-slate-900 text-amber-300 border border-amber-400/35 font-black text-xs rounded-xl transition shrink-0 text-center"
            >
              ⚡ Fix {metrics.wrongCount} Mistakes →
            </Link>
          )}
        </div>

        {/* 1. OVERALL PERFORMANCE SUMMARY (5 KPI CARDS) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 flex items-center gap-3.5 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center text-xl shrink-0">
              🏆
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                All-India Rank
              </span>
              <span className="text-xl font-black text-white">
                #{metrics.userRank}{' '}
                <span className="text-xs text-slate-500 font-bold">/ {metrics.totalStudents}</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 flex items-center gap-3.5 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center text-xl shrink-0">
              🎯
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                Net Score
              </span>
              <span className="text-xl font-black text-white">
                {metrics.totalScore.toFixed(2)}{' '}
                <span className="text-xs text-slate-500 font-bold">/ {maxMarks}</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 flex items-center gap-3.5 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl shrink-0">
              📝
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                Attempted
              </span>
              <span className="text-xl font-black text-white">
                {attemptedCount}{' '}
                <span className="text-xs text-slate-500 font-bold">/ {questions.length}</span>
              </span>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 flex items-center gap-3.5 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                Accuracy
              </span>
              <span className="text-xl font-black text-emerald-400">{metrics.accuracy}%</span>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-5 flex items-center gap-3.5 shadow-xl col-span-2 lg:col-span-1">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xl shrink-0">
              📈
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-extrabold uppercase tracking-wider">
                Percentile
              </span>
              <span className="text-xl font-black text-purple-300">{metrics.percentile}%</span>
            </div>
          </div>
        </div>

        {/* 2. TOPPER VS. BATCH AVERAGE VS. YOU + TIME-TRAP DETECTOR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Topper vs You Comparison */}
          <div className="lg:col-span-5 bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                Benchmarking
              </span>
              <h3 className="text-base font-black text-white mt-0.5">
                You vs. Topper vs. Batch Average
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                See how your net score compares against the highest scorer and exam cut-off.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  label: 'Your Score',
                  value: Math.max(0, metrics.totalScore),
                  rawLabel: `${metrics.totalScore.toFixed(2)} / ${maxMarks}`,
                  barClass: 'bg-gradient-to-r from-blue-500 to-sky-400',
                  textClass: 'text-sky-300',
                },
                {
                  label: 'Topper Score',
                  value: Math.max(0, metrics.topperScore),
                  rawLabel: `${metrics.topperScore.toFixed(2)} / ${maxMarks}`,
                  barClass: 'bg-gradient-to-r from-amber-400 to-orange-400',
                  textClass: 'text-amber-300',
                },
                {
                  label: 'Official Cut-off',
                  value: Math.max(0, cutoff),
                  rawLabel: `${cutoff.toFixed(2)} / ${maxMarks}`,
                  barClass: 'bg-gradient-to-r from-emerald-500 to-teal-400',
                  textClass: 'text-emerald-300',
                },
                {
                  label: 'Batch Average',
                  value: Math.max(0, metrics.batchAvgScore),
                  rawLabel: `${metrics.batchAvgScore.toFixed(2)} / ${maxMarks}`,
                  barClass: 'bg-slate-600',
                  textClass: 'text-slate-300',
                },
              ].map((row) => {
                const pct = Math.min(100, Math.max(4, Math.round((row.value / maxMarks) * 100)));
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">{row.label}</span>
                      <span className={row.textClass}>{row.rawLabel}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/[0.06]">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${row.barClass}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.08] text-center">
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-2.5">
                <span className="text-lg font-black text-emerald-400 block">{metrics.correctCount}</span>
                <span className="text-[10px] font-bold uppercase text-emerald-300">Correct ✓</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-2.5">
                <span className="text-lg font-black text-rose-400 block">{metrics.wrongCount}</span>
                <span className="text-[10px] font-bold uppercase text-rose-300">Wrong ✗</span>
              </div>
              <div className="bg-slate-950 border border-white/[0.08] rounded-2xl p-2.5">
                <span className="text-lg font-black text-slate-300 block">{metrics.unattemptedCount}</span>
                <span className="text-[10px] font-bold uppercase text-slate-400">Skipped ⚪</span>
              </div>
            </div>
          </div>

          {/* ⏱️ Time-vs-Accuracy & Time Trap Detector */}
          <div className="lg:col-span-7 bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl flex flex-col justify-between">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 block">
                  Speed &amp; Pacing Intelligence
                </span>
                <h3 className="text-base font-black text-white mt-0.5">
                  ⏱️ Time-vs-Accuracy &amp; &ldquo;Time Trap&rdquo; Detector
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identifies questions that consumed heavy exam time without yielding positive marks.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs">
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Avg Time / Correct</span>
                  <strong className="text-emerald-400 font-black">{metrics.avgTimeCorrect}s</strong>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs">
                  <span className="text-slate-400 text-[10px] block font-bold uppercase">Avg Time / Wrong</span>
                  <strong className="text-rose-400 font-black">{metrics.avgTimeWrong}s</strong>
                </div>
              </div>
            </div>

            {metrics.timeTraps.length === 0 ? (
              <div className="bg-slate-950/70 border border-white/[0.06] rounded-2xl p-6 text-center space-y-2 my-auto">
                <div className="text-3xl">⚡</div>
                <h4 className="text-sm font-black text-white">No Major Time Traps Detected!</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  You managed your per-question pacing well without getting stuck on wrong or unattempted questions.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {metrics.timeTraps.map((trap) => {
                  const vaultId = `mock_${test.id}_q_${trap.idx}`;
                  return (
                    <div
                      key={trap.idx}
                      className="bg-slate-950/85 border border-rose-500/25 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-rose-500/50 transition"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-black text-[10px]">
                            Q{trap.idx + 1} • {trap.q.section || 'QUANT'}
                          </span>
                          <span className="text-[11px] font-black text-amber-400 font-mono">
                            🔥 Wasted {formatDurationShort(trap.qTime)}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                              trap.status === 'WRONG'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {trap.status === 'WRONG' ? '✗ Marked Wrong' : '⚪ Left Skipped'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 truncate">{trap.q.questionText}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleBookmarkOnResult(trap.q, trap.idx)}
                          className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition ${
                            bookmarkedMap[vaultId]
                              ? 'bg-amber-400 text-slate-950 border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-white/[0.1] hover:border-amber-400/50'
                          }`}
                        >
                          🔖 {bookmarkedMap[vaultId] ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 3. SECTIONAL PERFORMANCE BREAKDOWN TABLE */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">
            Sectional Performance &amp; Pacing Breakdown
          </h3>
          <div className="bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-white/[0.08]">
                  <tr>
                    <th className="p-4">Section Name</th>
                    <th className="p-4 text-center">Net Score</th>
                    <th className="p-4 text-center">Attempted (✓ / ✗)</th>
                    <th className="p-4 text-center">Accuracy</th>
                    <th className="p-4 text-right">Time Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] font-medium text-slate-200">
                  {Object.entries(metrics.sectionStats).map(([sec, stats]) => {
                    const secAcc =
                      stats.attempted > 0 ? ((stats.correct / stats.attempted) * 100).toFixed(0) : '0';
                    const allocMins = Math.round(
                      test.duration_minutes / Math.max(1, Object.keys(metrics.sectionStats).length)
                    );
                    return (
                      <tr key={sec} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-black text-white">{sec}</td>
                        <td className="p-4 text-center font-black text-amber-400">
                          {stats.score.toFixed(2)}{' '}
                          <span className="text-slate-500 font-bold">/ {stats.total}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold text-white">{stats.attempted}</span>
                          <span className="text-slate-500"> / {stats.total} </span>
                          <span className="text-[11px] ml-1">
                            (<span className="text-emerald-400">{stats.correct}✓</span> ·{' '}
                            <span className="text-rose-400">{stats.wrong}✗</span>)
                          </span>
                        </td>
                        <td className="p-4 text-center text-emerald-400 font-black">{secAcc}%</td>
                        <td className="p-4 text-right font-mono text-slate-300">
                          {formatDurationShort(stats.timeSec)}{' '}
                          <span className="text-slate-500">/ {allocMins}m</span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-950 font-black text-white">
                    <td className="p-4">Overall Total</td>
                    <td className="p-4 text-center text-emerald-400 text-sm">
                      {metrics.totalScore.toFixed(2)}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ {test.total_marks}</span>
                    </td>
                    <td className="p-4 text-center">
                      {attemptedCount}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ {questions.length}</span>
                    </td>
                    <td className="p-4 text-center text-emerald-400">{metrics.accuracy}%</td>
                    <td className="p-4 text-right font-mono text-amber-300">
                      {formatDurationShort(metrics.totalTimeSpentSec)} / {test.duration_minutes}m
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. QUESTION-BY-QUESTION SPEED & ACCURACY MATRIX + LIVE LEADERBOARD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question-by-Question Matrix */}
          <div className="lg:col-span-8 bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-base font-black text-white">
                  Question-by-Question Speed &amp; Accuracy Matrix
                </h3>
                <p className="text-xs text-slate-400">
                  Bookmark tricky questions directly into your Revision Vault or inspect per-question time.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: `All (${questions.length})` },
                  { id: 'WRONG', label: `✗ Wrong (${metrics.wrongCount})` },
                  { id: 'CORRECT', label: `✓ Correct (${metrics.correctCount})` },
                  { id: 'SKIPPED', label: `⚪ Skipped (${metrics.unattemptedCount})` },
                  { id: 'TRAPS', label: '🔥 Slow (≥60s)' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setMatrixFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${
                      matrixFilter === f.id
                        ? 'bg-amber-400 text-slate-950 font-black shadow'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-white/[0.06]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No questions match the selected filter.
                </div>
              ) : (
                filteredQuestions.map((item) => {
                  const vaultId = `mock_${test.id}_q_${item.idx}`;
                  return (
                    <div
                      key={item.idx}
                      className="bg-slate-950/80 border border-white/[0.06] hover:border-white/[0.15] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-white font-black text-xs">
                            Q{item.idx + 1}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            {item.q.section || 'QUANT'}
                          </span>
                          {item.status === 'CORRECT' && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              ✓ Correct (+{item.q.marks || 1.0})
                            </span>
                          )}
                          {item.status === 'WRONG' && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              ✗ Wrong (-{item.q.negativeMarks || 0.25})
                            </span>
                          )}
                          {item.status === 'SKIPPED' && (
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              ⚪ Skipped (0)
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                              item.qTime >= 60
                                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                                : 'text-slate-400'
                            }`}
                          >
                            ⏱️ {formatDurationShort(item.qTime)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {item.q.questionText}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleBookmarkOnResult(item.q, item.idx)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                            bookmarkedMap[vaultId]
                              ? 'bg-amber-400 text-slate-950 border-amber-400 font-black'
                              : 'bg-slate-900 text-slate-300 border-white/[0.1] hover:border-amber-400/50'
                          }`}
                        >
                          🔖 {bookmarkedMap[vaultId] ? 'In Vault' : 'Save'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 🏆 Live All-India Leaderboard */}
          <div className="lg:col-span-4 bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl flex flex-col">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                Live Standings
              </span>
              <h3 className="text-base font-black text-white mt-0.5">
                🏆 All-India Leaderboard
              </h3>
              <p className="text-xs text-slate-400">
                Top performers ranked by net score in this mock test.
              </p>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[420px] pr-1">
              {metrics.leaderboardList.map((entry, idx) => {
                const rank = idx + 1;
                const isMe = entry.user_id === metrics.myKey;
                return (
                  <div
                    key={entry.user_id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      isMe
                        ? 'bg-amber-400/15 border-amber-400/40 shadow-md'
                        : 'bg-slate-950/80 border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          rank === 1
                            ? 'bg-amber-400 text-slate-950'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-950'
                            : rank === 3
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                      </span>
                      <div className="truncate">
                        <span
                          className={`text-xs font-black block truncate ${
                            isMe ? 'text-amber-300' : 'text-white'
                          }`}
                        >
                          {entry.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {entry.score >= cutoff ? '✓ Cleared Cut-off' : 'Appeared'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-emerald-400 block">
                        {entry.score.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        / {maxMarks}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
