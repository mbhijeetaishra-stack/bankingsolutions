'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Question {
  id: string;
  section: 'ENGLISH' | 'QUANT' | 'REASONING' | 'GA' | string;
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
  questions: Question[] | string;
}

interface DbAttempt {
  user_id: string;
  score: number;
}

export default function TCSiONMockTestPlayerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const testId = params?.id as string;
  const mode = searchParams.get('mode'); // 'reattempt' | 'solution' | null

  // Test & User Info
  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState('Aspirant');
  const [rollCode, setRollCode] = useState('BS2026-GUEST');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Real-Time Student Attempts for Rank Computation
  const [allDbAttempts, setAllDbAttempts] = useState<DbAttempt[]>([]);

  // Section Management States
  const [sections, setSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');
  const [lockedSections, setLockedSections] = useState<Record<string, boolean>>({});

  // Question & Answers Tracking
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<number, boolean>>({ 0: true });
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<number, number>>({});

  // Submission & Timer States
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sectionalTimeLeft, setSectionalTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  useEffect(() => {
    fetchUserData();
    if (testId) fetchMockTestAndAttempts();
  }, [testId]);

  // Sectional Timer & Time Spent Tracker
  useEffect(() => {
    if (test && !isSubmitted && sectionalTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setSectionalTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSectionTimeout();
            return 0;
          }
          return prev - 1;
        });

        setQuestionTimeSpent((prev) => ({
          ...prev,
          [activeIndex]: (prev[activeIndex] || 0) + 1,
        }));
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [test, isSubmitted, sectionalTimeLeft, activeSection, activeIndex]);

  async function fetchUserData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const user = session.user;
      setCurrentUser(user);
      setCandidateName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Aspirant');
      setRollCode(`BS2026-${user.id.slice(0, 4).toUpperCase()}`);
    }
  }

  async function fetchMockTestAndAttempts() {
    setLoading(true);

    // 1. Fetch Mock Test
    const { data, error } = await supabase
      .from('mock_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    const mockData = data as MockTest;
    let parsedQuestions: Question[] = [];

    if (typeof mockData.questions === 'string') {
      try { parsedQuestions = JSON.parse(mockData.questions); } catch (e) { parsedQuestions = []; }
    } else if (Array.isArray(mockData.questions)) {
      parsedQuestions = mockData.questions;
    }

    const uniqueSections = Array.from(new Set(parsedQuestions.map((q) => q.section || 'QUANT')));
    setSections(uniqueSections);

    if (uniqueSections.length > 0) {
      setActiveSection(uniqueSections[0]);
      const secTime = Math.floor(((mockData.duration_minutes || 60) * 60) / uniqueSections.length);
      setSectionalTimeLeft(secTime);
    }

    setTest(mockData);
    setQuestions(parsedQuestions);

    // 2. Fetch All Student Attempts for this Mock
    const { data: attemptsData } = await supabase
      .from('mock_attempts')
      .select('user_id, score')
      .eq('test_id', testId);

    if (attemptsData) {
      setAllDbAttempts(attemptsData as DbAttempt[]);
    }

    // 3. If mode is "solution", populate past attempt & open in solution view
    if (mode === 'solution') {
      setIsSubmitted(true);
      setShowAnalysis(true);

      try {
        const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
        if (localSaved[testId]?.answers) {
          setSelectedAnswers(localSaved[testId].answers);
        }
      } catch (e) {}
    }

    setLoading(false);
  }

  const handleSectionTimeout = () => {
    setLockedSections((prev) => ({ ...prev, [activeSection]: true }));

    const currentSecIdx = sections.indexOf(activeSection);
    if (currentSecIdx < sections.length - 1) {
      const nextSection = sections[currentSecIdx + 1];
      setActiveSection(nextSection);

      const secTime = Math.floor(((test?.duration_minutes || 60) * 60) / sections.length);
      setSectionalTimeLeft(secTime);

      const firstNextIdx = questions.findIndex((q) => (q.section || 'QUANT') === nextSection);
      if (firstNextIdx !== -1) {
        setActiveIndex(firstNextIdx);
        setVisitedQuestions((prev) => ({ ...prev, [firstNextIdx]: true }));
      }
    } else {
      finalizeAndSaveMock(selectedAnswers);
    }
  };

  const handleManualSubmitSection = () => {
    if (confirm(`Submit Section "${activeSection}"? You CANNOT return to this section once submitted.`)) {
      if (timerRef.current) clearInterval(timerRef.current);
      handleSectionTimeout();
    }
  };

  const handleSubmitFullTest = () => {
    if (confirm('Are you sure you want to submit the entire test?')) {
      if (timerRef.current) clearInterval(timerRef.current);
      finalizeAndSaveMock(selectedAnswers);
    }
  };

  const finalizeAndSaveMock = async (answers: Record<number, number>) => {
    if (!test) return;

    let score = 0;
    questions.forEach((q, idx) => {
      const userAns = answers[idx];
      if (userAns === q.correctOptionIndex) {
        score += q.marks || 1.0;
      } else if (userAns !== undefined) {
        score -= q.negativeMarks || 0.25;
      }
    });

    const attemptPayload = {
      test_id: test.id,
      score: score,
      total_marks: test.total_marks,
      answers: answers,
    };

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      localSaved[test.id] = attemptPayload;
      localStorage.setItem('bsca_mock_attempts', JSON.stringify(localSaved));
    } catch (e) {}

    if (currentUser?.id) {
      await supabase.from('mock_attempts').upsert([
        {
          user_id: currentUser.id,
          test_id: test.id,
          score: score,
          total_marks: test.total_marks,
          answers: answers,
          time_spent: questionTimeSpent,
          completed_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,test_id' });
    }

    const allLocked: Record<string, boolean> = {};
    sections.forEach((s) => (allLocked[s] = true));
    setLockedSections(allLocked);

    setIsSubmitted(true);
    setShowAnalysis(true);
  };

  const handleSelectQuestion = (globalIdx: number) => {
    const qSec = questions[globalIdx]?.section || 'QUANT';
    if (!isSubmitted && qSec !== activeSection) {
      alert(`You are in section "${activeSection}". Submit this section first to move ahead.`);
      return;
    }
    setActiveIndex(globalIdx);
    setVisitedQuestions((prev) => ({ ...prev, [globalIdx]: true }));
  };

  const handleNext = () => {
    const activeSectionIndices = questions
      .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
      .filter((idx) => idx !== -1);

    const currentPos = activeSectionIndices.indexOf(activeIndex);
    if (currentPos < activeSectionIndices.length - 1) {
      const nextGlobalIdx = activeSectionIndices[currentPos + 1];
      setActiveIndex(nextGlobalIdx);
      setVisitedQuestions((prev) => ({ ...prev, [nextGlobalIdx]: true }));
    }
  };

  const handlePrev = () => {
    const activeSectionIndices = questions
      .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
      .filter((idx) => idx !== -1);

    const currentPos = activeSectionIndices.indexOf(activeIndex);
    if (currentPos > 0) {
      const prevGlobalIdx = activeSectionIndices[currentPos - 1];
      setActiveIndex(prevGlobalIdx);
      setVisitedQuestions((prev) => ({ ...prev, [prevGlobalIdx]: true }));
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    if (isSubmitted || lockedSections[activeSection]) return;
    setSelectedAnswers((prev) => ({ ...prev, [activeIndex]: optionIdx }));
  };

  const handleClearResponse = () => {
    if (isSubmitted || lockedSections[activeSection]) return;
    setSelectedAnswers((prev) => {
      const updated = { ...prev };
      delete updated[activeIndex];
      return updated;
    });
  };

  const handleToggleMarkReview = () => {
    if (isSubmitted || lockedSections[activeSection]) return;
    setMarkedForReview((prev) => ({ ...prev, [activeIndex]: !prev[activeIndex] }));
    handleNext();
  };

  const calculateDetailedAnalysis = () => {
    let totalScore = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalUnattempted = 0;

    let timeCorrect = 0;
    let timeWrong = 0;
    let timeSkipped = 0;

    const sectionStats: Record<string, { total: number; attempted: number; correct: number; wrong: number; score: number }> = {};
    sections.forEach((sec) => {
      sectionStats[sec] = { total: 0, attempted: 0, correct: 0, wrong: 0, score: 0 };
    });

    questions.forEach((q, idx) => {
      const sec = q.section || 'QUANT';
      const userAns = selectedAnswers[idx];
      const spent = questionTimeSpent[idx] || 0;

      sectionStats[sec].total += 1;

      if (userAns === undefined) {
        totalUnattempted += 1;
        timeSkipped += spent;
      } else if (userAns === q.correctOptionIndex) {
        totalCorrect += 1;
        totalScore += q.marks || 1.0;
        timeCorrect += spent;

        sectionStats[sec].attempted += 1;
        sectionStats[sec].correct += 1;
        sectionStats[sec].score += q.marks || 1.0;
      } else {
        totalWrong += 1;
        totalScore -= q.negativeMarks || 0.25;
        timeWrong += spent;

        sectionStats[sec].attempted += 1;
        sectionStats[sec].wrong += 1;
        sectionStats[sec].score -= q.negativeMarks || 0.25;
      }
    });

    const accuracy = (totalCorrect + totalWrong) > 0 
      ? ((totalCorrect / (totalCorrect + totalWrong)) * 100).toFixed(1) 
      : '0.0';

    const allScores = [...allDbAttempts.map((a) => a.score), totalScore].sort((a, b) => b - a);
    const userRank = allScores.indexOf(totalScore) + 1;
    const totalStudentsAttempted = allScores.length;
    const percentile = (((totalStudentsAttempted - userRank) / totalStudentsAttempted) * 100).toFixed(1);

    return {
      totalScore,
      totalCorrect,
      totalWrong,
      totalUnattempted,
      accuracy,
      userRank,
      totalStudentsAttempted,
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-[#1D63B8] border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading TCS iON Engine...
      </div>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold">Test Not Found</h2>
        <Link href="/tests" className="px-5 py-2.5 bg-[#1D63B8] text-white font-bold text-xs rounded-lg shadow">
          Back to Tests Portal
        </Link>
      </div>
    );
  }

  const activeQuestion = questions[activeIndex];
  const hasPassage = Boolean(
    activeQuestion?.passageText && activeQuestion.passageText.trim().length > 0
  );

  // SECTION SCOPE VARIABLES
  const sectionQuestions = questions.filter((q) => (q.section || 'QUANT') === activeSection);
  const activeSectionQuestionIndices = questions
    .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
    .filter((idx) => idx !== -1);

  const analysis = isSubmitted ? calculateDetailedAnalysis() : null;

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 font-sans flex flex-col selection:bg-blue-200">
      {/* 1. TOP BRANDING HEADER */}
      <header className="bg-[#1D63B8] text-white px-6 py-2.5 flex justify-between items-center shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-[#1D63B8] rounded font-black text-sm flex items-center justify-center shadow-inner">
            BS
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-tight">{test.title}</h1>
            <p className="text-[10px] text-blue-100 uppercase font-semibold">{test.exam_type}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isSubmitted ? (
            <div className="bg-white/10 border border-white/20 px-4 py-1 rounded text-white font-mono font-bold text-sm flex items-center gap-2">
              <span className="text-xs">⏱️ Section Time:</span>
              <span className="text-base text-yellow-300 font-black">{formatTime(sectionalTimeLeft)}</span>
            </div>
          ) : (
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="px-3 py-1 bg-amber-400 text-slate-950 font-bold text-xs rounded shadow"
            >
              {showAnalysis ? 'Hide Scorecard' : '📊 View Rank & Scorecard'}
            </button>
          )}

          {!isSubmitted ? (
            <button
              onClick={handleManualSubmitSection}
              className="px-3 py-1 bg-[#154B94] hover:bg-[#103a75] text-white font-bold text-xs rounded border border-white/20 shadow transition"
            >
              Submit Section ({activeSection})
            </button>
          ) : (
            <Link href="/tests" className="px-3 py-1 bg-slate-800 text-white font-bold text-xs rounded">
              Exit Portal
            </Link>
          )}
        </div>
      </header>

      {/* 2. SECTIONAL TABS */}
      <div className="bg-white border-b border-slate-300 px-6 py-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
          <span className="text-xs font-bold text-slate-500 uppercase mr-2">Sections:</span>
          {sections.map((sec) => {
            const isLocked = lockedSections[sec];
            const isActive = activeSection === sec;

            return (
              <button
                key={sec}
                disabled={!isSubmitted && !isActive}
                onClick={() => {
                  if (isSubmitted) {
                    setActiveSection(sec);
                    const firstIdx = questions.findIndex((q) => (q.section || 'QUANT') === sec);
                    if (firstIdx !== -1) setActiveIndex(firstIdx);
                  }
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#1D63B8] text-white shadow'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
              >
                <span>{sec}</span>
                {!isSubmitted && !isActive && <span className="text-[10px]">🔒</span>}
                {isLocked && <span className="text-[10px] text-emerald-600">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-700">
          <span className="font-bold">Candidate: <span className="text-[#1D63B8]">{candidateName}</span></span>
          <span className="text-slate-300">|</span>
          <span className="font-bold">Roll No: <span className="text-[#1D63B8] font-mono">{rollCode}</span></span>
        </div>
      </div>

      {/* 3. RANK & SCORECARD OVERLAY MODAL */}
      {isSubmitted && showAnalysis && analysis && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur z-50 overflow-y-auto p-6 flex justify-center items-start">
          <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl border border-slate-300 p-8 space-y-6 my-8">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                  Official Scorecard & Student Rank
                </span>
                <h2 className="text-xl font-black text-slate-900 pt-1">{test.title}</h2>
              </div>
              <button
                onClick={() => setShowAnalysis(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl"
              >
                ✕ Close Scorecard
              </button>
            </div>

            {/* REAL-TIME RANK & METRICS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                <span className="text-2xl md:text-3xl font-black text-[#1D63B8] block">{analysis.totalScore.toFixed(2)}</span>
                <span className="text-[10px] uppercase font-bold text-slate-500">Total Marks</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <span className="text-2xl md:text-3xl font-black text-amber-700 block">
                  #{analysis.userRank} <span className="text-xs font-normal text-slate-500">/ {analysis.totalStudentsAttempted}</span>
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500">Real Student Rank</span>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
                <span className="text-2xl md:text-3xl font-black text-purple-700 block">{analysis.percentile}%</span>
                <span className="text-[10px] uppercase font-bold text-slate-500">Percentile</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <span className="text-2xl md:text-3xl font-black text-emerald-700 block">{analysis.accuracy}%</span>
                <span className="text-[10px] uppercase font-bold text-slate-500">Overall Accuracy</span>
              </div>
            </div>

            {/* TIME SPENT METRICS */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-700">⏱️ Time Spent Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex justify-between items-center">
                  <span className="font-bold text-emerald-900">Correct Answers Time</span>
                  <span className="font-black text-emerald-700 font-mono text-sm">{formatTime(analysis.timeCorrect)}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex justify-between items-center">
                  <span className="font-bold text-rose-900">Wrong Answers Time</span>
                  <span className="font-black text-rose-700 font-mono text-sm">{formatTime(analysis.timeWrong)}</span>
                </div>
                <div className="bg-slate-100 border border-slate-300 p-3 rounded-xl flex justify-between items-center">
                  <span className="font-bold text-slate-700">Skipped Questions Time</span>
                  <span className="font-black text-slate-800 font-mono text-sm">{formatTime(analysis.timeSkipped)}</span>
                </div>
              </div>
            </div>

            {/* SECTION PERFORMANCE TABLE */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-700">Section-Wise Breakdown</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="p-3">Section</th>
                      <th className="p-3">Total Qs</th>
                      <th className="p-3">Attempted</th>
                      <th className="p-3">Correct</th>
                      <th className="p-3">Wrong</th>
                      <th className="p-3">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {Object.entries(analysis.sectionStats).map(([sec, stats]) => (
                      <tr key={sec} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">{sec}</td>
                        <td className="p-3">{stats.total}</td>
                        <td className="p-3 font-bold text-blue-700">{stats.attempted}</td>
                        <td className="p-3 font-bold text-emerald-700">{stats.correct}</td>
                        <td className="p-3 font-bold text-rose-700">{stats.wrong}</td>
                        <td className="p-3 font-bold text-slate-900">{stats.score.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setShowAnalysis(false)}
                className="px-6 py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow"
              >
                Review Step-By-Step Question Solutions →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN EXAM DISPLAY WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* QUESTION DISPLAY AREA */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col justify-between">
          {hasPassage ? (
            /* SPLIT SCREEN (When passageText exists) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-[60vh]">
              <div className="bg-white border border-slate-300 rounded-lg p-5 overflow-y-auto max-h-[65vh] shadow-sm">
                <div className="bg-blue-50 border-l-4 border-[#1D63B8] px-3 py-1.5 text-[11px] font-bold text-[#1D63B8] uppercase mb-3">
                  Directions / Passage Context
                </div>
                <div className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line">
                  {activeQuestion.passageText}
                </div>
              </div>

              <div className="bg-white border border-slate-300 rounded-lg p-5 flex flex-col justify-between max-h-[65vh] overflow-y-auto shadow-sm">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2 text-xs font-bold text-slate-600">
                    <span>Question {activeIndex + 1} ({activeQuestion.section})</span>
                    <span className="text-emerald-700">Marks: +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25}</span>
                  </div>

                  <h3 className="text-xs md:text-sm font-bold text-slate-900 leading-relaxed">
                    {activeQuestion.questionText}
                  </h3>

                  <div className="space-y-2 pt-2">
                    {activeQuestion.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[activeIndex] === optIdx;
                      const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                      let btnStyle = 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50';

                      if (isSubmitted) {
                        if (isCorrect) btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                        else if (isSelected && !isCorrect) btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                      } else if (isSelected) {
                        btnStyle = 'bg-blue-50 border-[#1D63B8] text-[#1D63B8] font-bold shadow-sm';
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={lockedSections[activeSection] && !isSubmitted}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full p-3 rounded-lg border text-left text-xs transition flex items-center justify-between ${btnStyle}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                              isSelected ? 'bg-[#1D63B8] text-white border-[#1D63B8]' : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isSubmitted && activeQuestion.explanation && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-1">
                    <span className="font-bold text-amber-900 block">💡 Solution & Explanation:</span>
                    <p className="text-slate-800 leading-relaxed">{activeQuestion.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* FULL SCREEN (When passageText is empty) */
            <div className="max-w-4xl mx-auto w-full bg-white border border-slate-300 rounded-lg p-6 space-y-5 shadow-sm my-auto">
              <div className="flex justify-between items-center border-b pb-2 text-xs font-bold text-slate-600">
                <span>Question {activeIndex + 1} ({activeQuestion.section})</span>
                <span className="text-emerald-700">Marks: +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25}</span>
              </div>

              <h3 className="text-sm md:text-base font-bold text-slate-900 leading-relaxed">
                {activeQuestion.questionText}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {activeQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[activeIndex] === optIdx;
                  const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                  let btnStyle = 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50';

                  if (isSubmitted) {
                    if (isCorrect) btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                    else if (isSelected && !isCorrect) btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'bg-blue-50 border-[#1D63B8] text-[#1D63B8] font-bold shadow-sm';
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={lockedSections[activeSection] && !isSubmitted}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`p-3.5 rounded-lg border text-left text-xs transition flex items-center justify-between ${btnStyle}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center border ${
                          isSelected ? 'bg-[#1D63B8] text-white border-[#1D63B8]' : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {isSubmitted && activeQuestion.explanation && (
                <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-amber-900 block">💡 Solution & Explanation:</span>
                  <p className="text-slate-800 leading-relaxed">{activeQuestion.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* CONTROL BUTTONS */}
          {!isSubmitted && (
            <div className="bg-white border border-slate-300 rounded-lg p-3 max-w-4xl mx-auto w-full flex flex-wrap justify-between items-center gap-2 mt-4 shadow-sm">
              <div className="flex gap-2">
                <button
                  onClick={handleToggleMarkReview}
                  className={`px-3 py-2 rounded text-xs font-bold border transition ${
                    markedForReview[activeIndex]
                      ? 'bg-purple-700 text-white border-purple-800'
                      : 'bg-white border-purple-400 text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  Mark for Review & Next
                </button>
                <button
                  onClick={handleClearResponse}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs rounded transition"
                >
                  Clear Response
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={activeSectionQuestionIndices.indexOf(activeIndex) === 0}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-40 text-slate-700 font-bold text-xs rounded transition"
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded shadow transition"
                >
                  Save & Next →
                </button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT PALETTE */}
        <aside className="w-full lg:w-80 bg-white border-l border-slate-300 p-4 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded flex items-center gap-3">
              <div className="w-10 h-10 bg-[#1D63B8] text-white rounded-full flex items-center justify-center font-bold text-sm">
                {candidateName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 block">{candidateName}</span>
                <span className="text-[10px] text-slate-500 font-mono">Roll: {rollCode}</span>
              </div>
            </div>

            <h2 className="text-xs font-bold uppercase text-slate-700 border-b pb-1">
              Section Palette ({sectionQuestions.length} Questions)
            </h2>

            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-emerald-600 text-white rounded-sm inline-block"></span> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-rose-600 text-white rounded-sm inline-block"></span> Not Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-purple-700 text-white rounded-full inline-block"></span> Marked Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-slate-100 border border-slate-400 text-slate-700 rounded-sm inline-block"></span> Not Visited
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto p-1">
              {activeSectionQuestionIndices.map((globalIdx, localIdx) => {
                const isAns = selectedAnswers[globalIdx] !== undefined;
                const isVisited = visitedQuestions[globalIdx];
                const isMarked = markedForReview[globalIdx];
                const isActive = activeIndex === globalIdx;

                let paletteStyle = 'bg-slate-100 border-slate-300 text-slate-700';

                if (isMarked) {
                  paletteStyle = 'bg-purple-700 text-white rounded-full font-bold';
                } else if (isAns) {
                  paletteStyle = 'bg-emerald-600 text-white font-bold';
                } else if (isVisited) {
                  paletteStyle = 'bg-rose-600 text-white font-bold';
                }

                return (
                  <button
                    key={globalIdx}
                    onClick={() => handleSelectQuestion(globalIdx)}
                    className={`h-9 text-xs font-bold transition flex items-center justify-center border shadow-sm ${paletteStyle} ${
                      isActive ? 'ring-2 ring-[#1D63B8] font-black z-10' : ''
                    }`}
                  >
                    {localIdx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {!isSubmitted ? (
            <button
              onClick={handleSubmitFullTest}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded uppercase tracking-wider transition shadow"
            >
              Submit Entire Exam
            </button>
          ) : (
            <button
              onClick={() => setShowAnalysis(true)}
              className="w-full py-2.5 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded uppercase tracking-wider transition shadow"
            >
              📊 View Rank & Percentile
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}