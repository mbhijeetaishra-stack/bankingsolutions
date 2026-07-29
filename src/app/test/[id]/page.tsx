'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '../../../lib/supabase';

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  solution_text: string;
}

interface MockTestInfo {
  title: string;
  duration_minutes: number;
}

export default function DynamicTestPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const testId = resolvedParams.id;

  const [testInfo, setTestInfo] = useState<MockTestInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: number }>({});
  const [questionStates, setQuestionStates] = useState<{ [key: string]: string }>({});
  
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Analysis Screen State: 'summary' or 'solutions'
  const [analysisTab, setAnalysisTab] = useState<'summary' | 'solutions'>('summary');
  const [solutionFilter, setSolutionFilter] = useState<'ALL' | 'INCORRECT' | 'CORRECT' | 'UNATTEMPTED'>('ALL');
  const [solutionIndex, setSolutionIndex] = useState(0);

  useEffect(() => {
    fetchTestAndQuestions();
  }, [testId]);

  // Timer Loop with Auto-Submit
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

  async function fetchTestAndQuestions() {
    setLoading(true);

    const { data: mData } = await supabase
      .from('mock_tests')
      .select('title, duration_minutes')
      .eq('id', testId)
      .single();

    if (mData) {
      setTestInfo(mData);
      setTimeLeft(mData.duration_minutes * 60);
    }

    const { data: mapData } = await supabase
      .from('mock_test_questions')
      .select('question_id, questions(*)')
      .eq('mock_test_id', testId)
      .order('order_index', { ascending: true });

    if (mapData && mapData.length > 0) {
      const qList = mapData.map((item: any) => item.questions).filter(Boolean);
      setQuestions(qList);

      const initialStates: { [key: string]: string } = {};
      qList.forEach((q: Question, idx: number) => {
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
    setQuestionStates((prev) => ({ ...prev, [qId]: 'review' }));
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

  const handleSubmitTest = () => setIsSubmitted(true);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center font-sans text-slate-700">
        Loading test environment...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center font-sans p-6 text-center">
        <p className="text-lg font-semibold text-slate-700 mb-2">No questions linked to this test!</p>
        <a href="/tests" className="text-sm text-blue-600 underline">Back to Tests Catalog</a>
      </div>
    );
  }

  const results = calculateResults();

  // Filter questions for Solution View
  const filteredSolutionQuestions = questions.filter((q) => {
    const ans = userAnswers[q.id];
    if (solutionFilter === 'CORRECT') return ans === q.correct_option_index;
    if (solutionFilter === 'INCORRECT') return ans !== undefined && ans !== q.correct_option_index;
    if (solutionFilter === 'UNATTEMPTED') return ans === undefined;
    return true; // ALL
  });

  const solQ = filteredSolutionQuestions[solutionIndex] || filteredSolutionQuestions[0];

  return (
    <div className="flex flex-col h-screen font-sans bg-slate-100 select-none">
      {/* Header Banner */}
      <header className="bg-slate-800 text-white px-6 py-3 flex justify-between items-center shadow-md">
        <div>
          <h1 className="font-bold text-lg">{testInfo?.title || 'Banking Practice Test'}</h1>
          <p className="text-xs text-slate-300">
            {isSubmitted ? 'Detailed Performance & Solution Analysis' : 'Official Exam Simulation'}
          </p>
        </div>
        {!isSubmitted ? (
          <div className="bg-slate-700 px-4 py-2 rounded font-mono font-bold text-amber-400 border border-slate-600">
            Time Left: {formatTime(timeLeft)}
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
        /* ================= REAL TEST INTERFACE ================= */
        <div className="flex flex-1 overflow-hidden">
          {/* Question Area */}
          <main className="w-3/4 p-6 flex flex-col justify-between overflow-y-auto bg-white border-r">
            <div>
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <span className="font-semibold text-slate-700">Question No. {currentIndex + 1}</span>
                <span className="text-xs bg-slate-200 px-2 py-1 rounded text-slate-600 font-medium">
                  Marks: +1.00 | -0.25
                </span>
              </div>

              <p className="text-slate-800 font-medium text-base mb-6 leading-relaxed">
                {currentQ.question_text}
              </p>

              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  const isSelected = userAnswers[currentQ.id] === idx;
                  return (
                    <label
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`flex items-center p-3.5 rounded border cursor-pointer transition ${
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
                        className="mr-3 h-4 w-4 text-blue-600"
                      />
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="border-t pt-4 mt-6 flex justify-between items-center bg-white">
              <div className="space-x-2">
                <button
                  onClick={handleMarkForReview}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-sm font-semibold transition"
                >
                  Mark for Review & Next
                </button>
                <button
                  onClick={handleClearResponse}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded text-sm font-semibold transition"
                >
                  Clear Response
                </button>
              </div>

              <button
                onClick={handleSaveAndNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded text-sm font-semibold transition"
              >
                Save & Next
              </button>
            </div>
          </main>

          {/* Palette Sidebar */}
          <aside className="w-1/4 p-5 bg-slate-50 flex flex-col justify-between overflow-y-auto">
            <div>
              <h2 className="font-bold text-slate-700 mb-4 border-b pb-2 text-sm uppercase">Question Palette</h2>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const state = questionStates[q.id] || 'not_visited';
                  let btnColor = 'bg-slate-200 text-slate-700 hover:bg-slate-300';
                  if (state === 'answered') btnColor = 'bg-emerald-500 text-white';
                  if (state === 'not_answered') btnColor = 'bg-rose-500 text-white';
                  if (state === 'review') btnColor = 'bg-purple-600 text-white';

                  const isCurrent = idx === currentIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-9 w-9 font-bold text-xs rounded transition flex items-center justify-center ${btnColor} ${
                        isCurrent ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-6 border-t mt-6">
              <button
                onClick={handleSubmitTest}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded transition shadow"
              >
                Submit Test
              </button>
            </div>
          </aside>
        </div>
      ) : (
        /* ================= POST-TEST ANALYSIS MODE ================= */
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">

            {/* TAB 1: PERFORMANCE SUMMARY */}
            {analysisTab === 'summary' && (
              <div className="space-y-6">
                {/* Score Header Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                      Test Result Overview
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-800 mt-2">{testInfo?.title}</h2>
                    <p className="text-xs text-slate-500 mt-1">Submitted cleanly | Evaluated against standard IBPS marking scheme</p>
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

                {/* Performance Metrics Grid */}
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

                {/* Primary Action Buttons */}
                <div className="flex justify-center space-x-4 pt-4">
                  <button
                    onClick={() => {
                      setAnalysisTab('solutions');
                      setSolutionFilter('ALL');
                      setSolutionIndex(0);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg transition shadow"
                  >
                    📖 View Step-by-Step Solutions
                  </button>
                  <a
                    href="/tests"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-lg transition"
                  >
                    Back to Practice Catalog
                  </a>
                </div>
              </div>
            )}

            {/* TAB 2: DETAILED QUESTION-BY-QUESTION SOLUTIONS */}
            {analysisTab === 'solutions' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Solution Question Viewer (3 Columns) */}
                <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                  {solQ ? (
                    <div>
                      {/* Solution Question Header */}
                      <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <span className="font-bold text-slate-700 text-sm">
                          Question {questions.findIndex((q) => q.id === solQ.id) + 1} of {questions.length}
                        </span>

                        {/* Status Tag */}
                        {userAnswers[solQ.id] === undefined ? (
                          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-0.5 rounded">
                            Unattempted
                          </span>
                        ) : userAnswers[solQ.id] === solQ.correct_option_index ? (
                          <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                            Correct (+1.00)
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-0.5 rounded">
                            Incorrect (-0.25)
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className="text-slate-800 font-medium text-base mb-6 leading-relaxed">
                        {solQ.question_text}
                      </p>

                      {/* Options Review with Visual Indicators */}
                      <div className="space-y-3 mb-6">
                        {solQ.options.map((option, idx) => {
                          const userSelected = userAnswers[solQ.id] === idx;
                          const isCorrect = solQ.correct_option_index === idx;

                          let optionStyle = 'border-slate-200 text-slate-700 bg-white';
                          if (isCorrect) {
                            optionStyle = 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900';
                          } else if (userSelected && !isCorrect) {
                            optionStyle = 'border-rose-500 bg-rose-50 font-semibold text-rose-900';
                          }

                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between p-3.5 rounded-lg border ${optionStyle}`}
                            >
                              <div className="flex items-center">
                                <span className="font-bold mr-3">{String.fromCharCode(65 + idx)}.</span>
                                <span>{option}</span>
                              </div>

                              <div>
                                {isCorrect && (
                                  <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded font-bold">
                                    Correct Answer
                                  </span>
                                )}
                                {userSelected && !isCorrect && (
                                  <span className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded font-bold">
                                    Your Answer
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation Box */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-slate-600 uppercase mb-1">
                          💡 Step-by-Step Solution / Explanation:
                        </h4>
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                          {solQ.solution_text || 'No detailed solution provided for this question.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-sm p-6 text-center">No questions found for this solution filter.</p>
                  )}

                  {/* Solution Navigation Controls */}
                  <div className="flex justify-between items-center border-t pt-4 mt-6">
                    <button
                      disabled={solutionIndex === 0}
                      onClick={() => setSolutionIndex((prev) => Math.max(0, prev - 1))}
                      className={`px-4 py-2 text-xs font-semibold rounded border transition ${
                        solutionIndex === 0
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      ← Previous Question
                    </button>

                    <button
                      disabled={solutionIndex >= filteredSolutionQuestions.length - 1}
                      onClick={() => setSolutionIndex((prev) => Math.min(filteredSolutionQuestions.length - 1, prev + 1))}
                      className={`px-4 py-2 text-xs font-semibold rounded transition ${
                        solutionIndex >= filteredSolutionQuestions.length - 1
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      Next Question →
                    </button>
                  </div>
                </div>

                {/* Solution Filters & Palette (1 Column) */}
                <div className="space-y-4">
                  {/* Filter Selector */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Filter Solutions</label>
                    <div className="space-y-1 text-xs font-medium">
                      <button
                        onClick={() => { setSolutionFilter('ALL'); setSolutionIndex(0); }}
                        className={`w-full text-left px-3 py-2 rounded transition ${
                          solutionFilter === 'ALL' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        All Questions ({questions.length})
                      </button>
                      <button
                        onClick={() => { setSolutionFilter('INCORRECT'); setSolutionIndex(0); }}
                        className={`w-full text-left px-3 py-2 rounded transition ${
                          solutionFilter === 'INCORRECT' ? 'bg-rose-50 text-rose-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Incorrect Only ({results.wrongCount})
                      </button>
                      <button
                        onClick={() => { setSolutionFilter('CORRECT'); setSolutionIndex(0); }}
                        className={`w-full text-left px-3 py-2 rounded transition ${
                          solutionFilter === 'CORRECT' ? 'bg-emerald-50 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Correct Only ({results.correctCount})
                      </button>
                      <button
                        onClick={() => { setSolutionFilter('UNATTEMPTED'); setSolutionIndex(0); }}
                        className={`w-full text-left px-3 py-2 rounded transition ${
                          solutionFilter === 'UNATTEMPTED' ? 'bg-slate-100 text-slate-800 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Unattempted ({results.unattempted})
                      </button>
                    </div>
                  </div>

                  {/* Solution Palette Buttons */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Jump to Question</label>
                    <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1">
                      {filteredSolutionQuestions.map((q, idx) => {
                        const userAns = userAnswers[q.id];
                        let btnColor = 'bg-slate-200 text-slate-700'; // Unattempted
                        if (userAns !== undefined) {
                          btnColor = userAns === q.correct_option_index ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white';
                        }

                        const isCurrentSol = solQ && solQ.id === q.id;

                        return (
                          <button
                            key={q.id}
                            onClick={() => setSolutionIndex(idx)}
                            className={`h-8 w-8 text-xs font-bold rounded transition flex items-center justify-center ${btnColor} ${
                              isCurrentSol ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                            }`}
                          >
                            {questions.findIndex((origQ) => origQ.id === q.id) + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}