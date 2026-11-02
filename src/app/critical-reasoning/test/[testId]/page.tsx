'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Question {
  id: string;
  question_text?: string;
  question?: string;
  option_a?: string;
  opt_a?: string;
  option_b?: string;
  opt_b?: string;
  option_c?: string;
  opt_c?: string;
  option_d?: string;
  opt_d?: string;
  correct_option: string | number; // Can be 0-3, 'A'-'D', or full text
  explanation?: string;
}

export default function CriticalReasoningTestRunner() {
  const params = useParams();
  const router = useRouter();
  const testId = params.testId as string;

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [testData, setTestData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: string }>({});
  const [questionStatus, setQuestionStatus] = useState<{ [key: number]: string }>({});
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savingStatus, setSavingStatus] = useState('');

  useEffect(() => {
    verifyAccessAndFetchTest();
  }, [testId]);

  // Timer interval
  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  async function verifyAccessAndFetchTest() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      router.push('/login');
      return;
    }
    setUserId(session.user.id);

    // 1. Verify Purchase
    const { data: purchaseData } = await supabase
      .from('student_course_purchases')
      .select('*')
      .eq('user_id', session.user.id)
      .ilike('course_name', '%Critical Reasoning%')
      .single();

    if (purchaseData && new Date(purchaseData.expires_at) > new Date()) {
      setHasPurchased(true);
    }

    // 2. Fetch Test Info
    const { data: testInfo } = await supabase.from('admin_tests').select('*').eq('id', testId).single();
    if (testInfo) {
      setTestData(testInfo);
      setTimeLeft(testInfo.duration_minutes * 60);
    }

    // 3. Fetch Questions
    const { data: qData } = await supabase.from('admin_test_questions').select('*').eq('test_id', testId);
    if (qData) {
      setQuestions(qData);
    }

    // 4. Fetch Previous Saved Attempt
    const { data: attemptData } = await supabase
      .from('student_test_attempts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('test_id', testId)
      .single();

    if (attemptData) {
      if (attemptData.is_submitted) {
        setIsSubmitted(true);
      } else {
        setSelectedAnswers(attemptData.selected_answers || {});
        setQuestionStatus(attemptData.question_status || { 0: 'not_answered' });
        if (attemptData.time_left_seconds) setTimeLeft(attemptData.time_left_seconds);
      }
    } else if (qData && qData.length > 0) {
      setQuestionStatus({ 0: 'not_answered' });
    }

    setLoading(false);
  }

  // Safe Helper to get question text
  const getQuestionText = (q: Question) => {
    return q.question_text || q.question || '';
  };

  // Safe Helper to get option text (supports option_a, opt_a, etc.)
  const getOptionText = (q: Question, optKey: string) => {
    const lower = optKey.toLowerCase();
    return q[`option_${lower}` as keyof Question] || q[`opt_${lower}` as keyof Question] || '';
  };

  // Helper to determine if an option is correct (supports 0-3, 'A'-'D', or text)
  const isOptionCorrect = (q: Question, optKey: string) => {
    const rawCorrect = String(q.correct_option ?? '').trim();
    const upperCorrect = rawCorrect.toUpperCase();
    
    // Map optKey ('A', 'B', 'C', 'D') to index (0, 1, 2, 3)
    const keyMap: { [key: string]: number } = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const optIndex = keyMap[optKey];
    const numericCorrect = Number(rawCorrect);

    // 1. Check if stored as numeric index (0, 1, 2, 3)
    if (!isNaN(numericCorrect) && rawCorrect !== '') {
      return numericCorrect === optIndex;
    }

    // 2. Check if stored as 'A', 'B', 'C', 'D'
    if (['A', 'B', 'C', 'D'].includes(upperCorrect)) {
      return upperCorrect === optKey;
    }

    // 3. Fallback to exact option text matching
    const optText = getOptionText(q, optKey);
    return rawCorrect.toLowerCase() === String(optText).trim().toLowerCase();
  };

  async function autoSaveProgress(updatedAnswers: any, updatedStatus: any, currentTimer: number, submitted = false, finalScore = 0) {
    if (!userId) return;
    setSavingStatus('Saving...');

    await supabase.from('student_test_attempts').upsert([
      {
        user_id: userId,
        test_id: testId,
        selected_answers: updatedAnswers,
        question_status: updatedStatus,
        time_left_seconds: currentTimer,
        is_submitted: submitted,
        score: finalScore,
        updated_at: new Date().toISOString(),
      }
    ], { onConflict: 'user_id,test_id' });

    setSavingStatus('✅ Saved');
    setTimeout(() => setSavingStatus(''), 1500);
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleOptionSelect = (optionKey: string) => {
    if (isSubmitted) return;
    const newAnswers = { ...selectedAnswers, [currentIndex]: optionKey };
    setSelectedAnswers(newAnswers);
    autoSaveProgress(newAnswers, questionStatus, timeLeft);
  };

  const handleSaveAndNext = () => {
    const isAnswered = selectedAnswers[currentIndex] !== undefined;
    const newStatus = {
      ...questionStatus,
      [currentIndex]: isAnswered ? 'answered' : 'not_answered'
    };
    setQuestionStatus(newStatus);

    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (!newStatus[nextIdx] || newStatus[nextIdx] === 'not_visited') {
        newStatus[nextIdx] = 'not_answered';
      }
    }
    autoSaveProgress(selectedAnswers, newStatus, timeLeft);
  };

  const handleMarkForReview = () => {
    const newStatus = { ...questionStatus, [currentIndex]: 'marked' };
    setQuestionStatus(newStatus);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    autoSaveProgress(selectedAnswers, newStatus, timeLeft);
  };

  const handleClearResponse = () => {
    const updatedAnswers = { ...selectedAnswers };
    delete updatedAnswers[currentIndex];
    setSelectedAnswers(updatedAnswers);
    
    const newStatus = { ...questionStatus, [currentIndex]: 'not_answered' };
    setQuestionStatus(newStatus);
    autoSaveProgress(updatedAnswers, newStatus, timeLeft);
  };

  const handleSubmitTest = async () => {
    if (!confirm('Are you sure you want to submit the test?')) return;

    let correctCount = 0;
    questions.forEach((q, idx) => {
      const userAns = selectedAnswers[idx];
      if (userAns && isOptionCorrect(q, userAns.trim().toUpperCase())) {
        correctCount++;
      }
    });

    setIsSubmitted(true);
    await autoSaveProgress(selectedAnswers, questionStatus, timeLeft, true, correctCount);
  };

  const handlePauseAndExit = async () => {
    await autoSaveProgress(selectedAnswers, questionStatus, timeLeft, false, 0);
    alert('Test progress saved successfully! You can resume anytime from the test hub.');
    router.push('/critical-reasoning/tests');
  };

  const handleReattempt = async () => {
    if (!confirm('Are you sure you want to reattempt? Your previous score will be reset.')) return;

    await supabase
      .from('student_test_attempts')
      .delete()
      .eq('user_id', userId)
      .eq('test_id', testId);

    setSelectedAnswers({});
    setQuestionStatus({ 0: 'not_answered' });
    setCurrentIndex(0);
    setTimeLeft(testData.duration_minutes * 60);
    setIsSubmitted(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold text-sm">Loading Test Environment...</div>;
  }

  if (!hasPurchased) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-black">🔒 Locked Assessment</h2>
        <Link href="/critical-reasoning" className="px-6 py-3 bg-amber-500 text-slate-950 font-black text-xs rounded-xl">Unlock Course 🚀</Link>
      </div>
    );
  }

  // ==========================================
  // POST-TEST ANALYSIS & SOLUTIONS SCREEN
  // ==========================================
  if (isSubmitted) {
    let correctCount = 0;
    let incorrectCount = 0;
    let unattemptedCount = 0;

    questions.forEach((q, idx) => {
      const userAns = selectedAnswers[idx];
      if (!userAns) {
        unattemptedCount++;
      } else if (isOptionCorrect(q, userAns.trim().toUpperCase())) {
        correctCount++;
      } else {
        incorrectCount++;
      }
    });

    const activeAnalysisQ = questions[currentIndex] || questions[0];
    const userSelectedOpt = selectedAnswers[currentIndex]?.trim().toUpperCase();
    const isCorrectAns = userSelectedOpt ? isOptionCorrect(activeAnalysisQ, userSelectedOpt) : false;

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-sm font-black text-white">📊 Test Analysis: {testData?.title}</h1>
            <p className="text-[10px] text-slate-400">Review correct answers & expert solutions</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReattempt} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition shadow">
              🔄 Reattempt Test
            </button>
            <Link href="/critical-reasoning/tests" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow">
              Test Hub 🏠
            </Link>
          </div>
        </header>

        <div className="max-w-6xl mx-auto w-full p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold">Total Score</p>
            <p className="text-2xl font-black text-amber-400 font-mono">{correctCount} / {questions.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold">Correct</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">{correctCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold">Incorrect</p>
            <p className="text-2xl font-black text-rose-400 font-mono">{incorrectCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center space-y-1">
            <p className="text-xs text-slate-400 uppercase font-bold">Unattempted</p>
            <p className="text-2xl font-black text-slate-400 font-mono">{unattemptedCount}</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto w-full px-6 pb-12 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-xs font-black uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
                  Question {currentIndex + 1} of {questions.length}
                </span>
                <div>
                  {!userSelectedOpt ? <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg font-bold">Not Attempted</span> : isCorrectAns ? <span className="text-xs bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg font-bold">✓ Correct</span> : <span className="text-xs bg-rose-500/20 text-rose-400 px-3 py-1 rounded-lg font-bold">✕ Incorrect</span>}
                </div>
              </div>

              <div className="text-sm md:text-base text-slate-200 leading-relaxed font-medium whitespace-pre-line">
                {getQuestionText(activeAnalysisQ)}
              </div>

              {/* Options mapping with robust correct answer highlighting */}
              <div className="space-y-3 pt-2">
                {['A', 'B', 'C', 'D'].map((optKey) => {
                  const optText = getOptionText(activeAnalysisQ, optKey);
                  if (!optText) return null;

                  const isUserChoice = userSelectedOpt === optKey;
                  const isRightAnswer = isOptionCorrect(activeAnalysisQ, optKey);

                  let optStyle = 'bg-slate-950/60 border-slate-800 text-slate-300';
                  if (isRightAnswer) {
                    optStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold';
                  } else if (isUserChoice && !isRightAnswer) {
                    optStyle = 'bg-rose-500/20 border-rose-500 text-rose-200';
                  }

                  return (
                    <div key={optKey} className={`w-full text-left p-4 rounded-xl text-xs md:text-sm font-medium flex items-center justify-between border ${optStyle}`}>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">{optKey}</span>
                        <span>{optText}</span>
                      </div>
                      <div className="text-xs font-bold">
                        {isRightAnswer && <span className="text-emerald-400 bg-emerald-500/25 px-2.5 py-1 rounded">✓ Correct Answer</span>}
                        {isUserChoice && !isRightAnswer && <span className="text-rose-400 bg-rose-500/25 px-2.5 py-1 rounded">Your Choice</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-950 border border-blue-500/30 p-5 rounded-2xl space-y-2 mt-6">
                <h4 className="text-xs font-black uppercase text-blue-400 tracking-wider">💡 Expert Explanation</h4>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed whitespace-pre-line">{activeAnalysisQ.explanation || 'No explanation provided.'}</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 mt-6 flex justify-between items-center">
              <button disabled={currentIndex <= 0} onClick={() => setCurrentIndex(currentIndex - 1)} className="px-4 py-2 bg-slate-800 disabled:opacity-30 text-white font-bold text-xs rounded-xl">← Previous</button>
              <button disabled={currentIndex >= questions.length - 1} onClick={() => setCurrentIndex(currentIndex + 1)} className="px-4 py-2 bg-blue-600 disabled:opacity-30 text-white font-bold text-xs rounded-xl">Next →</button>
            </div>
          </div>

          <aside className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800 pb-2">Solutions Palette</h3>
              <div className="grid grid-cols-5 gap-2 pt-2 max-h-[350px] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const userAns = selectedAnswers[idx];
                  const isRight = userAns ? isOptionCorrect(q, userAns.trim().toUpperCase()) : false;
                  let bgCol = 'bg-slate-800 text-slate-400';
                  if (userAns) bgCol = isRight ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white';

                  return (
                    <button key={idx} onClick={() => setCurrentIndex(idx)} className={`h-10 rounded-xl font-mono font-bold text-xs border transition flex items-center justify-center ${bgCol} ${currentIndex === idx ? 'ring-2 ring-white scale-105' : ''}`}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-4 space-y-2">
              <button onClick={handleReattempt} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-lg transition">
                🔄 Reattempt Test
              </button>
              <Link href="/critical-reasoning/tests" className="block text-center w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl">
                Return to Test Hub 🏠
              </Link>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  if (!currentQ) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">No questions available in this test.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-sm font-black text-white">{testData?.title}</h1>
          <p className="text-[10px] text-slate-400">Exact Examination Environment</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePauseAndExit}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
          >
            <span>⏸️ Pause & Exit</span>
          </button>
          {savingStatus && <span className="text-[10px] font-bold text-emerald-400">{savingStatus}</span>}
          <div className="bg-slate-950 border border-slate-700 px-4 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">Time Left:</span>
            <span className="text-sm font-mono font-black text-amber-400">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 bg-slate-900 border-r border-slate-800 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <span className="text-xs font-black uppercase text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
              Question {currentIndex + 1} of {questions.length}
            </span>

            <div className="text-sm md:text-base text-slate-200 leading-relaxed font-medium whitespace-pre-line">
              {getQuestionText(currentQ)}
            </div>

            <div className="space-y-3 pt-2">
              {['A', 'B', 'C', 'D'].map((optKey) => {
                const optText = getOptionText(currentQ, optKey);
                if (!optText) return null;
                const isSelected = selectedAnswers[currentIndex] === optKey;

                return (
                  <button
                    key={optKey}
                    onClick={() => handleOptionSelect(optKey)}
                    className={`w-full text-left p-4 rounded-xl transition text-xs md:text-sm font-medium flex items-center gap-3 border ${
                      isSelected ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg' : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs border ${
                      isSelected ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}>
                      {optKey}
                    </span>
                    <span>{optText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 mt-8 flex flex-wrap justify-between items-center gap-3">
            <div className="flex gap-2">
              <button onClick={handleMarkForReview} className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl">Mark for Review</button>
              <button onClick={handleClearResponse} className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-700">Clear</button>
            </div>
            <button onClick={handleSaveAndNext} className="px-6 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg">Save & Next →</button>
          </div>
        </div>

        <aside className="w-full lg:w-80 bg-slate-950 p-4 md:p-6 flex flex-col justify-between shrink-0 border-t lg:border-t-0 border-slate-800">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800 pb-2">Question Palette</h3>
            <div className="grid grid-cols-5 gap-2 pt-2">
              {questions.map((_, idx) => {
                const status = questionStatus[idx] || 'not_visited';
                let bgClass = 'bg-slate-800 text-slate-400';
                if (status === 'answered') bgClass = 'bg-emerald-600 text-white';
                else if (status === 'not_answered') bgClass = 'bg-rose-600 text-white';
                else if (status === 'marked') bgClass = 'bg-amber-600 text-white';

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl font-mono font-bold text-xs border transition flex items-center justify-center ${bgClass} ${currentIndex === idx ? 'ring-2 ring-white scale-105' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={handleSubmitTest} className="w-full py-3 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-lg mt-4">
            Submit Test 🚀
          </button>
        </aside>
      </div>
    </div>
  );
}