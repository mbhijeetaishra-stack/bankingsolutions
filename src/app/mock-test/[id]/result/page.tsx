'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Question {
  id: string;
  section: string;
  passageText?: string;
  questionText: string;
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
  const router = useRouter();
  const testId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [timeSpent, setTimeSpent] = useState<Record<number, number>>({});
  const [allDbAttempts, setAllDbAttempts] = useState<any[]>([]);

  useEffect(() => {
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
    let parsedQ: Question[] = [];
    if (typeof mock.questions === 'string') {
      try { parsedQ = JSON.parse(mock.questions); } catch (e) { parsedQ = []; }
    } else if (Array.isArray(mock.questions)) {
      parsedQ = mock.questions;
    }

    setTest(mock);
    setQuestions(parsedQ);

    // 2. Fetch User's Attempt from LocalStorage or Supabase
    let savedAnswers: Record<number, number> = {};
    let savedTime: Record<number, number> = {};

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      if (localSaved[testId]) {
        savedAnswers = localSaved[testId].answers || {};
      }
    } catch (e) {}

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: dbAttempt } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('test_id', testId)
        .eq('user_id', session.user.id)
        .single();

      if (dbAttempt) {
        if (dbAttempt.answers) savedAnswers = dbAttempt.answers;
        if (dbAttempt.time_spent) savedTime = dbAttempt.time_spent;
      }
    }

    setUserAnswers(savedAnswers);
    setTimeSpent(savedTime);

    // 3. Fetch All Student Attempts for Rank Computation
    const { data: attemptsData } = await supabase
      .from('mock_attempts')
      .select('user_id, score')
      .eq('test_id', testId);

    if (attemptsData) {
      setAllDbAttempts(attemptsData);
    }

    setLoading(false);
  }

  const calculateMetrics = () => {
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    const sections = Array.from(new Set(questions.map((q) => q.section || 'QUANT')));
    const sectionStats: Record<string, { total: number; attempted: number; correct: number; wrong: number; score: number }> = {};
    sections.forEach((sec) => {
      sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0 };
    });

    questions.forEach((q, idx) => {
      const sec = q.section || 'QUANT';
      const userAns = userAnswers[idx];

      if (!sectionStats[sec]) {
        sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0 };
      }

      sectionStats[sec].total += 1;

      if (userAns === undefined) {
        unattemptedCount += 1;
      } else if (userAns === q.correctOptionIndex) {
        correctCount += 1;
        totalScore += q.marks || 1.0;

        sectionStats[sec].attempted += 1;
        sectionStats[sec].correct += 1;
        sectionStats[sec].score += q.marks || 1.0;
      } else {
        wrongCount += 1;
        totalScore -= q.negativeMarks || 0.25;

        sectionStats[sec].attempted += 1;
        sectionStats[sec].wrong += 1;
        sectionStats[sec].score -= q.negativeMarks || 0.25;
      }
    });

    const accuracy = (correctCount + wrongCount) > 0 
      ? ((correctCount / (correctCount + wrongCount)) * 100).toFixed(1) 
      : '0.0';

    const allScores = [...allDbAttempts.map((a) => a.score), totalScore].sort((a, b) => b - a);
    const userRank = allScores.indexOf(totalScore) + 1;
    const totalStudents = allScores.length || 1;
    const percentile = (((totalStudents - userRank + 1) / totalStudents) * 100).toFixed(1);

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
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-[#1D63B8] border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading Result Analysis...
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Report Not Found</h2>
        <Link href="/tests" className="px-5 py-2.5 bg-[#1D63B8] text-white font-bold text-xs rounded-xl">
          Back to Tests Portal
        </Link>
      </div>
    );
  }

  const metrics = calculateMetrics();
  const cutoff = Number(test.cutoff_marks ?? 55);
  const passed = metrics.totalScore >= cutoff;
  const attemptedCount = metrics.correctCount + metrics.wrongCount;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* TOP HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div>
          <span className="text-[10px] font-extrabold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full">
            {test.exam_type || 'Exam Result'}
          </span>
          <h1 className="text-base font-bold text-white mt-1">{test.title} — Performance Report</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/mock-test/${test.id}?mode=solution`}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl border border-amber-400/30 transition"
          >
            👁️ View Solutions
          </Link>
          <Link href="/tests" className="px-4 py-2 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition">
            Dashboard
          </Link>
        </div>
      </header>

      {/* MAIN ANALYSIS CONTENT */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        
        {/* CUTOFF STATUS FLASH MESSAGE */}
        <div className={`p-5 rounded-2xl border flex items-center gap-4 shadow-xl ${
          passed ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
        }`}>
          <span className="text-3xl">{passed ? '🎉' : '⚠️'}</span>
          <div>
            <h3 className="text-base font-black text-white">{passed ? 'Congratulations!' : 'Thank you for appearing!'}</h3>
            <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
              {passed 
                ? `Based on your performance (Score: ${metrics.totalScore.toFixed(1)}), you have successfully cleared the cut-off (${cutoff} marks). Touch the sky with glory!` 
                : `Based on your performance (Score: ${metrics.totalScore.toFixed(1)}), you have not cleared the cut-off (${cutoff} marks). Keep practicing with BankingSolutions to bridge the gap!`}
            </p>
          </div>
        </div>

        {/* OVERALL PERFORMANCE SUMMARY */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Overall Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-lg shadow-md">🏆</div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold uppercase">Rank</span>
                <span className="text-base font-black text-white">#{metrics.userRank} <span className="text-xs text-slate-500 font-normal">/ {metrics.totalStudents}</span></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md">🎯</div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold uppercase">Score</span>
                <span className="text-base font-black text-white">{metrics.totalScore.toFixed(1)} <span className="text-xs text-slate-500 font-normal">/ {test.total_marks}</span></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600 text-white flex items-center justify-center font-black text-lg shadow-md">📝</div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold uppercase">Attempted</span>
                <span className="text-base font-black text-white">{attemptedCount} <span className="text-xs text-slate-500 font-normal">/ {questions.length}</span></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md">⚡</div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold uppercase">Accuracy</span>
                <span className="text-base font-black text-white">{metrics.accuracy}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md">📈</div>
              <div>
                <span className="text-[11px] text-slate-400 block font-bold uppercase">Percentile</span>
                <span className="text-base font-black text-white">{metrics.percentile}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTIONAL PERFORMANCE BREAKDOWN TABLE */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Sectional Performance Breakdown</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-4">Section Name</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-center">Attempted</th>
                  <th className="p-4 text-center">Accuracy</th>
                  <th className="p-4 text-right">Time Taken</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-medium text-slate-200">
                {Object.entries(metrics.sectionStats).map(([sec, stats]) => {
                  const secAcc = stats.attempted > 0 ? ((stats.correct / stats.attempted) * 100).toFixed(0) : '0';
                  return (
                    <tr key={sec} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-white">{sec}</td>
                      <td className="p-4 text-center font-bold text-amber-400">{stats.score.toFixed(1)} <span className="text-slate-500">/ {stats.total}</span></td>
                      <td className="p-4 text-center">{stats.attempted} <span className="text-slate-500">/ {stats.total}</span></td>
                      <td className="p-4 text-center text-emerald-400 font-bold">{secAcc}%</td>
                      <td className="p-4 text-right text-slate-400">-- / {Math.round(test.duration_minutes / Object.keys(metrics.sectionStats).length)} min</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-950 font-black text-white">
                  <td className="p-4">Overall</td>
                  <td className="p-4 text-center text-emerald-400 text-sm">
                    {metrics.totalScore.toFixed(1)} <span className="text-xs text-slate-400 font-normal">/ {test.total_marks}</span>
                    <span className="block text-[10px] text-amber-400 font-normal mt-0.5">{cutoff} cut-off requirement</span>
                  </td>
                  <td className="p-4 text-center">{attemptedCount} <span className="text-xs text-slate-400 font-normal">/ {questions.length}</span></td>
                  <td className="p-4 text-center text-emerald-400">{metrics.accuracy}%</td>
                  <td className="p-4 text-right text-slate-300">-- / {test.duration_minutes} mins</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 🟢 REPLACED COMPARE WITH TOPPER SECTION WITH CORRECT, INCORRECT & SKIPPED BREAKDOWN */}
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Detailed Attempt Breakdown</h3>
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-emerald-950/30 border border-emerald-500/30 p-5 rounded-xl space-y-1">
                <span className="text-3xl font-black text-emerald-400 block">{metrics.correctCount}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 block">Correct Answers</span>
              </div>
              <div className="bg-rose-950/30 border border-rose-500/30 p-5 rounded-xl space-y-1">
                <span className="text-3xl font-black text-rose-400 block">{metrics.wrongCount}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300 block">Wrong Answers</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-1">
                <span className="text-3xl font-black text-slate-400 block">{metrics.unattemptedCount}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">Skipped Questions</span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}