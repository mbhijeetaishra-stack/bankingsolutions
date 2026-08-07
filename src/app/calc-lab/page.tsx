'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type ModuleType = 'tables' | 'squares' | 'cubes' | 'percentages' | 'mixed';

interface QuestionProblem {
  prompt: string;
  answer: number;
  explanation: string;
}

interface LeaderboardEntry {
  id: string;
  user_id: string;
  student_name: string;
  module_type: string;
  score: number;
  total_attempted: number;
  accuracy: number;
  created_at: string;
}

// 🟢 Predefined pool of unique fraction/percentage problems to avoid repetitions
const fractionPercentagePool = [
  { prompt: '16.66% of 60', answer: 10, explanation: '16.66% = 1/6th' },
  { prompt: '14.28% of 70', answer: 10, explanation: '14.28% = 1/7th' },
  { prompt: '12.5% of 80', answer: 10, explanation: '12.5% = 1/8th' },
  { prompt: '37.5% of 80', answer: 30, explanation: '37.5% = 3/8th' },
  { prompt: '62.5% of 80', answer: 50, explanation: '62.5% = 5/8th' },
  { prompt: '83.33% of 60', answer: 50, explanation: '83.33% = 5/6th' },
  { prompt: '11.11% of 90', answer: 10, explanation: '11.11% = 1/9th' },
  { prompt: '9.09% of 110', answer: 10, explanation: '9.09% = 1/11th' },
  { prompt: '27.27% of 110', answer: 30, explanation: '27.27% = 3/11th' },
  { prompt: '33.33% of 90', answer: 30, explanation: '33.33% = 1/3rd' },
  { prompt: '66.66% of 90', answer: 60, explanation: '66.66% = 2/3rds' },
  { prompt: '20% of 150', answer: 30, explanation: '20% = 1/5th' },
  { prompt: '40% of 150', answer: 60, explanation: '40% = 2/5ths' },
  { prompt: '60% of 150', answer: 90, explanation: '60% = 3/5ths' },
  { prompt: '80% of 150', answer: 120, explanation: '80% = 4/5ths' },
  { prompt: '28.57% of 70', answer: 20, explanation: '28.57% = 2/7ths' },
  { prompt: '42.85% of 70', answer: 30, explanation: '42.85% = 3/7ths' },
  { prompt: '57.14% of 70', answer: 40, explanation: '57.14% = 4/7ths' },
  { prompt: '71.42% of 70', answer: 50, explanation: '71.42% = 5/7ths' },
  { prompt: '85.71% of 70', answer: 60, explanation: '85.71% = 6/7ths' },
];

