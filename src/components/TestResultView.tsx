'use client';

import React, { useState } from 'react';
import { SectionConfig, Question, UserAnswer } from '@/types/mock';
import Link from 'next/link';

interface TestResultViewProps {
  sections: SectionConfig[];
  userAnswers: Record<string, UserAnswer>;
  onRetake?: () => void;
}

export const TestResultView: React.FC<TestResultViewProps> = ({ sections, userAnswers }) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'solutions'>('summary');
  const [selectedSecIdx, setSelectedSecIdx] = useState(0);
  const [selectedQIdx, setSelectedQIdx] = useState(0);

  // Stats calculation
  let totalQuestions = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  let totalScore = 0;
  let totalMaxMarks = 0;

  const sectionSummaries = sections.map((sec) => {
    let secCorrect = 0;
    let secIncorrect = 0;
    let secUnattempted = 0;
    let secScore = 0;
    let secMaxMarks = 0;

    sec.questions.forEach((q) => {
      totalQuestions++;
      secMaxMarks += q.marks || 1.0;
      totalMaxMarks += q.marks || 1.0;

      const userAns = userAnswers[q.id];
      if (userAns?.selectedOption !== null && userAns?.selectedOption !== undefined) {
        if (userAns.selectedOption === q.correctOptionIndex) {
          secCorrect++;
          correctCount++;
          secScore += q.marks || 1.0;
          totalScore += q.marks || 1.0;
        } else {
          secIncorrect++;
          incorrectCount++;
          secScore -= q.negativeMarks || 0.25;
          totalScore -= q.negativeMarks || 0.25;
        }
      } else {
        secUnattempted++;
        unattemptedCount++;
      }
    });

    return {
      title: sec.title,
      total: sec.questions.length,
      correct: secCorrect,
      incorrect: secIncorrect,
      unattempted: secUnattempted,
      score: Math.max(0, secScore),
      maxMarks: secMaxMarks,
    };
  });

  const attemptedCount = correctCount + incorrectCount;
  const accuracy = attemptedCount > 0 ? ((correctCount / attemptedCount) * 100).toFixed(1) : '0.0';

  const currentSection = sections[selectedSecIdx];
  const currentQuestion: Question | undefined = currentSection?.questions[selectedQIdx];
  const currentUserAns = currentQuestion ? userAnswers[currentQuestion.id] : undefined;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-[#1D63B8]">Exam Performance & Analysis</h1>
          <p className="text-xs text-slate-400">Detailed Scorecard & Solutions Dashboard</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'summary' ? 'bg-[#1D63B8] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            📊 Score Analysis
          </button>
          <button
            onClick={() => setActiveTab('solutions')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'solutions' ? 'bg-[#1D63B8] text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            💡 View Solutions
          </button>
          <Link
            href="/tests"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg transition"
          >
            Exit to Mocks
          </Link>
        </div>
      </header>

      {/* SCORE SUMMARY TAB */}
      {activeTab === 'summary' ? (
        <div className="max-w-5xl mx-auto p-6 space-y-6 w-full flex-1">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs uppercase font-bold text-slate-400 block">Total Score</span>
              <span className="text-3xl font-black text-emerald-400">{totalScore.toFixed(2)}</span>
              <span className="text-[11px] text-slate-500 block">/ {totalMaxMarks} Marks</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs uppercase font-bold text-slate-400 block">Accuracy</span>
              <span className="text-3xl font-black text-blue-400">{accuracy}%</span>
              <span className="text-[11px] text-slate-500 block">Precision Rate</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs uppercase font-bold text-slate-400 block">Correct Answers</span>
              <span className="text-3xl font-black text-emerald-400">{correctCount}</span>
              <span className="text-[11px] text-slate-500 block">Questions</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl text-center space-y-1">
              <span className="text-xs uppercase font-bold text-slate-400 block">Incorrect Answers</span>
              <span className="text-3xl font-black text-rose-400">{incorrectCount}</span>
              <span className="text-[11px] text-slate-500 block">Questions</span>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-200">Sectional Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/60 uppercase text-[11px] text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4">Total Qs</th>
                    <th className="py-3 px-4">Correct</th>
                    <th className="py-3 px-4">Incorrect</th>
                    <th className="py-3 px-4">Unattempted</th>
                    <th className="py-3 px-4">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60">
                  {sectionSummaries.map((sec, i) => (
                    <tr key={i} className="hover:bg-slate-700/30 transition">
                      <td className="py-3.5 px-4 font-bold text-white">{sec.title}</td>
                      <td className="py-3.5 px-4">{sec.total}</td>
                      <td className="py-3.5 px-4 text-emerald-400 font-bold">{sec.correct}</td>
                      <td className="py-3.5 px-4 text-rose-400 font-bold">{sec.incorrect}</td>
                      <td className="py-3.5 px-4 text-slate-400">{sec.unattempted}</td>
                      <td className="py-3.5 px-4 font-bold text-blue-400">{sec.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={() => setActiveTab('solutions')}
              className="px-8 py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg transition"
            >
              Check Questions & Detailed Solutions →
            </button>
          </div>
        </div>
      ) : (
        /* SOLUTIONS TAB */
        <div className="flex flex-1 overflow-hidden bg-slate-900 text-slate-900">
          <div className="flex flex-1 overflow-hidden">
            {currentQuestion?.passageText && (
              <div className="w-1/2 border-r border-slate-800 bg-slate-950 p-6 overflow-y-auto">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                  Reference Context
                </span>
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 text-sm leading-relaxed whitespace-pre-line text-slate-200">
                  {currentQuestion.passageText}
                </div>
              </div>
            )}

            <div className={`flex-1 p-6 overflow-y-auto bg-slate-900 text-slate-100 flex flex-col justify-between ${!currentQuestion?.passageText ? 'max-w-3xl border-r border-slate-800' : ''}`}>
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                  <span className="font-bold text-white text-base">Question {selectedQIdx + 1} Solution</span>
                  <div className="flex gap-2 text-xs">
                    {currentUserAns?.selectedOption === currentQuestion?.correctOptionIndex ? (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
                        Correct (+{currentQuestion?.marks})
                      </span>
                    ) : currentUserAns?.selectedOption !== null && currentUserAns?.selectedOption !== undefined ? (
                      <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full font-bold">
                        Incorrect (-{currentQuestion?.negativeMarks})
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1 rounded-full font-bold">
                        Unattempted (0)
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-white text-base font-semibold leading-relaxed mb-6">
                  {currentQuestion?.questionText}
                </p>

                <div className="space-y-3">
                  {currentQuestion?.options.map((opt, i) => {
                    const isCorrect = i === currentQuestion.correctOptionIndex;
                    const isUserChoice = currentUserAns?.selectedOption === i;

                    let borderStyle = 'border-slate-800 bg-slate-800/40 text-slate-300';
                    if (isCorrect) {
                      borderStyle = 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold';
                    } else if (isUserChoice && !isCorrect) {
                      borderStyle = 'border-rose-500 bg-rose-500/10 text-rose-300 font-bold';
                    }

                    return (
                      <div key={i} className={`p-3.5 rounded-xl text-sm border flex items-center justify-between ${borderStyle}`}>
                        <div className="flex items-center">
                          <span className={`w-7 h-7 rounded-full border flex items-center justify-center mr-3 text-xs font-bold ${
                            isCorrect ? 'bg-emerald-500 text-white' : isUserChoice ? 'bg-rose-500 text-white' : 'border-slate-700 text-slate-400'
                          }`}>
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span>{opt}</span>
                        </div>
                        {isCorrect && <span className="text-xs font-bold text-emerald-400">✓ Correct Answer</span>}
                        {isUserChoice && !isCorrect && <span className="text-xs font-bold text-rose-400">✗ Your Choice</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-6">
                <button
                  disabled={selectedQIdx === 0}
                  onClick={() => setSelectedQIdx((p) => p - 1)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 transition"
                >
                  Previous
                </button>
                <button
                  disabled={selectedQIdx === (currentSection?.questions.length || 1) - 1}
                  onClick={() => setSelectedQIdx((p) => p + 1)}
                  className="px-5 py-2 bg-[#1D63B8] hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow"
                >
                  Next Question
                </button>
              </div>
            </div>
          </div>

          <div className="w-72 bg-slate-950 border-l border-slate-800 p-4 flex flex-col justify-between overflow-y-auto text-slate-100">
            <div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase text-slate-400 block mb-1">Select Section</label>
                <select
                  value={selectedSecIdx}
                  onChange={(e) => {
                    setSelectedSecIdx(Number(e.target.value));
                    setSelectedQIdx(0);
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-white focus:ring-2 focus:ring-blue-500"
                >
                  {sections.map((sec, idx) => (
                    <option key={sec.id} value={idx}>
                      {sec.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-5 gap-2 max-h-[calc(100vh-220px)] overflow-y-auto p-1">
                {currentSection?.questions.map((q, idx) => {
                  const ans = userAnswers[q.id];
                  const isCorrect = ans?.selectedOption === q.correctOptionIndex;
                  const isAttempted = ans?.selectedOption !== null && ans?.selectedOption !== undefined;

                  let btnBg = 'bg-slate-800 text-slate-400 border-slate-700';
                  if (isAttempted) {
                    btnBg = isCorrect ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500';
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQIdx(idx)}
                      className={`h-9 w-9 rounded-lg border text-xs font-bold flex items-center justify-center transition ${btnBg} ${
                        idx === selectedQIdx ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-950' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};