'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

type ModuleType = 'tables' | 'squares' | 'cubes' | 'percentages';

interface QuestionProblem {
  prompt: string;
  answer: number;
  explanation: string;
}

export default function CalcLabPage() {
  const [selectedModule, setSelectedModule] = useState<ModuleType>('tables');
  const [mode, setMode] = useState<'timer' | 'target20'>('timer');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);

  // Game Metrics
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [totalAttempted, setTotalAttempted] = useState(0);
  
  // Current Question
  const [currentProblem, setCurrentProblem] = useState<QuestionProblem | null>(null);
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input field automatically when active
  useEffect(() => {
    if (isGameActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isGameActive, currentProblem]);

  // Timer loop for 60-Second Blitz Mode
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

  // Question Generator Logic
  const generateProblem = (moduleType: ModuleType): QuestionProblem => {
    if (moduleType === 'tables') {
      const num1 = Math.floor(Math.random() * 19) + 12; // 12 to 30
      const num2 = Math.floor(Math.random() * 9) + 2;   // 2 to 10
      return {
        prompt: `${num1} × ${num2}`,
        answer: num1 * num2,
        explanation: `${num1} × ${num2} = ${num1 * num2}`,
      };
    }

    if (moduleType === 'squares') {
      const num = Math.floor(Math.random() * 41) + 10; // 10 to 50
      return {
        prompt: `${num}²`,
        answer: num * num,
        explanation: `${num} × ${num} = ${num * num}`,
      };
    }

    if (moduleType === 'cubes') {
      const num = Math.floor(Math.random() * 21) + 5; // 5 to 25
      return {
        prompt: `${num}³`,
        answer: num * num * num,
        explanation: `${num} × ${num} × ${num} = ${num * num * num}`,
      };
    }

    // Module: Percentages & Fractions
    const commonFractions = [
      { prompt: '16.66% of 60', answer: 10, exp: '16.66% = 1/6th' },
      { prompt: '14.28% of 70', answer: 10, exp: '14.28% = 1/7th' },
      { prompt: '12.5% of 80', answer: 10, exp: '12.5% = 1/8th' },
      { prompt: '37.5% of 80', answer: 30, exp: '37.5% = 3/8th' },
      { prompt: '62.5% of 80', answer: 50, exp: '62.5% = 5/8th' },
      { prompt: '83.33% of 60', answer: 50, exp: '83.33% = 5/6th' },
      { prompt: '11.11% of 90', answer: 10, exp: '11.11% = 1/9th' },
      { prompt: '9.09% of 110', answer: 10, exp: '9.09% = 1/11th' },
      { prompt: '27.27% of 110', answer: 30, exp: '27.27% = 3/11th' },
    ];
    const picked = commonFractions[Math.floor(Math.random() * commonFractions.length)];
    return {
      prompt: picked.prompt,
      answer: picked.answer,
      explanation: picked.exp,
    };
  };

  const startGame = () => {
    setScore(0);
    setWrongCount(0);
    setTotalAttempted(0);
    setTimeLeft(60);
    setUserInput('');
    setIsGameFinished(false);
    setIsGameActive(true);
    setCurrentProblem(generateProblem(selectedModule));
  };

  const endGame = () => {
    setIsGameActive(false);
    setIsGameFinished(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserInput(val);

    if (!currentProblem) return;

    // Check Answer automatically
    if (parseInt(val, 10) === currentProblem.answer) {
      setFeedback('correct');
      setScore((prev) => prev + 1);
      const nextTotal = totalAttempted + 1;
      setTotalAttempted(nextTotal);

      // Check Target 20 mode completion
      if (mode === 'target20' && score + 1 >= 20) {
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
      setScore((prev) => prev + 1);
      setTotalAttempted((prev) => prev + 1);

      if (mode === 'target20' && score + 1 >= 20) {
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
      <div className="max-w-xl mx-auto w-full">
        {/* Header */}
        <header className="flex justify-between items-center border-b border-slate-800 pb-4 mb-6">
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
            {/* Live Metrics Bar */}
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

            {/* Question Box */}
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

              {/* Input Form */}
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

            {/* Mobile / Touch Numpad */}
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
              <p className="text-xs text-slate-400 mt-1">Great job pushing your mental math speed.</p>
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
                onClick={() => setIsGameFinished(false)}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-3 px-5 rounded-xl transition text-sm"
              >
                Change Module
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}