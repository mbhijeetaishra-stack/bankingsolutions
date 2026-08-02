'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Quiz {
  id: string;
  title: string;
  quiz_date: string;
  duration_minutes: number;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation?: string;
}

export default function BscaQuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  
  // Attempts Tracking
  const [currentAnswers, setCurrentAnswers] = useState<Record<number, number>>({});
  const [previousAnswers, setPreviousAnswers] = useState<Record<number, number> | null>(null);
  
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Interactive Question-Wise Checked State (When toggle is OFF after submission)
  const [interactiveChecked, setInteractiveChecked] = useState<Record<number, boolean>>({});

  // Timer States
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Post-submission Toggle (Default: ON)
  const [showAnswersToggle, setShowAnswersToggle] = useState<boolean>(true);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  // Timer Effect
  useEffect(() => {
    if (activeQuiz && !quizSubmitted && timeLeft > 0) {
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
  }, [activeQuiz, quizSubmitted, timeLeft]);

  async function fetchQuizzes() {
    setLoading(true);
    const { data } = await supabase
      .from('bsca_quizzes')
      .select('*')
      .order('quiz_date', { ascending: false });

    if (data) setQuizzes(data as Quiz[]);
    setLoading(false);
  }

  // First Attempt Start
  async function handleStartQuiz(quiz: Quiz) {
    setActiveQuiz(quiz);
    setLoading(true);
    setCurrentAnswers({});
    setPreviousAnswers(null);
    setInteractiveChecked({});
    setQuizSubmitted(false);
    setShowAnswersToggle(true);

    const { data } = await supabase
      .from('bsca_quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('created_at', { ascending: true });

    if (data) setQuestions(data as QuizQuestion[]);
    
    const totalSeconds = (quiz.duration_minutes || 10) * 60;
    setTimeLeft(totalSeconds);
    setLoading(false);
  }

  // Reattempt Quiz (Saves current answers to previousAnswers state)
  const handleReattemptQuiz = () => {
    setPreviousAnswers(currentAnswers); // Save old attempt
    setCurrentAnswers({});
    setInteractiveChecked({});
    setQuizSubmitted(false);
    setShowAnswersToggle(true);
    const totalSeconds = (activeQuiz?.duration_minutes || 10) * 60;
    setTimeLeft(totalSeconds);
  };

  const handleAutoSubmit = () => {
    setQuizSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Option selection logic
  const handleSelectOption = (questionIdx: number, optionIdx: number) => {
    if (!quizSubmitted) {
      // Standard quiz attempt before submission
      setCurrentAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }));
    } else if (!showAnswersToggle) {
      // Interactive Mode when solution toggle is OFF after submission
      setCurrentAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }));
      setInteractiveChecked((prev) => ({ ...prev, [questionIdx]: true }));
    }
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (currentAnswers[idx] === q.correct_option_index) {
        score += 1;
      }
    });
    return score;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-lg">
            BS
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">BSCA Daily Current Affairs Quiz</h1>
            <p className="text-[11px] text-slate-400">Interactive Question-Wise Practice & Attempt Comparison</p>
          </div>
        </div>

        <Link
          href="/"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
        >
          ← Return Home
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full space-y-6">
        {!activeQuiz ? (
          /* QUIZ CATALOG */
          <div className="space-y-6">
            <div className="bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 p-8 rounded-2xl text-center space-y-2">
              <h2 className="text-2xl font-black text-white">Daily Banking GA Quizzes</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Attempt timed daily quizzes with multi-attempt comparison and step-by-step explanations.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center space-y-2">
                <div className="text-4xl">💡</div>
                <h3 className="font-bold text-white text-base">No Quizzes Published Yet</h3>
                <p className="text-xs text-slate-400">Quizzes published from Admin Portal will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-slate-950 border border-slate-800 hover:border-amber-400/50 rounded-2xl p-6 flex justify-between items-center transition shadow-lg"
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded">
                        📅 {new Date(quiz.quiz_date).toLocaleDateString()}
                      </span>
                      <h3 className="font-bold text-white text-base leading-snug">{quiz.title}</h3>
                      <p className="text-[11px] text-slate-400">⏱️ Duration: {quiz.duration_minutes} Mins</p>
                    </div>

                    <button
                      onClick={() => handleStartQuiz(quiz)}
                      className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition"
                    >
                      Start Quiz →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE QUIZ & COMPARISON VIEW */
          <div className="space-y-6">
            {/* Top Bar */}
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
              <div>
                <button
                  onClick={() => setActiveQuiz(null)}
                  className="text-xs text-slate-400 hover:text-white transition font-bold block mb-1"
                >
                  ← Exit Quiz
                </button>
                <h2 className="text-lg font-extrabold text-white">{activeQuiz.title}</h2>
              </div>

              {!quizSubmitted ? (
                <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono font-black text-lg px-4 py-2 rounded-xl">
                  <span>⏱️</span>
                  <span>{formatTime(timeLeft)}</span>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row items-end md:items-center gap-3">
                  <div className="bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-sm shadow">
                    Score: {calculateScore()} / {questions.length}
                  </div>
                  
                  <button
                    onClick={handleReattemptQuiz}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    🔄 Reattempt Quiz
                  </button>
                </div>
              )}
            </div>

            {/* COMPARISON LEGEND & TOGGLE WHEN SUBMITTED */}
            {quizSubmitted && (
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-300 block">Solutions View Mode:</span>
                    <p className="text-[11px] text-slate-400">
                      {showAnswersToggle
                        ? 'Showing overall breakdown for all questions.'
                        : 'Interactive Mode: Click any option on a question to reveal its answer & breakdown!'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAnswersToggle(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                        showAnswersToggle ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      ON (Show All)
                    </button>
                    <button
                      onClick={() => setShowAnswersToggle(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
                        !showAnswersToggle ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      OFF (Practice Mode)
                    </button>
                  </div>
                </div>

                {/* Visual Badges Legend */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold pt-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Correct Answer
                  </span>
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Current Choice
                  </span>
                  {previousAnswers && (
                    <span className="flex items-center gap-1 text-purple-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span> Previous Choice
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* QUESTIONS LIST */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : questions.length === 0 ? (
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
                No questions in this quiz.
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q, qIdx) => {
                  const currentOpt = currentAnswers[qIdx];
                  const previousOpt = previousAnswers ? previousAnswers[qIdx] : undefined;

                  // Determine if this question should show its correct answer & solution
                  const showSolution =
                    quizSubmitted &&
                    (showAnswersToggle || interactiveChecked[qIdx]);

                  return (
                    <div key={q.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
                      <h3 className="font-bold text-sm text-white leading-snug">
                        Q{qIdx + 1}. {q.question_text}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => {
                          const isCurrent = currentOpt === optIdx;
                          const isPrevious = previousOpt === optIdx;
                          const isCorrect = q.correct_option_index === optIdx;

                          let btnStyle = 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';

                          if (!quizSubmitted) {
                            // 1. BEFORE SUBMISSION: Active selection (Yellow outline)
                            if (isCurrent) {
                              btnStyle = 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold';
                            }
                          } else if (showSolution) {
                            // 2. REVEALED SOLUTION: Correct (Emerald Green), Incorrect Choice (Rose Red)
                            if (isCorrect) {
                              btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold';
                            } else if (isCurrent && !isCorrect) {
                              btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold';
                            }
                          }
                          // 3. WHEN TOGGLE IS OFF & NOT CLICKED YET:
                          // Remains in neutral dark style without any yellow highlight!

                          return (
                            <div key={optIdx} className="relative">
                              <button
                                onClick={() => handleSelectOption(qIdx, optIdx)}
                                className={`w-full p-3.5 rounded-xl border text-left text-xs transition leading-snug flex justify-between items-center ${btnStyle}`}
                              >
                                <div>
                                  <span className="font-bold mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                                  {opt}
                                </div>

                                {/* ATTEMPT BADGES AFTER SOLUTION IS REVEALED */}
                                {showSolution && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                    {isPrevious && (
                                      <span className="text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded">
                                        Previous Choice
                                      </span>
                                    )}
                                    {isCurrent && (
                                      <span className="text-[9px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                                        Current Choice
                                      </span>
                                    )}
                                    {isCorrect && (
                                      <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                                        Correct
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* QUESTION-WISE EXPLANATION */}
                      {showSolution && q.explanation && (
                        <div className="mt-3 p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                          <span className="text-[11px] font-black uppercase text-amber-400 block">💡 Solution & Explanation:</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!quizSubmitted ? (
                  <button
                    onClick={handleSubmitQuiz}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg uppercase tracking-wider transition"
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={handleReattemptQuiz}
                      className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      🔄 Reattempt Quiz
                    </button>
                    <button
                      onClick={() => setActiveQuiz(null)}
                      className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl shadow transition"
                    >
                      Back to All Quizzes
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}