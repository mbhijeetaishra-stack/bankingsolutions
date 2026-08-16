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

export default function TCSiONMockTestPlayerPage() {
  const params = useParams();
  const router = useRouter();
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

  // ⚡ MOBILE PALETTE DRAWER STATE
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // Submission & Timer States
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sectionalTimeLeft, setSectionalTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

    if (mode === 'solution') {
      setIsSubmitted(true);
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

    setIsSubmitted(true);
    // 🟢 Routed to the exact /result folder path
    router.push(`/mock-test/${test.id}/result`);
  };

  const handleSelectQuestion = (globalIdx: number) => {
    const qSec = questions[globalIdx]?.section || 'QUANT';
    if (!isSubmitted && qSec !== activeSection) {
      alert(`You are in section "${activeSection}". Submit this section first to move ahead.`);
      return;
    }
    setActiveIndex(globalIdx);
    setVisitedQuestions((prev) => ({ ...prev, [globalIdx]: true }));
    setIsMobilePaletteOpen(false);
  };

  const handleNext = () => {
    if (isSubmitted) {
      if (activeIndex < questions.length - 1) {
        setActiveIndex(activeIndex + 1);
        const newSec = questions[activeIndex + 1]?.section || activeSection;
        setActiveSection(newSec);
      }
      return;
    }

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
    if (isSubmitted) {
      if (activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
        const newSec = questions[activeIndex - 1]?.section || activeSection;
        setActiveSection(newSec);
      }
      return;
    }

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

  const getCounts = () => {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0, answeredMarked = 0;
    
    questions.forEach((q, idx) => {
      if ((q.section || 'QUANT') === activeSection) {
        const isAns = selectedAnswers[idx] !== undefined;
        const isVisited = visitedQuestions[idx];
        const isMarked = markedForReview[idx];

        if (isAns && isMarked) answeredMarked++;
        else if (isMarked) marked++;
        else if (isAns) answered++;
        else if (isVisited) notAnswered++;
        else notVisited++;
      }
    });

    return { answered, notAnswered, notVisited, marked, answeredMarked };
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

  const sectionQuestions = questions.filter((q) => (q.section || 'QUANT') === activeSection);
  const activeSectionQuestionIndices = isSubmitted
    ? questions.map((_, idx) => idx)
    : questions
        .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
        .filter((idx) => idx !== -1);

  const counts = getCounts();

  return (
    <div className="h-screen w-screen bg-[#F4F6F9] text-slate-900 font-sans flex flex-col select-none overflow-hidden">
      {/* 1. TOP BRANDING HEADER */}
      <header className="bg-[#1D63B8] text-white px-4 md:px-6 py-2.5 flex justify-between items-center shadow-md shrink-0 z-40">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-8 h-8 bg-white text-[#1D63B8] rounded font-black text-sm flex items-center justify-center shadow-inner">
            BS
          </div>
          <div>
            <h1 className="text-xs md:text-sm font-bold tracking-tight leading-tight truncate max-w-[140px] sm:max-w-none">{test.title}</h1>
            <p className="text-[10px] text-blue-100 uppercase font-semibold">{test.exam_type} {isSubmitted ? '— Solution Mode' : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {!isSubmitted && (
            <div className="bg-white/10 border border-white/20 px-3 md:px-4 py-1 rounded text-white font-mono font-bold text-xs md:text-sm flex items-center gap-1.5 md:gap-2">
              <span className="text-[10px] md:text-xs">⏱️ Time:</span>
              <span className="text-sm md:text-base text-yellow-300 font-black">{formatTime(sectionalTimeLeft)}</span>
            </div>
          )}

          {!isSubmitted ? (
            <button
              onClick={handleManualSubmitSection}
              className="px-2.5 md:px-3 py-1 bg-[#154B94] hover:bg-[#103a75] text-white font-bold text-xs rounded border border-white/20 shadow transition"
            >
              Submit Section ({activeSection})
            </button>
          ) : (
            <Link href={`/mock-test/${test.id}/result`} className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded shadow">
              📊 View Scorecard & Analysis
            </Link>
          )}

          {/* MOBILE PALETTE TOGGLE BUTTON */}
          <button
            onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
            className="lg:hidden bg-blue-900/60 border border-blue-400/30 text-white font-bold px-2 py-1 rounded text-xs flex items-center gap-1"
          >
            <span>☰</span>
            <span className="text-[10px]">Palette</span>
          </button>
        </div>
      </header>

      {/* 2. SECTIONAL TABS */}
      <div className="bg-white border-b border-slate-300 px-4 md:px-6 py-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 shadow-sm">
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
                  setActiveSection(sec);
                  const firstIdx = questions.findIndex((q) => (q.section || 'QUANT') === sec);
                  if (firstIdx !== -1) setActiveIndex(firstIdx);
                }}
                className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#1D63B8] text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
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

      {/* 4. MAIN EXAM DISPLAY WORKSPACE (LOCKED HEIGHT FOR NO OVERFLOW) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* QUESTION DISPLAY AREA */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col justify-between">
          {hasPassage ? (
            /* 50/50 SPLIT SCREEN FOR PASSAGE / DI / RC */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-[60vh]">
              <div className="bg-white border border-slate-300 rounded-lg p-4 md:p-5 overflow-y-auto max-h-[70vh] shadow-sm">
                <div className="bg-blue-50 border-l-4 border-[#1D63B8] px-3 py-1.5 text-[11px] font-bold text-[#1D63B8] uppercase mb-3">
                  Directions / Passage Context
                </div>
                <div className="text-xs text-slate-800 leading-relaxed font-medium whitespace-pre-line font-serif">
                  {activeQuestion.passageText}
                </div>
              </div>

              <div className="bg-white border border-slate-300 rounded-lg p-4 md:p-5 flex flex-col justify-between max-h-[70vh] overflow-y-auto shadow-sm">
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
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                        } else {
                          btnStyle = 'bg-white border-slate-300 text-slate-600';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-blue-50 border-[#1D63B8] text-[#1D63B8] font-bold shadow-sm';
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isSubmitted || (lockedSections[activeSection] && !isSubmitted)}
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
                          {isSubmitted && isCorrect && <span className="text-emerald-700 font-bold text-xs">✓ Correct</span>}
                          {isSubmitted && isSelected && !isCorrect && <span className="text-rose-700 font-bold text-xs">✗ Yours</span>}
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
            /* FULL SCREEN FOR STANDALONE QUESTIONS */
            <div className="max-w-4xl mx-auto w-full bg-white border border-slate-300 rounded-lg p-5 md:p-6 space-y-5 shadow-sm my-auto">
              <div className="flex justify-between items-center border-b pb-2 text-xs font-bold text-slate-600">
                <span>Question {activeIndex + 1} ({activeQuestion.section})</span>
                <span className="text-emerald-700">Marks: +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25}</span>
              </div>

              <h3 className="text-xs md:text-base font-bold text-slate-900 leading-relaxed">
                {activeQuestion.questionText}
              </h3>

              <div className="flex flex-col gap-3 pt-2">
                {activeQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[activeIndex] === optIdx;
                  const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                  let btnStyle = 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50';

                  if (isSubmitted) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                    } else if (isSelected && !isCorrect) {
                      btnStyle = 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                    } else {
                      btnStyle = 'bg-white border-slate-300 text-slate-600';
                    }
                  } else if (isSelected) {
                    btnStyle = 'bg-blue-50 border-[#1D63B8] text-[#1D63B8] font-bold shadow-sm';
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={isSubmitted || (lockedSections[activeSection] && !isSubmitted)}
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
                      {isSubmitted && isCorrect && <span className="text-emerald-700 font-bold text-xs">✓ Correct</span>}
                      {isSubmitted && isSelected && !isCorrect && <span className="text-rose-700 font-bold text-xs">✗ Yours</span>}
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
          <div className="bg-white border border-slate-300 rounded-lg p-3 max-w-4xl mx-auto w-full flex flex-wrap justify-between items-center gap-2 mt-4 shadow-sm shrink-0">
            <div className="flex gap-2">
              <button
                disabled={isSubmitted}
                onClick={handleToggleMarkReview}
                className={`px-3 py-2 rounded text-xs font-bold border transition ${
                  isSubmitted
                    ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                    : markedForReview[activeIndex]
                    ? 'bg-purple-700 text-white border-purple-800'
                    : 'bg-white border-purple-400 text-purple-700 hover:bg-purple-50'
                }`}
              >
                Mark for Review & Next
              </button>
              <button
                disabled={isSubmitted}
                onClick={handleClearResponse}
                className={`px-3 py-2 border text-slate-700 font-bold text-xs rounded transition ${
                  isSubmitted ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
              >
                Clear Response
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={isSubmitted ? activeIndex === 0 : activeSectionQuestionIndices.indexOf(activeIndex) === 0}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-40 text-slate-700 font-bold text-xs rounded transition"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={isSubmitted ? activeIndex === questions.length - 1 : false}
                className="px-5 py-2 bg-[#1D63B8] hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded shadow transition"
              >
                {isSubmitted ? 'Next Question →' : 'Save & Next →'}
              </button>
            </div>
          </div>
        </main>

        {/* ⚡ MOBILE BACKDROP OVERLAY */}
        {isMobilePaletteOpen && (
          <div
            onClick={() => setIsMobilePaletteOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40"
          />
        )}

        {/* ⚡ FIXED RIGHT PALETTE (STAYS LOCKED, NO OVERLAPPING HEADER) */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-50 w-72 lg:w-80 bg-white border-l border-slate-300 p-4 flex flex-col justify-between space-y-4 shadow-2xl lg:shadow-none transition-transform duration-300 shrink-0 ${
            isMobilePaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#1D63B8] text-white rounded-full flex items-center justify-center font-bold text-xs">
                  {candidateName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[120px]">{candidateName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">Roll: {rollCode}</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobilePaletteOpen(false)}
                className="lg:hidden text-slate-500 font-bold text-base px-1"
              >
                ✕
              </button>
            </div>

            <h2 className="text-xs font-bold uppercase text-slate-700 border-b pb-1">
              {isSubmitted ? 'Solution Palette' : `Section Palette (${sectionQuestions.length} Questions)`}
            </h2>

            {/* TCS iON LEGEND */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-emerald-600 text-white rounded-sm flex items-center justify-center text-[9px] font-bold">
                  {counts.answered}
                </span>{' '}
                Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-rose-600 text-white rounded-sm flex items-center justify-center text-[9px] font-bold">
                  {counts.notAnswered}
                </span>{' '}
                Not Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-purple-700 text-white rounded-sm flex items-center justify-center text-[9px] font-bold">
                  {counts.marked}
                </span>{' '}
                Marked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 bg-slate-100 border border-slate-400 text-slate-700 rounded-sm flex items-center justify-center text-[9px] font-bold">
                  {counts.notVisited}
                </span>{' '}
                Not Visited
              </span>

              <span className="flex items-center gap-1.5 col-span-2 pt-0.5">
                <span className="w-3.5 h-3.5 bg-purple-700 text-white rounded-sm flex items-center justify-center text-[8px] relative overflow-visible font-bold">
                  {counts.answeredMarked}
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-white"></span>
                </span>
                Answered & Marked for Review
              </span>
            </div>

            {/* PALETTE GRID BUTTONS */}
            <div className="grid grid-cols-5 gap-1.5 max-h-56 overflow-y-auto p-1">
              {activeSectionQuestionIndices.map((globalIdx, localIdx) => {
                const isAns = selectedAnswers[globalIdx] !== undefined;
                const isVisited = visitedQuestions[globalIdx];
                const isMarked = markedForReview[globalIdx];
                const isActive = activeIndex === globalIdx;

                let paletteStyle = 'bg-slate-100 border-slate-300 text-slate-700';

                if (isSubmitted) {
                  const userAns = selectedAnswers[globalIdx];
                  const qCorrect = questions[globalIdx].correctOptionIndex;
                  if (userAns === undefined) paletteStyle = 'bg-white border-slate-300 text-slate-600';
                  else if (userAns === qCorrect) paletteStyle = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                  else paletteStyle = 'bg-rose-600 text-white border-rose-700 font-bold';
                } else {
                  if (isAns && isMarked) {
                    paletteStyle = 'bg-purple-700 text-white border-purple-800 font-bold relative overflow-visible';
                  } else if (isMarked) {
                    paletteStyle = 'bg-purple-700 text-white border-purple-800 font-bold';
                  } else if (isAns) {
                    paletteStyle = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                  } else if (isVisited) {
                    paletteStyle = 'bg-rose-600 text-white border-rose-700 font-bold';
                  }
                }

                return (
                  <button
                    key={globalIdx}
                    onClick={() => handleSelectQuestion(globalIdx)}
                    className={`h-9 text-xs font-bold transition flex items-center justify-center border shadow-sm relative ${paletteStyle} ${
                      isActive ? 'ring-2 ring-[#1D63B8] font-black z-10' : ''
                    }`}
                  >
                    {localIdx + 1}

                    {!isSubmitted && isAns && isMarked && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-sm z-20"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!isSubmitted ? (
            <button
              onClick={handleSubmitFullTest}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded uppercase tracking-wider transition shadow shrink-0"
            >
              Submit Entire Exam
            </button>
          ) : (
            <Link
              href={`/mock-test/${test.id}/result`}
              className="block text-center w-full py-2.5 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded uppercase tracking-wider transition shadow shrink-0"
            >
              📊 View Scorecard & Rank
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}