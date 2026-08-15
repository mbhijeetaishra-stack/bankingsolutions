'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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

function TestListContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin'>('student');
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [mocks, setMocks] = useState<MockItem[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryItem[]>([]);
  const [completedAttempts, setCompletedAttempts] = useState<Record<string, MockAttempt>>({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedParentExam, setSelectedParentExam] = useState('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState('ALL');

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
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', session.user.id)
        .single();

      if (profile?.is_admin || profile?.role === 'admin' || session.user.user_metadata?.is_admin) {
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
    // 1. Fetch Sub-Cards / Exam Sub-Categories
    const { data: subCatData } = await supabase
      .from('exam_sub_categories')
      .select('*')
      .order('display_order', { ascending: true });

    if (subCatData) {
      setSubCategories(subCatData);
    }

    // 2. Fetch Mock Tests
    const { data: mockData, error } = await supabase
      .from('mock_tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && mockData) {
      setMocks(mockData);
    }

    // 3. Process Attempts & Active Sessions
    let attemptsMap: Record<string, MockAttempt> = {};

    // A. Check LocalStorage Session Cache (for Instant Resume Detection)
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

    // B. Check Local Storage Completed Attempts
    try {
      const localSaved = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      Object.keys(localSaved).forEach((tid) => {
        const att = localSaved[tid];
        const testObj = mockData?.find(m => m.id === tid);
        let correct = 0, wrong = 0, unattempted = 0;

        if (testObj && att.answers) {
          let questionsArr: any[] = [];
          if (typeof testObj.questions === 'string') {
            try { questionsArr = JSON.parse(testObj.questions); } catch (e) {}
          } else if (Array.isArray(testObj.questions)) {
            questionsArr = testObj.questions;
          }

          questionsArr.forEach((q: any, qIdx: number) => {
            const userAns = att.answers[qIdx];
            if (userAns === undefined) unattempted++;
            else if (userAns === q.correctOptionIndex) correct++;
            else wrong++;
          });
        }

        // Only set if not already marked as in_progress locally
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

    // C. Check Supabase DB Attempts
    if (userId) {
      const { data: attemptData } = await supabase
        .from('mock_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (attemptData) {
        attemptData.forEach((att: any) => {
          const testObj = mockData?.find(m => m.id === att.test_id);
          let correct = 0, wrong = 0, unattempted = 0;
          const userAnswers = att.user_answers || att.answers || {};

          if (testObj) {
            let questionsArr: any[] = [];
            if (typeof testObj.questions === 'string') {
              try { questionsArr = JSON.parse(testObj.questions); } catch (e) {}
            } else if (Array.isArray(testObj.questions)) {
              questionsArr = testObj.questions;
            }

            questionsArr.forEach((q: any, qIdx: number) => {
              const userAns = typeof userAnswers === 'object' ? userAnswers[q.id || qIdx] : undefined;
              if (userAns === undefined) unattempted++;
              else if (Number(userAns) === Number(q.correctOptionIndex)) correct++;
              else wrong++;
            });
          }

          const existing = attemptsMap[att.test_id];
          // Always prioritize 'in_progress' status
          if (!existing || att.status === 'in_progress' || existing.status !== 'in_progress') {
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

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      } else if (data.user) {
        await supabase.from('profiles').upsert([
          {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || 'Aspirant',
            role: 'student',
            is_admin: false,
          }
        ], { onConflict: 'id' });

        checkUserSession();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/tests`,
        }
      });
      
      if (error) {
        setAuthError(error.message);
      } else if (data.user) {
        await supabase.from('profiles').upsert([
          {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || 'Aspirant',
            role: 'student',
            is_admin: false,
          }
        ], { onConflict: 'id' });

        alert('🎉 Registration successful! Please check your email for the confirmation link.');
        setAuthMode('login');
      }
    }
    setLoading(false);
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
    setMocks([]);
    setSubCategories([]);
    setCompletedAttempts({});
  }

  const staticParentExams = ['SBI PO', 'IBPS PO', 'IBPS CLERK', 'SBI CLERK', 'IBPS RRB PO', 'IBPS RRB CLERK', 'RBI Grade B', 'BSCA', 'BSPS'];
  const dynamicSubCatParents = Array.from(new Set(subCategories.map(sc => sc.parent_exam_name)));
  const mockParents = Array.from(new Set(mocks.map(m => (m.exam_type || '').split('-')[0].trim()))).filter(Boolean);

  const finalParentExams = Array.from(new Set([...staticParentExams, ...dynamicSubCatParents, ...mockParents]));

  const getSubCardsForParent = (parent: string) => {
    if (parent === 'ALL') return [];
    return subCategories.filter(sc => sc.parent_exam_name.toUpperCase() === parent.toUpperCase());
  };

  const currentSubCards = getSubCardsForParent(selectedParentExam);

  const filteredMocks = mocks.filter((mock) => {
    const matchesSearch = mock.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (mock.exam_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (selectedParentExam === 'ALL') return true;

    const parentUpper = selectedParentExam.toUpperCase();
    const examTypeUpper = (mock.exam_type || '').toUpperCase();

    const matchedSubCard = subCategories.find(sc => sc.id === mock.sub_category_id);
    const matchesParent = (matchedSubCard && matchedSubCard.parent_exam_name.toUpperCase() === parentUpper) ||
                          examTypeUpper.includes(parentUpper);

    if (!matchesParent) return false;

    if (selectedSubCategory !== 'ALL') {
      if (mock.sub_category_id) {
        return mock.sub_category_id === selectedSubCategory;
      }
      const matchedSubObj = subCategories.find(sc => sc.id === selectedSubCategory);
      if (matchedSubObj) {
        return examTypeUpper.includes(matchedSubObj.sub_card_title.toUpperCase());
      }
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-bold space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs tracking-wide text-slate-400">Verifying Account & Access Permissions...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-amber-400 text-slate-950 rounded-2xl flex items-center justify-center font-black text-xl mx-auto shadow-md">
              BS
            </div>
            <h1 className="text-xl font-bold text-white">BankingSolutions Portal</h1>
            <p className="text-xs text-slate-400">Please log in to access your mock tests and practice series.</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-3 border border-slate-300"
          >
            <span>Continue with Google</span>
          </button>

          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 font-bold rounded-lg transition ${authMode === 'login' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 font-bold rounded-lg transition ${authMode === 'signup' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400'}`}
            >
              New Student Register
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl font-bold">
                {authError}
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@gmail.com"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#1D63B8]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#1D63B8]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              {authMode === 'login' ? 'Enter Test Portal →' : 'Register Student Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-400 text-slate-950 rounded-lg flex items-center justify-center font-black text-sm shadow-md">
            BS
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">BankingSolutions Test Portal</h1>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{user.email}</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                userRole === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {userRole === 'admin' ? '🛡️ Admin' : '🎓 Student'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userRole === 'admin' && (
            <Link
              href="/admin"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg transition shadow flex items-center gap-1.5"
            >
              <span>⚙️ Admin Panel</span>
            </Link>
          )}
          <Link href="/" className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg transition border border-white/20">
            ← Home
          </Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Full-Length & Sectional Mock Tests</h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Real exam pattern simulations for SBI PO, IBPS PO, RRB PO, BSCA Current Affairs & BSPS Practice Sheets.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between max-w-4xl mx-auto pt-2">
            <div className="relative w-full md:w-96 mx-auto">
              <input
                type="text"
                placeholder="Search test by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#1D63B8]"
              />
            </div>
          </div>

          {/* PARENT EXAM CARDS / TABS */}
          <div className="flex gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 flex-wrap justify-center max-w-5xl mx-auto">
            <button
              onClick={() => {
                setSelectedParentExam('ALL');
                setSelectedSubCategory('ALL');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${
                selectedParentExam === 'ALL' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              ALL EXAMS
            </button>
            {finalParentExams.map((parent) => (
              <button
                key={parent}
                onClick={() => {
                  setSelectedParentExam(parent);
                  setSelectedSubCategory('ALL');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition uppercase ${
                  selectedParentExam === parent ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {parent}
              </button>
            ))}
          </div>

          {/* SUB-CARDS TABS */}
          {currentSubCards.length > 0 && (
            <div className="flex gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700/80 flex-wrap justify-center max-w-3xl mx-auto animate-fadeIn">
              <span className="text-[10px] text-amber-400 self-center uppercase font-bold px-2 flex items-center gap-1">
                <span>🗂️</span> Sub-Cards:
              </span>
              <button
                onClick={() => setSelectedSubCategory('ALL')}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition uppercase ${
                  selectedSubCategory === 'ALL' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                }`}
              >
                All Series
              </button>
              {currentSubCards.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setSelectedSubCategory(sc.id)}
                  className={`px-3 py-1 rounded-md text-[11px] font-bold transition uppercase ${
                    selectedSubCategory === sc.id ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                  }`}
                >
                  {sc.sub_card_title}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Tests ({filteredMocks.length})
          </h3>
        </div>

        {filteredMocks.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center space-y-4 max-w-md mx-auto my-8">
            <div className="text-4xl">📝</div>
            <h4 className="text-lg font-bold text-white">No Tests Found</h4>
            <p className="text-xs text-slate-400">No mock tests available matching your selected exam filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMocks.map((mock) => {
              let qCount = 0;
              if (mock.questions) {
                const parsed = typeof mock.questions === 'string' ? JSON.parse(mock.questions) : mock.questions;
                if (Array.isArray(parsed)) qCount = parsed.length;
              }

              const attempt = completedAttempts[mock.id];
              const cutoff = mock.cutoff_marks ?? 55;
              const isSubmitted = attempt?.status === 'submitted';
              const isInProgress = attempt?.status === 'in_progress';
              const isPassed = isSubmitted ? attempt.score >= cutoff : false;

              const matchedSubCard = subCategories.find(sc => sc.id === mock.sub_category_id);

              return (
                <div
                  key={mock.id}
                  className={`bg-slate-800/60 border rounded-2xl p-6 flex flex-col justify-between space-y-5 transition ${
                    isSubmitted ? 'border-emerald-500/40 bg-slate-800/90' :
                    isInProgress ? 'border-amber-500/60 bg-slate-800/90 shadow-amber-500/10 shadow-lg' : 'border-slate-700/70 hover:border-blue-500/50 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full">
                        {mock.exam_type || 'IBPS PO - Prelims'}
                      </span>

                      {matchedSubCard && (
                        <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                          {matchedSubCard.sub_card_title}
                        </span>
                      )}

                      {isSubmitted ? (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          isPassed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {isPassed ? '✓ Cleared Cut-Off' : '⚠️ Below Cut-Off'} ({attempt.score.toFixed(1)})
                        </span>
                      ) : isInProgress ? (
                        <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded animate-pulse">
                          ⏳ In Progress
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          Cut-off: {cutoff}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-base leading-snug">
                      {mock.title}
                    </h3>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Questions</span>
                        <span className="font-bold text-slate-200">{qCount || 100} Qs</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Duration</span>
                        <span className="font-bold text-slate-200">{mock.duration_minutes || 60} Mins</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">Marks</span>
                        <span className="font-bold text-slate-200">{mock.total_marks || 100} Marks</span>
                      </div>
                    </div>

                    {isSubmitted && (
                      <div className="grid grid-cols-3 gap-1 pt-2 text-center text-[10px] font-bold bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                        <div className="text-emerald-400">
                          <span className="block text-[9px] text-slate-500 uppercase">Correct</span>
                          {attempt.correctCount ?? 0}
                        </div>
                        <div className="text-rose-400 border-x border-slate-800">
                          <span className="block text-[9px] text-slate-500 uppercase">Wrong</span>
                          {attempt.wrongCount ?? 0}
                        </div>
                        <div className="text-slate-400">
                          <span className="block text-[9px] text-slate-500 uppercase">Skipped</span>
                          {attempt.unattemptedCount ?? 0}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Action Buttons */}
                  {isSubmitted ? (
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Link
                        href={`/mock-test/${mock.id}/result`}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition text-center"
                      >
                        📊 View Analysis
                      </Link>

                      <Link
                        href={`/mock-test/${mock.id}?mode=solution`}
                        className="py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 font-extrabold text-xs border border-amber-400/30 rounded-xl transition text-center"
                      >
                        👁️ Solutions
                      </Link>
                    </div>
                  ) : isInProgress ? (
                    <Link
                      href={`/mock-test/${mock.id}`}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl text-center shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <span>▶️ Resume Test</span>
                      <span>→</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/mock-test/${mock.id}`}
                      className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl text-center shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <span>Start Test Now</span>
                      <span>→</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TestListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">Loading...</div>}>
      <TestListContent />
    </Suspense>
  );
}