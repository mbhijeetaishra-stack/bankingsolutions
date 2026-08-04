'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// TYPES
interface QuizCard {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
}

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

// EXPANDABLE CATEGORIES FOR STUDENT DASHBOARD
const CATEGORIES = [
  'All',
  'Sectional Quiz',
  'Chapter-wise Quiz',
  'Full Forms Quiz',
  'Full Mock',
];

export default function ComputerIonExamPage() {
  // ROUTING & VIEW STATES
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<QuizCard[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(true);

  // CATEGORY FILTER STATE
  const [activeCategory, setActiveCategory] = useState('All');

  // MOBILE PALETTE DRAWER STATE
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // TRACK COMPLETED TESTS
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<string[]>([]);

  // EXAM ARENA STATES
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: number }>({});
  const [statuses, setStatuses] = useState<{ [key: number]: QuestionStatus }>({});
  const [timeLeft, setTimeLeft] = useState(1200); // 20 Minutes standard
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSolutionView, setIsSolutionView] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [candidateName, setCandidateName] = useState('Aspirant');

  // REAL RANKING ANALYTICS STATES
  const [realRank, setRealRank] = useState<number>(1);
  const [realPercentile, setRealPercentile] = useState<number>(100);
  const [realTotalCandidates, setRealTotalCandidates] = useState<number>(1);

  // Fetch Containers and Attempts on Mount
  useEffect(() => {
    fetchQuizContainers();
    loadAttemptedQuizzes();
  }, []);

  // Timer Loop when active and taking test
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeQuizId && !isSubmitted && !isSolutionView && timeLeft > 0 && !loadingQuestions) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeQuizId, isSubmitted, isSolutionView, timeLeft, loadingQuestions]);

  const loadAttemptedQuizzes = () => {
    try {
      const saved = localStorage.getItem('attempted_computer_quizzes');
      if (saved) {
        setAttemptedQuizIds(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading attempted quizzes', e);
    }
  };

  const markQuizAsAttempted = (quizId: string) => {
    setAttemptedQuizIds((prev) => {
      if (!prev.includes(quizId)) {
        const updated = [...prev, quizId];
        localStorage.setItem('attempted_computer_quizzes', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  };

  const fetchQuizContainers = async () => {
    setLoadingContainers(true);
    const { data, error } = await supabase
      .from('computer_quiz_containers')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setQuizzes(data as QuizCard[]);
    }
    setLoadingContainers(false);
  };

  const startQuiz = async (quizId: string, directToSolutions = false) => {
    setLoadingQuestions(true);
    setActiveQuizId(quizId);
    setTimeLeft(1200);
    setCurrentIndex(0);
    setIsMobilePaletteOpen(false);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCandidateName(
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Aspirant'
      );
    }

    const { data, error } = await supabase
      .from('computer_quiz_questions')
      .select('*')
      .eq('quiz_id', quizId);

    if (!error && data) {
      setQuestions(data as Question[]);
      
      const savedSelections = localStorage.getItem(`answers_${quizId}`);

      if (directToSolutions) {
        if (savedSelections) {
          setSelectedOptions(JSON.parse(savedSelections));
        }
        setIsSubmitted(true);
        setIsSolutionView(true);
      } else {
        // FRESH ATTEMPT
        setSelectedOptions({});
        setIsSubmitted(false);
        setIsSolutionView(false);

        const initialStatuses: { [key: number]: QuestionStatus } = {};
        data.forEach((_, idx) => {
          initialStatuses[idx] = idx === 0 ? 'not_answered' : 'not_visited';
        });
        setStatuses(initialStatuses);
      }
    }
    setLoadingQuestions(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOptionSelect = (optIndex: number) => {
    if (isSolutionView) return;
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
    if (isSolutionView) return;
    setSelectedOptions((prev) => {
      const updated = { ...prev };
      delete updated[currentIndex];
      return updated;
    });
    setStatuses((prev) => ({ ...prev, [currentIndex]: 'not_answered' }));
  };

  const handlePaletteClick = (idx: number) => {
    setCurrentIndex(idx);
    if (!isSolutionView && statuses[idx] === 'not_visited') {
      setStatuses((prev) => ({ ...prev, [idx]: 'not_answered' }));
    }
    setIsMobilePaletteOpen(false);
  };

  // SAVE ATTEMPT TO SUPABASE & FETCH REAL RANK
  const saveQuizAttemptToSupabase = async (quizId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      const res = calculateResult();

      // 1. Insert Record into Supabase attempts table
      await supabase.from('computer_quiz_attempts').insert([
        {
          quiz_id: quizId,
          user_id: userId,
          candidate_name: candidateName,
          score: res.marksObtained,
          total_marks: res.totalMaxMarks,
          correct_count: res.correct,
          wrong_count: res.wrong,
          unattempted_count: res.unattempted,
          accuracy: res.accuracy,
          time_spent_seconds: 1200 - timeLeft,
        },
      ]);

      // 2. Calculate Real Rank & Percentile
      const { count: totalCount } = await supabase
        .from('computer_quiz_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', quizId);

      const { count: higherCount } = await supabase
        .from('computer_quiz_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('quiz_id', quizId)
        .gt('score', res.marksObtained);

      const computedRank = (higherCount || 0) + 1;
      const totalCandidates = totalCount || 1;
      const computedPercentile = Number(
        (((totalCandidates - computedRank + 1) / totalCandidates) * 100).toFixed(1)
      );

      setRealRank(computedRank);
      setRealTotalCandidates(totalCandidates);
      setRealPercentile(computedPercentile);
    } catch (err) {
      console.error('Error saving attempt to Supabase:', err);
    }
  };

  const handleAutoSubmit = async () => {
    if (activeQuizId) {
      markQuizAsAttempted(activeQuizId);
      localStorage.setItem(`answers_${activeQuizId}`, JSON.stringify(selectedOptions));
      await saveQuizAttemptToSupabase(activeQuizId);
    }
    setIsSubmitted(true);
    setIsSolutionView(false);
  };

  const handleSubmitExam = async () => {
    if (confirm('Are you sure you want to submit the exam?')) {
      if (activeQuizId) {
        markQuizAsAttempted(activeQuizId);
        localStorage.setItem(`answers_${activeQuizId}`, JSON.stringify(selectedOptions));
        await saveQuizAttemptToSupabase(activeQuizId);
      }
      setIsSubmitted(true);
      setIsSolutionView(false);
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
    const accuracy = totalAttempted > 0 ? Number(((correct / totalAttempted) * 100).toFixed(1)) : 0;
    
    // RRB Mains Scheme: 0.5 marks per correct, -0.125 negative marking
    const marksObtained = Number((correct * 0.5 - wrong * 0.125).toFixed(3));
    const totalMaxMarks = questions.length * 0.5;

    const timeSpentSeconds = 1200 - timeLeft;
    const timeSpentFormatted = `${Math.floor(timeSpentSeconds / 60)}m ${timeSpentSeconds % 60}s`;

    return {
      correct,
      wrong,
      unattempted,
      marksObtained,
      totalMaxMarks,
      accuracy,
      totalAttempted,
      timeSpentFormatted,
    };
  };

  // Filter Quizzes based on Selected Tab
  const filteredQuizzes = activeCategory === 'All'
    ? quizzes
    : quizzes.filter(q => q.category?.toLowerCase() === activeCategory.toLowerCase());

  /* ========================================================= */
  /* VIEW 1: QUIZ CARDS DASHBOARD                              */
  /* ========================================================= */
  if (!activeQuizId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* HEADER */}
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-amber-400 flex items-center gap-2">
                💻 RRB Computer Awareness Test Series
              </h1>
              <p className="text-[11px] md:text-xs text-slate-400 mt-1">
                Target IBPS RRB PO & Clerk Mains (20 Marks / 40 Questions)
              </p>
            </div>
            <Link
              href="/"
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-slate-700 transition"
            >
              ← Home
            </Link>
          </div>

          {/* DYNAMIC CATEGORY TABS */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs font-bold scrollbar-none">
            {CATEGORIES.map((cat) => {
              const count = cat === 'All' 
                ? quizzes.length 
                : quizzes.filter(q => q.category?.toLowerCase() === cat.toLowerCase()).length;

              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
                    activeCategory === cat
                      ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span>{cat === 'All' ? '🌐 All Quizzes' : cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activeCategory === cat ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-950 text-amber-400 border border-slate-800'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* QUIZ CARDS GRID */}
          {loadingContainers ? (
            <div className="text-center py-12 text-slate-500 text-xs font-bold">
              Loading Computer Quizzes...
            </div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
              No computer quizzes found in <strong className="text-amber-400">{activeCategory}</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 pt-2">
              {filteredQuizzes.map((quiz) => {
                const isAttempted = attemptedQuizIds.includes(quiz.id);

                return (
                  <div
                    key={quiz.id}
                    className="bg-slate-900 border border-slate-800 hover:border-amber-400/50 rounded-2xl p-4 md:p-5 flex flex-col justify-between shadow-xl transition-all duration-200"
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                        <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
                          {quiz.category || 'Sectional Quiz'}
                        </span>
                        
                        {isAttempted ? (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            ✓ Attempted
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono">{quiz.difficulty || 'Moderate'}</span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-base md:text-lg font-black text-white">
                          {quiz.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {quiz.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <div className="flex items-center gap-1">
                          <span>❓</span>
                          <span>40 Qs (20 Marks)</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>⏱️</span>
                          <span>20 Mins</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      {isAttempted ? (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => startQuiz(quiz.id, false)}
                            className="py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl text-center transition"
                          >
                            Re-take 🔄
                          </button>
                          <button
                            onClick={() => startQuiz(quiz.id, true)}
                            className="py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl text-center transition"
                          >
                            Solutions 📖
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startQuiz(quiz.id, false)}
                          className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg transition"
                        >
                          Attempt Test (iON Mode) →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-slate-900 text-amber-400 flex items-center justify-center text-sm font-bold">
        Loading BS TCS iON Portal...
      </div>
    );
  }

  const res = calculateResult();
  const currentQ = questions[currentIndex];
  const counts = getCounts();

  /* ========================================================= */
  /* VIEW 2: POST-EXAM ANALYSIS SCORECARD DASHBOARD            */
  /* ========================================================= */
  if (isSubmitted && !isSolutionView) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 font-sans flex flex-col items-center justify-center">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden space-y-6 p-5 md:p-6">
          
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded text-xs md:text-sm shadow">
                BS iON
              </span>
              <span className="font-extrabold text-white text-sm md:text-base">
                Performance Scorecard
              </span>
            </div>
            <span className="text-[10px] md:text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full font-mono">
              {activeQuizId?.toUpperCase().replace('_', ' ')}
            </span>
          </div>

          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-blue-500/10 border border-amber-500/30 rounded-2xl p-5 md:p-6 text-center space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block">
              Overall Marks
            </span>
            <div className="text-3xl md:text-5xl font-black text-amber-400">
              {res.marksObtained} <span className="text-sm md:text-lg text-slate-500 font-normal">/ {res.totalMaxMarks}</span>
            </div>
            <p className="text-xs text-slate-300 pt-1">
              Candidate: <strong className="text-white">{candidateName}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3 text-center">
            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-xl md:text-2xl font-black text-blue-400 block">#{realRank}</span>
              <span className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold block">
                Rank (of {realTotalCandidates})
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1">
              <span className="text-xl md:text-2xl font-black text-amber-400 block">{realPercentile}%</span>
              <span className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold block">
                Percentile
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-1 col-span-2 md:col-span-1">
              <span className="text-xl md:text-2xl font-black text-emerald-400 block">{res.accuracy}%</span>
              <span className="text-[9px] md:text-[10px] text-slate-400 uppercase font-bold block">
                Accuracy
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center text-xs font-mono">
            <div>
              <span className="text-emerald-400 font-bold text-base md:text-lg block">{res.correct}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Correct</span>
            </div>
            <div>
              <span className="text-rose-400 font-bold text-base md:text-lg block">{res.wrong}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Wrong</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold text-base md:text-lg block">{res.unattempted}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Left</span>
            </div>
            <div>
              <span className="text-amber-400 font-bold text-base md:text-lg block">{res.timeSpentFormatted}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">Time</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={() => setIsSolutionView(true)}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition text-center"
            >
              View Solutions 📖
            </button>
            <button
              onClick={() => activeQuizId && startQuiz(activeQuizId, false)}
              className="py-3 px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition text-center"
            >
              Re-take Mock 🔄
            </button>
            <button
              onClick={() => setActiveQuizId(null)}
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl border border-slate-700 transition"
            >
              Exit
            </button>
          </div>

        </div>
      </div>
    );
  }

  /* ========================================================= */
  /* VIEW 3: LIVE EXAM ARENA & TCS iON SOLUTIONS PORTAL        */
  /* ========================================================= */
  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-slate-100 select-none overflow-hidden text-slate-900">
      
      {/* 1. TOP HEADER WITH BANKINGSOLUTIONS (BS) BRANDING */}
      <header className="bg-[#1d63b8] text-white h-12 md:h-14 flex justify-between items-center px-3 md:px-4 shadow-md shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 md:py-1 rounded text-xs md:text-sm shadow flex items-center gap-1">
            <span className="tracking-tighter">BS</span>
            <span className="text-[9px] md:text-[10px] bg-slate-950 text-amber-400 px-1 rounded">iON</span>
          </div>
          <span className="font-extrabold text-xs md:text-sm tracking-wide uppercase truncate max-w-[140px] sm:max-w-none">
            BankingSolutions — {activeQuizId?.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="text-right hidden sm:block">
            <span className="text-[9px] uppercase text-blue-200 block font-bold">Candidate</span>
            <span className="text-xs font-bold">{candidateName}</span>
          </div>

          {!isSolutionView ? (
            <div className="bg-white text-slate-900 px-2.5 py-1 rounded font-mono font-bold text-xs md:text-sm flex items-center gap-1.5 border border-blue-300">
              <span className="text-slate-500 text-[10px] hidden sm:inline">Time:</span>
              <span className={timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-blue-700'}>
                {formatTime(timeLeft)}
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsSolutionView(false)}
              className="bg-amber-400 text-slate-950 text-[10px] md:text-xs font-black px-2.5 py-1 rounded uppercase"
            >
              Scorecard 📊
            </button>
          )}

          {/* MOBILE PALETTE TOGGLE BUTTON */}
          <button
            onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
            className="md:hidden bg-blue-900/60 border border-blue-400/30 text-white font-bold px-2 py-1 rounded text-xs flex items-center gap-1"
          >
            <span>☰</span>
            <span className="text-[10px]">Palette</span>
          </button>
        </div>
      </header>

      {/* 2. SECTION BAR / SOLUTIONS SCORE BAR */}
      <div className="bg-slate-200 border-b border-slate-300 px-3 md:px-4 py-1.5 flex justify-between items-center shrink-0 text-xs">
        <div className="flex items-center gap-1.5">
          <button className="bg-[#1d63b8] text-white font-bold px-3 py-1 rounded-t text-[10px] md:text-xs shadow">
            Computer Knowledge
          </button>
          {isSolutionView && (
            <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
              Solution Mode
            </span>
          )}
        </div>

        {isSolutionView ? (
          <div className="flex gap-2.5 font-mono font-bold text-slate-700 text-[10px] md:text-xs">
            <span>Score: <strong className="text-blue-600">{res.marksObtained} / {res.totalMaxMarks}</strong></span>
            <span className="hidden sm:inline">Accuracy: <strong className="text-emerald-600">{res.accuracy}%</strong></span>
          </div>
        ) : (
          <span className="text-slate-600 font-semibold text-[10px] md:text-[11px]">
            +0.5 | -0.125
          </span>
        )}
      </div>

      {/* 3. MAIN EXAM / SOLUTION BODY */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT: QUESTION ARENA */}
        <div className="flex-1 flex flex-col justify-between bg-white border-r border-slate-300 overflow-hidden">
          <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4 md:space-y-5">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <span className="font-extrabold text-slate-800 text-sm md:text-base">
                Question No. {currentIndex + 1}
              </span>
              <span className="text-[10px] md:text-[11px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border">
                Category: {currentQ?.category || 'General'}
              </span>
            </div>

            <div className="text-xs md:text-base font-semibold text-slate-800 leading-relaxed">
              {currentQ?.question}
            </div>

            {/* OPTIONS */}
            <div className="space-y-2.5 pt-1">
              {currentQ?.options.map((opt: string, optIdx: number) => {
                const isSelected = selectedOptions[currentIndex] === optIdx;
                const isCorrectOption = optIdx === currentQ.correct_option;

                let optStyle = 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50';

                if (isSolutionView) {
                  if (isCorrectOption) {
                    optStyle = 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold';
                  } else if (isSelected && !isCorrectOption) {
                    optStyle = 'bg-rose-50 border-rose-500 text-rose-800 font-bold';
                  } else {
                    optStyle = 'bg-slate-50 border-slate-200 text-slate-400';
                  }
                } else if (isSelected) {
                  optStyle = 'bg-blue-50 border-[#1d63b8] text-[#1d63b8] font-bold shadow-sm';
                }

                return (
                  <label
                    key={optIdx}
                    onClick={() => handleOptionSelect(optIdx)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs md:text-sm cursor-pointer transition ${optStyle}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        disabled={isSolutionView}
                        name={`q-${currentIndex}`}
                        checked={isSelected}
                        onChange={() => handleOptionSelect(optIdx)}
                        className="accent-[#1d63b8] w-4 h-4 shrink-0"
                      />
                      <span>{opt}</span>
                    </div>

                    {isSolutionView && isCorrectOption && (
                      <span className="text-[9px] bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                        Correct
                      </span>
                    )}
                    {isSolutionView && isSelected && !isCorrectOption && (
                      <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                        Your Pick
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* EXPLANATION IN SOLUTION MODE */}
            {isSolutionView && currentQ?.explanation && (
              <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl text-xs space-y-1">
                <span className="font-bold text-amber-600 block uppercase text-[10px]">💡 Official Explanation:</span>
                <p className="text-slate-700 leading-relaxed text-xs">{currentQ.explanation}</p>
              </div>
            )}
          </div>

          {/* BOTTOM CONTROLS BAR */}
          <div className="bg-slate-100 border-t border-slate-300 p-2.5 md:p-3 flex flex-wrap justify-between items-center gap-2 shrink-0">
            {!isSolutionView ? (
              <>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleMarkForReview}
                    className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-[10px] md:text-xs px-2.5 md:px-4 py-2 rounded shadow"
                  >
                    Mark for Review
                  </button>
                  <button
                    onClick={handleClearResponse}
                    className="bg-white hover:bg-slate-200 border border-slate-400 text-slate-700 font-bold text-[10px] md:text-xs px-2.5 md:px-4 py-2 rounded shadow"
                  >
                    Clear Response
                  </button>
                </div>

                <button
                  onClick={handleSaveAndNext}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 md:px-6 py-2 rounded shadow"
                >
                  Save & Next →
                </button>
              </>
            ) : (
              <div className="flex justify-between w-full">
                <button
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="bg-slate-300 hover:bg-slate-400 text-slate-800 font-bold text-xs px-3.5 py-2 rounded disabled:opacity-40"
                >
                  ← Previous Question
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentIndex === questions.length - 1}
                  className="bg-[#1d63b8] hover:bg-blue-700 text-white font-bold text-xs px-5 py-2 rounded"
                >
                  Next Question →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE PALETTE OVERLAY BACKDROP */}
        {isMobilePaletteOpen && (
          <div
            onClick={() => setIsMobilePaletteOpen(false)}
            className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
          />
        )}

        {/* RIGHT: QUESTION PALETTE WITH ALL 5 OFFICIAL TCS STATES */}
        <div
          className={`fixed md:static inset-y-0 right-0 z-50 w-72 md:w-80 bg-slate-50 flex flex-col justify-between border-l border-slate-300 shrink-0 transition-transform duration-300 shadow-2xl md:shadow-none ${
            isMobilePaletteOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="p-4 overflow-y-auto space-y-4">
            
            <div className="flex justify-between items-center md:hidden border-b border-slate-300 pb-2">
              <span className="font-bold text-xs text-slate-800 uppercase">Question Palette</span>
              <button
                onClick={() => setIsMobilePaletteOpen(false)}
                className="text-slate-500 font-bold text-base px-2"
              >
                ✕
              </button>
            </div>

            {/* TCS PALETTE LEGEND */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-700 border-b border-slate-300 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-emerald-600 text-white flex items-center justify-center rounded-sm text-[9px]">
                  {counts.answered}
                </span>
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-rose-600 text-white flex items-center justify-center rounded-sm text-[9px]">
                  {counts.notAnswered}
                </span>
                <span>Not Answered</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-slate-200 border border-slate-400 text-slate-700 flex items-center justify-center rounded-sm text-[9px]">
                  {counts.notVisited}
                </span>
                <span>Not Visited</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-purple-700 text-white flex items-center justify-center rounded-sm text-[9px]">
                  {counts.marked}
                </span>
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="w-4 h-4 bg-purple-700 text-white flex items-center justify-center rounded-sm text-[9px] relative overflow-visible">
                  {counts.answeredMarked}
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-white"></span>
                </span>
                <span>Answered & Marked for Review</span>
              </div>
            </div>

            {/* PALETTE GRID */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-2 uppercase">
                Questions ({questions.length})
              </span>
              <div className="grid grid-cols-5 gap-1.5 max-h-80 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const st = statuses[idx];
                  const userSel = selectedOptions[idx];

                  let btnBg = 'bg-slate-200 border-slate-400 text-slate-700';

                  if (isSolutionView) {
                    if (userSel === undefined) {
                      btnBg = 'bg-slate-200 border-slate-400 text-slate-700';
                    } else if (userSel === q.correct_option) {
                      btnBg = 'bg-emerald-600 text-white border-emerald-700';
                    } else {
                      btnBg = 'bg-rose-600 text-white border-rose-700';
                    }
                  } else {
                    if (st === 'answered') btnBg = 'bg-emerald-600 text-white border-emerald-700';
                    if (st === 'not_answered') btnBg = 'bg-rose-600 text-white border-rose-700';
                    if (st === 'marked') btnBg = 'bg-purple-700 text-white border-purple-800';
                    if (st === 'answered_marked') btnBg = 'bg-purple-700 text-white border-purple-800 relative overflow-visible';
                  }

                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={idx}
                      onClick={() => handlePaletteClick(idx)}
                      className={`h-8 font-bold text-xs rounded border transition flex items-center justify-center shadow-sm relative ${btnBg} ${
                        isCurrent ? 'ring-2 ring-blue-600 ring-offset-1 font-black scale-105' : ''
                      }`}
                    >
                      {idx + 1}

                      {/* GREEN DOT INDICATOR FOR ANSWERED & MARKED FOR REVIEW */}
                      {!isSolutionView && st === 'answered_marked' && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white shadow-sm z-10"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON FOOTER */}
          <div className="p-3 bg-slate-200 border-t border-slate-300">
            {!isSolutionView ? (
              <button
                onClick={handleSubmitExam}
                className="w-full py-2.5 bg-[#1d63b8] hover:bg-blue-800 text-white font-extrabold text-xs uppercase tracking-wider rounded shadow transition"
              >
                Submit Test
              </button>
            ) : (
              <button
                onClick={() => setIsSolutionView(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs uppercase tracking-wider rounded shadow transition"
              >
                Back to Scorecard 📊
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}