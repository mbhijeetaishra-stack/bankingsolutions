'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  solution_text: string;
}

type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked';

export default function TestPlayerPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: number }>({});
  const [questionStates, setQuestionStates] = useState<{ [key: string]: QuestionStatus }>({});
  
  const [timeLeft, setTimeLeft] = useState(1200);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // ⚡ MOBILE PALETTE DRAWER STATE
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // Analysis Screen State
  const [analysisTab, setAnalysisTab] = useState<'summary' | 'solutions'>('summary');
  const [solutionFilter, setSolutionFilter] = useState<'ALL' | 'INCORRECT' | 'CORRECT' | 'UNATTEMPTED'>('ALL');
  const [solutionIndex, setSolutionIndex] = useState(0);

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !isSubmitted && !loading) {
      handleSubmitTest();
      return;
    }

    if (timeLeft > 0 && !isSubmitted && !loading) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft, isSubmitted, loading]);

  async function fetchQuestions() {
    setLoading(true);
    const { data } = await supabase.from('questions').select('*');
    if (data && data.length > 0) {
      setQuestions(data);
      const initialStates: { [key: string]: QuestionStatus } = {};
      data.forEach((q, idx) => {
        initialStates[q.id] = idx === 0 ? 'not_answered' : 'not_visited';
      });
      setQuestionStates(initialStates);
    }
    setLoading(false);
  }

  const currentQ = questions[currentIndex];

  const handleSelectOption = (optIdx: number) => {
    if (isSubmitted) return;
    setUserAnswers({ ...userAnswers, [currentQ.id]: optIdx });
  };

  const handleSaveAndNext = () => {
    const qId = currentQ.id;
    const isAnswered = userAnswers[qId] !== undefined;

    setQuestionStates((prev) => ({
      ...prev,
      [qId]: isAnswered ? 'answered' : 'not_answered',
    }));

    if (currentIndex < questions.length - 1) {
      const nextQId = questions[currentIndex + 1].id;
      setQuestionStates((prev) => ({
        ...prev,
        [nextQId]: prev[nextQId] === 'not_visited' ? 'not_answered' : prev[nextQId],
      }));
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleMarkForReview = () => {
    const qId = currentQ.id;
    const isAnswered = userAnswers[qId] !== undefined;
    setQuestionStates((prev) => ({
      ...prev,
      [qId]: isAnswered ? 'answered_marked' : 'marked',
    }));
    if (currentIndex < questions.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handleClearResponse = () => {
    const qId = currentQ.id;
    const newAnswers = { ...userAnswers };
    delete newAnswers[qId];
    setUserAnswers(newAnswers);
    setQuestionStates((prev) => ({ ...prev, [qId]: 'not_answered' }));
  };

  const calculateResults = () => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((q) => {
      const ans = userAnswers[q.id];
      if (ans !== undefined) {
        if (ans === q.correct_option_index) {
          score += 1.0;
          correctCount++;
        } else {
          score -= 0.25;
          wrongCount++;
        }
      }
    });

    const attempted = correctCount + wrongCount;
    const unattempted = questions.length - attempted;
    const accuracy = attempted > 0 ? ((correctCount / attempted) * 100).toFixed(1) : '0.0';

    return {
      score,
      correctCount,
      wrongCount,
      attempted,
      unattempted,
      accuracy,
      totalQuestions: questions.length,
    };
  };

  const getCounts = () => {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0, answeredMarked = 0;
    
    questions.forEach((q) => {
      const st = questionStates[q.id];
      if (st === 'answered') answered++;
      if (st === 'not_answered') notAnswered++;
      if (st === 'not_visited') notVisited++;
      if (st === 'marked') marked++;
      if (st === 'answered_marked') answeredMarked++;
    });

    return { answered, notAnswered, notVisited, marked, answeredMarked };
  };

  const handleSubmitTest = () => setIsSubmitted(true);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center font-sans text-slate-700">
        Loading test questions...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center font-sans">
        <p className="text-lg font-semibold text-slate-700 mb-2">No questions available in database!</p>
        <p className="text-sm text-slate-500">Go to /admin to add questions first.</p>
      </div>
    );
  }

  const results = calculateResults();
  const counts = getCounts();

  const filteredSolutionQuestions = questions.filter((q) => {
    const ans = userAnswers[q.id];
    if (solutionFilter === 'CORRECT') return ans === q.correct_option_index;
    if (solutionFilter === 'INCORRECT') return ans !== undefined && ans !== q.correct_option_index;
    if (solutionFilter === 'UNATTEMPTED') return ans === undefined;
    return true;
  });

  const solQ = filteredSolutionQuestions[solutionIndex] || filteredSolutionQuestions[0];

  return (
    <div className="flex flex-col h-screen font-sans bg-slate-100 select-none">
      <header className="bg-slate-800 text-white px-4 md:px-6 py-3 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-sm md:text-lg">BankingSolutions Practice Test</h1>
          <p className="text-[10px] md:text-xs text-slate-300">
            {isSubmitted ? 'Detailed Performance & Solution Analysis' : 'Official Exam Simulation'}
          </p>
        </div>
        {!isSubmitted ? (
          <div className="flex items-center gap-2">
            <div className="bg-slate-700 px-3 md:px-4 py-1.5 md:py-2 rounded font-mono font-bold text-xs md:text-sm text-amber-400 border border-slate-600">
              Time Left: {formatTime(timeLeft)}
            </div>
            {/* ⚡ MOBILE PALETTE TOGGLE BUTTON */}
            <button
              onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
              className="lg:hidden bg-slate-700 border border-slate-600 text-white font-bold px-2.5 py-1.5 rounded text-xs"
            >
              ☰ Palette
            </button>
          </div>
        ) : (
          <div className="flex space-x-2 bg-slate-700 p-1 rounded-lg text-xs">
            <button
              onClick={() => setAnalysisTab('summary')}
              className={`px-3 py-1 font-semibold rounded transition ${
                analysisTab === 'summary' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              📊 Performance Summary
            </button>
            <button
              onClick={() => setAnalysisTab('solutions')}
              className={`px-3 py-1 font-semibold rounded transition ${
                analysisTab === 'solutions' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              📖 View Solutions
            </button>
          </div>
        )}
      </header>

      {!isSubmitted ? (
        <div className="flex flex-1 overflow-hidden relative">
          <main className="w-full lg:w-3/4 p-4 md:p-6 flex flex-col justify-between overflow-y-auto bg-white border-r">
            <div>
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <span className="font-semibold text-slate-700">Question No. {currentIndex + 1}</span>
                <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 font-medium">
                  Marks: +1.00 | -0.25
                </span>
              </div>

              <p className="text-slate-800 font-medium text-xs md:text-base mb-6 leading-relaxed">
                {currentQ.question_text}
              </p>

              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  const isSelected = userAnswers[currentQ.id] === idx;
                  return (
                    <label
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`flex items-center p-3.5 rounded border cursor-pointer transition text-xs md:text-sm ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 font-medium text-blue-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQ.id}`}
                        checked={isSelected}
                        onChange={() => {}}
                        className="mr-3 h-4 w-4 text-blue-600 shrink-0"
                      />
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4 mt-6 flex justify-between items-center bg-white flex-wrap gap-2">
              <div className="space-x-2">
                <button
                  onClick={handleMarkForReview}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 md:px-4 py-2 rounded text-xs md:text-sm font-semibold transition"
                >
                  Mark for Review & Next
                </button>
                <button
                  onClick={handleClearResponse}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 md:px-4 py-2 rounded text-xs md:text-sm font-semibold transition"
                >
                  Clear Response
                </button>
              </div>

              <button
                onClick={handleSaveAndNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 md:px-6 py-2 rounded text-xs md:text-sm font-semibold transition"
              >
                Save & Next
              </button>
            </div>
          </main>

          {/* ⚡ MOBILE BACKDROP OVERLAY */}
          {isMobilePaletteOpen && (
            <div
              onClick={() => setIsMobilePaletteOpen(false)}
              className="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
            />
          )}

          {/* ⚡ SIDEBAR PALETTE */}
          <aside
            className={`fixed lg:static inset-y-0 right-0 z-50 w-72 lg:w-1/4 p-5 bg-slate-50 flex flex-col justify-between overflow-y-auto border-l shadow-2xl lg:shadow-none transition-transform duration-300 ${
              isMobilePaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="font-bold text-slate-700 text-xs md:text-sm uppercase">Question Palette</h2>
                <button onClick={() => setIsMobilePaletteOpen(false)} className="lg:hidden font-bold text-slate-500">
                  ✕
                </button>
              </div>

              {/* TCS LEGEND */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600 bg-white p-2.5 rounded border mb-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-emerald-500 text-white rounded-sm flex items-center justify-center text-[9px] font-bold">
                    {counts.answered}
                  </span>{' '}
                  Answered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-rose-500 text-white rounded-sm flex items-center justify-center text-[9px] font-bold">
                    {counts.notAnswered}
                  </span>{' '}
                  Not Answered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-purple-600 text-white rounded-sm flex items-center justify-center text-[9px] font-bold">
                    {counts.marked}
                  </span>{' '}
                  Marked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-400 text-slate-700 rounded-sm flex items-center justify-center text-[9px] font-bold">
                    {counts.notVisited}
                  </span>{' '}
                  Not Visited
                </span>

                {/* 🟢 ANSWERED & MARKED FOR REVIEW LEGEND ITEM */}
                <span className="flex items-center gap-1.5 col-span-2 pt-0.5">
                  <span className="w-3.5 h-3.5 bg-purple-600 text-white rounded-sm flex items-center justify-center text-[8px] relative overflow-visible font-bold">
                    {counts.answeredMarked}
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-white"></span>
                  </span>
                  Answered & Marked for Review
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto">
                {questions.map((q, idx) => {
                  const state = questionStates[q.id] || 'not_visited';
                  let btnColor = 'bg-slate-200 text-slate-700 hover:bg-slate-300';

                  if (state === 'answered') btnColor = 'bg-emerald-500 text-white';
                  if (state === 'not_answered') btnColor = 'bg-rose-500 text-white';
                  if (state === 'marked') btnColor = 'bg-purple-600 text-white';
                  if (state === 'answered_marked') btnColor = 'bg-purple-600 text-white relative overflow-visible';

                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setIsMobilePaletteOpen(false);
                      }}
                      className={`h-9 w-9 font-bold text-xs rounded transition flex items-center justify-center relative ${btnColor} ${
                        isCurrent ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                      }`}
                    >
                      {idx + 1}

                      {/* 🟢 GREEN DOT BADGE INDICATOR FOR ANSWERED & MARKED FOR REVIEW */}
                      {state === 'answered_marked' && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-sm z-20"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t mt-6">
              <button
                onClick={handleSubmitTest}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded transition shadow text-xs uppercase"
              >
                Submit Test
              </button>
            </div>
          </aside>
        </div>
      ) : (
        /* POST-TEST SUMMARY & SOLUTIONS VIEW */
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            {analysisTab === 'summary' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                      Test Result Overview
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-800 mt-2">Practice Test</h2>
                    <p className="text-xs text-slate-500 mt-1">Evaluated against standard IBPS marking scheme</p>
                  </div>

                  <div className="flex items-center space-x-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Total Score</p>
                      <p className="text-3xl font-black text-blue-600">{results.score.toFixed(2)}</p>
                    </div>
                    <div className="h-10 w-px bg-slate-200"></div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Accuracy</p>
                      <p className="text-3xl font-black text-emerald-600">{results.accuracy}%</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs text-slate-500 font-medium mb-1">Attempted</p>
                    <p className="text-2xl font-bold text-slate-800">{results.attempted} / {results.totalQuestions}</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-emerald-100 bg-emerald-50/50 shadow-sm text-center">
                    <p className="text-xs text-emerald-700 font-medium mb-1">Correct Answers</p>
                    <p className="text-2xl font-bold text-emerald-700">+{results.correctCount}</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-rose-100 bg-rose-50/50 shadow-sm text-center">
                    <p className="text-xs text-rose-700 font-medium mb-1">Wrong Answers</p>
                    <p className="text-2xl font-bold text-rose-700">-{results.wrongCount}</p>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
                    <p className="text-xs text-slate-500 font-medium mb-1">Unattempted</p>
                    <p className="text-2xl font-bold text-slate-600">{results.unattempted}</p>
                  </div>
                </div>

                <div className="flex justify-center space-x-4 pt-4">
                  <button
                    onClick={() => {
                      setAnalysisTab('solutions');
                      setSolutionFilter('ALL');
                      setSolutionIndex(0);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow text-xs"
                  >
                    📖 View Step-by-Step Solutions
                  </button>
                  <a
                    href="/tests"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg transition text-xs"
                  >
                    Back to Catalog
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}