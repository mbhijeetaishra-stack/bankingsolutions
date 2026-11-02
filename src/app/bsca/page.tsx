'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import BscaPaywall from '@/components/BscaPaywall';
import ThemeToggle from '@/components/ThemeToggle';
import { BscaAccessState, checkBscaAccess } from '@/lib/bscaAccess';
import {
  BSCA_CATEGORIES,
  BscaArticle,
  BscaCapsule,
  BscaCategory,
  BscaDayPdf,
  fetchBscaArticles,
  fetchBscaCapsules,
  fetchBscaDayPdfs,
  getBscaReadArticles,
  getCategoryMeta,
  getPdfYearAndMonth,
  MONTH_NAMES,
  toggleMarkArticleRead,
} from '@/lib/bsca';
import { NotebookItem, getNotebookItems, recordMistakeQuestions, toggleBookmarkQuestion } from '@/lib/notebook';

type BscaTab = 'digest' | 'daypdfs' | 'quiz' | 'capsules' | 'vault';
type ReadingMode = 'editorial' | 'oneliner';

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

export default function BscaUnifiedPage() {
  const [activeTab, setActiveTab] = useState<BscaTab>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const tabParam = p.get('tab') as BscaTab;
      if (tabParam && ['digest', 'daypdfs', 'quiz', 'capsules', 'vault'].includes(tabParam)) {
        return tabParam;
      }
    }
    return 'digest';
  });
  const [readingMode, setReadingMode] = useState<ReadingMode>('editorial');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Auth & Access
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [access, setAccess] = useState<BscaAccessState | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Content
  const [articles, setArticles] = useState<BscaArticle[]>([]);
  const [capsules, setCapsules] = useState<BscaCapsule[]>([]);
  const [dayPdfs, setDayPdfs] = useState<BscaDayPdf[]>([]);
  const [readArticleIds, setReadArticleIds] = useState<Set<string>>(new Set());
  const [loadingContent, setLoadingContent] = useState(true);

  // Digest Filters
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const dateParam = p.get('date');
      if (dateParam) return dateParam;
    }
    return '';
  });
  const [selectedCategory, setSelectedCategory] = useState<BscaCategory | 'ALL'>('ALL');
  const [expandedGk, setExpandedGk] = useState<Record<string, boolean>>({});

  // Day PDFs Filters (AffairsCloud Style)
  const [pdfMonthFilter, setPdfMonthFilter] = useState('ALL');
  const [pdfYearFilter, setPdfYearFilter] = useState('ALL');
  const [pdfSearchQuery, setPdfSearchQuery] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState<string>('BSCA Current Affairs PDF');
  const [previewPdfAltUrl, setPreviewPdfAltUrl] = useState<string | null>(null);
  const [previewPdfAltLabel, setPreviewPdfAltLabel] = useState<string | null>(null);
  const [pdfLangFilter, setPdfLangFilter] = useState<'ALL' | 'EN' | 'HI'>('ALL');

  const openPdfViewer = (
    url: string,
    title: string,
    altUrl?: string | null,
    altLabel?: string | null
  ) => {
    setPreviewPdfUrl(url);
    setPreviewPdfTitle(title);
    setPreviewPdfAltUrl(altUrl || null);
    setPreviewPdfAltLabel(altLabel || null);
  };

  // Quiz States
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState<Record<string, QuizAttempt>>({});
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentAnswers, setCurrentAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRef = useRef<() => void>(() => {});
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    const savedVault = getNotebookItems();
    const bm: Record<string, boolean> = {};
    savedVault.forEach((item) => {
      bm[item.id] = true;
    });
    return bm;
  });

  // Vault Search
  const [vaultQuery, setVaultQuery] = useState('');
  const [vaultCategory, setVaultCategory] = useState<string>('ALL');

  // Copy feedback
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const fetchQuizzesAndAttempts = useCallback(async (userId?: string) => {
    const { data: quizData } = await supabase
      .from('bsca_quizzes')
      .select('*')
      .order('quiz_date', { ascending: false });

    if (quizData) setQuizzes(quizData as Quiz[]);

    let attemptsMap: Record<string, QuizAttempt> = {};
    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_quiz_attempts') || '{}');
      attemptsMap = { ...localSaved };
    } catch {}

    if (userId) {
      const { data: attemptData } = await supabase
        .from('bsca_quiz_attempts')
        .select('*')
        .eq('user_id', userId);

      if (attemptData) {
        attemptData.forEach((att: { quiz_id: string; answers: Record<number, number>; score: number; total_questions: number }) => {
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
  }, []);

  const refreshAccess = useCallback(async () => {
    const state = await checkBscaAccess();
    setAccess(state);
    setCurrentUser(state.user || null);
    void fetchQuizzesAndAttempts(state.user?.id);
    return state;
  }, [fetchQuizzesAndAttempts]);

  // Initial Load
  useEffect(() => {
    let active = true;
    const initializePage = async () => {
      const state = await checkBscaAccess();
      if (!active) return;
      setAccess(state);
      setCurrentUser(state.user || null);
      void fetchQuizzesAndAttempts(state.user?.id);

      setLoadingContent(true);
      const [arts, caps, pdfList] = await Promise.all([
        fetchBscaArticles(),
        fetchBscaCapsules(),
        fetchBscaDayPdfs(),
      ]);
      if (!active) return;
      setArticles(arts);
      setCapsules(caps);
      setDayPdfs(pdfList);

      if (arts.length > 0) {
        setSelectedDate((prev) => prev || arts[0].date);
      } else if (pdfList.length > 0) {
        setSelectedDate((prev) => prev || pdfList[0].release_date);
      } else {
        setSelectedDate(new Date().toISOString().slice(0, 10));
      }

      setReadArticleIds(new Set(getBscaReadArticles()));
      setLoadingContent(false);
    };

    void initializePage();

    return () => {
      active = false;
    };
  }, [fetchQuizzesAndAttempts]);

  // Quiz Timer
  useEffect(() => {
    if (activeQuiz && !quizSubmitted && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            autoSubmitRef.current();
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

  // Derived: Available Dates (Articles + Day PDFs)
  const availableDates = useMemo(() => {
    const set = new Set([...articles.map((a) => a.date), ...dayPdfs.map((p) => p.release_date)]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [articles, dayPdfs]);

  // Derived: Current Date Articles
  const currentDateArticles = useMemo(() => {
    return articles
      .filter((a) => a.date === selectedDate)
      .filter((a) => (selectedCategory === 'ALL' ? true : a.category === selectedCategory));
  }, [articles, selectedDate, selectedCategory]);

  // Lead Feature Story for Selected Date
  const leadStory = useMemo(() => {
    const forDate = articles.filter((a) => a.date === selectedDate);
    return forDate.find((a) => a.isFeaturedHero) || forDate[0] || null;
  }, [articles, selectedDate]);

  // Other Stories
  const feedArticles = useMemo(() => {
    if (readingMode === 'oneliner' || selectedCategory !== 'ALL' || !leadStory) {
      return currentDateArticles;
    }
    return currentDateArticles.filter((a) => a.id !== leadStory.id);
  }, [currentDateArticles, leadStory, readingMode, selectedCategory]);

  // Matching Quiz for Selected Date
  const currentMatchingQuiz = useMemo(() => {
    return quizzes.find((q) => q.quiz_date === selectedDate);
  }, [quizzes, selectedDate]);

  // Matching Day-Wise PDF for Selected Date
  const matchingDayPdf = useMemo(() => {
    return dayPdfs.find(
      (p) => p.release_date === selectedDate || p.title.toLowerCase().includes(selectedDate.toLowerCase())
    );
  }, [dayPdfs, selectedDate]);

  // Derived: Available Years from Day PDFs
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    dayPdfs.forEach((p) => {
      const { year } = getPdfYearAndMonth(p);
      if (year) years.add(year);
    });
    years.add('2026');
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [dayPdfs]);

  // Filtered Day PDFs (AffairsCloud style with Month & Year filters + Hindi Language Filter)
  const filteredDayPdfs = useMemo(() => {
    const q = pdfSearchQuery.trim().toLowerCase();
    return dayPdfs.filter((p) => {
      const { year, monthIndex, monthName } = getPdfYearAndMonth(p);
      if (pdfYearFilter !== 'ALL' && year !== pdfYearFilter) return false;
      if (pdfMonthFilter !== 'ALL') {
        const matchesIndex = String(monthIndex) === pdfMonthFilter;
        const matchesName = monthName.toLowerCase() === pdfMonthFilter.toLowerCase();
        const matchesTitle = p.monthTitle.toLowerCase().includes(pdfMonthFilter.toLowerCase());
        if (!matchesIndex && !matchesName && !matchesTitle) return false;
      }
      if (pdfLangFilter === 'HI' && !p.pdf_hindi_url) return false;
      if (!q) return true;
      const inTitle = p.title.toLowerCase().includes(q);
      const inTopics = (p.topic_list || '').toLowerCase().includes(q);
      const inDate = p.release_date.includes(q);
      return inTitle || inTopics || inDate;
    });
  }, [dayPdfs, pdfMonthFilter, pdfYearFilter, pdfSearchQuery, pdfLangFilter]);

  // Vault Results
  const vaultResults = useMemo(() => {
    const q = vaultQuery.trim().toLowerCase();
    if (!q) return [];
    return articles.filter((a) => {
      if (vaultCategory !== 'ALL' && a.category !== vaultCategory) return false;
      const inTitle = a.title.toLowerCase().includes(q);
      const inBullets = a.bullets.some((b) => b.toLowerCase().includes(q));
      const inGk = a.staticGk.some((g) => g.key.toLowerCase().includes(q) || g.value.toLowerCase().includes(q));
      return inTitle || inBullets || inGk;
    });
  }, [articles, vaultQuery, vaultCategory]);

  // Reading Progress for Current Date
  const dateArticlesTotal = useMemo(() => {
    return articles.filter((a) => a.date === selectedDate).length;
  }, [articles, selectedDate]);

  const dateArticlesRead = useMemo(() => {
    return articles.filter((a) => a.date === selectedDate && readArticleIds.has(a.id)).length;
  }, [articles, selectedDate, readArticleIds]);

  // ---------------- Actions ----------------
  const handleToggleRead = (id: string) => {
    const isNowRead = toggleMarkArticleRead(id);
    setReadArticleIds((prev) => {
      const copy = new Set(prev);
      if (isNowRead) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  };

  const handleToggleGk = (id: string) => {
    setExpandedGk((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleTopics = (id: string) => {
    setExpandedTopics((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopySummary = (art: BscaArticle) => {
    const text = `${art.title}\n\nKey Takeaways:\n${art.bullets.map((b) => `• ${b}`).join('\n')}\n\nVia BSCA 360 Current Affairs`;
    navigator.clipboard.writeText(text);
    setCopyFeedback(art.id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  // ---------------- Quiz Handlers ----------------
  const handleStartQuiz = async (quiz: Quiz) => {
    const state = access || (await refreshAccess());
    if (!state.hasAccess) {
      setPaywallOpen(true);
      return;
    }

    setActiveQuiz(quiz);
    setCurrentAnswers({});
    setQuizSubmitted(false);

    const { data } = await supabase
      .from('bsca_quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('created_at', { ascending: true });

    if (data) setQuizQuestions(data as QuizQuestion[]);
    setTimeLeft((quiz.duration_minutes || 10) * 60);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewQuizSolution = async (quiz: Quiz) => {
    const state = access || (await refreshAccess());
    if (!state.hasAccess) {
      setPaywallOpen(true);
      return;
    }

    setActiveQuiz(quiz);
    setQuizSubmitted(true);
    const pastAttempt = completedAttempts[quiz.id];
    setCurrentAnswers(pastAttempt?.answers || {});

    const { data } = await supabase
      .from('bsca_quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('created_at', { ascending: true });

    if (data) setQuizQuestions(data as QuizQuestion[]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveQuizAttempt = async (answers: Record<number, number>) => {
    if (!activeQuiz) return;
    let score = 0;
    const wrongQuizItems: NotebookItem[] = [];

    quizQuestions.forEach((q, idx) => {
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
          isBookmarked: false,
          isMistake: true,
          personalNote: '',
          mastered: false,
          savedAt: new Date().toISOString(),
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
      total_questions: quizQuestions.length,
    };

    setCompletedAttempts((prev) => ({ ...prev, [activeQuiz.id]: attemptData }));

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_quiz_attempts') || '{}');
      localSaved[activeQuiz.id] = attemptData;
      localStorage.setItem('bsca_quiz_attempts', JSON.stringify(localSaved));
    } catch {}

    if (currentUser?.id) {
      await supabase.from('bsca_quiz_attempts').upsert([
        {
          user_id: currentUser.id,
          quiz_id: activeQuiz.id,
          answers: answers,
          score: score,
          total_questions: quizQuestions.length,
          completed_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,quiz_id' });
    }
  };

  const handleAutoSubmitQuiz = () => {
    setQuizSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    handleSaveQuizAttempt(currentAnswers);
  };
  useEffect(() => {
    autoSubmitRef.current = handleAutoSubmitQuiz;
  });

  const handleSubmitQuiz = () => {
    setQuizSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    handleSaveQuizAttempt(currentAnswers);
  };

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

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#020617] text-slate-100 font-sans flex flex-col lg:flex-row relative selection:bg-amber-400 selection:text-slate-950">
      {/* Background Glows */}
      <div className="pointer-events-none fixed -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-600/10 blur-[150px] rounded-full z-0" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[500px] h-[350px] bg-amber-500/5 blur-[140px] rounded-full z-0" />

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* LEFT SIDEBAR (Sticky on Desktop, Drawer on Mobile) */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-72 sm:w-80 bg-slate-950/95 lg:bg-slate-950/90 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 h-full ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* SIDEBAR SCROLLABLE CONTENT */}
        <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin">
          {/* Logo / Title */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-sm shadow-md shadow-amber-500/20 hover:scale-105 transition shrink-0"
              >
                BS
              </Link>
              <div>
                <div className="flex items-center gap-1.5">
                  <Link href="/bsca" className="text-sm font-black text-white hover:text-amber-400 transition tracking-tight">
                    BSCA 360°
                  </Link>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    SUITE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Current Affairs & GA Hub</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="lg:hidden w-7 h-7 rounded-lg bg-slate-900 border border-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center text-xs"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Access / Pass Card */}
          {access?.hasAccess ? (
            <div className="p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-400/30 rounded-2xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm">👑</span>
                <div>
                  <div className="text-xs font-black text-amber-300">PASS ACTIVE</div>
                  <div className="text-[10px] text-slate-400">PDFs, GA Quizzes & Capsules Unlocked</div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          ) : (
            <div className="p-3 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-400/40 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30">
                  FREE READER
                </span>
                <button
                  type="button"
                  onClick={() => setPaywallOpen(true)}
                  className="text-[11px] font-black text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
                >
                  Unlock PRO ↗
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Daily Articles & One-Liners are Free. Upgrade for Day PDFs, GA Quizzes & Capsules.
              </p>
            </div>
          )}

          {/* 5-MODE NAVIGATION MENU */}
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 pb-1">
              Modules
            </div>
            {[
              { id: 'digest', label: 'Daily Digest', sub: 'Articles & One-Liners', icon: '📰', badge: 'FREE' },
              { id: 'daypdfs', label: 'Day-Wise CA PDFs', sub: 'Bilingual Study Sheets', icon: '📑', badge: 'PRO' },
              { id: 'quiz', label: 'Daily GA Quiz', sub: 'Real Exam CBT Test', icon: '💡', badge: 'PRO' },
              { id: 'capsules', label: 'Monthly Capsules', sub: 'Compiled Month PDFs', icon: '📚', badge: 'PRO' },
              { id: 'vault', label: 'Search Vault', sub: 'Past CA Repository', icon: '🔍', badge: 'PRO' },
            ].map((t) => {
              const isSelected = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(t.id as BscaTab);
                    setActiveQuiz(null);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between border ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md font-black'
                      : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border-white/[0.06] font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-base shrink-0">{t.icon}</span>
                    <div className="truncate">
                      <div className="text-xs leading-tight truncate">{t.label}</div>
                      <div className={`text-[10px] truncate ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                        {t.sub}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ml-1.5 ${
                      t.badge === 'FREE'
                        ? isSelected
                          ? 'bg-slate-950 text-emerald-300'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isSelected
                        ? 'bg-slate-950 text-amber-300'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}
                  >
                    {t.badge}
                  </span>
                </button>
              );
            })}

            {/* Daily CA Boss Raid Direct Launch Card */}
            <Link
              href={`/ca-raid?date=${selectedDate}`}
              onClick={() => setMobileNavOpen(false)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between border bg-gradient-to-r from-rose-950/60 via-slate-900 to-amber-950/40 hover:border-rose-400/60 border-rose-500/35 text-white font-black shadow-md"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">⚔️</span>
                <div className="truncate">
                  <div className="text-xs leading-tight truncate text-rose-200">
                    The CA Boss Fight
                  </div>
                  <div className="text-[10px] truncate text-slate-400">
                    10-Q Raid • Unlock 1-Page PDF
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ml-1.5 bg-rose-500/25 text-rose-200 border border-rose-500/40">
                RAID
              </span>
            </Link>
          </div>

          {/* Contextual Filters: Daily Digest */}
          {activeTab === 'digest' && (
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-white/[0.08] space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <span>📅</span> Edition Date
                  </label>
                  <span className="text-[10px] font-bold text-amber-400">
                    {dateArticlesRead}/{dateArticlesTotal} Read
                  </span>
                </div>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-950 border border-white/[0.12] rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {availableDates.map((d) => (
                    <option key={d} value={d} className="bg-slate-950 text-white">
                      {d === new Date().toISOString().slice(0, 10) ? `Today (${d})` : d}
                    </option>
                  ))}
                </select>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/[0.08] mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${dateArticlesTotal ? (dateArticlesRead / dateArticlesTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                  🏷️ Category Focus
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as BscaCategory | 'ALL')}
                  className="w-full bg-slate-950 border border-white/[0.12] rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-950 text-white">✨ All Categories</option>
                  {BSCA_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key} className="bg-slate-950 text-white">
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Contextual Filters: Day-Wise PDFs */}
          {activeTab === 'daypdfs' && (
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-white/[0.08] space-y-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                📑 Quick Filters
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Year</label>
                  <select
                    value={pdfYearFilter}
                    onChange={(e) => setPdfYearFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-white/[0.12] rounded-xl px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">All Years</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Month</label>
                  <select
                    value={pdfMonthFilter}
                    onChange={(e) => setPdfMonthFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-white/[0.12] rounded-xl px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="ALL">All Months</option>
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={String(idx)}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="p-3 border-t border-white/[0.08] space-y-2 shrink-0 bg-slate-950/90">
          <div className="flex items-center justify-between text-xs">
            {currentUser ? (
              <div className="truncate text-slate-300 font-bold text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow text-center"
              >
                Sign In
              </button>
            )}
          </div>
          {/* Theme Toggle Switch */}
          <ThemeToggle variant="sidebar" />

          <div className="flex items-center gap-2 pt-1">
            <Link
              href="/notebook"
              className="flex-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-amber-400/30 text-amber-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              title="Open Revision Notebook"
            >
              <span>🔖</span> Notebook
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 font-bold text-xs rounded-xl transition"
            >
              Home
            </Link>
          </div>
        </div>
      </aside>

      {/* RIGHT CONTENT VIEWPORT (Scrolls Independently) */}
      <div className="flex-1 min-w-0 lg:h-screen lg:overflow-y-auto scrollbar-thin flex flex-col bg-[#020617]">
        {/* VIEWPORT TOP STICKY BAR */}
        <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-white/[0.08] text-amber-400 hover:text-amber-300 shrink-0"
              aria-label="Open Sidebar Menu"
            >
              ☰
            </button>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-white truncate flex items-center gap-2">
                {activeTab === 'digest' && (
                  <>
                    <span>📰 Daily Digest</span>
                    <span className="text-xs font-medium text-slate-400 hidden sm:inline">
                      · {selectedDate ? new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}
                    </span>
                  </>
                )}
                {activeTab === 'daypdfs' && '📑 Day-Wise CA PDFs (AffairsCloud Style)'}
                {activeTab === 'quiz' && '💡 Daily GA Real-Exam Quizzes'}
                {activeTab === 'capsules' && '📚 Monthly Current Affairs Capsules'}
                {activeTab === 'vault' && '🔍 Search Vault & Archives'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'digest' && (
              <>
                <div className="flex bg-slate-900/90 border border-white/[0.08] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReadingMode('editorial')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      readingMode === 'editorial' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Full Editorial Cards"
                  >
                    📖 Full Read
                  </button>
                  <button
                    type="button"
                    onClick={() => setReadingMode('oneliner')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                      readingMode === 'oneliner' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    title="High-Speed One-Liner Rapid Revision"
                  >
                    <span>⚡ One-Liners</span>
                  </button>
                </div>

                <div className="hidden sm:flex bg-slate-900/90 border border-white/[0.08] p-1 rounded-xl text-xs font-bold text-slate-400">
                  <button
                    type="button"
                    onClick={() => setFontSize('sm')}
                    className={`px-2 py-0.5 rounded ${fontSize === 'sm' ? 'bg-slate-800 text-white' : 'hover:text-white'}`}
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('base')}
                    className={`px-2 py-0.5 rounded ${fontSize === 'base' ? 'bg-slate-800 text-white' : 'hover:text-white'}`}
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('lg')}
                    className={`px-2 py-0.5 rounded ${fontSize === 'lg' ? 'bg-slate-800 text-white' : 'hover:text-white'}`}
                  >
                    A+
                  </button>
                </div>

                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-400/30 text-amber-300 text-xs font-bold">
                  <span>🔥</span>
                  <span>{readArticleIds.size} Read</span>
                </div>
              </>
            )}

            {/* Theme Toggle */}
            <ThemeToggle variant="switch" />

            {!currentUser && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="hidden lg:inline-block px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* MAIN CONTENT CANVAS */}
        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: DAILY DIGEST (FREE MAGAZINE FEED)                                  */}
        {/* ========================================================================= */}
        {activeTab === 'digest' && (
          <div className="space-y-6">
            {/* 1. DATE RIBBON */}
            <div className="bg-slate-900/75 backdrop-blur-md border border-white/[0.08] rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1.5">
                  <span>📅</span> Edition:
                </span>
                {availableDates.slice(0, 8).map((d) => {
                  const isSelected = d === selectedDate;
                  const dateObj = new Date(d);
                  const isToday = d === new Date().toISOString().slice(0, 10);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/10'
                          : 'bg-slate-950 text-slate-300 border-white/[0.08] hover:border-amber-400/40 hover:text-white'
                      }`}
                    >
                      <span>{isToday ? 'Today' : dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Progress pill */}
              <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
                <span className="text-xs text-slate-400">
                  <strong className="text-amber-400">{dateArticlesRead}</strong> of {dateArticlesTotal} Read
                </span>
                <div className="w-24 h-2 bg-slate-950 rounded-full overflow-hidden border border-white/[0.08]">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${dateArticlesTotal ? (dateArticlesRead / dateArticlesTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 2. MATCHING DAY-WISE PDF PROMOTION BANNER (If Available for Selected Date) */}
            {matchingDayPdf && (
              <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 border border-amber-400/40 p-5 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center text-2xl font-black shrink-0 border border-amber-400/30">
                    📄
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/20 text-amber-300">
                        Day {matchingDayPdf.day_number} PDF
                      </span>
                      <span className="text-xs text-slate-400">Official BankingSolutions CA Sheet</span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-white mt-0.5">{matchingDayPdf.title}</h4>
                    <p className="text-xs text-slate-300">
                      Download the full day-wise PDF sheet with bilingual explanations and key facts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!access?.hasAccess ? (
                    <button
                      type="button"
                      onClick={() => setPaywallOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5"
                    >
                      <span>🔒</span>
                      <span>Unlock Day PDF (Pass)</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* English Actions */}
                      <button
                        type="button"
                        onClick={() => openPdfViewer(
                          matchingDayPdf.pdf_url,
                          `${matchingDayPdf.title} (English)`,
                          matchingDayPdf.pdf_hindi_url || null,
                          matchingDayPdf.pdf_hindi_url ? '🇮🇳 Switch to हिन्दी PDF' : null
                        )}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/[0.1] text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                        title="Read English Current Affairs PDF online"
                      >
                        <span>👁️ Read (EN)</span>
                      </button>
                      <a
                        href={matchingDayPdf.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5"
                        title="Download English PDF"
                      >
                        <span>📥 Download (EN)</span>
                      </a>

                      {/* Hindi Actions (if available) */}
                      {matchingDayPdf.pdf_hindi_url ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openPdfViewer(
                              matchingDayPdf.pdf_hindi_url!,
                              `${matchingDayPdf.title} (हिन्दी)`,
                              matchingDayPdf.pdf_url,
                              '🇬🇧 Switch to English PDF'
                            )}
                            className="px-3.5 py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center gap-1.5"
                            title="Read Hindi Current Affairs PDF online"
                          >
                            <span>🇮🇳 Read (हिन्दी)</span>
                          </button>
                          <a
                            href={matchingDayPdf.pdf_hindi_url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs shadow-md transition flex items-center gap-1.5"
                            title="Download Hindi PDF"
                          >
                            <span>🇮🇳 Download (हिन्दी)</span>
                          </a>
                        </>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-950 px-2.5 py-1 rounded-xl border border-white/[0.08]">
                          🇬🇧 English Medium
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. CATEGORY PILL SELECTOR */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition ${
                  selectedCategory === 'ALL'
                    ? 'bg-white text-slate-950 border-white shadow-sm font-black'
                    : 'bg-slate-900/60 text-slate-400 border-white/[0.06] hover:text-white'
                }`}
              >
                All Topics ({articles.filter((a) => a.date === selectedDate).length})
              </button>
              {BSCA_CATEGORIES.map((cat) => {
                const count = articles.filter((a) => a.date === selectedDate && a.category === cat.key).length;
                if (count === 0 && selectedCategory !== cat.key) return null;
                const isSel = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition flex items-center gap-1.5 ${
                      isSel ? cat.badgeCls + ' shadow-sm font-black' : 'bg-slate-900/60 text-slate-400 border-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* 4. TWO-COLUMN EDITORIAL DESKTOP LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
              {/* LEFT COLUMN: ARTICLES STREAM */}
              <div className="space-y-6">
                {/* LEAD FEATURE STORY */}
                {readingMode === 'editorial' && selectedCategory === 'ALL' && leadStory && (
                  <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-2xl">
                    <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

                    <div className="relative z-10 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-sm flex items-center gap-1">
                            <span>⚡</span> LEAD EDITORIAL
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getCategoryMeta(leadStory.category).badgeCls}`}>
                            {getCategoryMeta(leadStory.category).icon} {getCategoryMeta(leadStory.category).label}
                          </span>
                        </div>
                        <span className="text-[11px] text-amber-300 font-bold">⏱️ {leadStory.readTimeMin || 2} min read</span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                        {leadStory.title}
                      </h2>

                      {leadStory.keyStats && leadStory.keyStats.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {leadStory.keyStats.map((stat, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-3 py-1 rounded-xl text-xs font-black bg-amber-400/10 text-amber-300 border border-amber-400/25"
                            >
                              📊 {stat}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2.5 pt-1">
                        {leadStory.bullets.map((b, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                            <span className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0 shadow-sm shadow-amber-400/50" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>

                      {leadStory.staticGk && leadStory.staticGk.length > 0 && (
                        <div className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-2.5 mt-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                            <span>💡</span> Static Exam Notes (High-Yield Facts)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {leadStory.staticGk.map((gk, gIdx) => (
                              <div key={gIdx} className="text-xs bg-slate-900/90 border border-white/[0.05] p-2.5 rounded-xl">
                                <span className="text-slate-400 block text-[10px] uppercase font-bold">{gk.key}</span>
                                <span className="text-white font-bold">{gk.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => handleToggleRead(leadStory.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-black border transition flex items-center gap-1.5 ${
                            readArticleIds.has(leadStory.id)
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-900 border-white/[0.1] text-slate-300 hover:text-white'
                          }`}
                        >
                          <span>{readArticleIds.has(leadStory.id) ? '✓ Completed' : '○ Mark as Read'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySummary(leadStory)}
                          className="text-xs text-slate-400 hover:text-amber-400 font-bold transition flex items-center gap-1"
                        >
                          <span>{copyFeedback === leadStory.id ? '✓ Copied!' : '📋 Copy Summary'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ARTICLES STREAM */}
                {loadingContent ? (
                  <div className="py-24 text-center text-xs font-bold uppercase tracking-widest text-slate-500 animate-pulse">
                    Loading Current Affairs Feed…
                  </div>
                ) : feedArticles.length === 0 && (!leadStory || readingMode === 'oneliner') ? (
                  <div className="bg-slate-900/40 border border-white/[0.08] rounded-3xl p-12 text-center space-y-3">
                    <div className="text-4xl">📰</div>
                    <h3 className="font-bold text-white text-base">No articles found for {selectedDate}</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Choose another date from the ribbon above or explore the Day-Wise PDF tab.
                    </p>
                  </div>
                ) : readingMode === 'oneliner' ? (
                  /* RAPID ONE-LINER VIEW */
                  <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-5">
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                          ⚡ Exam-Day Rapid Revision Sheet
                        </span>
                        <h3 className="text-base sm:text-lg font-black text-white">
                          One-Liner Bullets · {selectedDate}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400">{feedArticles.length} Key Points</span>
                    </div>

                    <div className="divide-y divide-white/[0.06] space-y-3">
                      {currentDateArticles.map((art, idx) => {
                        const meta = getCategoryMeta(art.category);
                        return (
                          <div key={art.id} className="pt-3 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${meta.badgeCls}`}>
                                {meta.label}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white">{art.title}</h4>
                            <p className="text-xs text-slate-300 leading-relaxed">{art.bullets[0]}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* STANDARD EDITORIAL STREAM */
                  <div className="space-y-5">
                    {feedArticles.map((art) => {
                      const meta = getCategoryMeta(art.category);
                      const isRead = readArticleIds.has(art.id);
                      const gkOpen = !!expandedGk[art.id];

                      return (
                        <article
                          key={art.id}
                          className={`bg-slate-900/75 border-l-4 ${meta.borderCls} border rounded-3xl p-6 sm:p-7 space-y-4 transition-all shadow-xl ${
                            isRead ? 'border-white/[0.05] bg-slate-900/50 opacity-90' : 'border-white/[0.08] hover:border-amber-400/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${meta.badgeCls}`}>
                                <span>{meta.icon}</span>
                                <span>{meta.label}</span>
                              </span>
                              {art.importance === 'HIGH' && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/25">
                                  ★ High Yield
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">⏱️ {art.readTimeMin || 2} min read</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleToggleRead(art.id)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                                isRead
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-950 border-white/[0.08] text-slate-400 hover:text-white'
                              }`}
                            >
                              <span>{isRead ? '✓ Completed' : '○ Mark as Read'}</span>
                            </button>
                          </div>

                          <h3
                            className={`font-black text-white leading-snug tracking-tight ${
                              fontSize === 'sm' ? 'text-base sm:text-lg' : fontSize === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                            }`}
                          >
                            {art.title}
                          </h3>

                          {art.keyStats && art.keyStats.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              {art.keyStats.map((st, i) => (
                                <span key={i} className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-950 border border-white/[0.08] text-amber-300">
                                  {st}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="space-y-2 pt-1">
                            {art.bullets.map((b, idx) => (
                              <div
                                key={idx}
                                className={`flex items-start gap-2.5 text-slate-300 leading-relaxed ${
                                  fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base' : 'text-xs sm:text-sm'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                                <span>{b}</span>
                              </div>
                            ))}
                          </div>

                          {art.staticGk && art.staticGk.length > 0 && (
                            <div className="pt-2">
                              <div className="bg-slate-950/75 border border-white/[0.06] rounded-2xl p-4 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                                    <span>💡</span> Static GK Exam Booster
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleGk(art.id)}
                                    className="text-[10px] font-bold text-slate-400 hover:text-white"
                                  >
                                    {gkOpen ? 'Collapse ▲' : `View All (${art.staticGk.length}) ▼`}
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {(!gkOpen ? art.staticGk.slice(0, 2) : art.staticGk).map((gk, gIdx) => (
                                    <div key={gIdx} className="text-xs bg-slate-900/60 p-2 rounded-xl flex items-center gap-2">
                                      <strong className="text-slate-400 font-bold shrink-0">{gk.key}:</strong>
                                      <span className="text-amber-200 truncate">{gk.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs text-slate-400">
                            <span className="text-[11px] text-slate-500">BankingSolutions Exam Prep</span>
                            <button
                              type="button"
                              onClick={() => handleCopySummary(art)}
                              className="hover:text-amber-400 font-bold transition flex items-center gap-1"
                            >
                              <span>{copyFeedback === art.id ? '✓ Copied' : '📋 Copy Summary'}</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT SIDEBAR */}
              <aside className="space-y-6 lg:sticky lg:top-24">
                {/* 1. Day-Wise PDF Quick Card */}
                {matchingDayPdf ? (
                  <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">
                        📄 Day {matchingDayPdf.day_number} PDF
                      </span>
                      <span className="text-xs text-emerald-400 font-bold">Free Download</span>
                    </div>
                    <h4 className="text-sm font-black text-white">{matchingDayPdf.title}</h4>
                    <p className="text-xs text-slate-400">
                      Download the complete PDF study sheet for {selectedDate}.
                    </p>
                    <div className="space-y-2 pt-1">
                      <a
                        href={matchingDayPdf.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition"
                      >
                        <span>📥 Download English PDF</span>
                      </a>
                      {matchingDayPdf.pdf_hindi_url && (
                        <a
                          href={matchingDayPdf.pdf_hindi_url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow transition"
                        >
                          <span>🇮🇳 Download हिन्दी PDF</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-5 text-center space-y-2">
                    <div className="text-2xl">📑</div>
                    <h4 className="text-sm font-bold text-white">Day-Wise CA PDF Bank</h4>
                    <p className="text-xs text-slate-400">
                      Browse and download all {dayPdfs.length} day-wise PDFs in our archive.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('daypdfs')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs rounded-xl transition"
                    >
                      Open PDF Bank ({dayPdfs.length}) →
                    </button>
                  </div>
                )}

                {/* 1B. Daily CA Boss Raid Challenge Card */}
                <div className="bg-gradient-to-br from-rose-950/40 via-slate-900 to-amber-950/30 border border-rose-500/35 rounded-3xl p-6 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/35">
                      ⚔️ Daily CA Raid
                    </span>
                    <span className="text-[11px] font-bold text-amber-300">🏅 3-Min Badge</span>
                  </div>
                  <h4 className="text-base font-black text-white">The CA Boss Fight ({selectedDate})</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Choose a specific Date or Month Boss Fight, drain the Community Boss HP bar, and unlock the 1-Page Revision PDF!
                  </p>
                  <Link
                    href={`/ca-raid?date=${selectedDate}`}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-amber-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg transition"
                  >
                    <span>⚔️ Enter Daily Boss Raid →</span>
                  </Link>
                </div>

                {/* 2. Today's Daily GA Quiz Widget */}
                {currentMatchingQuiz ? (
                  <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20 border border-amber-400/30 rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                        ⚡ Retain Today&apos;s News
                      </span>
                      <span className="text-xs text-slate-400">⏱️ {currentMatchingQuiz.duration_minutes || 10} min</span>
                    </div>

                    <div>
                      <h4 className="text-base font-black text-white">{currentMatchingQuiz.title}</h4>
                      <p className="text-xs text-slate-300 mt-1">
                        10 questions sampled directly from today’s current affairs.
                      </p>
                    </div>

                    {completedAttempts[currentMatchingQuiz.id] ? (
                      <div className="space-y-3 pt-1">
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">Your Last Score:</span>
                          <span className="text-base font-black text-emerald-400">
                            {completedAttempts[currentMatchingQuiz.id].score} / {completedAttempts[currentMatchingQuiz.id].total_questions}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('quiz');
                              handleStartQuiz(currentMatchingQuiz);
                            }}
                            className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition"
                          >
                            Reattempt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('quiz');
                              handleViewQuizSolution(currentMatchingQuiz);
                            }}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/[0.1] text-slate-300 text-xs font-bold hover:text-white"
                          >
                            Solutions
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('quiz');
                          handleStartQuiz(currentMatchingQuiz);
                        }}
                        className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
                      >
                        <span>▶ Start Today’s GA Quiz</span>
                      </button>
                    )}
                  </div>
                ) : null}

                {/* 3. Daily Consistency & Goal Widget */}
                <div className="bg-slate-900/70 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl font-black text-slate-950">
                      🔥
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Consistency Goal</span>
                      <h4 className="text-sm font-black text-white">Daily Reading Streak</h4>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Today&apos;s Completion</span>
                      <span className="text-amber-400 font-bold">
                        {dateArticlesTotal ? Math.round((dateArticlesRead / dateArticlesTotal) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/[0.08]">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                        style={{ width: `${dateArticlesTotal ? (dateArticlesRead / dateArticlesTotal) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Reading current affairs daily is the single highest ROI activity for SBI &amp; IBPS PO Mains selection.
                  </p>
                </div>

                {/* 4. Trending Exam Keywords */}
                <div className="bg-slate-900/50 border border-white/[0.06] rounded-3xl p-5 space-y-2.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    🔥 Trending Banking Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['#ProjectFinance', '#Saarthi3', '#RuPayUAE', '#WorldBankGDP', '#NaBFID', '#RBIRate', '#NetZero2070'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setVaultQuery(tag.replace('#', ''));
                          setActiveTab('vault');
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-950 border border-white/[0.08] text-slate-300 hover:text-amber-300 hover:border-amber-400/40 transition"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DAY-WISE CA PDFS (AFFAIRSCLOUD-STYLE ARCHIVE)                       */}
        {/* ========================================================================= */}
        {activeTab === 'daypdfs' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-950 p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      📑 Official Day-Wise PDF Archive
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      PRO PASS
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white">
                    Daily Current Affairs PDF Schedule
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Download official BankingSolutions Day-Wise current affairs PDFs for SBI PO, IBPS PO, RRB &amp; RBI Grade B exams. Includes bilingual explanations, exam one-liners, and key topic checklists.
                  </p>
                </div>

                {access && !access.hasAccess && (
                  <button
                    type="button"
                    onClick={() => setPaywallOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shrink-0 shadow-md flex items-center gap-1.5 transition"
                  >
                    <span>👑</span>
                    <span>Unlock Day PDFs with Pass</span>
                  </button>
                )}
              </div>

              {/* Month & Year Dropdown Filters + Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 mt-6 border-t border-white/[0.08]">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Select Month Dropdown */}
                  <div className="flex items-center gap-2 bg-slate-950/90 border border-white/[0.1] hover:border-amber-400/50 focus-within:border-amber-400 rounded-xl px-3 py-1.5 transition">
                    <span className="text-[11px] font-bold text-slate-400">Month:</span>
                    <select
                      value={pdfMonthFilter}
                      onChange={(e) => setPdfMonthFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-slate-950 text-white">All Months</option>
                      {MONTH_NAMES.map((name, idx) => {
                        const count = dayPdfs.filter((p) => {
                          const { year, monthIndex } = getPdfYearAndMonth(p);
                          if (pdfYearFilter !== 'ALL' && year !== pdfYearFilter) return false;
                          return monthIndex === idx;
                        }).length;
                        return (
                          <option key={name} value={String(idx)} className="bg-slate-950 text-white">
                            {name} {count > 0 ? `(${count})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Select Year Dropdown */}
                  <div className="flex items-center gap-2 bg-slate-950/90 border border-white/[0.1] hover:border-amber-400/50 focus-within:border-amber-400 rounded-xl px-3 py-1.5 transition">
                    <span className="text-[11px] font-bold text-slate-400">Year:</span>
                    <select
                      value={pdfYearFilter}
                      onChange={(e) => setPdfYearFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-slate-950 text-white">All Years</option>
                      {availableYears.map((y) => {
                        const count = dayPdfs.filter((p) => {
                          const { year } = getPdfYearAndMonth(p);
                          return year === y;
                        }).length;
                        return (
                          <option key={y} value={y} className="bg-slate-950 text-white">
                            {y} {count > 0 ? `(${count})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Language Medium Filter */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-white/[0.08] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPdfLangFilter('ALL')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                        pdfLangFilter === 'ALL'
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfLangFilter('EN')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                        pdfLangFilter === 'EN'
                          ? 'bg-amber-400 text-slate-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🇬🇧 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setPdfLangFilter('HI')}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                        pdfLangFilter === 'HI'
                          ? 'bg-emerald-500 text-slate-950 font-black'
                          : 'text-emerald-400 hover:text-emerald-300'
                      }`}
                    >
                      <span>🇮🇳 हिन्दी</span>
                      <span className="text-[9px] px-1 py-0.2 bg-emerald-950/60 text-emerald-300 rounded font-black">
                        {dayPdfs.filter((p) => p.pdf_hindi_url).length}
                      </span>
                    </button>
                  </div>

                  {/* Clear / Reset Filter button */}
                  {(pdfMonthFilter !== 'ALL' || pdfYearFilter !== 'ALL' || pdfLangFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setPdfMonthFilter('ALL');
                        setPdfYearFilter('ALL');
                        setPdfLangFilter('ALL');
                      }}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/25 transition flex items-center gap-1"
                      title="Clear Filters"
                    >
                      <span>✕</span>
                      <span>Reset</span>
                    </button>
                  )}

                  <span className="text-[11px] text-slate-400 font-bold hidden md:inline ml-1">
                    Showing <strong className="text-amber-400">{filteredDayPdfs.length}</strong> of {dayPdfs.length} PDFs
                  </span>
                </div>

                <div className="relative sm:w-64">
                  <input
                    type="text"
                    placeholder="Search topics (e.g. Ladakh, ADB, RBI)..."
                    value={pdfSearchQuery}
                    onChange={(e) => setPdfSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-1.5 text-xs text-white outline-none pl-8 placeholder:text-slate-500"
                  />
                  <span className="absolute left-2.5 top-2 text-xs">🔍</span>
                </div>
              </div>
            </div>

            {/* AffairsCloud-Style Professional List Table */}
            {filteredDayPdfs.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/[0.08] rounded-3xl p-12 text-center space-y-2">
                <div className="text-3xl">📄</div>
                <h4 className="font-bold text-white text-base">No PDFs found</h4>
                <p className="text-xs text-slate-400">Try adjusting your month filter or search query above.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDayPdfs.map((pdf) => {
                  const isTopicsOpen = !!expandedTopics[pdf.id];
                  const topicLines = (pdf.topic_list || '')
                    .split('\n')
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0);

                  return (
                    <div
                      key={pdf.id}
                      className="bg-slate-900/75 border border-white/[0.08] hover:border-amber-400/40 rounded-3xl p-5 sm:p-6 space-y-4 transition-all shadow-xl group"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3.5">
                          {/* Day Number Box */}
                          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/25 text-amber-300 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[9px] font-black uppercase text-amber-400/80">DAY</span>
                            <span className="text-lg font-black leading-none">{String(pdf.day_number).padStart(2, '0')}</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                                {pdf.monthTitle}
                              </span>
                              <span className="text-xs text-slate-400">📅 {pdf.release_date}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/[0.08]">
                                🇬🇧 English
                              </span>
                              {pdf.pdf_hindi_url ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  🇮🇳 हिन्दी Available
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">
                                  (Hindi coming soon)
                                </span>
                              )}
                            </div>
                            <h3 className="font-black text-white text-base sm:text-lg group-hover:text-amber-400 transition">
                              {pdf.title}
                            </h3>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                          <Link
                            href={`/ca-raid?date=${pdf.release_date}`}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1"
                            title="Fight the 10-question Daily Boss Raid sourced from this CA PDF"
                          >
                            <span>⚔️ Boss Raid</span>
                          </Link>
                          {!access?.hasAccess ? (
                            <button
                              type="button"
                              onClick={() => setPaywallOpen(true)}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5"
                            >
                              <span>🔒</span>
                              <span>Unlock PDF (Pass)</span>
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* English Group */}
                              <button
                                type="button"
                                onClick={() => openPdfViewer(
                                  pdf.pdf_url,
                                  `${pdf.title} (English)`,
                                  pdf.pdf_hindi_url || null,
                                  pdf.pdf_hindi_url ? '🇮🇳 Switch to हिन्दी PDF' : null
                                )}
                                className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/[0.1] text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1"
                                title="Read English PDF online"
                              >
                                <span>👁️ Read (EN)</span>
                              </button>
                              <a
                                href={pdf.pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1"
                                title="Download English PDF"
                              >
                                <span>📥 Download (EN)</span>
                              </a>

                              {/* Hindi Group (if available) */}
                              {pdf.pdf_hindi_url && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openPdfViewer(
                                      pdf.pdf_hindi_url!,
                                      `${pdf.title} (हिन्दी)`,
                                      pdf.pdf_url,
                                      '🇬🇧 Switch to English PDF'
                                    )}
                                    className="px-3 py-2 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition flex items-center gap-1"
                                    title="Read Hindi Current Affairs PDF online"
                                  >
                                    <span>🇮🇳 Read (हिन्दी)</span>
                                  </button>
                                  <a
                                    href={pdf.pdf_hindi_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-xs shadow-md transition flex items-center gap-1"
                                    title="Download Hindi PDF"
                                  >
                                    <span>🇮🇳 Download (हिन्दी)</span>
                                  </a>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Topic Highlights */}
                      {topicLines.length > 0 && (
                        <div className="pt-2 border-t border-white/[0.05] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <span>📚</span> Topics Covered in this Sheet:
                            </span>
                            {topicLines.length > 3 && (
                              <button
                                type="button"
                                onClick={() => handleToggleTopics(pdf.id)}
                                className="text-[11px] text-amber-400 font-bold hover:underline"
                              >
                                {isTopicsOpen ? 'Show Less ▲' : `View All (${topicLines.length}) ▼`}
                              </button>
                            )}
                          </div>

                          <div className="space-y-1">
                            {(!isTopicsOpen ? topicLines.slice(0, 3) : topicLines).map((line, lIdx) => (
                              <p key={lIdx} className="text-xs text-slate-300 leading-relaxed">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DAILY GA QUIZ (REAL CBT QUIZ ENGINE)                               */}
        {/* ========================================================================= */}
        {activeTab === 'quiz' && (
          <div className="space-y-6">
            {!activeQuiz ? (
              <div className="space-y-6">
                <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                      💡 Daily Retentive Testing
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white">Daily Banking GA Quizzes</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Attempt timed daily quizzes based on each day’s news. Any incorrect answers automatically sync to your Mistake Notebook.
                    </p>
                  </div>
                  {access && !access.hasAccess && (
                    <button
                      type="button"
                      onClick={() => setPaywallOpen(true)}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shrink-0 shadow-md"
                    >
                      👑 Unlock Quizzes with Pass
                    </button>
                  )}
                </div>

                {quizzes.length === 0 ? (
                  <div className="bg-slate-900/40 border border-white/[0.08] rounded-3xl p-12 text-center space-y-2">
                    <div className="text-4xl">💡</div>
                    <h3 className="font-bold text-white text-base">No Quizzes Published Yet</h3>
                    <p className="text-xs text-slate-400">Upload today’s quiz from the Admin panel to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quizzes.map((quiz) => {
                      const attempt = completedAttempts[quiz.id];
                      return (
                        <div
                          key={quiz.id}
                          className={`bg-slate-900/75 border rounded-3xl p-6 flex flex-col justify-between space-y-4 transition ${
                            attempt ? 'border-emerald-500/30' : 'border-white/[0.08] hover:border-amber-400/40'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/25">
                                📅 {new Date(quiz.quiz_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {attempt && (
                                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  ✓ Score: {attempt.score}/{attempt.total_questions}
                                </span>
                              )}
                            </div>
                            <h3 className="font-black text-white text-base leading-snug">{quiz.title}</h3>
                            <p className="text-xs text-slate-400">⏱️ Duration: {quiz.duration_minutes} Mins</p>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => handleStartQuiz(quiz)}
                              className="flex-1 py-2.5 rounded-xl text-xs font-black transition bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950"
                            >
                              {attempt ? 'Reattempt' : '▶ Start Quiz'}
                            </button>
                            {attempt && (
                              <button
                                type="button"
                                onClick={() => handleViewQuizSolution(quiz)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-950 border border-white/[0.1] text-slate-300 hover:text-white"
                              >
                                View Solutions
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Active Quiz Session */
              <div className="space-y-6">
                <div className="bg-slate-900/90 border border-white/[0.08] rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-16 z-30 backdrop-blur-xl">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white">{activeQuiz.title}</h2>
                    <span className="text-xs text-slate-400">
                      {quizQuestions.length} Questions · {Object.keys(currentAnswers).length} Answered
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {!quizSubmitted && (
                      <div className="px-4 py-2 rounded-xl font-mono font-black text-base bg-slate-950 border border-amber-400/40 text-amber-300">
                        ⏱️ {formatClock(timeLeft)}
                      </div>
                    )}
                    {!quizSubmitted ? (
                      <button
                        type="button"
                        onClick={handleSubmitQuiz}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition"
                      >
                        Submit Test
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveQuiz(null)}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                      >
                        ← Back to Quizzes
                      </button>
                    )}
                  </div>
                </div>

                {quizSubmitted && (
                  <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 text-center space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Test Completed</span>
                    <div className="text-3xl font-black text-emerald-400">
                      {quizQuestions.reduce((acc, q, idx) => (currentAnswers[idx] === q.correct_option_index ? acc + 1 : acc), 0)} / {quizQuestions.length}
                    </div>
                    <p className="text-xs text-slate-300">
                      Any incorrect questions have been saved to your Mistake Notebook for revision.
                    </p>
                  </div>
                )}

                <div className="space-y-5">
                  {quizQuestions.map((q, qIdx) => {
                    const userOpt = currentAnswers[qIdx];
                    const isBookmarked = !!bookmarkedMap[`quiz_${activeQuiz.id}_q_${q.id || qIdx}`];

                    return (
                      <div
                        key={q.id || qIdx}
                        className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-black text-amber-400">Question {qIdx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleQuizBookmark(q, qIdx)}
                            className="text-xs text-slate-400 hover:text-amber-400"
                          >
                            {isBookmarked ? '🔖 Saved in Vault' : '🔖 Save to Vault'}
                          </button>
                        </div>

                        <p className="text-base text-white font-medium leading-relaxed">{q.question_text}</p>

                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = userOpt === optIdx;
                            let btnCls = 'bg-slate-950/70 border-white/[0.08] text-slate-300 hover:border-amber-400/40';

                            if (quizSubmitted) {
                              if (optIdx === q.correct_option_index) {
                                btnCls = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold';
                              } else if (isSelected) {
                                btnCls = 'bg-rose-500/20 border-rose-500 text-rose-200';
                              }
                            } else if (isSelected) {
                              btnCls = 'bg-amber-400/15 border-amber-400 text-white';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={quizSubmitted}
                                onClick={() => setCurrentAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                                className={`w-full text-left p-3.5 rounded-2xl border transition flex items-center gap-3 ${btnCls}`}
                              >
                                <span className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-xs font-black shrink-0">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span className="text-xs sm:text-sm">{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {quizSubmitted && q.explanation && (
                          <div className="mt-3 p-4 rounded-2xl bg-slate-950/80 border border-white/[0.06] text-xs text-slate-300 space-y-1">
                            <strong className="text-amber-300 block font-bold">💡 Solution &amp; Background:</strong>
                            <p className="leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: MONTHLY & SPECIALIZED CAPSULES                                     */}
        {/* ========================================================================= */}
        {activeTab === 'capsules' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                  📚 Exam Revision Powerhouse
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">Monthly Capsules &amp; Compilations</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Structured PDF capsules for last-minute revision before SBI PO, IBPS PO, and RBI Grade B exams.
                </p>
              </div>
              {access && !access.hasAccess && (
                <button
                  type="button"
                  onClick={() => setPaywallOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs shrink-0 shadow-md"
                >
                  👑 Unlock Capsules with Pass
                </button>
              )}
            </div>

            {capsules.length === 0 ? (
              <div className="bg-slate-900/40 border border-white/[0.08] rounded-3xl p-12 text-center space-y-3">
                <div className="text-4xl">📚</div>
                <h4 className="font-bold text-white text-base">Monthly PDF Capsules</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Monthly Current Affairs master PDF capsules will appear here once uploaded by the admin. You will be able to read online or download them directly without any redirection.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {capsules.map((cap) => (
                  <div
                    key={cap.id}
                    className="bg-slate-900/75 border border-white/[0.08] hover:border-amber-400/40 rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-5 transition shadow-xl group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/25">
                          {cap.month}
                        </span>
                        {cap.badge && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                            {cap.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="font-black text-white text-base sm:text-lg leading-snug group-hover:text-amber-400 transition">
                        {cap.title}
                      </h3>

                      {cap.highlights && cap.highlights.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {cap.highlights.map((h, hIdx) => (
                            <div key={hIdx} className="text-xs text-slate-300 flex items-center gap-2">
                              <span className="text-amber-400">✓</span>
                              <span>{h}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-400 pt-2 border-t border-white/[0.05]">
                        {cap.pages_count && <span>📄 {cap.pages_count} Pages</span>}
                        {cap.file_size && <span>💾 {cap.file_size}</span>}
                        {cap.download_count !== undefined && <span>📥 {cap.download_count}+ Aspirants</span>}
                      </div>
                    </div>

                    {!access?.hasAccess ? (
                      <button
                        type="button"
                        onClick={() => setPaywallOpen(true)}
                        className="w-full py-3 rounded-2xl text-xs font-black transition bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/15"
                      >
                        🔒 Unlock PDF Capsule
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openPdfViewer(cap.pdf_url, cap.title)}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 transition flex items-center justify-center gap-1.5"
                        >
                          <span>👁️</span>
                          <span>Read Online</span>
                        </button>
                        <a
                          href={cap.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="flex-1 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 transition flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <span>📥</span>
                          <span>Download PDF</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CURRENT AFFAIRS SEARCH VAULT                                       */}
        {/* ========================================================================= */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">
                  🔍 Precision Keyword Retrieval
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">Current Affairs Search Vault</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Instant search across all 6 months of current affairs by keyword, organization, or scheme name.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="e.g. RBI, SEBI, Project Finance, Saarthi, PM-eBus, Ajay Banga…"
                    value={vaultQuery}
                    onChange={(e) => setVaultQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 rounded-2xl px-4 py-3.5 text-sm text-white outline-none pl-11"
                  />
                  <span className="absolute left-4 top-3.5 text-base">🔍</span>
                </div>

                <select
                  value={vaultCategory}
                  onChange={(e) => setVaultCategory(e.target.value)}
                  className="bg-slate-950 border border-white/[0.1] rounded-2xl px-4 py-3 text-xs font-bold text-slate-300 outline-none"
                >
                  <option value="ALL">All Categories</option>
                  {BSCA_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {access && !access.hasAccess ? (
              <div className="bg-slate-900/50 border border-amber-400/30 rounded-3xl p-10 text-center space-y-3">
                <div className="text-3xl">🔒</div>
                <h3 className="font-bold text-white text-base">Search Vault is locked under Practice &amp; PRO Pass</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Unlock full keyword search across all banking current affairs, circulars, and static GK.
                </p>
                <button
                  type="button"
                  onClick={() => setPaywallOpen(true)}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs"
                >
                  👑 View Access Plans
                </button>
              </div>
            ) : vaultQuery.trim() === '' ? (
              <div className="bg-slate-900/30 border border-white/[0.06] rounded-3xl p-12 text-center text-xs text-slate-400">
                Type any keyword above to search through all published news items.
              </div>
            ) : vaultResults.length === 0 ? (
              <div className="bg-slate-900/30 border border-white/[0.06] rounded-3xl p-12 text-center text-xs text-slate-400">
                No articles matching &quot;{vaultQuery}&quot; found.
              </div>
            ) : (
              <div className="space-y-4">
                <span className="text-xs text-slate-400 font-bold block">
                  Found {vaultResults.length} article(s) matching &quot;{vaultQuery}&quot;:
                </span>
                {vaultResults.map((art) => {
                  const meta = getCategoryMeta(art.category);
                  return (
                    <div
                      key={art.id}
                      className="bg-slate-900/70 border border-white/[0.08] rounded-3xl p-5 sm:p-6 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/25">
                          📅 {art.date}
                        </span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${meta.badgeCls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-base">{art.title}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">{art.bullets[0]}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
      </div>

      {/* PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/[0.1] rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-4 bg-slate-950 border-b border-white/[0.08] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">
                  📄 In-App PDF Reader
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-md">
                  {previewPdfTitle}
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Instant Language Switcher Button (if counterpart exists) */}
                {previewPdfAltUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      const curUrl = previewPdfUrl;
                      const curTitle = previewPdfTitle;
                      setPreviewPdfUrl(previewPdfAltUrl);
                      setPreviewPdfAltUrl(curUrl);
                      setPreviewPdfTitle(previewPdfAltLabel || 'Switched PDF');
                      setPreviewPdfAltLabel(curTitle);
                    }}
                    className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-lg transition flex items-center gap-1"
                    title="Switch language between English and Hindi"
                  >
                    <span>🔄</span>
                    <span className="hidden sm:inline">{previewPdfAltLabel || 'Switch Medium'}</span>
                  </button>
                )}
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-lg transition"
                >
                  Download / Open ↗
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewPdfUrl(null);
                    setPreviewPdfAltUrl(null);
                    setPreviewPdfAltLabel(null);
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 w-full h-full bg-slate-950">
              <iframe
                src={previewPdfUrl}
                title="BSCA PDF Preview"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Current Affairs Paywall & Auth Modals */}
      <BscaPaywall
        isOpen={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        user={currentUser}
        onRequireLogin={() => setIsAuthOpen(true)}
        onUnlocked={async () => {
          setPaywallOpen(false);
          await refreshAccess();
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={async (user) => {
          setIsAuthOpen(false);
          setCurrentUser(user);
          await refreshAccess();
        }}
      />
    </div>
  );
}