export default function CalcLabPage() {
  const [activeTab, setActiveTab] = useState<'practice' | 'leaderboard'>('practice');

  const [selectedModule, setSelectedModule] = useState<ModuleType>('tables');
  const [mode, setMode] = useState<'timer' | 'target20'>('timer');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);

  // Game Metrics
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);

  // 🟢 Session-based tracking array to prevent duplicate questions in a single drill
  const sessionQueueRef = useRef<QuestionProblem[]>([]);

  // User & Leaderboard States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState<{ rank: number; score: number; accuracy: number; student_name: string; module_type: string } | null>(null);

  // Current Question
  const [currentProblem, setCurrentProblem] = useState<QuestionProblem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');

  const inputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user || null;
      setCurrentUser(user);
      fetchLeaderboard(user?.id);
    });
  }, []);

  useEffect(() => {
    if (isGameActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isGameActive, currentProblem]);

  useEffect(() => {
    let interval: any = null;
    if (isGameActive && mode === 'timer' && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isGameActive, mode, timeLeft]);

  const fetchLeaderboard = async (userId?: string) => {
    setLoadingLeaderboard(true);
    const activeUserId = userId || currentUser?.id;

    const { data, error } = await supabase
      .from('calculation_lab_scores')
      .select('*')
      .order('score', { ascending: false })
      .order('accuracy', { ascending: false })
      .limit(50);

    if (!error && data) {
      setLeaderboard(data as LeaderboardEntry[]);

      if (activeUserId) {
        const foundIndex = data.findIndex((entry) => entry.user_id === activeUserId);
        if (foundIndex !== -1) {
          setCurrentUserRank(null);
        } else {
          fetchUserRankOutsideTop50(activeUserId);
        }
      }
    }
    setLoadingLeaderboard(false);
  };

  const fetchUserRankOutsideTop50 = async (userId: string) => {
    const { data: userData, error: userErr } = await supabase
      .from('calculation_lab_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (userErr || !userData) {
      setCurrentUserRank(null);
      return;
    }

    const { count, error: countErr } = await supabase
      .from('calculation_lab_scores')
      .select('*', { count: 'exact', head: true })
      .or(`score.gt.${userData.score},and(score.eq.${userData.score},accuracy.gt.${userData.accuracy})`);

    if (!countErr && count !== null) {
      setCurrentUserRank({
        rank: count + 1,
        score: userData.score,
        accuracy: userData.accuracy,
        student_name: userData.student_name || 'You',
        module_type: userData.module_type || 'GENERAL',
      });
    } else {
      setCurrentUserRank(null);
    }
  };

  // 🟢 Enhanced Question Generator with Unique Queue Support for Percentages
  const generateProblem = (moduleType: ModuleType): QuestionProblem => {
    if (moduleType === 'mixed') {
      const ops = ['+', '-', '×', '÷'];
      const chosenOp = ops[Math.floor(Math.random() * ops.length)];

      if (chosenOp === '+') {
        const a = Math.floor(Math.random() * 89) + 11;
        const b = Math.floor(Math.random() * 89) + 11;
        return { prompt: `${a} + ${b}`, answer: a + b, explanation: `${a} + ${b} = ${a + b}` };
      } else if (chosenOp === '-') {
        const a = Math.floor(Math.random() * 89) + 11;
        const b = Math.floor(Math.random() * a) + 1;
        return { prompt: `${a} - ${b}`, answer: a - b, explanation: `${a} - ${b} = ${a - b}` };
      } else if (chosenOp === '×') {
        const a = Math.floor(Math.random() * 20) + 5;
        const b = Math.floor(Math.random() * 9) + 2;
        return { prompt: `${a} × ${b}`, answer: a * b, explanation: `${a} × ${b} = ${a * b}` };
      } else {
        const divisor = Math.floor(Math.random() * 14) + 2;
        const quotient = Math.floor(Math.random() * 19) + 2;
        const dividend = divisor * quotient;
        return { prompt: `${dividend} ÷ ${divisor}`, answer: quotient, explanation: `${dividend} ÷ ${divisor} = ${quotient}` };
      }
    }

    if (moduleType === 'tables') {
      const num1 = Math.floor(Math.random() * 19) + 12;
      const num2 = Math.floor(Math.random() * 9) + 2;
      return {
        prompt: `${num1} × ${num2}`,
        answer: num1 * num2,
        explanation: `${num1} × ${num2} = ${num1 * num2}`,
      };
    }

    if (moduleType === 'squares') {
      const num = Math.floor(Math.random() * 41) + 10;
      return {
        prompt: `${num}²`,
        answer: num * num,
        explanation: `${num} × ${num} = ${num * num}`,
      };
    }

    if (moduleType === 'cubes') {
      const num = Math.floor(Math.random() * 21) + 5;
      return {
        prompt: `${num}³`,
        answer: num * num * num,
        explanation: `${num} × ${num} × ${num} = ${num * num * num}`,
      };
    }

    // 🟢 Non-repeating queue pop for percentages module
    if (sessionQueueRef.current.length === 0) {
      sessionQueueRef.current = [...fractionPercentagePool].sort(() => 0.5 - Math.random());
    }
    return sessionQueueRef.current.pop()!;
  };

  const startGame = () => {
    isSavingRef.current = false;
    setScore(0);
    setWrongCount(0);
    setTotalAttempted(0);
    setTimeLeft(60);
    setUserInput('');
    setIsGameFinished(false);
    setIsGameActive(true);
    
    // Clear queue on fresh start to guarantee a completely randomized deck
    sessionQueueRef.current = [...fractionPercentagePool].sort(() => 0.5 - Math.random());
    setCurrentProblem(generateProblem(selectedModule));
  };

  const endGame = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    
    setIsGameActive(false);
    setIsGameFinished(true);

    const session = (await supabase.auth.getSession()).data.session;
    if (session?.user && score > 0) {
      const studentName =
        session.user.user_metadata?.full_name ||
        session.user.email?.split('@')[0] ||
        'Aspirant';

      const accNum = totalAttempted > 0 ? Number(((score / totalAttempted) * 100).toFixed(1)) : 100;

      await supabase.from('calculation_lab_scores').upsert(
        [
          {
            user_id: session.user.id,
            student_name: studentName,
            module_type: selectedModule.toUpperCase(),
            score: score,
            total_attempted: totalAttempted,
            accuracy: accNum,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'user_id,module_type' }
      );

      fetchLeaderboard(session.user.id);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserInput(val);

    if (!currentProblem) return;

    if (parseInt(val, 10) === currentProblem.answer) {
      setFeedback('correct');
      const newScore = score + 1;
      const newTotal = totalAttempted + 1;
      setScore(newScore);
      setTotalAttempted(newTotal);

      if (mode === 'target20' && newScore >= 20) {
        setTimeout(() => {
          setFeedback('none');
          endGame();
        }, 200);
        return;
      }

      setTimeout(() => {
        setFeedback('none');
        setUserInput('');
        setCurrentProblem(generateProblem(selectedModule));
      }, 200);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProblem || !userInput) return;

    if (parseInt(userInput, 10) !== currentProblem.answer) {
      setFeedback('wrong');
      setWrongCount((prev) => prev + 1);
      setTotalAttempted((prev) => prev + 1);

      setTimeout(() => {
        setFeedback('none');
        setUserInput('');
      }, 400);
    }
  };

  const handleNumpadClick = (numStr: string) => {
    if (!isGameActive) return;
    if (numStr === 'CLEAR') {
      setUserInput('');
      return;
    }
    const newVal = userInput + numStr;
    setUserInput(newVal);

    if (currentProblem && parseInt(newVal, 10) === currentProblem.answer) {
      setFeedback('correct');
      const newScore = score + 1;
      const newTotal = totalAttempted + 1;
      setScore(newScore);
      setTotalAttempted(newTotal);

      if (mode === 'target20' && newScore >= 20) {
        setTimeout(() => {
          setFeedback('none');
          endGame();
        }, 200);
        return;
      }

      setTimeout(() => {
        setFeedback('none');
        setUserInput('');
        setCurrentProblem(generateProblem(selectedModule));
      }, 200);
    }
  };

  const accuracy = totalAttempted > 0 ? ((score / totalAttempted) * 100).toFixed(0) : '100';

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-6 select-none flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full space-y-6">
        
        {/* Header */}
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-400">⚡ Speed Calculation Lab</h1>
            <p className="text-xs text-slate-400">Banking Quant Speed Booster</p>
          </div>
          <Link
            href="/"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-1.5 rounded border border-slate-700 transition"
          >
            ← Exit Lab
          </Link>
        </header>

        {/* TOP TAB SWITCHER */}
        {!isGameActive && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('practice')}
              className={`flex-1 py-2.5 rounded-lg transition ${
                activeTab === 'practice' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🧪 Drill Lab
            </button>
            <button
              onClick={() => {
                setActiveTab('leaderboard');
                fetchLeaderboard();
              }}
              className={`flex-1 py-2.5 rounded-lg transition ${
                activeTab === 'leaderboard' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🏆 Top Scorers
            </button>
          </div>
        )}

        {/* TAB 1: PRACTICE DRILL */}
        {activeTab === 'practice' && (
          <>
            {!isGameActive && !isGameFinished ? (
              /* SETUP SCREEN */
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Select Practice Module</h2>

                {/* Module Picker */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    onClick={() => setSelectedModule('tables')}
                    className={`p-4 rounded-xl border font-bold text-left transition ${
                      selectedModule === 'tables'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">✖️ Tables</span>
                    <span className="text-xs font-normal text-slate-400">12 × 12 up to 30 × 10</span>
                  </button>

                  <button
                    onClick={() => setSelectedModule('squares')}
                    className={`p-4 rounded-xl border font-bold text-left transition ${
                      selectedModule === 'squares'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">🔲 Squares</span>
                    <span className="text-xs font-normal text-slate-400">Squares 10² to 50²</span>
                  </button>

                  <button
                    onClick={() => setSelectedModule('cubes')}
                    className={`p-4 rounded-xl border font-bold text-left transition ${
                      selectedModule === 'cubes'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">🧊 Cubes</span>
                    <span className="text-xs font-normal text-slate-400">Cubes 5³ to 25³</span>
                  </button>

                  <button
                    onClick={() => setSelectedModule('percentages')}
                    className={`p-4 rounded-xl border font-bold text-left transition ${
                      selectedModule === 'percentages'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">⚡ Fraction %</span>
                    <span className="text-xs font-normal text-slate-400">16.66%, 14.28%, etc.</span>
                  </button>

                  <button
                    onClick={() => setSelectedModule('mixed')}
                    className={`col-span-2 p-4 rounded-xl border font-bold text-center transition ${
                      selectedModule === 'mixed'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                        : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-lg block mb-1">🔀 Mixed Practice</span>
                    <span className="text-xs font-normal text-slate-400">Addition, Subtraction, Multiplication, Division</span>
                  </button>
                </div>

                {/* Mode Picker */}
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Choose Mode</h2>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <button
                    onClick={() => setMode('timer')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-xs border transition ${
                      mode === 'timer' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    ⏱️ 60-Second Blitz
                  </button>
                  <button
                    onClick={() => setMode('target20')}
                    className={`py-2.5 px-4 rounded-lg font-semibold text-xs border transition ${
                      mode === 'target20' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    🎯 Target 20 Correct
                  </button>
                </div>

                <button
                  onClick={startGame}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 rounded-xl transition text-base uppercase tracking-wider shadow-lg shadow-amber-500/20"
                >
                  Start Drill
                </button>
              </div>
            ) : isGameActive ? (
              /* ACTIVE GAME ARENA */
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 font-mono text-sm">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">
                      {mode === 'timer' ? 'Time Left' : 'Questions Left'}
                    </span>
                    <span className="font-bold text-amber-400 text-lg">
                      {mode === 'timer' ? `${timeLeft}s` : `${20 - score} left`}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">Score</span>
                    <span className="font-bold text-emerald-400 text-lg">{score}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px] uppercase font-sans">Accuracy</span>
                    <span className="font-bold text-blue-400 text-lg">{accuracy}%</span>
                  </div>
                </div>

                <div
                  className={`bg-slate-800 border-2 rounded-2xl p-8 text-center transition-all ${
                    feedback === 'correct'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : feedback === 'wrong'
                      ? 'border-rose-500 bg-rose-500/10'
                      : 'border-slate-700'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Solve Fast</span>
                  <p className="text-4xl md:text-5xl font-black text-white tracking-wide mb-6">{currentProblem?.prompt}</p>

                  <form onSubmit={handleFormSubmit}>
                    <input
                      ref={inputRef}
                      type="number"
                      value={userInput}
                      onChange={handleInputChange}
                      placeholder="?"
                      className="w-36 text-center text-3xl font-bold bg-slate-950 border-2 border-slate-700 rounded-xl p-3 text-amber-400 focus:outline-none focus:border-amber-400 font-mono"
                      autoFocus
                    />
                  </form>
                </div>

                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLEAR', '0'].map((btn) => (
                    <button
                      key={btn}
                      onClick={() => handleNumpadClick(btn)}
                      className={`p-4 font-bold rounded-xl text-lg transition active:scale-95 ${
                        btn === 'CLEAR'
                          ? 'bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-sans col-span-1'
                          : btn === '0'
                          ? 'bg-slate-800 border border-slate-700 text-slate-200 col-span-2'
                          : 'bg-slate-800 border border-slate-700 text-slate-200'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* RESULT SCREEN */
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center space-y-6 shadow-xl">
                <span className="text-4xl block">🎉</span>
                <div>
                  <h2 className="text-2xl font-black text-white">Drill Complete!</h2>
                  <p className="text-xs text-slate-400 mt-1">Your score has been updated on the leaderboard.</p>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-700 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans uppercase">Score</span>
                    <span className="text-xl font-bold text-emerald-400">{score}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans uppercase">Errors</span>
                    <span className="text-xl font-bold text-rose-400">{wrongCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans uppercase">Accuracy</span>
                    <span className="text-xl font-bold text-blue-400">{accuracy}%</span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={startGame}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition text-sm"
                  >
                    Try Again 🔄
                  </button>
                  <button
                    onClick={() => {
                      setIsGameFinished(false);
                      setActiveTab('leaderboard');
                      fetchLeaderboard();
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-3 px-5 rounded-xl transition text-sm"
                  >
                    🏆 Leaderboard
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: TOP SCORERS LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>🏆 Top Speed Calculators</span>
              </h3>
              <button
                onClick={() => fetchLeaderboard()}
                className="text-xs text-amber-400 hover:underline font-bold"
              >
                🔄 Refresh
              </button>
            </div>

            {loadingLeaderboard ? (
              <div className="text-center py-12 text-slate-400 text-xs font-bold">
                Loading Leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No scores recorded yet. Be the first to complete a drill!
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-700 sticky top-0">
                      <tr>
                        <th className="p-3 text-center">Rank</th>
                        <th className="p-3">Aspirant</th>
                        <th className="p-3 text-center">Module</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 font-medium">
                      {leaderboard.map((entry, idx) => {
                        const isCurrentUser = currentUser?.id === entry.user_id;
                        let rankBadge = `#${idx + 1}`;
                        if (idx === 0) rankBadge = '🥇 1st';
                        if (idx === 1) rankBadge = '🥈 2nd';
                        if (idx === 2) rankBadge = '🥉 3rd';

                        return (
                          <tr
                            key={entry.id}
                            className={`hover:bg-slate-700/40 transition ${
                              isCurrentUser ? 'bg-amber-500/10 border-l-4 border-amber-400' : ''
                            }`}
                          >
                            <td className="p-3 text-center font-bold text-amber-400">{rankBadge}</td>
                            <td className="p-3 font-bold text-white flex items-center gap-2">
                              <span>{entry.student_name}</span>
                              {isCurrentUser && (
                                <span className="text-[9px] bg-amber-400/20 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded font-extrabold">
                                  YOU
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center text-slate-400 text-[10px] uppercase font-mono">
                              {entry.module_type}
                            </td>
                            <td className="p-3 text-center font-black text-emerald-400 text-sm">
                              {entry.score}
                            </td>
                            <td className="p-3 text-right font-bold text-blue-400">
                              {entry.accuracy}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* USER'S STANDING CARD AT THE BOTTOM IF LOWER THAN RANK 50 */}
                {currentUserRank && (
                  <div className="pt-3 border-t border-slate-700">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider text-center">
                      Your Standings
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-amber-500/10 border border-amber-400/40 text-amber-300 text-xs font-bold shadow-inner">
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-black shadow">
                          #{currentUserRank.rank}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white">{currentUserRank.student_name}</span>
                          <span className="text-[9px] bg-amber-400/20 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded font-extrabold">
                            YOU
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-[10px] uppercase text-slate-400 font-sans">{currentUserRank.module_type}</span>
                        <span className="text-emerald-400 font-black text-sm">{currentUserRank.score} pts</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}