'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  getNotebookItems,
  toggleBookmarkQuestion,
  recordMistakeQuestions,
  updateNotebookNote,
} from '@/lib/notebook';
import QuestionCommunityBar from '@/components/QuestionCommunityBar';

interface Question {
  id: string;
  section: 'ENGLISH' | 'QUANT' | 'REASONING' | 'GA' | 'computer awareness' |'HINDI' | string;
  passageText?: string;
  passageTextHi?: string;
  questionText: string;
  questionTextHi?: string;
  imageUrl?: string;
  solutionImageUrl?: string;
  options: string[];
  optionsHi?: string[];
  correctOptionIndex: number;
  marks?: number;
  negativeMarks?: number;
  explanation?: string;
  explanationHi?: string;
}

interface MockTest {
  id: string;
  title: string;
  exam_type: string;
  duration_minutes: number;
  total_marks: number;
  questions: Question[] | string;
}

export default function TCSiONMockTestPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const testId = params?.id as string;
  const mode = searchParams.get('mode'); // 'reattempt' | 'solution' | null

  // Test & User Info
  const [test, setTest] = useState<MockTest | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidateName, setCandidateName] = useState('Aspirant');
  const [rollCode, setRollCode] = useState('BS2026-GUEST');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isResumedSession, setIsResumedSession] = useState(false);

  // Section Management States
  const [sections, setSections] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<string>('');
  const [lockedSections, setLockedSections] = useState<Record<string, boolean>>({});

  // Question & Answers Tracking
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<number, boolean>>({ 0: true });
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<number, number>>({});

  // ⏸️ PAUSE MODAL STATE
  const [isPaused, setIsPaused] = useState(false);

  // ⚡ MOBILE PALETTE DRAWER STATE
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);

  // 🌙 ELEVATED DARK / CLASSIC iON LIGHT THEME TOGGLE
  const [isDarkExam, setIsDarkExam] = useState(true);

  // 🔖 SMART BOOKMARK & PERSONAL NOTE STATES
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [noteSavedBanner, setNoteSavedBanner] = useState(false);

  // 🌐 BILINGUAL LANGUAGE & PRE-EXAM INSTRUCTIONS STATES
  const [examLang, setExamLang] = useState<'BOTH' | 'EN' | 'HI'>('BOTH');
  const [hasAcceptedInstructions, setHasAcceptedInstructions] = useState(false);
  const [declarationChecked, setDeclarationChecked] = useState(false);

  // Submission & Timer States
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sectionalTimeLeft, setSectionalTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronized Refs for Unload & Background Saving
  const attemptIdRef = useRef<string | null>(null);
  const selectedAnswersRef = useRef(selectedAnswers);
  const sectionalTimeLeftRef = useRef(sectionalTimeLeft);
  const questionTimeSpentRef = useRef(questionTimeSpent);
  const activeIndexRef = useRef(activeIndex);

  useEffect(() => { attemptIdRef.current = attemptId; }, [attemptId]);
  useEffect(() => { selectedAnswersRef.current = selectedAnswers; }, [selectedAnswers]);
  useEffect(() => { sectionalTimeLeftRef.current = sectionalTimeLeft; }, [sectionalTimeLeft]);
  useEffect(() => { questionTimeSpentRef.current = questionTimeSpent; }, [questionTimeSpent]);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  useEffect(() => {
    fetchUserData();
    if (testId) fetchMockTestAndAttempts();
    const existingVault = getNotebookItems();
    const bm: Record<string, boolean> = {};
    const nm: Record<string, string> = {};
    existingVault.forEach((item) => {
      if (item.isBookmarked) bm[item.id] = true;
      if (item.personalNote) nm[item.id] = item.personalNote;
    });
    setBookmarkedMap(bm);
    setNotesMap(nm);
  }, [testId]);

  // Sectional Timer & Time Spent Tracker (Pauses when isPaused is true or instructions not yet accepted)
  useEffect(() => {
    if (test && !isSubmitted && !isPaused && hasAcceptedInstructions && sectionalTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setSectionalTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleSectionTimeout();
            return 0;
          }
          return prev - 1;
        });

        setQuestionTimeSpent((prev) => ({
          ...prev,
          [activeIndexRef.current]: (prev[activeIndexRef.current] || 0) + 1,
        }));
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [test, isSubmitted, isPaused, hasAcceptedInstructions, sectionalTimeLeft, activeSection]);

  // Auto-Save Loop & Unload Listeners for Pause/Resume persistence
  useEffect(() => {
    if (isSubmitted || !attemptId || loading) return;

    const interval = setInterval(() => {
      if (!isPaused) {
        saveInProgressToSupabase();
      }
    }, 4000);

    const handleWindowUnload = () => {
      saveToLocalStorageFallback();
      saveInProgressToSupabase();
    };

    window.addEventListener('beforeunload', handleWindowUnload);
    window.addEventListener('visibilitychange', handleWindowUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleWindowUnload);
      window.removeEventListener('visibilitychange', handleWindowUnload);
    };
  }, [attemptId, isSubmitted, isPaused, loading]);

  const saveToLocalStorageFallback = () => {
    if (!testId) return;
    const cacheKey = `mock_session_${testId}`;
    const sessionData = {
      test_id: testId,
      status: 'in_progress',
      user_answers: selectedAnswersRef.current,
      time_remaining_seconds: sectionalTimeLeftRef.current,
      time_spent: questionTimeSpentRef.current,
      updated_at: Date.now(),
    };
    try {
      localStorage.setItem(cacheKey, JSON.stringify(sessionData));
    } catch (e) {}
  };

  async function fetchUserData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const user = session.user;
      setCurrentUser(user);
      setCandidateName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Aspirant');
      setRollCode(`BS2026-${user.id.slice(0, 4).toUpperCase()}`);
    }
  }

  async function fetchMockTestAndAttempts() {
    setLoading(true);

    const { data, error } = await supabase
      .from('mock_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    const mockData = data as MockTest;
    let rawQuestions: any[] = [];

    if (typeof mockData.questions === 'string') {
      try { rawQuestions = JSON.parse(mockData.questions); } catch (e) { rawQuestions = []; }
    } else if (Array.isArray(mockData.questions)) {
      rawQuestions = mockData.questions;
    }

    // Comprehensive question normalization supporting both camelCase and snake_case properties
    const parsedQuestions: Question[] = rawQuestions.map((q: any) => ({
      ...q,
      imageUrl: q.imageUrl || q.image_url || q.question_image_url || q.questionImageUrl || q.image || q.graph_url || undefined,
      solutionImageUrl: q.solutionImageUrl || q.solution_image_url || q.solutionImage || q.sol_image_url || q.sol_image || q.solution_image || undefined,
      passageText: q.passageText || q.passage_text || q.passage || undefined,
      passageTextHi: q.passageTextHi || q.passage_text_hi || undefined,
      questionText: q.questionText || q.question_text || q.question || '',
      questionTextHi: q.questionTextHi || q.question_text_hi || undefined,
      options: Array.isArray(q.options) ? q.options : [],
      optionsHi: Array.isArray(q.optionsHi) ? q.optionsHi : Array.isArray(q.options_hi) ? q.options_hi : undefined,
      explanation: q.explanation || q.solution || q.solution_text || q.solutionText || undefined,
      explanationHi: q.explanationHi || q.solution_hi || q.explanation_hi || undefined,
    }));

    const uniqueSections = Array.from(new Set(parsedQuestions.map((q) => q.section || 'QUANT')));
    setSections(uniqueSections);

    const defaultSecTime = Math.floor(((mockData.duration_minutes || 60) * 60) / (uniqueSections.length || 1));

    setTest(mockData);
    setQuestions(parsedQuestions);

    if (mode === 'solution') {
      setIsSubmitted(true);
      setHasAcceptedInstructions(true);
      setActiveSection(uniqueSections[0] || 'QUANT');
      try {
        const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
        if (localSaved[testId]?.answers) {
          setSelectedAnswers(localSaved[testId].answers);
        }
        if (localSaved[testId]?.time_spent) {
          setQuestionTimeSpent(localSaved[testId].time_spent);
        }
      } catch (e) {}
      setLoading(false);
      return;
    }

    let restoredAttempt: any = null;
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { data: inProgressRecord } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('test_id', testId)
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (inProgressRecord) {
        restoredAttempt = inProgressRecord;
      }
    }

    let localCache: any = null;
    try {
      const cachedStr = localStorage.getItem(`mock_session_${testId}`);
      if (cachedStr) {
        localCache = JSON.parse(cachedStr);
      }
    } catch (e) {}

    if (restoredAttempt || localCache) {
      const activeRecord = restoredAttempt || {};
      if (activeRecord.id) {
        setAttemptId(activeRecord.id);
        attemptIdRef.current = activeRecord.id;
      }

      const restoredAnswers = localCache?.user_answers || activeRecord.answers || {};
      setSelectedAnswers(restoredAnswers);
      selectedAnswersRef.current = restoredAnswers;

      if (localCache?.time_spent || activeRecord.time_spent) {
        const spentObj = localCache?.time_spent || activeRecord.time_spent;
        setQuestionTimeSpent(spentObj);
        questionTimeSpentRef.current = spentObj;
      }

      const dbSecTime = Number(activeRecord.time_remaining_seconds);
      const cacheSecTime = Number(localCache?.time_remaining_seconds);
      let finalSecTime = defaultSecTime;

      if (!isNaN(cacheSecTime) && cacheSecTime > 0) {
        finalSecTime = cacheSecTime;
      } else if (!isNaN(dbSecTime) && dbSecTime > 0) {
        finalSecTime = dbSecTime;
      }

      setSectionalTimeLeft(finalSecTime);
      sectionalTimeLeftRef.current = finalSecTime;
      setActiveSection(uniqueSections[0] || 'QUANT');
      setIsResumedSession(true);
      setHasAcceptedInstructions(true);
    } else {
      setActiveSection(uniqueSections[0] || 'QUANT');
      setSectionalTimeLeft(defaultSecTime);
      sectionalTimeLeftRef.current = defaultSecTime;

      if (session?.user) {
        const { data: newAttempt } = await supabase
          .from('mock_attempts')
          .insert([
            {
              user_id: session.user.id,
              test_id: testId,
              status: 'in_progress',
              score: 0,
              total_marks: mockData.total_marks || 100,
              answers: {},
              time_remaining_seconds: defaultSecTime,
            },
          ])
          .select()
          .single();

        if (newAttempt) {
          setAttemptId(newAttempt.id);
          attemptIdRef.current = newAttempt.id;
        }
      }
    }

    setLoading(false);
  }

  const saveInProgressToSupabase = async () => {
    saveToLocalStorageFallback();
    const curAttemptId = attemptIdRef.current;
    if (!curAttemptId || isSubmitted) return;

    await supabase
      .from('mock_attempts')
      .update({
        answers: selectedAnswersRef.current,
        time_remaining_seconds: sectionalTimeLeftRef.current,
        time_spent: questionTimeSpentRef.current,
        status: 'in_progress',
      })
      .eq('id', curAttemptId);
  };

  const handlePauseTest = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    await saveInProgressToSupabase();
    setIsPaused(true);
  };

  const handleResumeFromModal = () => {
    setIsPaused(false);
  };

  const handleSectionTimeout = () => {
    setLockedSections((prev) => ({ ...prev, [activeSection]: true }));

    const currentSecIdx = sections.indexOf(activeSection);
    if (currentSecIdx < sections.length - 1) {
      const nextSection = sections[currentSecIdx + 1];
      setActiveSection(nextSection);

      const secTime = Math.floor(((test?.duration_minutes || 60) * 60) / sections.length);
      setSectionalTimeLeft(secTime);

      const firstNextIdx = questions.findIndex((q) => (q.section || 'QUANT') === nextSection);
      if (firstNextIdx !== -1) {
        setActiveIndex(firstNextIdx);
        setVisitedQuestions((prev) => ({ ...prev, [firstNextIdx]: true }));
      }
      saveInProgressToSupabase();
    } else {
      finalizeAndSaveMock(selectedAnswersRef.current);
    }
  };

  const handleManualSubmitSection = () => {
    if (confirm(`Submit Section "${activeSection}"? You CANNOT return to this section once submitted.`)) {
      if (timerRef.current) clearInterval(timerRef.current);
      handleSectionTimeout();
    }
  };

  const handleSubmitFullTest = () => {
    if (confirm('Are you sure you want to submit the entire test?')) {
      if (timerRef.current) clearInterval(timerRef.current);
      finalizeAndSaveMock(selectedAnswersRef.current);
    }
  };

  const finalizeAndSaveMock = async (answers: Record<number, number>) => {
    if (!test) return;

    let score = 0;
    const wrongQuestionsToSave: any[] = [];

    questions.forEach((q, idx) => {
      const userAns = answers[idx];
      if (userAns === q.correctOptionIndex) {
        score += q.marks || 1.0;
      } else if (userAns !== undefined) {
        score -= q.negativeMarks || 0.25;
        wrongQuestionsToSave.push({
          id: `mock_${test.id}_q_${idx}`,
          sourceType: 'MOCK_TEST' as const,
          sourceId: test.id,
          sourceTitle: test.title,
          section: q.section || 'QUANT',
          passageText: q.passageText,
          questionText: q.questionText,
          imageUrl: q.imageUrl,
          solutionImageUrl: q.solutionImageUrl,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          userSelectedOption: userAns,
          explanation: q.explanation,
        });
      }
    });

    if (wrongQuestionsToSave.length > 0) {
      recordMistakeQuestions(wrongQuestionsToSave);
    }

    try {
      localStorage.removeItem(`mock_session_${test.id}`);
    } catch (e) {}

    const attemptPayload = {
      test_id: test.id,
      score: score,
      total_marks: test.total_marks,
      answers: answers,
      time_spent: questionTimeSpentRef.current,
      status: 'submitted',
    };

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      localSaved[test.id] = attemptPayload;
      localStorage.setItem('bsca_mock_attempts', JSON.stringify(localSaved));
    } catch (e) {}

    if (attemptIdRef.current) {
      await supabase
        .from('mock_attempts')
        .update({
          score: score,
          status: 'submitted',
          answers: answers,
          time_spent: questionTimeSpentRef.current,
          time_remaining_seconds: sectionalTimeLeftRef.current,
          completed_at: new Date().toISOString(),
        })
        .eq('id', attemptIdRef.current);
    } else if (currentUser?.id) {
      await supabase.from('mock_attempts').upsert([
        {
          user_id: currentUser.id,
          test_id: test.id,
          score: score,
          total_marks: test.total_marks,
          status: 'submitted',
          answers: answers,
          time_spent: questionTimeSpentRef.current,
          completed_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,test_id' });
    }

    setIsSubmitted(true);
    router.push(`/mock-test/${test.id}/result`);
  };

  const handleSelectQuestion = (globalIdx: number) => {
    const qSec = questions[globalIdx]?.section || 'QUANT';
    if (!isSubmitted && qSec !== activeSection) {
      alert(`You are in section "${activeSection}". Submit this section first to move ahead.`);
      return;
    }
    setActiveIndex(globalIdx);
    setVisitedQuestions((prev) => ({ ...prev, [globalIdx]: true }));
    setIsMobilePaletteOpen(false);
  };

  const handleNext = () => {
    if (isSubmitted) {
      if (activeIndex < questions.length - 1) {
        setActiveIndex(activeIndex + 1);
        const newSec = questions[activeIndex + 1]?.section || activeSection;
        setActiveSection(newSec);
      }
      return;
    }

    const activeSectionIndices = questions
      .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
      .filter((idx) => idx !== -1);

    const currentPos = activeSectionIndices.indexOf(activeIndex);
    if (currentPos < activeSectionIndices.length - 1) {
      const nextGlobalIdx = activeSectionIndices[currentPos + 1];
      setActiveIndex(nextGlobalIdx);
      setVisitedQuestions((prev) => ({ ...prev, [nextGlobalIdx]: true }));
    }
  };

  const handlePrev = () => {
    if (isSubmitted) {
      if (activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
        const newSec = questions[activeIndex - 1]?.section || activeSection;
        setActiveSection(newSec);
      }
      return;
    }

    const activeSectionIndices = questions
      .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
      .filter((idx) => idx !== -1);

    const currentPos = activeSectionIndices.indexOf(activeIndex);
    if (currentPos > 0) {
      const prevGlobalIdx = activeSectionIndices[currentPos - 1];
      setActiveIndex(prevGlobalIdx);
      setVisitedQuestions((prev) => ({ ...prev, [prevGlobalIdx]: true }));
    }
  };

  const handleSelectOption = (optionIdx: number) => {
    if (isSubmitted || isPaused || lockedSections[activeSection]) return;
    const updated = { ...selectedAnswers, [activeIndex]: optionIdx };
    setSelectedAnswers(updated);
    selectedAnswersRef.current = updated;
    saveInProgressToSupabase();
  };

  const handleClearResponse = () => {
    if (isSubmitted || isPaused || lockedSections[activeSection]) return;
    const updated = { ...selectedAnswers };
    delete updated[activeIndex];
    setSelectedAnswers(updated);
    selectedAnswersRef.current = updated;
    saveInProgressToSupabase();
  };

  const handleToggleMarkReview = () => {
    if (isSubmitted || isPaused || lockedSections[activeSection]) return;
    setMarkedForReview((prev) => ({ ...prev, [activeIndex]: !prev[activeIndex] }));
    handleNext();
  };

  // 🔖 Toggle bookmark for active question in Revision Vault
  const handleToggleBookmarkCurrent = () => {
    if (!test || !questions[activeIndex]) return;
    const q = questions[activeIndex];
    const vaultId = `mock_${test.id}_q_${activeIndex}`;
    const { isNowBookmarked } = toggleBookmarkQuestion({
      id: vaultId,
      sourceType: 'MOCK_TEST',
      sourceId: test.id,
      sourceTitle: test.title,
      section: q.section || 'QUANT',
      questionText: q.questionText,
      passageText: q.passageText,
      imageUrl: q.imageUrl,
      solutionImageUrl: q.solutionImageUrl,
      options: q.options || [],
      correctOptionIndex: q.correctOptionIndex,
      userSelectedOption: selectedAnswers[activeIndex],
      explanation: q.explanation,
    });
    setBookmarkedMap((prev) => ({ ...prev, [vaultId]: isNowBookmarked }));
  };

  // 📝 Save personal formula/shortcut note for active question
  const handleSaveCurrentNote = (noteText: string) => {
    if (!test || !questions[activeIndex]) return;
    const q = questions[activeIndex];
    const vaultId = `mock_${test.id}_q_${activeIndex}`;
    // Ensure question is in vault if not already
    if (!bookmarkedMap[vaultId]) {
      toggleBookmarkQuestion({
        id: vaultId,
        sourceType: 'MOCK_TEST',
        sourceId: test.id,
        sourceTitle: test.title,
        section: q.section || 'QUANT',
        questionText: q.questionText,
        passageText: q.passageText,
        imageUrl: q.imageUrl,
        solutionImageUrl: q.solutionImageUrl,
        options: q.options || [],
        correctOptionIndex: q.correctOptionIndex,
        userSelectedOption: selectedAnswers[activeIndex],
        explanation: q.explanation,
      });
      setBookmarkedMap((prev) => ({ ...prev, [vaultId]: true }));
    }
    updateNotebookNote(vaultId, noteText);
    setNotesMap((prev) => ({ ...prev, [vaultId]: noteText }));
    setNoteSavedBanner(true);
    setTimeout(() => setNoteSavedBanner(false), 2000);
  };

  const getCounts = () => {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0, answeredMarked = 0;
    
    questions.forEach((q, idx) => {
      if ((q.section || 'QUANT') === activeSection) {
        const isAns = selectedAnswers[idx] !== undefined;
        const isVisited = visitedQuestions[idx];
        const isMarked = markedForReview[idx];

        if (isAns && isMarked) answeredMarked++;
        else if (isMarked) marked++;
        else if (isAns) answered++;
        else if (isVisited) notAnswered++;
        else notVisited++;
      }
    });

    return { answered, notAnswered, notVisited, marked, answeredMarked };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 🖼️ Helper function to render text or markdown/raw image links cleanly
  const renderContentWithImages = (text: string) => {
    if (!text) return null;

    const markdownImgRegex = /!\[([^\]]*)]\(([^)]+)\)/g;
    if (markdownImgRegex.test(text)) {
      const parts = [];
      let lastIndex = 0;
      let match;

      markdownImgRegex.lastIndex = 0;
      while ((match = markdownImgRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(
          <div key={match.index} className="my-3 text-center">
            <img src={match[2]} alt={match[1] || 'Graph/Image'} className="max-w-full h-auto mx-auto rounded-lg border border-slate-300 shadow-sm bg-white p-1" />
          </div>
        );
        lastIndex = markdownImgRegex.lastIndex;
      }
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }
      return <div className="space-y-2">{parts}</div>;
    }

    if (text.trim().startsWith('http') && (text.includes('.png') || text.includes('.jpg') || text.includes('.jpeg') || text.includes('.webp') || text.includes('supabase.co'))) {
      return (
        <div className="my-3 text-center">
          <img src={text.trim()} alt="Graph/Image" className="max-w-full h-auto mx-auto rounded-lg border border-slate-300 shadow-sm bg-white p-1" />
        </div>
      );
    }

    return <div className="whitespace-pre-line">{text}</div>;
  };

  // 🌐 Smart Bilingual Renderer (supports explicit Hindi fields OR inline English/Hindi text)
  const renderBilingualContent = (enText?: string, hiText?: string) => {
    const rawEn = (enText || '').trim();
    const rawHi = (hiText || '').trim();

    if (rawHi) {
      if (examLang === 'EN') return renderContentWithImages(rawEn);
      if (examLang === 'HI') return renderContentWithImages(rawHi);
      return (
        <div className="space-y-2.5">
          <div>{renderContentWithImages(rawEn)}</div>
          <div className="pt-2 border-t border-dashed border-slate-500/30 text-amber-200/95">
            {renderContentWithImages(rawHi)}
          </div>
        </div>
      );
    }

    // Check if rawEn contains both English and Devanagari script separated by newline or " / "
    const hasDevanagari = /[\u0900-\u097F]/.test(rawEn);
    if (hasDevanagari && examLang !== 'BOTH') {
      const lines = rawEn.split('\n');
      if (lines.length > 1) {
        const enLines = lines.filter((l) => !/[\u0900-\u097F]/.test(l) || /[A-Za-z]{4,}/.test(l));
        const hiLines = lines.filter((l) => /[\u0900-\u097F]/.test(l));
        if (examLang === 'EN' && enLines.length > 0) {
          return renderContentWithImages(enLines.join('\n'));
        }
        if (examLang === 'HI' && hiLines.length > 0) {
          return renderContentWithImages(hiLines.join('\n'));
        }
      } else if (rawEn.includes(' / ')) {
        const [partEn, partHi] = rawEn.split(' / ');
        if (examLang === 'EN' && partEn) return renderContentWithImages(partEn);
        if (examLang === 'HI' && partHi) return renderContentWithImages(partHi);
      }
    }

    return renderContentWithImages(rawEn);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center font-bold">
        <div className="w-9 h-9 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mr-3.5"></div>
        <span className="text-xs uppercase tracking-widest text-slate-300">Loading Mock Test Environment...</span>
      </div>
    );
  }

  if (!test || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-black text-white">Test Not Found</h2>
        <Link href="/tests" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg">
          Back to Tests Portal
        </Link>
      </div>
    );
  }

  const activeQuestion = questions[activeIndex];
  const hasPassage = Boolean(
    activeQuestion?.passageText && activeQuestion.passageText.trim().length > 0
  );

  const sectionQuestions = questions.filter((q) => (q.section || 'QUANT') === activeSection);
  const activeSectionQuestionIndices = isSubmitted
    ? questions.map((_, idx) => idx)
    : questions
        .map((q, idx) => ((q.section || 'QUANT') === activeSection ? idx : -1))
        .filter((idx) => idx !== -1);

  const counts = getCounts();

  // 📋 PRE-EXAM TCS iON INSTRUCTIONS & DECLARATION SCREEN (Renders exclusively before exam starts)
  if (!isSubmitted && !hasAcceptedInstructions) {
    return (
      <div className="h-screen w-screen bg-[#020617] text-slate-100 font-sans flex flex-col select-none overflow-hidden">
        {/* Instructions Top Bar */}
          <div className="bg-slate-950 border-b border-white/[0.08] px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 rounded-xl font-black text-base flex items-center justify-center shadow-lg">
                BS
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  Official CBT Exam Simulation Environment
                </span>
                <h2 className="text-base sm:text-lg font-black text-white">{test.title} — General Instructions</h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-white/[0.08] px-3.5 py-2 rounded-xl text-xs">
                <span className="text-slate-400">Candidate:</span>
                <strong className="text-amber-400">{candidateName}</strong>
              </div>
              <Link
                href="/tests"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 font-bold text-xs rounded-xl transition"
              >
                ← Cancel
              </Link>
            </div>
          </div>

          {/* Scrollable Instructions Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
            {/* Exam Pattern & Sectional Timing Table */}
            <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-base font-black text-white">1. Exam Pattern &amp; Sectional Timing</h3>
                  <p className="text-xs text-slate-400">
                    Each section has a strict sectional timer. Once a section ends or is submitted, you cannot return to it.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 font-black text-xs">
                    ⏱️ Total Duration: {test.duration_minutes} Mins
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-black text-xs">
                    🎯 Max Marks: {test.total_marks}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-white/[0.08]">
                    <tr>
                      <th className="p-3.5">Sr. No.</th>
                      <th className="p-3.5">Section Name</th>
                      <th className="p-3.5 text-center">No. of Questions</th>
                      <th className="p-3.5 text-center">Sectional Time</th>
                      <th className="p-3.5 text-right">Marking Scheme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-slate-200 font-semibold">
                    {sections.map((sec, idx) => {
                      const secQs = questions.filter((q) => (q.section || 'QUANT') === sec);
                      const secMins = Math.round((test.duration_minutes || 60) / (sections.length || 1));
                      return (
                        <tr key={sec} className="hover:bg-slate-800/40">
                          <td className="p-3.5 text-slate-400">{idx + 1}</td>
                          <td className="p-3.5 font-black text-white">{sec}</td>
                          <td className="p-3.5 text-center text-amber-400 font-bold">{secQs.length} Qs</td>
                          <td className="p-3.5 text-center text-blue-400 font-bold">{secMins} Mins</td>
                          <td className="p-3.5 text-right text-emerald-400">
                            +{secQs[0]?.marks || 1.0} / -{secQs[0]?.negativeMarks || 0.25}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Question Palette Legend */}
            <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-base font-black text-white">2. Question Palette Symbols</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="flex items-center gap-3 bg-slate-950/80 border border-white/[0.06] p-3 rounded-2xl">
                  <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 flex items-center justify-center font-black shrink-0">
                    1
                  </span>
                  <span className="text-slate-300">You have not visited the question yet.</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-950/80 border border-white/[0.06] p-3 rounded-2xl">
                  <span className="w-7 h-7 rounded-lg bg-[#E45225] text-white flex items-center justify-center font-black shrink-0">
                    2
                  </span>
                  <span className="text-slate-300">You have visited but not answered the question.</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-950/80 border border-white/[0.06] p-3 rounded-2xl">
                  <span className="w-7 h-7 rounded-lg bg-[#2CAB48] text-white flex items-center justify-center font-black shrink-0">
                    3
                  </span>
                  <span className="text-slate-300">You have answered the question.</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-950/80 border border-white/[0.06] p-3 rounded-2xl">
                  <span className="w-7 h-7 rounded-full bg-[#693B98] text-white flex items-center justify-center font-black shrink-0">
                    4
                  </span>
                  <span className="text-slate-300">Marked for review (Not answered).</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-950/80 border border-white/[0.06] p-3 rounded-2xl sm:col-span-2">
                  <span className="w-7 h-7 rounded-full bg-[#693B98] text-white flex items-center justify-center font-black relative shrink-0">
                    5
                    <span className="w-2.5 h-2.5 bg-[#2CAB48] rounded-full absolute -bottom-0.5 -right-0.5 border border-white"></span>
                  </span>
                  <span className="text-emerald-300 font-semibold">
                    Answered &amp; Marked for Review — Will be evaluated for final marks!
                  </span>
                </div>
              </div>
            </div>

            {/* Language & Declaration */}
            <div className="bg-slate-900/80 border border-amber-400/25 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <h3 className="text-sm font-black text-white">Choose Your Default Question Display Language:</h3>
                  <p className="text-[11px] text-slate-400">
                    You can also switch between English, Hindi, and Bilingual anytime during the test.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/[0.1]">
                  {[
                    { id: 'BOTH', label: '🌐 Bilingual (EN + हिं)' },
                    { id: 'EN', label: 'English' },
                    { id: 'HI', label: 'हिन्दी (Hindi)' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setExamLang(l.id as any)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition ${
                        examLang === l.id
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
                <span className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-white">Candidate Declaration:</strong> I have read and understood all the exam instructions. I agree that in case of any dispute, the marking scheme and sectional timer rules of this simulation shall apply. Wrong answers attempted during this mock test will be automatically logged into my <strong className="text-amber-400">Mistake &amp; Revision Notebook</strong> for post-exam review.
                </span>
              </label>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={!declarationChecked}
                  onClick={() => setHasAcceptedInstructions(true)}
                  className={`px-8 py-3.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition shadow-xl ${
                    declarationChecked
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 border border-white/[0.06] cursor-not-allowed'
                  }`}
                >
                  I am ready to begin →
                </button>
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
    <div
      data-cbt-exam="true"
      className={`h-screen w-screen font-sans flex flex-col select-none overflow-hidden relative transition-colors duration-200 ${
        isDarkExam ? 'bg-[#020617] text-slate-100' : 'bg-[#F4F6F9] text-slate-900'
      }`}
    >
      {/* ⏸️ PAUSE MODAL OVERLAY */}
      {isPaused && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 max-w-md w-full rounded-3xl p-7 shadow-2xl border border-white/[0.1] text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 bg-amber-400/15 text-amber-400 border border-amber-400/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              ⏸️
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white tracking-tight">Test Paused</h3>
              <p className="text-xs text-slate-400">Your test progress and answers have been safely saved.</p>
            </div>

            <div className="bg-slate-950 border border-white/[0.08] p-4 rounded-2xl text-xs space-y-2.5 text-left font-medium text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Current Section:</span>
                <b className="text-blue-400 font-bold">{activeSection}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Time Remaining:</span>
                <b className="font-mono text-amber-400 font-bold">{formatTime(sectionalTimeLeft)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Questions Answered:</span>
                <b className="text-emerald-400 font-bold">{Object.keys(selectedAnswers).length} Qs</b>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResumeFromModal}
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <span>▶️ Resume Test</span>
              </button>
              <Link
                href="/tests"
                className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-white/[0.08] transition"
              >
                Exit Portal
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 1. TOP BRANDING HEADER */}
      <header
        className={`px-4 md:px-6 py-3 flex justify-between items-center shadow-md shrink-0 z-40 border-b ${
          isDarkExam
            ? 'bg-slate-950/90 backdrop-blur-xl border-white/[0.08] text-white'
            : 'bg-[#1D63B8] border-[#154B94] text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 rounded-xl font-black text-sm flex items-center justify-center shadow-md">
            BS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs md:text-sm font-black tracking-tight leading-tight truncate max-w-[150px] sm:max-w-none">
                {test.title}
              </h1>
              {isResumedSession && !isSubmitted && (
                <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  ▶️ Resumed
                </span>
              )}
            </div>
            <p className="text-[10px] text-blue-200/90 uppercase font-bold tracking-wider">
              {test.exam_type} {isSubmitted ? '— Solution Mode' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Dark / Classic iON Light Toggle */}
          <button
            onClick={() => setIsDarkExam(!isDarkExam)}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] font-bold transition flex items-center gap-1.5"
            title="Switch between Elevated Dark Mode and Classic CBT Light Mode"
          >
            <span>{isDarkExam ? '☀️' : '🌙'}</span>
            <span className="hidden md:inline">{isDarkExam ? 'CBT Light' : 'Dark UI'}</span>
          </button>

          {!isSubmitted && (
            <div className="flex items-center gap-2">
              <div
                className={`px-3 md:px-4 py-1.5 rounded-xl font-mono font-bold text-xs md:text-sm flex items-center gap-1.5 border ${
                  sectionalTimeLeft < 180
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                    : 'bg-white/10 border-white/20 text-white'
                }`}
              >
                <span className="text-[10px] md:text-xs opacity-80">⏱️</span>
                <span className="text-sm md:text-base text-amber-300 font-black">{formatTime(sectionalTimeLeft)}</span>
              </div>

              {/* PAUSE BUTTON */}
              <button
                onClick={handlePauseTest}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-1"
                title="Pause Test"
              >
                <span>⏸️</span>
                <span className="hidden sm:inline">Pause</span>
              </button>
            </div>
          )}

          {!isSubmitted ? (
            <button
              onClick={handleManualSubmitSection}
              className="px-3 md:px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl border border-blue-400/30 shadow transition"
            >
              Submit Section ({activeSection})
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/notebook"
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-400/30 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <span>🔖</span>
                <span className="hidden sm:inline">Mistake Notebook</span>
              </Link>
              <Link
                href={`/mock-test/${test.id}/result`}
                className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow"
              >
                📊 View Scorecard &amp; Analysis
              </Link>
            </div>
          )}

          {/* MOBILE PALETTE TOGGLE BUTTON */}
          <button
            onClick={() => setIsMobilePaletteOpen(!isMobilePaletteOpen)}
            className="lg:hidden bg-white/10 border border-white/20 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1"
          >
            <span>☰</span>
            <span className="text-[10px]">Palette</span>
          </button>
        </div>
      </header>

      {/* 2. SECTIONAL TABS */}
      <div
        className={`px-4 md:px-6 py-2.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0 border-b ${
          isDarkExam
            ? 'bg-slate-900/90 border-white/[0.08] text-slate-200'
            : 'bg-white border-slate-300 text-slate-800 shadow-sm'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-2">Sections:</span>
          {sections.map((sec) => {
            const isLocked = lockedSections[sec];
            const isActive = activeSection === sec;

            return (
              <button
                key={sec}
                disabled={!isSubmitted && !isActive}
                onClick={() => {
                  setActiveSection(sec);
                  const firstIdx = questions.findIndex((q) => (q.section || 'QUANT') === sec);
                  if (firstIdx !== -1) setActiveIndex(firstIdx);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : isDarkExam
                    ? 'bg-slate-800/80 text-slate-400 hover:text-white border border-white/[0.06]'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <span>{sec}</span>
                {!isSubmitted && !isActive && <span className="text-[10px] opacity-75">🔒</span>}
                {isLocked && <span className="text-[10px] text-emerald-400">✓</span>}
              </button>
            );
          })}
        </div>

        <div className={`flex flex-wrap items-center gap-3 text-xs ${isDarkExam ? 'text-slate-300' : 'text-slate-700'}`}>
          {/* 🌐 BILINGUAL LANGUAGE SWITCHER */}
          <div className="flex items-center gap-1 bg-slate-950/60 border border-white/[0.1] p-0.5 rounded-lg">
            {[
              { id: 'BOTH', label: '🌐 EN+हिं' },
              { id: 'EN', label: 'EN' },
              { id: 'HI', label: 'हिं' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setExamLang(lang.id as any)}
                className={`px-2 py-1 rounded-md text-[10px] font-black transition ${
                  examLang === lang.id
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Switch Question Language (English / Hindi / Bilingual)"
              >
                {lang.label}
              </button>
            ))}
          </div>

          <span className="font-bold hidden sm:inline">
            Candidate: <span className={isDarkExam ? 'text-amber-400' : 'text-[#1D63B8]'}>{candidateName}</span>
          </span>
          <span className="opacity-30 hidden sm:inline">|</span>
          <span className="font-bold hidden md:inline">
            Roll No: <span className={`font-mono ${isDarkExam ? 'text-blue-400' : 'text-[#1D63B8]'}`}>{rollCode}</span>
          </span>
        </div>
      </div>

      {/* 4. MAIN EXAM DISPLAY WORKSPACE (LOCKED HEIGHT FOR NO OVERFLOW) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* QUESTION DISPLAY AREA */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto flex flex-col justify-between custom-scrollbar">
          {hasPassage ? (
            /* 50/50 SPLIT SCREEN FOR PASSAGE / DI / RC */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-[60vh]">
              <div
                className={`rounded-2xl p-5 overflow-y-auto max-h-[70vh] border shadow-lg custom-scrollbar ${
                  isDarkExam
                    ? 'bg-slate-900/85 border-white/[0.08] text-slate-200'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <div
                  className={`border-l-4 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider mb-4 rounded-r-lg flex items-center justify-between ${
                    isDarkExam
                      ? 'bg-blue-500/10 border-blue-400 text-blue-300'
                      : 'bg-blue-50 border-[#1D63B8] text-[#1D63B8]'
                  }`}
                >
                  <span>
                    {(() => {
                      const p = (activeQuestion.passageText || '').toLowerCase();
                      if (p.includes('puzzle') || p.includes('seating') || p.includes('facing') || p.includes('sitting') || p.includes('floor') || p.includes('box')) {
                        return '🧩 Reasoning Puzzle / Seating Context';
                      }
                      if (p.includes('graph') || p.includes('chart') || p.includes('table') || p.includes('data interpretation') || p.includes('di') || p.includes('accounts') || p.includes('production')) {
                        return '📊 Data Interpretation (DI) Context';
                      }
                      if (p.includes('passage') || p.includes('comprehension') || p.includes('read the')) {
                        return '📖 Reading Comprehension / Passage Context';
                      }
                      return '📌 Directions / Passage Context';
                    })()}
                  </span>
                  <span className="text-[10px] opacity-75 font-semibold">Left Pane</span>
                </div>
                <div className="text-xs sm:text-sm leading-relaxed font-normal whitespace-pre-line">
                  {renderBilingualContent(activeQuestion.passageText, activeQuestion.passageTextHi)}
                </div>
              </div>

              <div
                className={`rounded-2xl p-5 flex flex-col justify-between max-h-[70vh] overflow-y-auto border shadow-lg custom-scrollbar ${
                  isDarkExam
                    ? 'bg-slate-900/85 border-white/[0.08] text-slate-100'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              >
                <div className="space-y-4">
                  <div
                    className={`flex flex-wrap justify-between items-center gap-2 border-b pb-3 text-xs font-bold ${
                      isDarkExam ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="font-extrabold text-sm text-blue-400">
                      Question {activeIndex + 1} <span className="text-xs opacity-75">({activeQuestion.section})</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {isSubmitted && (
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            (questionTimeSpent[activeIndex] || 0) >= 90
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                          }`}
                        >
                          ⏱️ {questionTimeSpent[activeIndex] || 0}s
                          {(questionTimeSpent[activeIndex] || 0) >= 90 ? ' ⚠️ Time Trap' : ''}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleToggleBookmarkCurrent}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                          bookmarkedMap[`mock_${test.id}_q_${activeIndex}`]
                            ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                            : isDarkExam
                            ? 'bg-slate-800/80 text-slate-300 border-white/[0.1] hover:border-amber-400/50'
                            : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-amber-400'
                        }`}
                        title="Save to Mistake & Revision Notebook"
                      >
                        <span>🔖</span>
                        <span>{bookmarkedMap[`mock_${test.id}_q_${activeIndex}`] ? 'Saved in Vault' : 'Save to Vault'}</span>
                      </button>
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[11px]">
                        +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs md:text-sm font-semibold leading-relaxed">
                    {renderBilingualContent(activeQuestion.questionText, activeQuestion.questionTextHi)}
                  </div>

                  {activeQuestion.imageUrl && (
                    <div className="my-3 text-center">
                      <img
                        src={activeQuestion.imageUrl}
                        alt="Question Graph / Diagram"
                        className="max-w-full max-h-96 h-auto mx-auto rounded-xl border border-slate-300 shadow-md bg-white p-1"
                      />
                    </div>
                  )}

                  <div className="space-y-2.5 pt-2">
                    {activeQuestion.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[activeIndex] === optIdx;
                      const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                      let btnStyle = isDarkExam
                        ? 'bg-slate-950/70 border-white/[0.08] text-slate-200 hover:border-slate-700 hover:bg-slate-950'
                        : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50';

                      if (isSubmitted) {
                        if (isCorrect) {
                          btnStyle = isDarkExam
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 font-bold'
                            : 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                        } else if (isSelected && !isCorrect) {
                          btnStyle = isDarkExam
                            ? 'bg-rose-500/15 border-rose-500 text-rose-200 font-bold'
                            : 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                        }
                      } else if (isSelected) {
                        btnStyle = isDarkExam
                          ? 'bg-blue-600/20 border-blue-500 text-blue-200 font-bold shadow-md'
                          : 'bg-blue-50 border-[#1D63B8] text-[#1D63B8] font-bold shadow-sm';
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isSubmitted || isPaused || (lockedSections[activeSection] && !isSubmitted)}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-2 ${btnStyle}`}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center border shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-500'
                                  : isDarkExam
                                  ? 'bg-slate-900 text-slate-400 border-white/[0.1]'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>
                              {renderBilingualContent(opt, activeQuestion.optionsHi?.[optIdx])}
                            </span>
                          </div>
                          {isSubmitted && isCorrect && (
                            <span className="text-emerald-400 font-bold text-xs shrink-0">✓ Correct</span>
                          )}
                          {isSubmitted && isSelected && !isCorrect && (
                            <span className="text-rose-400 font-bold text-xs shrink-0">✗ Yours</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isSubmitted && (
                  <div className="mt-4 space-y-3">
                    {(activeQuestion.explanation || activeQuestion.solutionImageUrl) && (
                      <div
                        className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                          isDarkExam
                            ? 'bg-amber-400/10 border-amber-400/25 text-slate-200'
                            : 'bg-amber-50 border-amber-200 text-slate-800'
                        }`}
                      >
                        <span className="font-black uppercase tracking-wider text-amber-400 block">
                          💡 Solution &amp; Explanation
                        </span>
                        {activeQuestion.explanation && (
                          <div className="leading-relaxed whitespace-pre-line">
                            {renderBilingualContent(activeQuestion.explanation, activeQuestion.explanationHi)}
                          </div>
                        )}

                        {activeQuestion.solutionImageUrl && (
                          <div className="my-3 text-center space-y-1.5">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                              📊 Solution Diagram / Working:
                            </span>
                            <a
                              href={activeQuestion.solutionImageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block group"
                              title="Click to view full image in high resolution"
                            >
                              <img
                                src={activeQuestion.solutionImageUrl}
                                alt="Solution Diagram"
                                className="max-w-full max-h-96 h-auto mx-auto rounded-xl border border-slate-300 shadow-md bg-white p-1 hover:border-amber-400 transition"
                              />
                              <span className="text-[10px] text-slate-400 group-hover:text-amber-400 block mt-1 font-semibold">
                                🔍 Click to view full resolution image
                              </span>
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 📝 Personal Revision Note Box */}
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        isDarkExam
                          ? 'bg-slate-950/70 border-white/[0.08] text-slate-200'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                          📝 Your Personal Formula / Shortcut Note
                        </span>
                        {noteSavedBanner && (
                          <span className="text-[10px] font-bold text-emerald-400">✓ Saved to Mistake Notebook</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notesMap[`mock_${test.id}_q_${activeIndex}`] || ''}
                          onChange={(e) =>
                            setNotesMap((prev) => ({
                              ...prev,
                              [`mock_${test.id}_q_${activeIndex}`]: e.target.value,
                            }))
                          }
                          placeholder="Add a shortcut, formula, or reason why you missed this..."
                          className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none ${
                            isDarkExam
                              ? 'bg-slate-900 border-white/[0.1] text-white focus:border-amber-400'
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleSaveCurrentNote(notesMap[`mock_${test.id}_q_${activeIndex}`] || '')
                          }
                          className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-lg transition shrink-0"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>

                    {/* 💬 Peer Discussion & Report Error Bar */}
                    <QuestionCommunityBar
                      questionKey={`mock_${test.id}_q_${activeIndex}`}
                      sourceType="MOCK_TEST"
                      sourceId={test.id}
                      sourceTitle={test.title}
                      questionNumber={activeIndex + 1}
                      section={activeQuestion.section || 'QUANT'}
                      questionPreview={activeQuestion.questionText}
                      userName={candidateName}
                      userEmail={currentUser?.email || ''}
                      isDarkTheme={isDarkExam}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* FULL SCREEN FOR STANDALONE QUESTIONS */
            <div
              className={`max-w-4xl mx-auto w-full rounded-3xl p-6 md:p-8 space-y-5 border shadow-xl my-auto ${
                isDarkExam
                  ? 'bg-slate-900/85 border-white/[0.08] text-slate-100'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <div
                className={`flex flex-wrap justify-between items-center gap-2 border-b pb-3 text-xs font-bold ${
                  isDarkExam ? 'border-white/[0.08] text-slate-400' : 'border-slate-200 text-slate-600'
                }`}
              >
                <span className="font-extrabold text-sm text-blue-400">
                  Question {activeIndex + 1} <span className="text-xs opacity-75">({activeQuestion.section})</span>
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {isSubmitted && (
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        (questionTimeSpent[activeIndex] || 0) >= 90
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-blue-500/10 text-blue-300 border-blue-500/25'
                      }`}
                    >
                      ⏱️ {questionTimeSpent[activeIndex] || 0}s
                      {(questionTimeSpent[activeIndex] || 0) >= 90 ? ' ⚠️ Time Trap' : ''}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleBookmarkCurrent}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
                      bookmarkedMap[`mock_${test.id}_q_${activeIndex}`]
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                        : isDarkExam
                        ? 'bg-slate-800/80 text-slate-300 border-white/[0.1] hover:border-amber-400/50'
                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-amber-400'
                    }`}
                    title="Save to Mistake & Revision Notebook"
                  >
                    <span>🔖</span>
                    <span>{bookmarkedMap[`mock_${test.id}_q_${activeIndex}`] ? 'Saved in Vault' : 'Save to Vault'}</span>
                  </button>
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg text-[11px]">
                    Marks: +{activeQuestion.marks || 1.0} / -{activeQuestion.negativeMarks || 0.25}
                  </span>
                </div>
              </div>

              <div className="text-sm md:text-base font-semibold leading-relaxed">
                {renderBilingualContent(activeQuestion.questionText, activeQuestion.questionTextHi)}
              </div>

              {activeQuestion.imageUrl && (
                <div className="my-3 text-center">
                  <img
                    src={activeQuestion.imageUrl}
                    alt="Question Graph / Diagram"
                    className="max-w-full max-h-96 h-auto mx-auto rounded-xl border border-slate-300 shadow-md bg-white p-1"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2">
                {activeQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[activeIndex] === optIdx;
                  const isCorrect = activeQuestion.correctOptionIndex === optIdx;

                  let btnStyle = isDarkExam
                    ? 'bg-slate-950/70 border-white/[0.08] text-slate-200 hover:border-slate-700 hover:bg-slate-950'
                    : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50';

                  if (isSubmitted) {
                    if (isCorrect) {
                      btnStyle = isDarkExam
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 font-bold'
                        : 'bg-emerald-100 border-emerald-500 text-emerald-900 font-bold';
                    } else if (isSelected && !isCorrect) {
                      btnStyle = isDarkExam
                        ? 'bg-rose-500/15 border-rose-500 text-rose-200 font-bold'
                        : 'bg-rose-100 border-rose-500 text-rose-900 font-bold';
                    }
                  } else if (isSelected) {
                    btnStyle = isDarkExam
                      ? 'bg-blue-600/20 border-blue-500 text-blue-200 font-bold shadow-md'
                      : 'bg-blue-50 border-[#1D63B8] text-[#1D63B8] font-bold shadow-sm';
                  }

                  return (
                    <button
                      key={optIdx}
                      disabled={isSubmitted || isPaused || (lockedSections[activeSection] && !isSubmitted)}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`p-4 rounded-2xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-2 ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center border shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-500'
                              : isDarkExam
                              ? 'bg-slate-900 text-slate-400 border-white/[0.1]'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span>
                          {renderBilingualContent(opt, activeQuestion.optionsHi?.[optIdx])}
                        </span>
                      </div>
                      {isSubmitted && isCorrect && (
                        <span className="text-emerald-400 font-bold text-xs shrink-0">✓ Correct</span>
                      )}
                      {isSubmitted && isSelected && !isCorrect && (
                        <span className="text-rose-400 font-bold text-xs shrink-0">✗ Yours</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isSubmitted && (
                <div className="mt-4 space-y-3">
                  {(activeQuestion.explanation || activeQuestion.solutionImageUrl) && (
                    <div
                      className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                        isDarkExam
                          ? 'bg-amber-400/10 border-amber-400/25 text-slate-200'
                          : 'bg-amber-50 border-amber-200 text-slate-800'
                      }`}
                    >
                      <span className="font-black uppercase tracking-wider text-amber-400 block">
                        💡 Solution &amp; Explanation
                      </span>
                      {activeQuestion.explanation && (
                        <div className="leading-relaxed whitespace-pre-line">
                          {renderBilingualContent(activeQuestion.explanation, activeQuestion.explanationHi)}
                        </div>
                      )}

                      {activeQuestion.solutionImageUrl && (
                        <div className="my-3 text-center space-y-1.5">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                            📊 Solution Diagram / Working:
                          </span>
                          <a
                            href={activeQuestion.solutionImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block group"
                            title="Click to view full image in high resolution"
                          >
                            <img
                              src={activeQuestion.solutionImageUrl}
                              alt="Solution Diagram"
                              className="max-w-full max-h-96 h-auto mx-auto rounded-xl border border-slate-300 shadow-md bg-white p-1 hover:border-amber-400 transition"
                            />
                            <span className="text-[10px] text-slate-400 group-hover:text-amber-400 block mt-1 font-semibold">
                              🔍 Click to view full resolution image
                            </span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 📝 Personal Revision Note Box */}
                  <div
                    className={`p-4 rounded-2xl border text-xs space-y-2 ${
                      isDarkExam
                        ? 'bg-slate-950/70 border-white/[0.08] text-slate-200'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                        📝 Your Personal Formula / Shortcut Note
                      </span>
                      {noteSavedBanner && (
                        <span className="text-[10px] font-bold text-emerald-400">✓ Saved to Mistake Notebook</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={notesMap[`mock_${test.id}_q_${activeIndex}`] || ''}
                        onChange={(e) =>
                          setNotesMap((prev) => ({
                            ...prev,
                            [`mock_${test.id}_q_${activeIndex}`]: e.target.value,
                          }))
                        }
                        placeholder="Add a shortcut, formula, or reason why you missed this..."
                        className={`flex-1 px-3 py-2 rounded-xl border text-xs outline-none ${
                          isDarkExam
                            ? 'bg-slate-900 border-white/[0.1] text-white focus:border-amber-400'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleSaveCurrentNote(notesMap[`mock_${test.id}_q_${activeIndex}`] || '')
                        }
                        className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-xl transition shrink-0"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>

                  {/* 💬 Peer Discussion & Report Error Bar */}
                  <QuestionCommunityBar
                    questionKey={`mock_${test.id}_q_${activeIndex}`}
                    sourceType="MOCK_TEST"
                    sourceId={test.id}
                    sourceTitle={test.title}
                    questionNumber={activeIndex + 1}
                    section={activeQuestion.section || 'QUANT'}
                    questionPreview={activeQuestion.questionText}
                    userName={candidateName}
                    userEmail={currentUser?.email || ''}
                    isDarkTheme={isDarkExam}
                  />
                </div>
              )}
            </div>
          )}

          {/* CONTROL BUTTONS */}
          <div
            className={`rounded-2xl p-3.5 max-w-4xl mx-auto w-full flex flex-wrap justify-between items-center gap-2 mt-4 border shadow-lg shrink-0 ${
              isDarkExam ? 'bg-slate-900/90 border-white/[0.08]' : 'bg-white border-slate-300'
            }`}
          >
            <div className="flex gap-2">
              <button
                disabled={isSubmitted || isPaused}
                onClick={handleToggleMarkReview}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                  isSubmitted || isPaused
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500 border-slate-700'
                    : markedForReview[activeIndex]
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                    : isDarkExam
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20'
                    : 'bg-white border-purple-400 text-purple-700 hover:bg-purple-50'
                }`}
              >
                Mark for Review &amp; Next
              </button>
              <button
                disabled={isSubmitted || isPaused}
                onClick={handleClearResponse}
                className={`px-3.5 py-2.5 border font-bold text-xs rounded-xl transition ${
                  isSubmitted || isPaused
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500'
                    : isDarkExam
                    ? 'bg-slate-800 hover:bg-slate-700 border-white/[0.08] text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                Clear Response
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={isSubmitted ? activeIndex === 0 : activeSectionQuestionIndices.indexOf(activeIndex) === 0}
                className={`px-4 py-2.5 border disabled:opacity-40 font-bold text-xs rounded-xl transition ${
                  isDarkExam
                    ? 'bg-slate-800 hover:bg-slate-700 border-white/[0.08] text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                ← Previous
              </button>
              <button
                onClick={handleNext}
                disabled={isSubmitted ? activeIndex === questions.length - 1 : false}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-600/25 transition"
              >
                {isSubmitted ? 'Next Question →' : 'Save & Next →'}
              </button>
            </div>
          </div>
        </main>

        {/* ⚡ MOBILE BACKDROP OVERLAY */}
        {isMobilePaletteOpen && (
          <div
            onClick={() => setIsMobilePaletteOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-40"
          />
        )}

        {/* ⚡ FIXED RIGHT PALETTE */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-50 w-72 lg:w-80 border-l p-4 flex flex-col justify-between space-y-4 shadow-2xl lg:shadow-none transition-transform duration-300 shrink-0 ${
            isMobilePaletteOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          } ${
            isDarkExam
              ? 'bg-slate-900/95 border-white/[0.08] text-slate-100'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
        >
          <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            <div className={`flex justify-between items-center border-b pb-3 ${isDarkExam ? 'border-white/[0.08]' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-xl flex items-center justify-center font-black text-xs shadow">
                  {candidateName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-bold block truncate max-w-[130px]">{candidateName}</span>
                  <span className="text-[10px] text-slate-400 font-mono">Roll: {rollCode}</span>
                </div>
              </div>
              <button
                onClick={() => setIsMobilePaletteOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white font-bold text-base px-1"
              >
                ✕
              </button>
            </div>

            <h2 className={`text-[11px] font-black uppercase tracking-wider border-b pb-1.5 ${isDarkExam ? 'text-slate-400 border-white/[0.08]' : 'text-slate-700 border-slate-200'}`}>
              {isSubmitted ? 'Solution Palette' : `Section Palette (${sectionQuestions.length} Qs)`}
            </h2>

            {/* TCS iON LEGEND */}
            <div
              className={`grid grid-cols-2 gap-2 text-[10px] font-bold p-3 rounded-xl border ${
                isDarkExam
                  ? 'bg-slate-950/80 border-white/[0.08] text-slate-300'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-emerald-600 text-white rounded flex items-center justify-center text-[9px] font-bold">
                  {counts.answered}
                </span>{' '}
                Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-rose-600 text-white rounded flex items-center justify-center text-[9px] font-bold">
                  {counts.notAnswered}
                </span>{' '}
                Not Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 bg-purple-600 text-white rounded flex items-center justify-center text-[9px] font-bold">
                  {counts.marked}
                </span>{' '}
                Marked
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold border ${
                    isDarkExam ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-slate-100 border-slate-400 text-slate-700'
                  }`}
                >
                  {counts.notVisited}
                </span>{' '}
                Not Visited
              </span>

              <span className="flex items-center gap-1.5 col-span-2 pt-0.5">
                <span className="w-4 h-4 bg-purple-600 text-white rounded flex items-center justify-center text-[8px] relative overflow-visible font-bold">
                  {counts.answeredMarked}
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full border border-white"></span>
                </span>
                Answered &amp; Marked for Review
              </span>
            </div>

            {/* PALETTE GRID BUTTONS */}
            <div className="grid grid-cols-5 gap-1.5 max-h-60 overflow-y-auto p-1 custom-scrollbar">
              {activeSectionQuestionIndices.map((globalIdx, localIdx) => {
                const isAns = selectedAnswers[globalIdx] !== undefined;
                const isVisited = visitedQuestions[globalIdx];
                const isMarked = markedForReview[globalIdx];
                const isActive = activeIndex === globalIdx;

                let paletteStyle = isDarkExam
                  ? 'bg-slate-800/90 border-white/[0.08] text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-300 text-slate-700';

                if (isSubmitted) {
                  const userAns = selectedAnswers[globalIdx];
                  const qCorrect = questions[globalIdx].correctOptionIndex;
                  if (userAns === undefined) {
                    paletteStyle = isDarkExam
                      ? 'bg-slate-800/60 border-white/[0.08] text-slate-400'
                      : 'bg-white border-slate-300 text-slate-600';
                  } else if (userAns === qCorrect) {
                    paletteStyle = 'bg-emerald-600 text-white border-emerald-500 font-bold';
                  } else {
                    paletteStyle = 'bg-rose-600 text-white border-rose-500 font-bold';
                  }
                } else {
                  if (isAns && isMarked) {
                    paletteStyle = 'bg-purple-600 text-white border-purple-500 font-bold relative overflow-visible';
                  } else if (isMarked) {
                    paletteStyle = 'bg-purple-600 text-white border-purple-500 font-bold';
                  } else if (isAns) {
                    paletteStyle = 'bg-emerald-600 text-white border-emerald-500 font-bold';
                  } else if (isVisited) {
                    paletteStyle = 'bg-rose-600 text-white border-rose-500 font-bold';
                  }
                }

                return (
                  <button
                    key={globalIdx}
                    onClick={() => handleSelectQuestion(globalIdx)}
                    className={`h-9 rounded-lg text-xs font-bold transition flex items-center justify-center border shadow-sm relative ${paletteStyle} ${
                      isActive ? 'ring-2 ring-amber-400 font-black z-10 scale-105' : ''
                    }`}
                  >
                    {localIdx + 1}

                    {!isSubmitted && isAns && isMarked && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-sm z-20"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {!isSubmitted ? (
            <button
              onClick={handleSubmitFullTest}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs rounded-xl uppercase tracking-wider transition shadow-lg shadow-emerald-600/25 shrink-0"
            >
              Submit Entire Exam
            </button>
          ) : (
            <Link
              href={`/mock-test/${test.id}/result`}
              className="block text-center w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl uppercase tracking-wider transition shadow-lg shrink-0"
            >
              📊 View Scorecard &amp; Rank
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

