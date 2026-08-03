'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Question {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_option: number;
  explanation: string;
  category: string;
}

type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked' | 'answered_marked';
type SolutionFilter = 'all' | 'incorrect' | 'unattempted' | 'correct';

export default function ComputerIonTestRunner({ params }: { params: Promise<{ quizId: string }> }) {
  const { quizId } = use(params);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: number }>({});
  const [statuses, setStatuses] = useState<{ [key: number]: QuestionStatus }>({});
  const [timeLeft, setTimeLeft] = useState(1200); // 20 Mins
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState('Aspirant');

  // Solution View State
  const [solutionFilter, setSolutionFilter] = useState<SolutionFilter>('all');

  useEffect(() => {
    fetchQuizData();
  }, [quizId]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isSubmitted && timeLeft > 0 && !loading) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsSubmitted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSubmitted, timeLeft, loading]);

  const fetchQuizData = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCandidateName(
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Aspirant'
      );
    }

    // Fetch questions filtered by quiz_id
    const { data, error } = await supabase
      .from('computer_quiz_questions')
      .select('*')
      .eq('quiz_id', quizId);

    if (!error && data && data.length > 0) {
      setQuestions(data as Question[]);
      const initialStatuses: { [key: number]: QuestionStatus } = {};
      data.forEach((_, idx) => {
        initialStatuses[idx] = idx === 0 ? 'not_answered' : 'not_visited';
      });
      setStatuses(initialStatuses);
    }
    setLoading(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (optIndex: number) => {
    setSelectedOptions((prev) => ({ ...prev, [currentIndex]: optIndex }));
  };

  const handleSaveAndNext = () => {
    const hasSelection = selectedOptions[currentIndex] !== undefined;
    setStatuses((prev) => ({
      ...prev,
      [currentIndex]: hasSelection ? 'answered' : 'not_answered',
    }));

    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (statuses[nextIdx] === 'not_visited') {
        setStatuses((prev) => ({ ...prev, [nextIdx]: 'not_answered' }));
      }
    }
  };

  const handleMarkForReview = () => {
    const hasSelection = selectedOptions[currentIndex] !== undefined;
    setStatuses((prev) => ({
      ...prev,
      [currentIndex]: hasSelection ? 'answered_marked' : 'marked',
    }));

    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (statuses[nextIdx] === 'not_visited') {
        setStatuses((prev) => ({ ...prev, [nextIdx]: 'not_answered' }));
      }
    }
  };

  const handleClearResponse = () => {
    setSelectedOptions((prev) => {
      const updated = { ...prev };
      delete updated[currentIndex];
      return updated;
    });
    setStatuses((prev) => ({ ...prev, [currentIndex]: 'not_answered' }));
  };

  const handlePaletteClick = (idx: number) => {
    setCurrentIndex(idx);
    if (statuses[idx] === 'not_visited') {
      setStatuses((prev) => ({ ...prev, [idx]: 'not_answered' }));
    }
  };

  const handleSubmitExam = () => {
    if (confirm('Are you sure you want to submit the exam?')) {
      setIsSubmitted(true);
    }
  };

  const getCounts = () => {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0, answeredMarked = 0;
    Object.values(statuses).forEach((st) => {
      if (st === 'answered') answered++;
      if (st === 'not_answered') notAnswered++;
      if (st === 'not_visited') notVisited++;
      if (st === 'marked') marked++;
      if (st === 'answered_marked') answeredMarked++;
    });
    return { answered, notAnswered, notVisited, marked, answeredMarked };
  };

  const calculateResult = () => {
    let correct = 0, wrong = 0, unattempted = 0;
    questions.forEach((q, idx) => {
      const selected = selectedOptions[idx];
      if (selected === undefined) {
        unattempted++;
      } else if (selected === q.correct_option) {
        correct++;
      } else {
        wrong++;
      }
    });

    const totalAttempted = correct + wrong;
    const accuracy = totalAttempted > 0 ? ((correct / totalAttempted) * 100).toFixed(1) : '0';
    const marksObtained = correct * 1 - wrong * 0.25;

    return { correct, wrong, unattempted, marksObtained, accuracy, totalAttempted };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-amber-400 flex items-center justify-center text-sm font-bold">
        Loading iON Portal for {quizId.toUpperCase()}...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <h2 className="text-xl font-bold">No Questions Found in {quizId.toUpperCase()}</h2>
        <p className="text-xs text-slate-400">Please add questions with quiz_id = '{quizId}' in Supabase.</p>
        <Link href="/computer-quiz" className="px-4 py-2 bg-amber-400 text-slate-950 font-bold rounded text-xs">
          ← Back to Quizzes
        </Link>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const counts = getCounts();

  /* ========================================================= */
  /* POST-EXAM ANALYSIS & SOLUTION VIEW                         */
  /* ========================================================= */
  if (isSubmitted) {
    const res = calculateResult();

    // Filter questions based on selected tab
    const filteredQuestions = questions.map((q, idx) => ({ q, idx })).filter(({ q, idx }) => {
      const selected = selectedOptions[idx];
      if (solutionFilter === 'correct') return selected === q.correct_option;
      if (solutionFilter === 'incorrect') return selected !== undefined && selected !== q.correct_option;
      if (solutionFilter === 'unattempted') return selected === undefined;
      return true; // 'all'
    });

    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* ANALYSIS HEADER */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
                  Performance Report
                </span>
                <h1 className="text-2xl font-black text-white mt-1">
                  {quizId.toUpperCase().replace('_', ' ')} Analysis
                </h1>
                <p className="text-xs text-slate-400">Candidate: <strong className="text-slate-200">{candidateName}</strong></p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                >
                  Re-take Test 🔄
                </button>
                <Link
                  href="/computer-quiz"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition"
                >
                  All Quizzes
                </Link>
              </div>
            </div>

            {/* SCORE METRICS GRID */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-2xl font-black text-amber-400 block">{res.marksObtained.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Total Score</span>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl">
                <span className="text-2xl font-black text-emerald-400 block">{res.correct}</span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">Correct (+1.0)</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/30 p-3.5 rounded-xl">
                <span className="text-2xl font-black text-rose-400 block">{res.wrong}</span>
                <span className="text-[10px] text-rose-400 uppercase font-bold">Incorrect (-0.25)</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-2xl font-black text-slate-400 block">{res.unattempted}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Unattempted</span>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 p-3.5 rounded-xl col-span-2 md:col-span-1">
                <span className="text-2xl font-black text-blue-400 block">{res.accuracy}%</span>
                <span className="text-[10px] text-blue-400 uppercase font-bold">Accuracy</span>
              </div>
            </div>
          </div>

          {/* DETAILED SOLUTIONS SECTION */}
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📖 Detailed Solutions & Explanations</span>
              </h2>

              {/* FILTER TABS */}
              <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setSolutionFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    solutionFilter === 'all' ? 'bg-amber-400 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  All ({questions.length})
                </button>
                <button
                  onClick={() => setSolutionFilter('incorrect')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    solutionFilter === 'incorrect' ? 'bg-rose-500 text-white' : 'text-slate-400'
                  }`}
                >
                  Incorrect ({res.wrong})
                </button>
                <button
                  onClick={() => setSolutionFilter('unattempted')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    solutionFilter === 'unattempted' ? 'bg-slate-700 text-white' : 'text-slate-400'
                  }`}
                >
                  Unattempted ({res.unattempted})
                </button>
                <button
                  onClick={() => setSolutionFilter('correct')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    solutionFilter === 'correct' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  Correct ({res.correct})
                </button>
              </div>
            </div>

            {/* SOLUTIONS LIST */}
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                  No questions match this filter.
                </div>
              ) : (
                filteredQuestions.map(({ q, idx }) => {
                  const userSelected = selectedOptions[idx];
                  const isCorrect = userSelected === q.correct_option;
                  const isUnattempted = userSelected === undefined;

                  return (
                    <div
                      key={q.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl"
                    >
                      {/* QUESTION STATUS HEADER */}
                      <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-3">
                        <span className="font-bold text-amber-400">
                          Question {idx + 1}
                        </span>
                        <div>
                          {isCorrect && (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                              ✓ Correct (+1.0)
                            </span>
                          )}
                          {!isCorrect && !isUnattempted && (
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold">
                              ✕ Incorrect (-0.25)
                            </span>
                          )}
                          {isUnattempted && (
                            <span className="bg-slate-800 text-slate-400 border border-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                              ⚪ Unattempted
                            </span>
                          )}
                        </div>
                      </div>

                      {/* QUESTION TEXT */}
                      <p className="text-sm md:text-base font-semibold text-slate-100 leading-relaxed">
                        {q.question}
                      </p>

                      {/* OPTIONS DISPLAY */}
                      <div className="space-y-2">
                        {q.options.map((opt, optIdx) => {
                          const isCorrectOption = optIdx === q.correct_option;
                          const isUserPick = optIdx === userSelected;

                          let optionStyle = 'bg-slate-950 border-slate-800 text-slate-400';

                          if (isCorrectOption) {
                            optionStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-300 font-bold';
                          } else if (isUserPick && !isCorrectOption) {
                            optionStyle = 'bg-rose-500/10 border-rose-500 text-rose-300 font-bold';
                          }

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-xl border text-xs flex justify-between items-center ${optionStyle}`}
                            >
                              <span>{opt}</span>
                              {isCorrectOption && (
                                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                                  Correct Answer
                                </span>
                              )}
                              {isUserPick && !isCorrectOption && (
                                <span className="text-[10px] bg-rose-500 text-white font-black px-2 py-0.5 rounded uppercase">
                                  Your Choice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* EXPLANATION BOX */}
                      {q.explanation && (
                        <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-xs">
                          <span className="text-amber-400 font-bold block text-[10px] uppercase">
                            💡 Explanation:
                          </span>
                          <p className="text-slate-300 leading-relaxed">
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>
    );
  }

  /* ========================================================= */
  /* LIVE TCS iON EXAM ARENA VIEW                              */
  /* ========================================================= */
  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 select-none overflow-hidden text-slate-900">
      {/* HEADER */}
      <header className="bg-[#1d63b8] text-white h-14 flex justify-between items-center px-4 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white text-[#1d63b8] font-black px-2.5 py-1 rounded text-sm shadow">
            iON
          </div>
          <span className="font-bold text-sm tracking-wide hidden md:inline uppercase">
            IBPS RRB — {quizId.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="text-[10px] uppercase text-blue-200 block font-bold">Candidate</span>
            <span className="text-xs font-bold">{candidateName}</span>
          </div>

          <div className="bg-white text-slate-900 px-3 py-1.5 rounded font-mono font-bold text-sm flex items-center gap-2 border border-blue-300">
            <span className="text-slate-500 text-xs">Time Left:</span>
            <span className={timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-blue-700'}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN EXAM BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: QUESTION ARENA */}
        <div className="flex-1 flex flex-col justify-between bg-white border-r border-slate-300 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <span className="font-extrabold text-slate-800 text-base">
                Question No. {currentIndex + 1}
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded border">
                Category: {currentQ?.category || 'General'}
              </span>
            </div>

            <div className="text-sm md:text-base font-semibold text-slate-800 leading-relaxed">
              {currentQ?.question}
            </div>

            <div className="space-y-3 pt-2">
              {currentQ?.options.map((opt, optIdx) => {
                const isSelected = selectedOptions[currentIndex] === optIdx;
                return (
                  <label
                    key={optIdx}
                    onClick={() => handleOptionSelect(optIdx)}
                    className={`flex items-center gap-3 p-3.5 rounded border text-xs md:text-sm cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50 border-[#1d63b8] text-[#1d63b8] font-bold shadow-sm'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${currentIndex}`}
                      checked={isSelected}
                      onChange={() => handleOptionSelect(optIdx)}
                      className="accent-[#1d63b8] w-4 h-4"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-100 border-t border-slate-300 p-3 flex flex-wrap justify-between items-center gap-2 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleMarkForReview}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs px-4 py-2.5 rounded shadow"
              >
                Mark for Review & Next
              </button>
              <button
                onClick={handleClearResponse}
                className="bg-white hover:bg-slate-200 border border-slate-400 text-slate-700 font-bold text-xs px-4 py-2.5 rounded shadow"
              >
                Clear Response
              </button>
            </div>

            <button
              onClick={handleSaveAndNext}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded shadow"
            >
              Save & Next →
            </button>
          </div>
        </div>

        {/* RIGHT: PALETTE */}
        <div className="w-80 bg-slate-50 flex flex-col justify-between border-l border-slate-300 shrink-0">
          <div className="p-4 overflow-y-auto space-y-4">
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-700 border-b border-slate-300 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 bg-emerald-600 text-white flex items-center justify-center rounded-sm text-[10px]">{counts.answered}</span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 bg-rose-600 text-white flex items-center justify-center rounded-sm text-[10px]">{counts.notAnswered}</span>
                <span>Not Answered</span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-700 block mb-2 uppercase">Question Palette</span>
              <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
                {questions.map((_, idx) => {
                  const st = statuses[idx];
                  let btnBg = 'bg-slate-200 border-slate-400 text-slate-700';
                  if (st === 'answered') btnBg = 'bg-emerald-600 text-white border-emerald-700';
                  if (st === 'not_answered') btnBg = 'bg-rose-600 text-white border-rose-700';
                  if (st === 'marked') btnBg = 'bg-purple-700 text-white border-purple-800';
                  if (st === 'answered_marked') btnBg = 'bg-purple-700 text-white border-purple-800 relative';

                  return (
                    <button
                      key={idx}
                      onClick={() => handlePaletteClick(idx)}
                      className={`h-9 font-bold text-xs rounded border flex items-center justify-center shadow-sm ${btnBg} ${
                        idx === currentIndex ? 'ring-2 ring-blue-600 ring-offset-1 font-black scale-105' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-200 border-t border-slate-300">
            <button
              onClick={handleSubmitExam}
              className="w-full py-3 bg-[#1d63b8] hover:bg-blue-800 text-white font-extrabold text-xs uppercase tracking-wider rounded shadow transition"
            >
              Submit Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}