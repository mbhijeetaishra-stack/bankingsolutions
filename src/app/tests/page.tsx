'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface MockItem {
  id: string;
  title: string;
  exam_type?: string;
  sub_category_id?: string;
  duration_minutes?: number;
  total_marks?: number;
  cutoff_marks?: number;
  questions?: any[];
  created_at: string;
}

interface SubCategoryItem {
  id: string;
  parent_exam_name: string;
  sub_card_title: string;
  description?: string;
  display_order?: number;
}

interface MockAttempt {
  id?: string;
  test_id: string;
  score: number;
  total_marks: number;
  status?: 'in_progress' | 'submitted';
  correctCount?: number;
  wrongCount?: number;
  unattemptedCount?: number;
}

type TestFormatFilter = 'ALL' | 'FULL_LENGTH' | 'SECTIONAL' | 'PYQ';

function parseQuestionsArray(rawQuestions: any): any[] {
  if (!rawQuestions) return [];
  if (Array.isArray(rawQuestions)) return rawQuestions;
  if (typeof rawQuestions === 'string') {
    try {
      const parsed = JSON.parse(rawQuestions);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getExamBrandMeta(examType = '', title = ''): {
  icon: string;
  shortTag: string;
  badgeClass: string;
  difficultyLabel: string;
} {
  const combined = `${examType} ${title}`.toUpperCase();
  if (combined.includes('SBI')) {
    return {
      icon: '🏦',
      shortTag: 'SBI EXAM',
      badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/35',
      difficultyLabel: combined.includes('MAINS') ? 'High (Mains Level)' : 'Real CBT Exam Level',
    };
  }
  if (combined.includes('RRB')) {
    return {
      icon: '🌾',
      shortTag: 'IBPS RRB',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      difficultyLabel: 'Speed & Accuracy Focus',
    };
  }
  if (combined.includes('RBI') || combined.includes('NABARD')) {
    return {
      icon: '🇮🇳',
      shortTag: 'REGULATORY',
      badgeClass: 'bg-amber-400/15 text-amber-300 border-amber-400/35',
      difficultyLabel: 'Officer Grade Level',
    };
  }
  if (combined.includes('BSCA') || combined.includes('CURRENT AFFAIRS')) {
    return {
      icon: '📰',
      shortTag: 'BANKING GA',
      badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/35',
      difficultyLabel: 'High-Yield CA Drill',
    };
  }
  return {
    icon: '🏛️',
    shortTag: 'IBPS EXAM',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35',
    difficultyLabel: combined.includes('MAINS') ? 'High (Mains Level)' : 'Standard Prelims Level',
  };
}

function detectTestFormat(mock: MockItem, qCount: number): TestFormatFilter {
  const combined = `${mock.title} ${mock.exam_type || ''}`.toUpperCase();
  if (
    combined.includes('PYQ') ||
    combined.includes('MEMORY') ||
    combined.includes('PREVIOUS YEAR')
  ) {
    return 'PYQ';
  }
  if (
    combined.includes('SECTIONAL') ||
    combined.includes('TOPIC') ||
    combined.includes('MINI') ||
    combined.includes('SPEED') ||
    combined.includes('CHAPTER') ||
    (qCount > 0 && qCount <= 45 && (mock.duration_minutes || 60) <= 35)
  ) {
    return 'SECTIONAL';
  }
  return 'FULL_LENGTH';
}

function extractSectionBreakdown(questionsArr: any[]): { name: string; count: number }[] {
  if (!questionsArr || questionsArr.length === 0) return [];
  const counts = new Map<string, number>();
  questionsArr.forEach((q) => {
    const rawSec =
      q?.section ||
      q?.subject ||
      q?.topic ||
      '';
    const clean = String(rawSec).trim();
    if (clean) {
      counts.set(clean, (counts.get(clean) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .slice(0, 4);
}

function estimatePercentile(score: number, cutoff: number, totalMarks: number): number {
  if (score <= 0) return 15;
  const ratioToCutoff = cutoff > 0 ? score / cutoff : score / Math.max(1, totalMarks * 0.55);
  if (ratioToCutoff >= 1.25) return 98.4;
  if (ratioToCutoff >= 1.1) return 94.8;
  if (ratioToCutoff >= 1.0) return 89.2;
  if (ratioToCutoff >= 0.85) return 76.5;
  if (ratioToCutoff >= 0.7) return 61.0;
  return Math.max(20, Math.round(ratioToCutoff * 55));
}

function TestListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin'>('student');

  // Auth Modal State (Allows browsing catalog without login!)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingMockId, setPendingMockId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Pattern & Syllabus Preview Modal State
  const [patternPreviewMock, setPatternPreviewMock] = useState<MockItem | null>(null);

  const [mocks, setMocks] = useState<MockItem[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState<Record<string, MockAttempt>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedParentExam, setSelectedParentExam] = useState('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');
  const [formatFilter, setFormatFilter] = useState<TestFormatFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'UNATTEMPTED'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'POPULAR' | 'SHORTEST'>('NEWEST');

  useEffect(() => {
    const isVerified = searchParams.get('verified');
    if (isVerified === 'true') {
      alert('🎉 Signup successful! Your email has been verified and your account is ready.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    checkUserSession();
  }, [searchParams]);

  async function checkUserSession() {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', session.user.id)
        .single();

      if (
        profile?.is_admin ||
        profile?.role === 'admin' ||
        session.user.user_metadata?.is_admin
      ) {
        setUserRole('admin');
      } else {
        setUserRole('student');
      }

      await fetchMocksAndSubCategories(session.user.id);
    } else {
      setUser(null);
      await fetchMocksAndSubCategories();
    }
    setLoading(false);
  }

  async function fetchMocksAndSubCategories(userId?: string) {
    const { data: subCatData } = await supabase
      .from('exam_sub_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (subCatData) {
      setSubCategories(subCatData);
    }

    const { data: mockData, error } = await supabase
      .from('mock_tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && mockData) {
      setMocks(mockData);
    }

    const attemptsMap: Record<string, MockAttempt> = {};

    if (mockData) {
      mockData.forEach((m) => {
        try {
          const cachedSession = localStorage.getItem(`mock_session_${m.id}`);
          if (cachedSession) {
            const parsed = JSON.parse(cachedSession);
            if (parsed && parsed.status === 'in_progress') {
              attemptsMap[m.id] = {
                test_id: m.id,
                score: 0,
                total_marks: m.total_marks || 100,
                status: 'in_progress',
              };
            }
          }
        } catch (e) {}
      });
    }

    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      Object.keys(localSaved).forEach((tid) => {
        const att = localSaved[tid];
        const testObj = mockData?.find((m) => m.id === tid);
        let correct = 0,
          wrong = 0,
          unattempted = 0;

        if (testObj && att.answers) {
          const questionsArr = parseQuestionsArray(testObj.questions);
          questionsArr.forEach((q: any, qIdx: number) => {
            const userAns = att.answers[qIdx];
            if (userAns === undefined) unattempted++;
            else if (userAns === q.correctOptionIndex) correct++;
            else wrong++;
          });
        }

        if (!attemptsMap[tid] || attemptsMap[tid].status !== 'in_progress') {
          attemptsMap[tid] = {
            test_id: tid,
            score: Number(att.score || 0),
            total_marks: Number(att.total_marks || 100),
            status: att.status || 'submitted',
            correctCount: correct,
            wrongCount: wrong,
            unattemptedCount: unattempted,
          };
        }
      });
    } catch (e) {}

    if (userId) {
      const { data: attemptData } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (attemptData) {
        attemptData.forEach((att: any) => {
          const testObj = mockData?.find((m) => m.id === att.test_id);
          let correct = 0,
            wrong = 0,
            unattempted = 0;
          const userAnswers = att.user_answers || att.answers || {};

          if (testObj) {
            const questionsArr = parseQuestionsArray(testObj.questions);
            questionsArr.forEach((q: any, qIdx: number) => {
              const userAns =
                typeof userAnswers === 'object' ? userAnswers[q.id || qIdx] : undefined;
              if (userAns === undefined) unattempted++;
              else if (Number(userAns) === Number(q.correctOptionIndex)) correct++;
              else wrong++;
            });
          }

          const existing = attemptsMap[att.test_id];
          if (
            !existing ||
            att.status === 'in_progress' ||
            existing.status !== 'in_progress'
          ) {
            attemptsMap[att.test_id] = {
              id: att.id,
              test_id: att.test_id,
              score: Number(att.score || 0),
              total_marks: Number(att.total_marks || 100),
              status: att.status || 'submitted',
              correctCount: correct,
              wrongCount: wrong,
              unattemptedCount: unattempted,
            };
          }
        });
      }
    }

    setCompletedAttempts(attemptsMap);
  }

  function handleLaunchMock(testId: string) {
    if (!user) {
      setPendingMockId(testId);
      setShowAuthModal(true);
      return;
    }
    router.push(`/mock-test/${testId}`);
  }

  async function handleReattempt(testId: string) {
    if (
      !confirm(
        'Are you sure you want to reattempt this test? Your previous progress will be reset.'
      )
    )
      return;

    localStorage.removeItem(`mock_session_${testId}`);
    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      delete localSaved[testId];
      localStorage.setItem('bsca_mock_attempts', JSON.stringify(localSaved));
    } catch (e) {}

    if (user?.id) {
      await supabase
        .from('mock_attempts')
        .delete()
        .eq('user_id', user.id)
        .eq('test_id', testId);
    }

    router.push(`/mock-test/${testId}`);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      } else if (data.user) {
        await supabase.from('profiles').upsert(
          [
            {
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || 'Aspirant',
              role: 'student',
              is_admin: false,
            },
          ],
          { onConflict: 'id' }
        );

        setShowAuthModal(false);
        await checkUserSession();
        if (pendingMockId) {
          router.push(`/mock-test/${pendingMockId}`);
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/tests`,
        },
      });

      if (error) {
        setAuthError(error.message);
      } else if (data.user) {
        await supabase.from('profiles').upsert(
          [
            {
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || 'Aspirant',
              role: 'student',
              is_admin: false,
            },
          ],
          { onConflict: 'id' }
        );

        alert(
          '🎉 Registration successful! Please check your email for the confirmation link.'
        );
        setAuthMode('login');
      }
    }
  }

  async function handleGoogleLogin() {
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/tests`,
      },
    });

    if (error) {
      setAuthError(error.message);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setCompletedAttempts({});
  }

  const staticParentExams = [
    'SBI PO',
    'IBPS PO',
    'SBI CLERK',
    'IBPS CLERK',
    'IBPS RRB PO',
    'IBPS RRB CLERK',
    'BSCA',
    'BSPS',
  ];
  const dynamicSubCatParents = Array.from(
    new Set(subCategories.map((sc) => sc.parent_exam_name))
  );
  const mockParents = Array.from(
    new Set(mocks.map((m) => (m.exam_type || '').split('-')[0].trim()))
  ).filter(Boolean);

  const finalParentExams = Array.from(
    new Set([...staticParentExams, ...dynamicSubCatParents, ...mockParents])
  );

  const getSubCardsForParent = (parent: string) => {
    if (parent === 'ALL') return [];
    return subCategories.filter(
      (sc) => sc.parent_exam_name.toUpperCase() === parent.toUpperCase()
    );
  };

  const currentSubCards = getSubCardsForParent(selectedParentExam);

  const filteredMocks = mocks
    .filter((mock) => {
      const matchesSearch =
        mock.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (mock.exam_type || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      const questionsArr = parseQuestionsArray(mock.questions);
      const qCount = questionsArr.length;
      const detectedFormat = detectTestFormat(mock, qCount);

      if (formatFilter !== 'ALL' && detectedFormat !== formatFilter) {
        return false;
      }

      if (selectedParentExam !== 'ALL') {
        const parentUpper = selectedParentExam.toUpperCase();
        const examTypeUpper = (mock.exam_type || '').toUpperCase();
        const titleUpper = mock.title.toUpperCase();

        const matchedSubCard = subCategories.find(
          (sc) => sc.id === mock.sub_category_id
        );
        const matchesParent =
          (matchedSubCard &&
            matchedSubCard.parent_exam_name.toUpperCase() === parentUpper) ||
          examTypeUpper.includes(parentUpper) ||
          titleUpper.includes(parentUpper);

        if (!matchesParent) return false;

        if (selectedSubCategory !== 'ALL') {
          if (mock.sub_category_id) {
            if (mock.sub_category_id !== selectedSubCategory) return false;
          } else {
            const matchedSubObj = subCategories.find(
              (sc) => sc.id === selectedSubCategory
            );
            if (
              matchedSubObj &&
              !examTypeUpper.includes(matchedSubObj.sub_card_title.toUpperCase())
            )
              return false;
          }
        }
      }

      const attempt = completedAttempts[mock.id];
      if (
        statusFilter === 'IN_PROGRESS' &&
        (!attempt || attempt.status !== 'in_progress')
      )
        return false;
      if (
        statusFilter === 'COMPLETED' &&
        (!attempt || attempt.status !== 'submitted')
      )
        return false;
      if (statusFilter === 'UNATTEMPTED' && attempt) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'SHORTEST') {
        return (a.duration_minutes || 60) - (b.duration_minutes || 60);
      }
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });

  const totalAvailable = mocks.length;
  const submittedList = Object.values(completedAttempts).filter(
    (a) => a.status === 'submitted'
  );
  const totalAttempted = submittedList.length;
  const inProgressList = Object.values(completedAttempts).filter(
    (a) => a.status === 'in_progress'
  );
  const totalInProgress = inProgressList.length;
  const totalCleared = submittedList.filter((a) => {
    const m = mocks.find((x) => x.id === a.test_id);
    return a.score >= (m?.cutoff_marks ?? 55);
  }).length;

  // Find latest in-progress mock for top spotlight banner
  const latestInProgressMock =
    inProgressList.length > 0
      ? mocks.find((m) => m.id === inProgressList[0].test_id) || null
      : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center font-bold space-y-4">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs tracking-wide text-slate-400">
          Loading BankingSolutions Real CBT Test Center...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-r from-blue-600/12 via-amber-500/8 to-purple-600/12 blur-[140px] rounded-full z-0" />

      {/* ===================================================================== */}
      {/* MODAL 1: SIGN IN / REGISTER MODAL (Triggers only when starting a test) */}
      {/* ===================================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-md w-full bg-slate-900 border border-white/[0.12] rounded-3xl p-7 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-2xl flex items-center justify-center font-black text-lg mx-auto shadow-lg">
                BS
              </div>
              <h3 className="text-lg font-black text-white">
                Sign In to Launch Real CBT Exam Room
              </h3>
              <p className="text-xs text-slate-400">
                Save your live timer, responses, All-India Rank, and Mistake Notebook automatically.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs rounded-2xl shadow transition flex items-center justify-center gap-2"
            >
              <span>🌐 Continue with Google (1-Click)</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-white/[0.08]"></div>
              <span className="flex-shrink mx-3 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
                or with email
              </span>
              <div className="flex-grow border-t border-white/[0.08]"></div>
            </div>

            <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 font-bold rounded-xl transition ${
                  authMode === 'login'
                    ? 'bg-amber-400 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 font-bold rounded-xl transition ${
                  authMode === 'signup'
                    ? 'bg-amber-400 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Free Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-bold">
                  {authError}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@gmail.com"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition uppercase tracking-wider"
              >
                {authMode === 'login' ? 'Sign In & Start Test →' : 'Register & Start Test →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: SYLLABUS, PATTERN & MARKING SCHEME PREVIEW MODAL              */}
      {/* ===================================================================== */}
      {patternPreviewMock && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-lg w-full bg-slate-900 border border-white/[0.12] rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setPatternPreviewMock(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs font-bold"
            >
              ✕
            </button>

            {(() => {
              const qArr = parseQuestionsArray(patternPreviewMock.questions);
              const qCount = qArr.length || 100;
              const secs = extractSectionBreakdown(qArr);
              const cutoff = patternPreviewMock.cutoff_marks ?? 55;
              const marks = patternPreviewMock.total_marks || 100;
              const mins = patternPreviewMock.duration_minutes || 60;

              return (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/25 px-3 py-1 rounded-full inline-block">
                      📋 Official Real CBT Test Pattern
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white pr-6">
                      {patternPreviewMock.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {patternPreviewMock.exam_type || 'Banking Prelims / Mains Simulation'}
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5 text-center">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Questions
                      </span>
                      <span className="text-sm font-black text-white mt-0.5 block">
                        {qCount} Qs
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Max Marks
                      </span>
                      <span className="text-sm font-black text-white mt-0.5 block">
                        {marks}
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Duration
                      </span>
                      <span className="text-sm font-black text-amber-300 mt-0.5 block">
                        {mins} Mins
                      </span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Target Cut-Off
                      </span>
                      <span className="text-sm font-black text-emerald-400 mt-0.5 block">
                        {cutoff} Marks
                      </span>
                    </div>
                  </div>

                  {/* Section Breakdown */}
                  <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                      🗂️ Section &amp; Marking Breakdown
                    </div>
                    {secs.length > 0 ? (
                      <div className="space-y-1.5">
                        {secs.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center justify-between text-xs bg-slate-900 px-3 py-2 rounded-xl border border-slate-800/80"
                          >
                            <span className="font-bold text-slate-200">{s.name}</span>
                            <span className="font-black text-amber-300">{s.count} Questions</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">
                        Includes standard Banking Exam sections (Quantitative Aptitude, Reasoning Ability &amp; English / General Awareness).
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px]">
                      <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 px-3 py-2 rounded-xl font-bold">
                        ✓ Correct Answer: +1.00 Mark
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 px-3 py-2 rounded-xl font-bold">
                        ✕ Negative Marking: -0.25 Mark
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPatternPreviewMock(null)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = patternPreviewMock.id;
                        setPatternPreviewMock(null);
                        handleLaunchMock(targetId);
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20"
                    >
                      🚀 Enter Real CBT Exam Room →
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TOP NAVIGATION HEADER                                                 */}
      {/* ===================================================================== */}
      <header className="border-b border-white/[0.08] px-6 py-4 flex justify-between items-center sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center space-x-3.5 group cursor-pointer">
            <div className="relative h-11 w-11 rounded-2xl overflow-hidden bg-white p-1 shadow-lg shadow-amber-400/10 flex-shrink-0 group-hover:scale-105 transition border border-slate-200">
              <img
                src="/channel-logo.png"
                alt="BankingSolutions Logo"
                className="h-full w-full object-contain rounded-xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="text-left">
              <span className="text-lg font-black tracking-tight text-white group-hover:text-amber-400 transition block leading-none">
                BankingSolutions
              </span>
              <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-[0.18em] block mt-1">
                Real CBT Online Test Center
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/notebook"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/30 font-bold text-xs rounded-xl transition"
          >
            <span>🔖</span>
            <span>Mistake Notebook</span>
          </Link>

          <Link
            href="/profile"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/[0.08] font-bold text-xs rounded-xl transition"
          >
            <span>📊</span>
            <span>My Analytics</span>
          </Link>

          {userRole === 'admin' && (
            <Link
              href="/admin"
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shadow flex items-center gap-1.5"
            >
              <span>⚙️ Admin</span>
            </Link>
          )}

          <Link
            href="/"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl transition border border-white/[0.08]"
          >
            ← Home
          </Link>

          {user ? (
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs rounded-xl transition border border-rose-500/25"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => {
                setPendingMockId(null);
                setShowAuthModal(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* HERO & PERFORMANCE KPI BAR                                            */}
      {/* ===================================================================== */}
      <section className="relative z-10 bg-gradient-to-b from-slate-900/60 to-transparent border-b border-white/[0.08] py-8 sm:py-10 px-6 bg-grid-pattern">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-amber-400/10 text-amber-300 border border-amber-400/25 text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Real CBT Exam Interface • 2026–27 Series</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                Banking &amp; Insurance Mock Test Series
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                Full-Length Prelims &amp; Mains Mocks, Sectional Speed Drills, and Memory-Based Previous Year Papers with All-India Rank, Percentile &amp; Smart Mistake Notebook sync.
              </p>
            </div>

            {/* 4-Card KPI Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
              <div className="bg-slate-900/85 backdrop-blur-md border border-white/[0.08] rounded-2xl px-4 py-3 text-center shadow-lg">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Total Mocks
                </span>
                <span className="text-xl font-black text-white mt-0.5 block">
                  {totalAvailable}
                </span>
              </div>
              <div className="bg-slate-900/85 backdrop-blur-md border border-blue-500/25 rounded-2xl px-4 py-3 text-center shadow-lg">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Attempted
                </span>
                <span className="text-xl font-black text-blue-400 mt-0.5 block">
                  {totalAttempted}
                </span>
              </div>
              <div className="bg-slate-900/85 backdrop-blur-md border border-amber-500/25 rounded-2xl px-4 py-3 text-center shadow-lg">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  In Progress
                </span>
                <span className="text-xl font-black text-amber-400 mt-0.5 block">
                  {totalInProgress}
                </span>
              </div>
              <div className="bg-slate-900/85 backdrop-blur-md border border-emerald-500/25 rounded-2xl px-4 py-3 text-center shadow-lg">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Cut-Off Cleared
                </span>
                <span className="text-xl font-black text-emerald-400 mt-0.5 block">
                  {totalCleared}
                </span>
              </div>
            </div>
          </div>

          {/* RESUME PAUSED EXAM SPOTLIGHT BANNER */}
          {latestInProgressMock && (
            <div className="bg-gradient-to-r from-amber-500/15 via-slate-900/95 to-slate-900 border border-amber-400/40 rounded-2xl p-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shrink-0 shadow">
                  ▶️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                      Paused Exam Session Found
                    </span>
                    <span className="text-[10px] bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded font-bold">
                      Timer &amp; Answers Saved
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
                    {latestInProgressMock.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleLaunchMock(latestInProgressMock.id)}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-400/20 transition whitespace-nowrap"
              >
                ▶️ Resume Paused Test Now →
              </button>
            </div>
          )}

          {/* TEST FORMAT SWITCHER TABS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'ALL', label: '📋 All Test Series', icon: '' },
                  { id: 'FULL_LENGTH', label: '🏆 Full-Length Mocks', icon: '' },
                  { id: 'SECTIONAL', label: '⚡ Sectional & Speed Tests', icon: '' },
                  { id: 'PYQ', label: '📜 Memory-Based PYQs', icon: '' },
                ] as { id: TestFormatFilter; label: string; icon?: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormatFilter(tab.id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 ${
                    formatFilter === tab.id
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                      : 'bg-slate-900/90 text-slate-300 hover:text-white border border-white/[0.08]'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> +1.0 / -0.25 Marking
              </span>
              <span>•</span>
              <span>Instant Solutions &amp; Percentile</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MAIN CONTENT WRAPPER WITH SIDEBAR AND CARDS                           */}
      {/* ===================================================================== */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* LEFT EXAM CATEGORY SIDEBAR */}
        <aside className="w-full lg:col-span-1 bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-4 h-fit lg:sticky lg:top-24 space-y-3 shadow-2xl">
          <div className="px-3 py-2 border-b border-white/[0.08] flex justify-between items-center">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
              🏦 Select Target Exam
            </span>
            <span className="text-[10px] bg-amber-400/15 text-amber-300 border border-amber-400/25 font-bold px-2.5 py-0.5 rounded-full">
              {finalParentExams.length + 1}
            </span>
          </div>

          <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto lg:max-h-[62vh] pb-1 lg:pb-0 lg:pr-1 custom-scrollbar">
            <button
              onClick={() => {
                setSelectedParentExam('ALL');
                setSelectedSubCategory('ALL');
              }}
              className={`shrink-0 lg:w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between gap-2 ${
                selectedParentExam === 'ALL'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white bg-slate-950/40 lg:bg-transparent'
              }`}
            >
              <span>🌟 All Banking Exams</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  selectedParentExam === 'ALL'
                    ? 'bg-slate-950/20 text-slate-950 font-black'
                    : 'bg-slate-950/60 text-slate-400'
                }`}
              >
                {mocks.length}
              </span>
            </button>

            {finalParentExams.map((parent) => {
              const count = mocks.filter((m) => {
                const examTypeUpper = (m.exam_type || '').toUpperCase();
                const titleUpper = m.title.toUpperCase();
                const matchedSub = subCategories.find(
                  (sc) => sc.id === m.sub_category_id
                );
                return (
                  (matchedSub &&
                    matchedSub.parent_exam_name.toUpperCase() ===
                      parent.toUpperCase()) ||
                  examTypeUpper.includes(parent.toUpperCase()) ||
                  titleUpper.includes(parent.toUpperCase())
                );
              }).length;

              const brand = getExamBrandMeta(parent, parent);

              return (
                <button
                  key={parent}
                  onClick={() => {
                    setSelectedParentExam(parent);
                    setSelectedSubCategory('ALL');
                  }}
                  className={`shrink-0 lg:w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between gap-2 ${
                    selectedParentExam === parent
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white bg-slate-950/40 lg:bg-transparent'
                  }`}
                >
                  <span className="truncate">
                    {brand.icon} {parent}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      selectedParentExam === parent
                        ? 'bg-slate-950/20 text-slate-950 font-black'
                        : 'bg-slate-950/60 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT SIDE: SEARCH, FILTERS & PROFESSIONAL TEST CARDS */}
        <main className="lg:col-span-3 space-y-6">
          {/* Search + Status Filter + Sort Bar */}
          <div className="flex flex-col xl:flex-row gap-3.5 items-stretch xl:items-center justify-between bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] p-4 rounded-3xl shadow-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="🔍 Search by exam name, shift, prelims/mains, or topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Filter Pills */}
              <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/[0.08] text-xs gap-1 overflow-x-auto">
                {(
                  ['ALL', 'UNATTEMPTED', 'IN_PROGRESS', 'COMPLETED'] as const
                ).map((st) => {
                  let label = 'All';
                  if (st === 'UNATTEMPTED') label = 'Unattempted';
                  if (st === 'IN_PROGRESS') label = 'Paused';
                  if (st === 'COMPLETED') label = 'Attempted';

                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 font-bold rounded-xl transition uppercase text-[10px] tracking-wider whitespace-nowrap ${
                        statusFilter === st
                          ? 'bg-slate-800 text-amber-400 border border-amber-400/30 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-950 border border-white/[0.08] rounded-2xl px-3 py-2 text-[11px] font-bold text-slate-300 outline-none focus:border-amber-400"
              >
                <option value="NEWEST">✨ Sort: Latest Added</option>
                <option value="SHORTEST">⚡ Sort: Quickest Duration</option>
              </select>
            </div>
          </div>

          {/* SUB-CARDS TABS */}
          {currentSubCards.length > 0 && (
            <div className="flex gap-2 bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/[0.08] flex-wrap items-center">
              <span className="text-[10px] text-amber-400 uppercase font-extrabold tracking-wider px-2 flex items-center gap-1.5">
                <span>🗂️</span> Test Series Pack:
              </span>
              <button
                onClick={() => setSelectedSubCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition uppercase ${
                  selectedSubCategory === 'ALL'
                    ? 'bg-amber-400 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-800/80'
                }`}
              >
                All Packs
              </button>
              {currentSubCards.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setSelectedSubCategory(sc.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition uppercase ${
                    selectedSubCategory === sc.id
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-800/80'
                  }`}
                >
                  {sc.sub_card_title}
                </button>
              ))}
            </div>
          )}

          {/* Active Filter Header Bar */}
          <div className="flex flex-wrap justify-between items-center border-b border-white/[0.08] pb-3 gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">
                Showing {filteredMocks.length} Mock {filteredMocks.length === 1 ? 'Test' : 'Tests'}
              </h2>
              {selectedParentExam !== 'ALL' && (
                <span className="text-[10px] font-black bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                  {selectedParentExam}
                </span>
              )}
            </div>

            {(selectedParentExam !== 'ALL' ||
              formatFilter !== 'ALL' ||
              statusFilter !== 'ALL' ||
              searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedParentExam('ALL');
                  setSelectedSubCategory('ALL');
                  setFormatFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchTerm('');
                }}
                className="text-[11px] font-bold text-amber-400 hover:underline"
              >
                Reset All Filters ✕
              </button>
            )}
          </div>

          {/* TEST CARDS GRID */}
          {filteredMocks.length === 0 ? (
            <div className="bg-slate-900/50 border border-white/[0.08] rounded-3xl p-14 text-center space-y-4 max-w-md mx-auto my-8">
              <div className="text-4xl">📝</div>
              <h4 className="text-base font-bold text-white">
                No Matching Mock Tests Found
              </h4>
              <p className="text-xs text-slate-400">
                Try clearing your current search or switching the exam category filter on the left.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedParentExam('ALL');
                  setSelectedSubCategory('ALL');
                  setFormatFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchTerm('');
                }}
                className="px-4 py-2 bg-amber-400 text-slate-950 font-black text-xs rounded-xl"
              >
                Show All Mock Tests
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMocks.map((mock) => {
                const questionsArr = parseQuestionsArray(mock.questions);
                const qCount = questionsArr.length || 100;
                const sectionsList = extractSectionBreakdown(questionsArr);
                const brand = getExamBrandMeta(mock.exam_type, mock.title);
                const detectedFormat = detectTestFormat(mock, qCount);

                const attempt = completedAttempts[mock.id];
                const cutoff = mock.cutoff_marks ?? 55;
                const maxMarks = mock.total_marks || 100;
                const durationMins = mock.duration_minutes || 60;

                const isSubmitted = attempt?.status === 'submitted';
                const isInProgress = attempt?.status === 'in_progress';
                const isPassed = isSubmitted ? attempt.score >= cutoff : false;

                const matchedSubCard = subCategories.find(
                  (sc) => sc.id === mock.sub_category_id
                );

                // Accuracy & Percentile calculations for completed tests
                const totalAnswered = isSubmitted
                  ? (attempt.correctCount ?? 0) + (attempt.wrongCount ?? 0)
                  : 0;
                const accuracyPct =
                  totalAnswered > 0
                    ? Math.round(((attempt?.correctCount ?? 0) / totalAnswered) * 100)
                    : 0;
                const scorePct = isSubmitted
                  ? Math.min(100, Math.max(5, Math.round((attempt.score / maxMarks) * 100)))
                  : 0;
                const estPercentile = isSubmitted
                  ? estimatePercentile(attempt.score, cutoff, maxMarks)
                  : 0;

                return (
                  <div
                    key={mock.id}
                    className={`group bg-gradient-to-b from-slate-900/90 to-slate-950 border rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all duration-300 hover:-translate-y-1 shadow-xl relative overflow-hidden ${
                      isSubmitted
                        ? 'border-emerald-500/35'
                        : isInProgress
                        ? 'border-amber-400/50 shadow-amber-500/10'
                        : 'border-white/[0.08] hover:border-amber-400/40'
                    }`}
                  >
                    {/* Top Corner Subtle Glow */}
                    <div className="pointer-events-none absolute -right-10 -top-10 w-28 h-28 bg-amber-400/5 rounded-full blur-2xl group-hover:bg-amber-400/15 transition" />

                    <div className="space-y-4 relative z-10">
                      {/* Top Badges Row */}
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1 ${brand.badgeClass}`}
                          >
                            <span>{brand.icon}</span>
                            <span>{mock.exam_type || brand.shortTag}</span>
                          </span>

                          <span className="text-[10px] font-bold bg-slate-800/90 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full">
                            {detectedFormat === 'FULL_LENGTH'
                              ? '🏆 Full Mock'
                              : detectedFormat === 'SECTIONAL'
                              ? '⚡ Sectional'
                              : '📜 PYQ Paper'}
                          </span>

                          {matchedSubCard && (
                            <span className="text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                              {matchedSubCard.sub_card_title}
                            </span>
                          )}
                        </div>

                        {/* Status / Free Badge */}
                        {isSubmitted ? (
                          <span
                            className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                              isPassed
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                            }`}
                          >
                            {isPassed ? '✓ Cut-Off Cleared' : '⚠️ Attempted'}
                          </span>
                        ) : isInProgress ? (
                          <span className="text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2.5 py-1 rounded-full animate-pulse">
                            ⏳ Paused
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                            🆓 Free Test
                          </span>
                        )}
                      </div>

                      {/* Title & Pattern Info Button */}
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-black text-white text-base sm:text-lg leading-snug tracking-tight group-hover:text-amber-200 transition">
                          {mock.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setPatternPreviewMock(mock)}
                          title="View Exam Pattern, Syllabus & Marking Scheme"
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-amber-300 transition"
                        >
                          ℹ️ Pattern
                        </button>
                      </div>

                      {/* 4-Metric Spec Grid */}
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="bg-slate-950/90 p-2.5 rounded-2xl border border-white/[0.06]">
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">
                            Questions
                          </span>
                          <span className="font-black text-slate-100 mt-0.5 block">
                            {qCount} Qs
                          </span>
                        </div>
                        <div className="bg-slate-950/90 p-2.5 rounded-2xl border border-white/[0.06]">
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">
                            Duration
                          </span>
                          <span className="font-black text-slate-100 mt-0.5 block">
                            {durationMins}m
                          </span>
                        </div>
                        <div className="bg-slate-950/90 p-2.5 rounded-2xl border border-white/[0.06]">
                          <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">
                            Marks
                          </span>
                          <span className="font-black text-slate-100 mt-0.5 block">
                            {maxMarks}
                          </span>
                        </div>
                        <div className="bg-slate-950/90 p-2.5 rounded-2xl border border-amber-400/20">
                          <span className="text-[9px] text-amber-400/90 uppercase font-bold tracking-wider block">
                            Cut-Off
                          </span>
                          <span className="font-black text-amber-300 mt-0.5 block">
                            {cutoff}
                          </span>
                        </div>
                      </div>

                      {/* Exam Meta Strip (Sections or Marking Rules) */}
                      {!isSubmitted && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 bg-slate-950/60 px-3.5 py-2 rounded-xl border border-white/[0.05]">
                          {sectionsList.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {sectionsList.map((s) => (
                                <span
                                  key={s.name}
                                  className="text-[10px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                                >
                                  {s.name}: {s.count}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="font-semibold text-slate-300">
                              🎯 {brand.difficultyLabel}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-400">
                            ⚖️ +1 / -0.25
                          </span>
                        </div>
                      )}

                      {/* Completed Attempt Rich Visual Analytics Card */}
                      {isSubmitted && (
                        <div className="bg-slate-950/95 p-3.5 rounded-2xl border border-white/[0.07] space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <span className="text-slate-400 font-semibold">Your Score: </span>
                              <span className="font-black text-white text-sm">
                                {attempt.score.toFixed(2)}
                              </span>
                              <span className="text-slate-500 text-[11px]"> / {maxMarks}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="font-bold text-amber-300">
                                🏆 ~{estPercentile}%ile
                              </span>
                              <span>•</span>
                              <span className="font-bold text-emerald-400">
                                🎯 {accuracyPct}% Acc
                              </span>
                            </div>
                          </div>

                          {/* Score Progress Bar */}
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isPassed
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-amber-400 to-orange-500'
                              }`}
                              style={{ width: `${scorePct}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-1 pt-0.5 text-center text-[11px] font-bold">
                            <div className="text-emerald-400">
                              ✓ {attempt.correctCount ?? 0} Correct
                            </div>
                            <div className="text-rose-400 border-x border-white/[0.08]">
                              ✕ {attempt.wrongCount ?? 0} Wrong
                            </div>
                            <div className="text-slate-400">
                              ○ {attempt.unattemptedCount ?? 0} Skipped
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Action Buttons */}
                    <div className="pt-2 relative z-10">
                      {isSubmitted ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <Link
                              href={`/mock-test/${mock.id}/result`}
                              className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition text-center flex items-center justify-center gap-1"
                            >
                              <span>📊 Analysis</span>
                            </Link>

                            <Link
                              href={`/mock-test/${mock.id}?mode=solution`}
                              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-extrabold text-xs border border-amber-400/30 rounded-xl transition text-center flex items-center justify-center gap-1"
                            >
                              <span>👁️ Solutions</span>
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleReattempt(mock.id)}
                              className="py-2.5 bg-purple-600/90 hover:bg-purple-600 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1"
                            >
                              <span>🔄 Re-Test</span>
                            </button>
                          </div>
                        </div>
                      ) : isInProgress ? (
                        <button
                          type="button"
                          onClick={() => handleLaunchMock(mock.id)}
                          className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-2xl text-center shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                        >
                          <span>▶️ Resume Paused Test</span>
                          <span>→</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLaunchMock(mock.id)}
                          className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-amber-400 hover:to-amber-500 text-white hover:text-slate-950 font-black text-xs rounded-2xl text-center shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
                        >
                          <span>🚀 Start Real CBT Mock Test</span>
                          <span>→</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function TestListPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center font-bold">
          Loading Real CBT Test Center...
        </div>
      }
    >
      <TestListContent />
    </Suspense>
  );
}