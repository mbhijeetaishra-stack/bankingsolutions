'use client';

import React, { useState, useEffect } from 'react';
import { SectionConfig, Question, UserAnswer } from '@/types/mock';

interface EngineProps {
  testTitle?: string;
  sections: SectionConfig[];
  onCompleteTest: (answers: Record<string, UserAnswer>) => void;
}

export const TwoPaneMockEngine: React.FC<EngineProps> = ({ testTitle, sections, onCompleteTest }) => {
  const [activeSecIdx, setActiveSecIdx] = useState(0);
  const [activeQIdx, setActiveQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>({});
  
  const [lockedSections, setLockedSections] = useState<Record<number, boolean>>({});
  const [showSectionSubmitModal, setShowSectionSubmitModal] = useState(false);
  const [showFinalSubmitModal, setShowFinalSubmitModal] = useState(false);

  const activeSection = sections[activeSecIdx];
  const activeQuestion: Question | undefined = activeSection?.questions[activeQIdx];

  // Global question numbering calculation across all sections
  let overallQuestionOffset = 0;
  for (let i = 0; i < activeSecIdx; i++) {
    overallQuestionOffset += sections[i]?.questions.length || 0;
  }
  const currentOverallQNum = overallQuestionOffset + activeQIdx + 1;

  let totalExamQuestions = 0;
  sections.forEach((s) => (totalExamQuestions += s.questions.length));

  // Section Timer
  const [timeLeft, setTimeLeft] = useState<number>(activeSection?.durationInSeconds || 1200);

  useEffect(() => {
    setTimeLeft(sections[activeSecIdx]?.durationInSeconds || 1200);
    setActiveQIdx(0);
  }, [activeSecIdx, sections]);

  const handleLockAndNextSection = () => {
    setShowSectionSubmitModal(false);
    setLockedSections((prev) => ({ ...prev, [activeSecIdx]: true }));

    if (activeSecIdx < sections.length - 1) {
      setActiveSecIdx((prev) => prev + 1);
    } else {
      onCompleteTest(answers);
    }
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      alert(`Time is up for ${activeSection?.title}! Locking section.`);
      handleLockAndNextSection();
      return;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, activeSecIdx]);

  useEffect(() => {
    if (activeQuestion) {
      setVisited((prev) => ({ ...prev, [activeQuestion.id]: true }));
    }
  }, [activeQuestion]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')} : ${mins.toString().padStart(2, '0')} : ${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (optIndex: number) => {
    if (!activeQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: {
        questionId: activeQuestion.id,
        selectedOption: optIndex,
        isMarkedForReview: prev[activeQuestion.id]?.isMarkedForReview || false,
      },
    }));
  };

  const handleClearResponse = () => {
    if (!activeQuestion) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[activeQuestion.id];
      return copy;
    });
  };

  const handleToggleReview = () => {
    if (!activeQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: {
        questionId: activeQuestion.id,
        selectedOption: prev[activeQuestion.id]?.selectedOption ?? null,
        isMarkedForReview: !prev[activeQuestion.id]?.isMarkedForReview,
      },
    }));
    // Auto next after review mark
    if (activeQIdx < activeSection.questions.length - 1) {
      setActiveQIdx((p) => p + 1);
    }
  };

  // Counting badges across active section
  let answeredCount = 0;
  let notAnsweredCount = 0;
  let notVisitedCount = 0;
  let markedForReviewCount = 0;
  let answeredAndMarkedCount = 0;

  activeSection?.questions.forEach((q) => {
    const ans = answers[q.id];
    const isVis = visited[q.id];

    if (ans?.isMarkedForReview && ans?.selectedOption !== null && ans?.selectedOption !== undefined) {
      answeredAndMarkedCount++;
    } else if (ans?.isMarkedForReview) {
      markedForReviewCount++;
    } else if (ans?.selectedOption !== null && ans?.selectedOption !== undefined) {
      answeredCount++;
    } else if (isVis) {
      notAnsweredCount++;
    } else {
      notVisitedCount++;
    }
  });

  const getPaletteStyle = (qId: string) => {
    const ans = answers[qId];
    const isVis = visited[qId];

    if (ans?.isMarkedForReview && ans?.selectedOption !== null && ans?.selectedOption !== undefined) {
      return 'bg-purple-600 text-white font-bold relative';
    }
    if (ans?.isMarkedForReview) {
      return 'bg-purple-600 text-white font-bold';
    }
    if (ans?.selectedOption !== null && ans?.selectedOption !== undefined) {
      return 'bg-emerald-600 text-white font-bold';
    }
    if (isVis) {
      return 'bg-orange-600 text-white font-bold';
    }
    return 'bg-slate-200 text-slate-800 hover:bg-slate-300';
  };

  const isLastSection = activeSecIdx === sections.length - 1;

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-900 select-none overflow-hidden font-sans">
      {/* -------------------------------------------------------------------- */}
      {/* 1. TOP MAIN HEADER BAR (BLUE) WITH DYNAMIC TEST TITLE */}
      {/* -------------------------------------------------------------------- */}
      <header className="bg-[#1D63B8] text-white px-4 py-2 flex justify-between items-center h-12 shadow-sm">
        <div className="flex items-center gap-3 truncate">
          <div className="w-7 h-7 bg-pink-600 rounded flex-shrink-0 flex items-center justify-center font-black text-xs">
            BS
          </div>
          <h1 className="text-base md:text-lg font-semibold tracking-wide truncate">
            {testTitle || 'BankingSolutions Mock Test'}
          </h1>
        </div>

        <div className="flex items-center gap-2 text-xs flex-shrink-0">
          <div className="bg-white/10 px-3 py-1 rounded flex items-center gap-2 border border-white/20">
            <span>Time Left:</span>
            <span className="font-mono font-bold text-sm tracking-wider">{formatTime(timeLeft)}</span>
          </div>
          <button className="bg-white text-[#1D63B8] px-3 py-1 rounded font-semibold hover:bg-slate-100">
            Pause
          </button>
          <button className="bg-white/10 hover:bg-white/20 p-1.5 rounded border border-white/20">
            ⛶
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------------------- */}
      {/* 2. SUB HEADER (SECTION SWITCHER + LANGUAGE SELECTOR) */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-[#EAEFF7] border-b border-slate-300 px-4 py-2 flex justify-between items-center h-10 text-xs">
        <div className="flex gap-4">
          {sections.map((sec, i) => {
            const isLocked = lockedSections[i];
            const isActive = i === activeSecIdx;

            return (
              <div
                key={sec.id}
                className={`flex items-center gap-1 font-semibold transition ${
                  isActive
                    ? 'text-[#1D63B8] border-b-2 border-[#1D63B8] pb-0.5'
                    : isLocked
                    ? 'text-slate-400 line-through'
                    : 'text-slate-600'
                }`}
              >
                <span>{sec.title}</span>
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 text-white text-[9px] flex items-center justify-center font-bold">
                  i
                </span>
              </div>
            );
          })}
        </div>

        <div>
          <select className="border border-slate-300 rounded px-2 py-0.5 bg-white text-slate-800 text-xs font-semibold outline-none">
            <option>English</option>
            <option>Hindi</option>
          </select>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. MAIN BODY SECTION (QUESTIONS + PALETTE PANEL) */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT / CENTER QUESTION AREA */}
        <div className="flex-1 flex flex-col justify-between overflow-y-auto bg-white border-r border-slate-300">
          {/* Question Metadata Row (Qn. Time Removed) */}
          <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200 text-xs text-slate-600 bg-slate-50">
            <span className="font-semibold text-slate-800">
              Q: {currentOverallQNum} / {totalExamQuestions}
            </span>

            <div className="flex items-center gap-4">
              <span className="font-semibold text-slate-700">
                Marks : <span className="text-emerald-600">+1</span> | <span className="text-rose-600">-0.25</span>
              </span>
            </div>
          </div>

          {/* Question Content (Passage + Question Split) */}
          <div className="flex-1 flex overflow-y-auto p-4 gap-6">
            {/* Passage Pane (Left) */}
            {activeQuestion?.passageText && (
              <div className="w-1/2 overflow-y-auto pr-4 border-r border-slate-200 text-sm leading-relaxed text-slate-800 font-medium">
                {activeQuestion.passageText}
              </div>
            )}

            {/* Question & Options Pane (Right) */}
            <div className={`${activeQuestion?.passageText ? 'w-1/2' : 'w-full'} overflow-y-auto space-y-4`}>
              <h3 className="font-bold text-slate-900 text-sm leading-snug">
                {activeQuestion?.questionText}
              </h3>

              <div className="space-y-3 pt-2">
                {activeQuestion?.options.map((opt, i) => {
                  const isSelected = answers[activeQuestion.id]?.selectedOption === i;
                  return (
                    <label
                      key={i}
                      onClick={() => handleSelectOption(i)}
                      className={`flex items-center gap-3 p-2.5 rounded border text-xs cursor-pointer transition ${
                        isSelected ? 'border-blue-600 bg-blue-50 font-semibold' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${activeQuestion.id}`}
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-0"
                      />
                      <span className="text-slate-800">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* -------------------------------------------------------------------- */}
        {/* RIGHT PALETTE PANEL */}
        {/* -------------------------------------------------------------------- */}
        <div className="w-72 bg-[#EAEFF7] border-l border-slate-300 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* User Profile Info */}
            <div className="p-3 border-b border-slate-300 flex items-center gap-3 bg-white">
              <div className="w-9 h-9 rounded-full bg-slate-200 border flex items-center justify-center text-slate-600 font-bold text-sm">
                👤
              </div>
              <div className="truncate">
                <span className="font-bold text-slate-800 text-xs block truncate">Abhijeet Kumar Mishra</span>
                <span className="text-[10px] text-slate-500 font-medium">Time Left: {formatTime(timeLeft)}</span>
              </div>
            </div>

            {/* Status Counters Legend Grid */}
            <div className="p-3 grid grid-cols-2 gap-2 text-[10px] border-b border-slate-300 bg-slate-50">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-t bg-emerald-600 text-white font-bold flex items-center justify-center">
                  {answeredCount}
                </span>
                <span className="text-slate-700">Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-b bg-orange-600 text-white font-bold flex items-center justify-center">
                  {notAnsweredCount}
                </span>
                <span className="text-slate-700">Not Answered</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded bg-slate-200 text-slate-800 font-bold flex items-center justify-center border border-slate-300">
                  {notVisitedCount}
                </span>
                <span className="text-slate-700">Not Visited</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center">
                  {markedForReviewCount}
                </span>
                <span className="text-slate-700">Marked for Review</span>
              </div>

              <div className="col-span-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center relative">
                  {answeredAndMarkedCount}
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full absolute bottom-0 right-0"></span>
                </span>
                <span className="text-slate-700">Answered & Marked for Review</span>
              </div>
            </div>

            {/* Section Name Header above Grid */}
            <div className="bg-[#1D63B8] text-white px-3 py-1.5 text-xs font-bold text-center">
              {activeSection?.title}
            </div>

            {/* Question Number Buttons Grid */}
            <div className="p-3 grid grid-cols-4 gap-2 max-h-[calc(100vh-340px)] overflow-y-auto">
              {activeSection?.questions.map((q, idx) => {
                const qNum = overallQuestionOffset + idx + 1;
                const ans = answers[q.id];
                const isAnsweredAndMarked = ans?.isMarkedForReview && ans?.selectedOption !== null && ans?.selectedOption !== undefined;

                return (
                  <button
                    key={q.id}
                    onClick={() => setActiveQIdx(idx)}
                    className={`h-8 w-11 rounded border border-slate-300 text-xs font-bold flex items-center justify-center transition shadow-sm relative ${getPaletteStyle(
                      q.id
                    )} ${idx === activeQIdx ? 'ring-2 ring-blue-700 ring-offset-1' : ''}`}
                  >
                    {qNum}
                    {isAnsweredAndMarked && (
                      <span className="w-2 h-2 bg-emerald-400 rounded-full absolute bottom-0.5 right-0.5 border border-purple-800"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. BOTTOM ACTION BUTTONS BAR */}
      {/* -------------------------------------------------------------------- */}
      <footer className="bg-[#EAEFF7] border-t border-slate-300 px-4 py-2 flex justify-between items-center h-12">
        <div className="flex gap-2">
          <button
            onClick={handleToggleReview}
            className="px-3 py-1.5 bg-[#C5D5EB] hover:bg-[#B2C7E5] text-[#1D63B8] font-bold text-xs rounded border border-[#A1BFE8]"
          >
            Mark for review & next
          </button>
          <button
            onClick={handleClearResponse}
            className="px-3 py-1.5 bg-[#C5D5EB] hover:bg-[#B2C7E5] text-[#1D63B8] font-bold text-xs rounded border border-[#A1BFE8]"
          >
            Clear Response
          </button>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => {
              if (activeQIdx < activeSection.questions.length - 1) {
                setActiveQIdx((p) => p + 1);
              }
            }}
            className="px-6 py-1.5 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded shadow"
          >
            Save & Next
          </button>

          {/* Submit Button */}
          <button
            onClick={() => {
              if (isLastSection) setShowFinalSubmitModal(true);
              else setShowSectionSubmitModal(true);
            }}
            className="px-8 py-1.5 bg-[#17539E] hover:bg-[#124280] text-white font-bold text-xs rounded shadow ml-12"
          >
            Submit
          </button>
        </div>
      </footer>

      {/* SECTION SUBMIT MODAL */}
      {showSectionSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 text-center">Submit {activeSection?.title}?</h3>
            <p className="text-xs text-rose-600 font-semibold text-center bg-rose-50 p-2 rounded">
              ⚠️ Section will be permanently locked after submitting.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSectionSubmitModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded"
              >
                Resume
              </button>
              <button
                onClick={handleLockAndNextSection}
                className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded"
              >
                Confirm & Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINAL EXAM SUBMIT MODAL */}
      {showFinalSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 text-center">Submit Full Test?</h3>
            <p className="text-xs text-slate-500 text-center">Are you ready to submit your exam and view your score analysis?</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowFinalSubmitModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded"
              >
                Resume
              </button>
              <button
                onClick={() => onCompleteTest(answers)}
                className="flex-1 py-2 bg-red-600 text-white font-bold text-xs rounded"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};