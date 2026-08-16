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

export default function MockAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [timeSpent, setTimeSpent] = useState<Record<string, number>>({});
  const [allDbAttempts, setAllDbAttempts] = useState<any[]>([]);

  // Solution Navigation & Filtering
  const [activeTab, setActiveTab] = useState<'summary' | 'solutions'>('summary');
  const [solutionFilter, setSolutionFilter] = useState<'ALL' | 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED'>('ALL');
  const [solutionIndex, setSolutionIndex] = useState(0);

  useEffect(() => {
    if (testId) {
      fetchAnalysisData();
    }
  }, [testId]);

  async function fetchAnalysisData() {
    setLoading(true);

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

    let savedAnswers: Record<string, any> = {};
    let savedTime: Record<string, number> = {};

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      if (localSaved[testId]) {
        savedAnswers = localSaved[testId].answers || localSaved[testId].user_answers || {};
      }
    } catch (e) {}

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
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
        if (dbAns) savedAnswers = dbAns;
        if (latestAttempt.time_spent) savedTime = latestAttempt.time_spent;
      }
    }

    setUserAnswers(savedAnswers);
    setTimeSpent(savedTime);

    const { data: attemptsData } = await supabase
      .from('mock_attempts')
      .select('user_id, score')
      .eq('test_id', testId);

    if (attemptsData) {
      setAllDbAttempts(attemptsData);
    }

    setLoading(false);
  }

  const getAnswerForQuestion = (q: Question, idx: number) => {
    const qKey = q.id || idx.toString();
    return userAnswers[q.id] ?? userAnswers[idx] ?? userAnswers[qKey];
  };

  const calculateMetrics = () => {
    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    let timeCorrect = 0;
    let timeWrong = 0;
    let timeSkipped = 0;

    const sections = Array.from(new Set(questions.map((q) => q.section || 'QUANT')));
    const sectionStats: Record<string, { total: number; attempted: number; correct: number; wrong: number; score: number }> = {};
    sections.forEach((sec) => {
      sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0 };
    });

    questions.forEach((q, idx) => {
      const sec = q.section || 'QUANT';
      const userAns = getAnswerForQuestion(q, idx);
      const qKey = q.id || idx.toString();
      const spent = timeSpent[q.id] || timeSpent[idx] || timeSpent[qKey] || 0;

      if (!sectionStats[sec]) {
        sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0 };
      }

      sectionStats[sec].total += 1;

      if (userAns === undefined || userAns === null || userAns === '') {
        unattemptedCount += 1;
        timeSkipped += spent;
      } else if (Number(userAns) === Number(q.correctOptionIndex)) {
        correctCount += 1;
        totalScore += q.marks || 1.0;
        timeCorrect += spent;

        sectionStats[sec].attempted += 1;
        sectionStats[sec].correct += 1;
        sectionStats[sec].score += q.marks || 1.0;
      } else {
        wrongCount += 1;
        totalScore -= q.negativeMarks || 0.25;
        timeWrong += spent;

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
      timeCorrect,
      timeWrong,
      timeSkipped,
      sectionStats,
    };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-[#1D63B8] border-t-transparent rounded-full animate-spin mr-3"></div>
        Generating Performance Analytics & Leaderboard...
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

  const filteredSolutionQuestions = questions.filter((q, idx) => {
    const ans = getAnswerForQuestion(q, idx);
    if (solutionFilter === 'CORRECT') return ans !== undefined && Number(ans) === Number(q.correctOptionIndex);
    if (solutionFilter === 'INCORRECT') return ans !== undefined && Number(ans) !== Number(q.correctOptionIndex);
    if (solutionFilter === 'UNATTEMPTED') return ans === undefined || ans === null || ans === '';
    return true;
  });

  const currentSolQ = filteredSolutionQuestions[solutionIndex] || filteredSolutionQuestions[0];
  const originalIndex = currentSolQ ? questions.findIndex((q) => q.id === currentSolQ.id) : 0;
  const currentUserAns = currentSolQ ? getAnswerForQuestion(currentSolQ, originalIndex) : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* HEADER */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div>
          <span className="text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full">
            Official Performance Analysis
          </span>
          <h1 className="text-base font-bold text-white mt-1">{test.title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 font-bold rounded-lg transition ${
                activeTab === 'summary' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 Performance Summary
            </button>
            <button
              onClick={() => { setActiveTab('solutions'); setSolutionIndex(0); }}
              className={`px-4 py-2 font-bold rounded-lg transition ${
                activeTab === 'solutions' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              📖 Question Solutions
            </button>
          </div>

          <Link href="/tests" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl">
            Exit to Catalog
          </Link>
        </div>
      </header>

      {/* BODY WORKSPACE */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {activeTab === 'summary' ? (
          <div className="space-y-6">
            
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

            {/* TOP METRIC CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
                <span className="text-3xl font-black text-amber-400 block">{metrics.totalScore.toFixed(2)} <span className="text-xs text-slate-500 font-normal">/ {test.total_marks}</span></span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Marks</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
                <span className="text-3xl font-black text-blue-400 block">#{metrics.userRank} <span className="text-xs text-slate-500 font-normal">/ {metrics.totalStudents}</span></span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Real Student Rank</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
                <span className="text-3xl font-black text-purple-400 block">{metrics.percentile}%</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Percentile</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-1">
                <span className="text-3xl font-black text-emerald-400 block">{metrics.accuracy}%</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Accuracy</span>
              </div>
            </div>

            {/* DETAILED BREAKDOWN CARDS */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">📌 Detailed Attempt Breakdown</h3>
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

            {/* TIME MANAGEMENT ANALYTICS */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">⏱️ Time Management Efficiency</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Time on Correct Answers</span>
                  <span className="font-mono font-bold text-emerald-400">{formatTime(metrics.timeCorrect)}</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Time on Incorrect Answers</span>
                  <span className="font-mono font-bold text-rose-400">{formatTime(metrics.timeWrong)}</span>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Time on Skipped Questions</span>
                  <span className="font-mono font-bold text-slate-400">{formatTime(metrics.timeSkipped)}</span>
                </div>
              </div>
            </div>

            {/* SECTIONAL BREAKDOWN TABLE */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">📑 Section-Wise Performance Breakdown</h3>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-bold">
                    <tr>
                      <th className="p-3.5">Section Name</th>
                      <th className="p-3.5">Total Qs</th>
                      <th className="p-3.5">Attempted</th>
                      <th className="p-3.5">Correct</th>
                      <th className="p-3.5">Wrong</th>
                      <th className="p-3.5">Score Obtained</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {Object.entries(metrics.sectionStats).map(([sec, stats]) => (
                      <tr key={sec} className="hover:bg-slate-800/50">
                        <td className="p-3.5 font-bold text-white">{sec}</td>
                        <td className="p-3.5">{stats.total}</td>
                        <td className="p-3.5 font-bold text-blue-400">{stats.attempted}</td>
                        <td className="p-3.5 font-bold text-emerald-400">{stats.correct}</td>
                        <td className="p-3.5 font-bold text-rose-400">{stats.wrong}</td>
                        <td className="p-3.5 font-bold text-amber-400">{stats.score.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* SOLUTIONS TAB */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6">
              {currentSolQ ? (
                <div className="space-y-5">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <span className="text-xs font-bold text-slate-300">
                      Question {originalIndex + 1} ({currentSolQ.section})
                    </span>

                    {currentUserAns === undefined || currentUserAns === null || currentUserAns === '' ? (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        Unattempted (Skipped)
                      </span>
                    ) : Number(currentUserAns) === Number(currentSolQ.correctOptionIndex) ? (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        ✓ Correct (+{currentSolQ.marks || 1.0})
                      </span>
                    ) : (
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                        ✗ Incorrect (-{currentSolQ.negativeMarks || 0.25})
                      </span>
                    )}
                  </div>

                  {currentSolQ.passageText && (
                    <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-slate-300 leading-relaxed font-serif">
                      <strong className="text-blue-400 block mb-1 font-sans uppercase text-[10px]">Context / Passage:</strong>
                      {currentSolQ.passageText}
                    </div>
                  )}

                  <h3 className="text-sm font-bold text-white leading-relaxed">
                    {currentSolQ.questionText}
                  </h3>

                  <div className="space-y-2.5 pt-1">
                    {currentSolQ.options.map((opt, optIdx) => {
                      const userSelected = currentUserAns !== undefined && Number(currentUserAns) === optIdx;
                      const isCorrect = Number(currentSolQ.correctOptionIndex) === optIdx;

                      let optStyle = 'bg-slate-950 border-slate-800 text-slate-300';
                      if (isCorrect) {
                        optStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold';
                      } else if (userSelected && !isCorrect) {
                        optStyle = 'bg-rose-500/20 border-rose-500 text-rose-200 font-bold';
                      }

                      return (
                        <div
                          key={optIdx}
                          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${optStyle}`}
                        >
                          <div>
                            <span className="font-bold mr-2.5">{String.fromCharCode(65 + optIdx)}.</span>
                            <span>{opt}</span>
                          </div>
                          <div className="flex gap-2">
                            {isCorrect && (
                              <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded uppercase">
                                Correct Answer
                              </span>
                            )}
                            {userSelected && !isCorrect && (
                              <span className="text-[10px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded uppercase">
                                Your Pick
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {currentSolQ.explanation && (
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1 mt-4">
                      <span className="text-[11px] font-black uppercase text-amber-400 block">💡 Official Solution & Explanation:</span>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{currentSolQ.explanation}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 text-xs text-center py-12">No questions found under this solution filter.</p>
              )}

              <div className="flex justify-between items-center border-t border-slate-800 pt-4">
                <button
                  disabled={solutionIndex === 0}
                  onClick={() => setSolutionIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition"
                >
                  ← Previous Question
                </button>
                <button
                  disabled={solutionIndex >= filteredSolutionQuestions.length - 1}
                  onClick={() => setSolutionIndex((prev) => Math.min(filteredSolutionQuestions.length - 1, prev + 1))}
                  className="px-4 py-2 bg-[#1D63B8] hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition"
                >
                  Next Question →
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Filter Solutions</label>
                <div className="space-y-1 text-xs font-medium">
                  {[
                    { key: 'ALL', label: `All Questions (${questions.length})` },
                    { key: 'CORRECT', label: `Correct Only (${metrics.correctCount})` },
                    { key: 'INCORRECT', label: `Incorrect Only (${metrics.wrongCount})` },
                    { key: 'UNATTEMPTED', label: `Skipped Only (${metrics.unattemptedCount})` },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => { setSolutionFilter(f.key as any); setSolutionIndex(0); }}
                      className={`w-full text-left px-3 py-2 rounded-xl transition text-xs ${
                        solutionFilter === f.key ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                <label className="block text-[11px] font-bold text-slate-400 uppercase">Jump to Question</label>
                <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto p-1">
                  {filteredSolutionQuestions.map((q, idx) => {
                    const origIdx = questions.findIndex((orig) => orig.id === q.id);
                    const userAns = getAnswerForQuestion(q, origIdx);
                    let btnColor = 'bg-slate-800 text-slate-300';
                    if (userAns !== undefined && userAns !== null && userAns !== '') {
                      btnColor = Number(userAns) === Number(q.correctOptionIndex) ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white';
                    }

                    const isCurrent = currentSolQ && currentSolQ.id === q.id;

                    return (
                      <button
                        key={q.id}
                        onClick={() => setSolutionIndex(idx)}
                        className={`h-8 font-bold text-xs rounded-lg border transition flex items-center justify-center ${btnColor} ${
                          isCurrent ? 'ring-2 ring-amber-400 scale-105' : 'border-slate-700'
                        }`}
                      >
                        {origIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}