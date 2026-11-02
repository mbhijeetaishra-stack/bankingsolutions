'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import {
  getNotebookItems,
  toggleBookmarkQuestion,
  recordMistakeQuestions,
} from '@/lib/notebook';
import QuestionCommunityBar from '@/components/QuestionCommunityBar';

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

interface QuizAttempt {
  quiz_id: string;
  answers: Record<number, number>;
  score: number;
  total_questions: number;
}

export default function BscaQuizPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // User Completed Attempts Map (Mapped by Quiz ID)
  const [completedAttempts, setCompletedAttempts] = useState<Record<string, QuizAttempt>>({});

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

  // Post-submission Toggle
  const [showAnswersToggle, setShowAnswersToggle] = useState<boolean>(true);

  // 🔖 Revision Vault / Bookmark Map
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedVault = getNotebookItems();
    const bm: Record<string, boolean> = {};
    savedVault.forEach((item) => {
      bm[item.id] = true;
    });
    setBookmarkedMap(bm);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      setCurrentUser(user);
      fetchQuizzesAndAttempts(user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);
      fetchQuizzesAndAttempts(user?.id);
    });

    return () => subscription.unsubscribe();
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

  // Fetch Quizzes and restore completed attempts from both LocalStorage & Supabase
  async function fetchQuizzesAndAttempts(userId?: string) {
    setLoading(true);

    // 1. Fetch Quizzes
    const { data: quizData } = await supabase
      .from('bsca_quizzes')
      .select('*')
      .order('quiz_date', { ascending: false });

    if (quizData) setQuizzes(quizData as Quiz[]);

    // 2. Read LocalStorage attempts first
    let attemptsMap: Record<string, QuizAttempt> = {};
    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_quiz_attempts') || '{}');
      attemptsMap = { ...localSaved };
    } catch (e) {
      console.error('Error reading local attempts:', e);
    }

    // 3. Fetch Supabase DB attempts if user is signed in
    if (userId) {
      const { data: attemptData } = await supabase
        .from('bsca_quiz_attempts')
        .select('*')
        .eq('user_id', userId);

      if (attemptData) {
        attemptData.forEach((att: any) => {
          attemptsMap[att.quiz_id] = {
            quiz_id: att.quiz_id,
            answers: att.answers,
            score: att.score,
            total_questions: att.total_questions,
          };
        });
      }
    }

    setCompletedAttempts(attemptsMap);
    setLoading(false);
  }

  // Start Fresh Quiz
  async function handleStartQuiz(quiz: Quiz) {
    setActiveQuiz(quiz);
    setLoading(true);
    setCurrentAnswers({});
    setPreviousAnswers(completedAttempts[quiz.id]?.answers || null);
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

  // Open Solution Mode Directly
  async function handleViewSolution(quiz: Quiz) {
    setActiveQuiz(quiz);
    setLoading(true);
    setQuizSubmitted(true);
    setShowAnswersToggle(true);
    setInteractiveChecked({});

    const pastAttempt = completedAttempts[quiz.id];
    setCurrentAnswers(pastAttempt?.answers || {});
    setPreviousAnswers(pastAttempt?.answers || null);

    const { data } = await supabase
      .from('bsca_quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('created_at', { ascending: true });

    if (data) setQuestions(data as QuizQuestion[]);
    setLoading(false);
  }

  // Reattempt Quiz
  const handleReattemptQuiz = () => {
    if (activeQuiz) {
      setPreviousAnswers(currentAnswers);
      setCurrentAnswers({});
      setInteractiveChecked({});
      setQuizSubmitted(false);
      setShowAnswersToggle(true);
      const totalSeconds = (activeQuiz.duration_minutes || 10) * 60;
      setTimeLeft(totalSeconds);
    }
  };

  // Save attempt to UI State, LocalStorage & Supabase DB
  const saveAttemptToDb = async (answers: Record<number, number>) => {
    if (!activeQuiz) return;

    let score = 0;
    const wrongQuizItems: any[] = [];

    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_option_index) {
        score += 1;
      } else if (answers[idx] !== undefined && answers[idx] !== q.correct_option_index) {
        wrongQuizItems.push({
          id: `quiz_${activeQuiz.id}_q_${q.id || idx}`,
          sourceType: 'GA_QUIZ' as const,
          sourceId: activeQuiz.id,
          sourceTitle: activeQuiz.title,
          section: 'GA',
          questionText: q.question_text,
          options: q.options || [],
          correctOptionIndex: q.correct_option_index,
          userSelectedOption: answers[idx],
          explanation: q.explanation,
        });
      }
    });

    if (wrongQuizItems.length > 0) {
      recordMistakeQuestions(wrongQuizItems);
      const updatedMap = { ...bookmarkedMap };
      wrongQuizItems.forEach((wq) => {
        updatedMap[wq.id] = true;
      });
      setBookmarkedMap(updatedMap);
    }

    const attemptData: QuizAttempt = {
      quiz_id: activeQuiz.id,
      answers: answers,
      score: score,
      total_questions: questions.length,
    };

    // 1. Instantly update local UI state so cards reflect "✓ Completed"
    setCompletedAttempts((prev) => ({
      ...prev,
      [activeQuiz.id]: attemptData,
    }));

    // 2. Persist in LocalStorage
    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_quiz_attempts') || '{}');
      localSaved[activeQuiz.id] = attemptData;
      localStorage.setItem('bsca_quiz_attempts', JSON.stringify(localSaved));
    } catch (err) {
      console.error('LocalStorage error:', err);
    }

    // 3. Persist in Supabase if logged in
    if (currentUser?.id) {
      const payload = {
        user_id: currentUser.id,
        quiz_id: activeQuiz.id,
        answers: answers,
        score: score,
        total_questions: questions.length,
        completed_at: new Date().toISOString(),
      };

      await supabase.from('bsca_quiz_attempts').upsert([payload], { onConflict: 'user_id,quiz_id' });
    }
  };

  const handleAutoSubmit = () => {
    setQuizSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    saveAttemptToDb(currentAnswers);
  };

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    saveAttemptToDb(currentAnswers);
  };

  // Option selection logic
  const handleSelectOption = (questionIdx: number, optionIdx: number) => {
    if (!quizSubmitted) {
      setCurrentAnswers((prev) => ({ ...prev, [questionIdx]: optionIdx }));
    } else if (!showAnswersToggle) {
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

  // 🔖 Toggle bookmark for a BSCA quiz question
  const handleToggleQuizBookmark = (q: QuizQuestion, qIdx: number) => {
    if (!activeQuiz) return;
    const vaultId = `quiz_${activeQuiz.id}_q_${q.id || qIdx}`;
    const { isNowBookmarked } = toggleBookmarkQuestion({
      id: vaultId,
      sourceType: 'GA_QUIZ',
      sourceId: activeQuiz.id,
      sourceTitle: activeQuiz.title,
      section: 'GA',
      questionText: q.question_text,
      options: q.options || [],
      correctOptionIndex: q.correct_option_index,
      userSelectedOption: currentAnswers[qIdx],
      explanation: q.explanation,
    });
    setBookmarkedMap((prev) => ({ ...prev, [vaultId]: isNowBookmarked }));
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-blue-600/10 blur-[130px] rounded-full z-0" />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          fetchQuizzesAndAttempts(user.id);
        }}
      />

      {/* Header */}
      <header className="bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20">
            BS
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">BSCA Daily Current Affairs Quiz</h1>
            <p className="text-[11px] text-slate-400">Interactive Question-Wise Practice &amp; Attempt Comparison</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <span className="text-xs text-amber-400 font-bold hidden sm:block">
              Hi, {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
            </span>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md"
            >
              Sign In
            </button>
          )}

          <Link
            href="/notebook"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-amber-400/30 text-amber-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <span>🔖</span>
            <span className="hidden sm:inline">Mistake Notebook</span>
          </Link>

          <Link
            href="/"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
          >
            ← Return Home
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-10 flex-1 w-full space-y-6">
        {!activeQuiz ? (
          /* QUIZ CATALOG WITH COMPLETED STATUS & ACTION BUTTONS */
          <div className="space-y-8">
            <div className="relative overflow-hidden bg-gradient-to-b from-slate-900/90 to-slate-950 border border-white/[0.08] p-8 sm:p-10 rounded-3xl text-center space-y-3 shadow-2xl bg-grid-pattern">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full">
                <span>💡</span> Daily Banking GA Booster
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Daily Banking GA Quizzes</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                Attempt timed daily quizzes with multi-attempt comparison and step-by-step explanations.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="bg-slate-900/50 border border-white/[0.08] rounded-3xl p-12 text-center space-y-2">
                <div className="text-4xl">💡</div>
                <h3 className="font-bold text-white text-base">No Quizzes Published Yet</h3>
                <p className="text-xs text-slate-400">Quizzes published from Admin Portal will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {quizzes.map((quiz) => {
                  const attempt = completedAttempts[quiz.id];

                  return (
                    <div
                      key={quiz.id}
                      className={`bg-slate-900/75 backdrop-blur-md border rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all duration-300 hover:-translate-y-1 shadow-xl ${
                        attempt ? 'border-emerald-500/35 bg-slate-900/90' : 'border-white/[0.08] hover:border-amber-400/50'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/25 px-2.5 py-1 rounded-full">
                            📅 {new Date(quiz.quiz_date).toLocaleDateString()}
                          </span>

                          {attempt && (
                            <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                              ✓ Score: {attempt.score}/{attempt.total_questions}
                            </span>
                          )}
                        </div>

                        <h3 className="font-black text-white text-base sm:text-lg leading-snug tracking-tight pt-1">{quiz.title}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span>⏱️ Duration:</span>
                          <strong className="text-slate-200">{quiz.duration_minutes} Mins</strong>
                        </p>
                      </div>

                      {attempt ? (
                        /* DUAL ACTION BUTTONS FOR ATTEMPTED QUIZZES */
                        <div className="grid grid-cols-2 gap-2.5 pt-2">
                          <button
                            onClick={() => handleStartQuiz(quiz)}
                            className="py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition text-center"
                          >
                            🔄 Reattempt
                          </button>

                          <button
                            onClick={() => handleViewSolution(quiz)}
                            className="py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold text-xs border border-amber-400/30 rounded-xl transition text-center"
                          >
                            👁️ Solutions
                          </button>
                        </div>
                      ) : (
                        /* SINGLE ACTION BUTTON FOR NEW QUIZZES */
                        <button
                          onClick={() => handleStartQuiz(quiz)}
                          className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition mt-2"
                        >
                          Start Quiz →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE QUIZ & COMPARISON VIEW */
          <div className="space-y-6 animate-fade-in">
            {/* Top Bar */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] p-6 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xl sticky top-20 z-30">
              <div>
                <button
                  onClick={() => setActiveQuiz(null)}
                  className="text-xs text-slate-400 hover:text-amber-400 transition font-bold inline-flex items-center gap-1 mb-1.5"
                >
                  ← Exit to Quiz Catalog
                </button>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">{activeQuiz.title}</h2>
              </div>

              {!quizSubmitted ? (
                <div className="flex items-center gap-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono font-black text-lg px-5 py-2.5 rounded-2xl shadow-inner">
                  <span>⏱️</span>
                  <span>{formatTime(timeLeft)}</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-sm shadow-lg">
                    Score: {calculateScore()} / {questions.length}
                  </div>
                  
                  <button
                    onClick={handleReattemptQuiz}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition"
                  >
                    🔄 Reattempt Quiz
                  </button>
                </div>
              )}
            </div>

            {/* COMPARISON LEGEND & TOGGLE WHEN SUBMITTED */}
            {quizSubmitted && (
              <div className="bg-slate-900/70 backdrop-blur-md border border-white/[0.08] p-5 rounded-2xl space-y-3.5 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                  <div>
                    <span className="text-xs font-extrabold text-white block">Solutions View Mode</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {showAnswersToggle
                        ? 'Showing complete solution breakdown for all questions.'
                        : 'Practice Mode: Click any option on a question to reveal its answer & explanation!'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/[0.08]">
                    <button
                      onClick={() => setShowAnswersToggle(true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                        showAnswersToggle ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Show All
                    </button>
                    <button
                      onClick={() => setShowAnswersToggle(false)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition ${
                        !showAnswersToggle ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Interactive Practice
                    </button>
                  </div>
                </div>

                {/* Visual Badges Legend */}
                <div className="flex flex-wrap items-center gap-5 text-[11px] font-bold pt-0.5">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Correct Answer
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Current Choice
                  </span>
                  {previousAnswers && (
                    <span className="flex items-center gap-1.5 text-purple-400">
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
              <div className="bg-slate-900/50 border border-white/[0.08] rounded-3xl p-8 text-center text-xs text-slate-400">
                No questions in this quiz.
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q, qIdx) => {
                  const currentOpt = currentAnswers[qIdx];
                  const previousOpt = previousAnswers ? previousAnswers[qIdx] : undefined;

                  const showSolution =
                    quizSubmitted &&
                    (showAnswersToggle || interactiveChecked[qIdx]);

                  return (
                    <div key={q.id} className="bg-slate-900/75 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-white/[0.08] text-amber-400 font-black text-xs shrink-0">
                            Q{qIdx + 1}
                          </span>
                          <h3 className="font-bold text-sm sm:text-base text-white leading-relaxed">
                            {q.question_text}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleQuizBookmark(q, qIdx)}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition shrink-0 flex items-center gap-1.5 ${
                            bookmarkedMap[`quiz_${activeQuiz.id}_q_${q.id || qIdx}`]
                              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                              : 'bg-slate-950 text-slate-300 border-white/[0.08] hover:border-amber-400/50'
                          }`}
                          title="Save question to Mistake & Revision Notebook"
                        >
                          <span>🔖</span>
                          <span>{bookmarkedMap[`quiz_${activeQuiz.id}_q_${q.id || qIdx}`] ? 'Saved' : 'Save'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {q.options.map((opt, optIdx) => {
                          const isCurrent = currentOpt === optIdx;
                          const isPrevious = previousOpt === optIdx;
                          const isCorrect = q.correct_option_index === optIdx;

                          let btnStyle = 'bg-slate-950/80 border-white/[0.08] text-slate-300 hover:border-slate-600 hover:bg-slate-900';

                          if (!quizSubmitted) {
                            if (isCurrent) {
                              btnStyle = 'bg-amber-400/15 border-amber-400 text-amber-200 font-bold shadow-md shadow-amber-500/5';
                            }
                          } else if (showSolution) {
                            if (isCorrect) {
                              btnStyle = 'bg-emerald-500/15 border-emerald-500 text-emerald-200 font-bold';
                            } else if (isCurrent && !isCorrect) {
                              btnStyle = 'bg-rose-500/15 border-rose-500 text-rose-200 font-bold';
                            }
                          }

                          return (
                            <div key={optIdx} className="relative">
                              <button
                                onClick={() => handleSelectOption(qIdx, optIdx)}
                                className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm transition leading-snug flex justify-between items-center gap-2 ${btnStyle}`}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="font-black text-amber-400/90">{String.fromCharCode(65 + optIdx)}.</span>
                                  <span>{opt}</span>
                                </div>

                                {showSolution && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                    {isPrevious && (
                                      <span className="text-[9px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded">
                                        Prev
                                      </span>
                                    )}
                                    {isCurrent && (
                                      <span className="text-[9px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                                        Yours
                                      </span>
                                    )}
                                    {isCorrect && (
                                      <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {showSolution && (
                        <div className="space-y-3 pt-2">
                          {q.explanation && (
                            <div className="p-4 bg-slate-950/90 border border-amber-400/20 rounded-2xl space-y-1.5">
                              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                                💡 Solution &amp; Explanation
                              </span>
                              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}

                          <QuestionCommunityBar
                            questionKey={`quiz_${activeQuiz.id}_q_${q.id || qIdx}`}
                            sourceType="GA_QUIZ"
                            sourceId={activeQuiz.id}
                            sourceTitle={activeQuiz.title}
                            questionNumber={qIdx + 1}
                            section="GA"
                            questionPreview={q.question_text}
                            userName={
                              currentUser?.user_metadata?.full_name ||
                              currentUser?.email?.split('@')[0] ||
                              'Aspirant'
                            }
                            userEmail={currentUser?.email || ''}
                            isDarkTheme={true}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {!quizSubmitted ? (
                  <button
                    onClick={handleSubmitQuiz}
                    className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-emerald-600/25 uppercase tracking-wider transition"
                  >
                    Submit Quiz &amp; View Solutions
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={handleReattemptQuiz}
                      className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg transition"
                    >
                      🔄 Reattempt Quiz
                    </button>
                    <button
                      onClick={() => setActiveQuiz(null)}
                      className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm rounded-2xl border border-white/[0.08] transition"
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