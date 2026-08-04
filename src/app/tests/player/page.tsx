'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  questions: Question[] | string;
}

function MockTestPlayerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get('id');

  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Test Tracking States
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<number, boolean>>({ 0: true });
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});

  // ⚡ MOBILE PALETTE DRAWER STATE
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // Submission & Timer States
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (testId) {
      fetchMockTest(testId);
    } else {
      setLoading(false);
    }
  }, [testId]);

  // Countdown Timer Effect
  useEffect(() => {
    if (test && !isSubmitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [test, isSubmitted, timeLeft]);

  async function fetchMockTest(id: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('mock_tests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    const mockData = data as MockTest;
    let parsedQuestions: Question[] = [];

    if (typeof mockData.questions === 'string') {
      try {
        parsedQuestions = JSON.parse(mockData.questions);
      } catch (e) {
        parsedQuestions = [];
      }
    } else if (Array.isArray(mockData.questions)) {
      parsedQuestions = mockData.questions;
    }

    setTest(mockData);
    setQuestions(parsedQuestions);
    setTimeLeft((mockData.duration_minutes || 60) * 60);
    setLoading(false);
  }

  // Navigation & Palette Actions
  const handleSelectQuestion = (index: number) => {
    setActiveIndex(index);
    setVisitedQuestions((prev) => ({ ...prev, [index]: true }));
    setIsMobilePaletteOpen(false); // ⚡ Auto close drawer on mobile option select
  };

  const handleNext = () => {
    if (activeIndex < questions.length - 1) {
      const nextIdx = activeIndex + 1;
      setActiveIndex(nextIdx);
      setVisitedQuestions((prev) => ({ ...prev, [nextIdx]: true }));
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      const prevIdx = activeIndex - 1;
      setActiveIndex(prevIdx);
      setVisitedQuestions((prev) => ({ ...prev, [prevIdx]: true }));
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [activeIndex]: optionIdx }));
  };

  const handleClearResponse = () => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => {
      const updated = { ...prev };
      delete updated[activeIndex];
      return updated;
    });
  };

  const handleToggleMarkReview = () => {
    setMarkedForReview((prev) => ({ ...prev, [activeIndex]: !prev[activeIndex] }));
  };

  const handleAutoSubmit = () => {
    setIsSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSubmitTest = () => {
    if (confirm('Are you sure you want to submit the test?')) {
      setIsSubmitted(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Score Analysis Calculation
  const calculateResults = () => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    questions.forEach((q, idx) => {
      const userAns = selectedAnswers[idx];
      if (userAns === undefined) {
        unattemptedCount += 1;
      } else if (userAns === q.correctOptionIndex) {
        correctCount += 1;
        score += q.marks || 1.0;
      } else {
        wrongCount += 1;
        score -= q.negativeMarks || 0.25;
      }
    });

    return { score, correctCount, wrongCount, unattemptedCount };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading Mock Engine...
      </div>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold">No Active Test Selected</h2>
        <p className="text-xs text-slate-400">Select a published mock test from the portal to start practice.</p>
        <Link href="/tests" className="px-5 py-2.5 bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow">
          Return to Test Series Portal →
        </Link>
      </div>
    );
  }

  const activeQuestion = questions[activeIndex];
  const hasPassage = Boolean(
    activeQuestion?.passageText && activeQuestion.passageText.trim().length > 0
  );
  const results = isSubmitted ? calculateResults() : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* EXAM TOP HEADER */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-400 rounded-lg flex items-center justify-center font-black text-slate-950 text-sm">
            BS
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-extrabold text-white leading-tight truncate max-w-[150px] sm:max-w-none">{test.title}</h1>
            <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">{test.exam_type}</p>
          </div>
        </div>

        {!isSubmitted ? (
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1.5 md:gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono font-black text-xs md:text-base px-2.5 md:px-4 py-1.5 rounded-xl">
              <span>⏱️</span>
              <span>{formatTime(timeLeft)}</span>
            </div>

            <button
              onClick={handleSubmitTest}
              className="px-3 md:px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow uppercase tracking-wider transition"
            >
              Submit
            </button>

            {/* ⚡ MOBILE PALETTE TOGGLE BUTTON */}
            <button
              onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
              className="lg:hidden bg-slate-800 border border-slate-700 text-slate-200 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1"
            >
              <span>☰</span>
              <span className="text-[10px]">Palette</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-400">Score: {results?.score.toFixed(2)} / {test.total_marks}</span>
            <Link href="/tests" className="px-4 py-2 bg-slate-800 text-slate-200 font-bold text-xs rounded-xl">
              Exit Test
            </Link>
          </div>
        )}
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* QUESTION DISPLAY AREA */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto bg-slate-900 flex flex-col justify-between">
          {hasPassage ? (
            /* 1. SPLIT SCREEN LAYOUT */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-[60vh]">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-6 overflow-y-auto max-h-[65vh]">
                <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded mb-3 inline-block">
                  📌 Direction / Passage Context
                </span>
                <div className="text-xs text-slate-300 leading-relaxed space-y-2 whitespace-pre-line font-medium">
                  {activeQuestion.passageText}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 md:p-6 flex flex-col justify-between max-h-[65vh] overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <span className="text-xs font-extrabold text-white">Question {activeIndex + 1}</span>
                    <span className="text-[11px] font-bold text-slate-400">
                      +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25} Marks
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white leading-relaxed">
                    {activeQuestion.questionText}
                  </h3>

                  <div className="space-y-2.5 pt-2">
                    {activeQuestion.options.map((opt: string, optIdx: number) => {
                      const isSelected = selectedAnswers[activeIndex] === optIdx;
                      const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                      let btnStyle = 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';

                      if (isSubmitted) {
                        if (isCorrect) btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                        else if (isSelected && !isCorrect) btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold';
                      } else if (isSelected) {
                        btnStyle = 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold';
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full p-3.5 rounded-xl border text-left text-xs transition flex items-center justify-between ${btnStyle}`}
                        >
                          <div>
                            <span className="font-bold mr-2.5">{String.fromCharCode(65 + optIdx)}.</span>
                            {opt}
                          </div>
                          {isSelected && !isSubmitted && <span className="text-amber-400 text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isSubmitted && activeQuestion.explanation && (
                  <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[11px] font-black uppercase text-amber-400 block">💡 Solution & Explanation:</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{activeQuestion.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 2. FULL SCREEN LAYOUT */
            <div className="max-w-4xl mx-auto w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 md:p-8 space-y-6 shadow-2xl my-auto">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs font-extrabold text-white">Question {activeIndex + 1}</span>
                <span className="text-[11px] font-bold text-slate-400">
                  +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25} Marks
                </span>
              </div>

              <h3 className="text-xs md:text-base font-bold text-white leading-relaxed">
                {activeQuestion.questionText}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                {activeQuestion.options.map((opt: string, optIdx: number) => {
                  const isSelected = selectedAnswers[activeIndex] === optIdx;
                  const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                  let btnStyle = 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';

                  if (isSubmitted) {
                    if (isCorrect) btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                    else if (isSelected && !isCorrect) btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold';
                  }

                  return (
                    <button
                      key={optIdx}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`p-3.5 md:p-4 rounded-xl border text-left text-xs transition flex items-center justify-between ${btnStyle}`}
                    >
                      <div>
                        <span className="font-bold mr-2.5">{String.fromCharCode(65 + optIdx)}.</span>
                        {opt}
                      </div>
                      {isSelected && !isSubmitted && <span className="text-amber-400 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>

              {isSubmitted && activeQuestion.explanation && (
                <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[11px] font-black uppercase text-amber-400 block">💡 Solution & Explanation:</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{activeQuestion.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* BOTTOM CONTROL ACTIONS */}
          {!isSubmitted && (
            <div className="max-w-4xl mx-auto w-full flex flex-wrap justify-between items-center gap-3 pt-4 md:pt-6 border-t border-slate-800 mt-4 md:mt-6">
              <div className="flex gap-2">
                <button
                  onClick={handleToggleMarkReview}
                  className={`px-3.5 md:px-4 py-2 md:py-2.5 rounded-xl font-bold text-[11px] md:text-xs transition ${
                    markedForReview[activeIndex]
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-purple-400 border border-purple-500/30'
                  }`}
                >
                  {markedForReview[activeIndex] ? '★ Marked' : '🔖 Mark for Review'}
                </button>
                <button
                  onClick={handleClearResponse}
                  className="px-3.5 md:px-4 py-2 md:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] md:text-xs rounded-xl transition"
                >
                  Clear Choice
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={activeIndex === 0}
                  className="px-4 md:px-5 py-2 md:py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-[11px] md:text-xs rounded-xl transition"
                >
                  ← Prev
                </button>
                <button
                  onClick={handleNext}
                  disabled={activeIndex === questions.length - 1}
                  className="px-5 md:px-6 py-2 md:py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-[11px] md:text-xs rounded-xl shadow transition"
                >
                  Save & Next →
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ⚡ MOBILE BACKDROP OVERLAY */}
        {isMobilePaletteOpen && (
          <div
            onClick={() => setIsMobilePaletteOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40"
          />
        )}

        {/* ⚡ SIDEBAR PALETTE */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-50 w-72 lg:w-80 bg-slate-950 border-l border-slate-800 p-5 lg:p-6 flex flex-col justify-between space-y-6 transition-transform duration-300 shadow-2xl lg:shadow-none ${
            isMobilePaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Question Palette ({questions.length})
              </h2>
              <button
                onClick={() => setIsMobilePaletteOpen(false)}
                className="lg:hidden text-slate-400 font-bold text-base px-1"
              >
                ✕
              </button>
            </div>

            {/* PALETTE COLOR LEGEND */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-400 border-b border-slate-800/80 pb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> Not Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> Marked Review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-800 border border-slate-700 inline-block"></span> Not Visited
              </span>
              
              {/* 🟢 ANSWERED & MARKED FOR REVIEW LEGEND ITEM */}
              <span className="flex items-center gap-1.5 col-span-2 pt-0.5">
                <span className="w-3.5 h-3.5 bg-purple-600 text-white rounded-full flex items-center justify-center text-[8px] relative overflow-visible">
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-slate-950"></span>
                </span>
                Answered & Marked for Review
              </span>
            </div>

            {/* PALETTE GRID BUTTONS */}
            <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto pt-1">
              {questions.map((_, qIdx) => {
                const isAns = selectedAnswers[qIdx] !== undefined;
                const isVisited = visitedQuestions[qIdx];
                const isMarked = markedForReview[qIdx];
                const isActive = activeIndex === qIdx;

                let paletteStyle = 'bg-slate-900 border-slate-800 text-slate-400';

                if (isAns && isMarked) {
                  // 🟢 Answered & Marked for Review Style
                  paletteStyle = 'bg-purple-600 text-white border-purple-400 font-bold relative overflow-visible';
                } else if (isMarked) {
                  paletteStyle = 'bg-purple-600 text-white border-purple-400 font-bold';
                } else if (isAns) {
                  paletteStyle = 'bg-emerald-500 text-slate-950 border-emerald-400 font-black';
                } else if (isVisited) {
                  paletteStyle = 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-bold';
                }

                return (
                  <button
                    key={qIdx}
                    onClick={() => handleSelectQuestion(qIdx)}
                    className={`h-9 lg:h-10 rounded-xl border text-xs font-bold transition flex items-center justify-center relative ${paletteStyle} ${
                      isActive ? 'ring-2 ring-amber-400 scale-105 z-10' : ''
                    }`}
                  >
                    {qIdx + 1}

                    {/* 🟢 GREEN DOT BADGE INDICATOR FOR ANSWERED & MARKED FOR REVIEW */}
                    {isAns && isMarked && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 shadow-sm z-20"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* PERFORMANCE BREAKDOWN */}
          {isSubmitted && results && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
              <h3 className="text-xs font-black uppercase text-amber-400 border-b border-slate-800 pb-2">
                Performance Score
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Correct</span>
                  <span className="font-extrabold text-emerald-400 text-sm">{results.correctCount}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Wrong</span>
                  <span className="font-extrabold text-rose-400 text-sm">{results.wrongCount}</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function MockTestPlayerPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">Loading Test Player...</div>}>
      <MockTestPlayerContent />
    </Suspense>
  );
}