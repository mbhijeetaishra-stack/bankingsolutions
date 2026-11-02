'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  downloadPurchaseReceipt,
  getProPassConfig,
  syncMonetizationFromSupabase,
  checkAndClaimEmailGrants,
} from '@/lib/monetization';
import DailyMissionWidget from '@/components/DailyMissionWidget';
import {
  DEFAULT_WORD_MATRIX_STATS,
  getUserWordMatrixRank,
  loadWordMatrixStats,
  syncWordMatrixLeaderboardFromSupabase,
  upsertWordMatrixLeaderboardEntry,
  type WordMatrixLeaderboardEntry,
  type WordMatrixStats,
} from '@/lib/wordMatrix';
import {
  DEFAULT_PLAYER_RAID_STATS,
  loadPlayerRaidStats,
  type PlayerRaidStats,
} from '@/lib/caRaid';

interface CoursePurchase {
  id: string;
  course_name: string;
  amount_paid: number;
  payment_id?: string;
  expires_at?: string;
  created_at: string;
}

interface EBookItem {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  pdf_url: string;
  price: number;
}

interface MockTestMeta {
  id: string;
  title: string;
  exam_type?: string;
  total_marks?: number;
  cutoff_marks?: number;
  duration_minutes?: number;
}

interface EnrichedMockAttempt {
  id: string;
  test_id: string;
  test_title: string;
  exam_type: string;
  score: number;
  total_marks: number;
  cutoff_marks: number;
  status: 'in_progress' | 'submitted';
  date: string;
}

interface EnrichedQuizAttempt {
  quiz_id: string;
  quiz_title: string;
  quiz_date: string;
  score: number;
  total_questions: number;
}

interface ExamCountdown {
  id: string;
  exam_name: string;
  exam_date: string;
}

export default function UnifiedStudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'tests' | 'settings'>('overview');

  // Profile Form Fields
  const [studentName, setStudentName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [targetExam, setTargetExam] = useState('SBI PO & IBPS PO 2026');
  const [email, setEmail] = useState('');

  // Dashboard Data States
  const [coursePurchases, setCoursePurchases] = useState<CoursePurchase[]>([]);
  const [unlockedEBooks, setUnlockedEBooks] = useState<EBookItem[]>([]);
  const [mockAttempts, setMockAttempts] = useState<EnrichedMockAttempt[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<EnrichedQuizAttempt[]>([]);
  const [examCountdowns, setExamCountdowns] = useState<ExamCountdown[]>([]);
  const [completedDaysMap, setCompletedDaysMap] = useState<Record<number, boolean>>({});
  const [streakCount, setStreakCount] = useState(0);
  const [completedCompChapters, setCompletedCompChapters] = useState<number>(0);
  const [isProPassVisible, setIsProPassVisible] = useState(true);
  const [wmStats, setWmStats] = useState<WordMatrixStats>(DEFAULT_WORD_MATRIX_STATS);
  const [raidStats, setRaidStats] = useState<PlayerRaidStats>(DEFAULT_PLAYER_RAID_STATS);
  const [wmStanding, setWmStanding] = useState<{
    rank: number | null;
    entry: WordMatrixLeaderboardEntry | null;
    totalPlayers: number;
    pointsToTop100: number;
  }>({
    rank: null,
    entry: null,
    totalPlayers: 0,
    pointsToTop100: 0,
  });

  useEffect(() => {
    setIsProPassVisible(getProPassConfig().isVisibleOnWebsite);
    syncMonetizationFromSupabase().then((synced) => {
      setIsProPassVisible(synced.proPassConfig.isVisibleOnWebsite);
    });
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      window.location.href = '/tests';
      return;
    }

    const currentUser = session.user;
    setUser(currentUser);
    setEmail(currentUser.email || '');

    // Load saved Target Exam preference from localStorage
    const savedTarget = localStorage.getItem('bs_student_target_exam');
    if (savedTarget) setTargetExam(savedTarget);

    // Load completed computer chapters count from localStorage
    try {
      const savedComp = JSON.parse(localStorage.getItem('bs_completed_computer_chapters') || '[]');
      if (Array.isArray(savedComp)) setCompletedCompChapters(savedComp.length);
    } catch (e) {}

    // Calculate Daily Targets consistency & 30-day map from localStorage
    const daysMap: Record<number, boolean> = {};
    let currentStreak = 0;
    let streakBroken = false;
    for (let d = 1; d <= 30; d++) {
      const beg = localStorage.getItem(`bsca_target_day_${d}_beginner`);
      const rep = localStorage.getItem(`bsca_target_day_${d}_repeater`);
      let done = false;
      try {
        if (beg && JSON.parse(beg).some((i: any) => i.completed)) done = true;
        if (rep && JSON.parse(rep).some((i: any) => i.completed)) done = true;
      } catch (e) {}
      daysMap[d] = done;
      if (done && !streakBroken) {
        currentStreak++;
      } else if (!done && d > 1) {
        streakBroken = true;
      }
    }
    setCompletedDaysMap(daysMap);
    setStreakCount(currentStreak);

    // Run Supabase queries in parallel
    const [
      profileRes,
      coursePurchasesRes,
      ebookPurchasesRes,
      ebooksCatalogRes,
      mocksCatalogRes,
      dbMockAttemptsRes,
      quizzesCatalogRes,
      dbQuizAttemptsRes,
      countdownsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('student_name, mobile_number, full_name').eq('id', currentUser.id).maybeSingle(),
      supabase.from('student_course_purchases').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('student_ebook_purchases').select('*').eq('user_id', currentUser.id),
      supabase.from('ebooks').select('*'),
      supabase.from('mock_tests').select('id, title, exam_type, total_marks, cutoff_marks, duration_minutes'),
      supabase.from('mock_attempts').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('bsca_quizzes').select('id, title, quiz_date').order('quiz_date', { ascending: false }),
      supabase.from('bsca_quiz_attempts').select('*').eq('user_id', currentUser.id),
      supabase.from('admin_exam_countdowns').select('*').order('exam_date', { ascending: true }),
    ]);

    // 1. Profile Info
    const resolvedStudentName = profileRes.data
      ? profileRes.data.student_name ||
        profileRes.data.full_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.email?.split('@')[0] ||
        'Banking Aspirant'
      : currentUser.user_metadata?.full_name ||
        currentUser.email?.split('@')[0] ||
        'Banking Aspirant';

    setStudentName(resolvedStudentName);
    if (profileRes.data) {
      setMobileNumber(profileRes.data.mobile_number || '');
    }

    // Sync Word Matrix Stats & Individual Leaderboard Rank
    const localWm = loadWordMatrixStats();
    setWmStats(localWm);
    setRaidStats(loadPlayerRaidStats());
    let wmBoard = await syncWordMatrixLeaderboardFromSupabase();
    const existingWmEntry = wmBoard.find((e) => e.userId === currentUser.id);
    if (
      localWm.bestScore > 0 &&
      (!existingWmEntry || localWm.bestScore > existingWmEntry.bestScore)
    ) {
      const upserted = await upsertWordMatrixLeaderboardEntry({
        userId: currentUser.id,
        name: resolvedStudentName,
        targetExam: savedTarget || 'SBI PO & IBPS PO 2026',
        bestScore: localWm.bestScore,
        bestClearTimeMs: localWm.bestClearTimeMs,
        boardsCleared: localWm.boardsCleared,
        bestWinStreak: localWm.bestWinStreak,
      });
      wmBoard = upserted.entries;
    }
    setWmStanding(getUserWordMatrixRank(currentUser.id, wmBoard));

    // 2. Course Purchases (plus Admin Email Grants)
    const emailGrants = await checkAndClaimEmailGrants(currentUser);
    const dbPurchases = (coursePurchasesRes.data as CoursePurchase[]) || [];
    const existingNames = new Set(
      dbPurchases.map((p) => (p.course_name || '').toLowerCase())
    );
    const extraGrantsAsPurchases: CoursePurchase[] = emailGrants
      .filter((g) => !existingNames.has(g.courseName.toLowerCase()))
      .map((g) => ({
        id: g.id,
        course_name: g.courseName,
        amount_paid: 0,
        payment_id: 'ADMIN_FREE_GRANT',
        expires_at: g.expiresAt || undefined,
        created_at: g.grantedAt,
      }));
    setCoursePurchases([...extraGrantsAsPurchases, ...dbPurchases]);

    // 3. Unlocked E-Books
    const purchasedIds = new Set((ebookPurchasesRes.data || []).map((p: any) => p.ebook_id));
    if (ebooksCatalogRes.data) {
      const myBooks = (ebooksCatalogRes.data as EBookItem[]).filter((b) => purchasedIds.has(b.id));
      setUnlockedEBooks(myBooks);
    }

    // 4. Merge Mock Attempts (Supabase + LocalStorage)
    const mocksMap = new Map<string, MockTestMeta>();
    (mocksCatalogRes.data || []).forEach((m: any) => mocksMap.set(m.id, m));

    const mergedMocksMap = new Map<string, EnrichedMockAttempt>();

    // Check localStorage in-progress sessions
    mocksMap.forEach((meta, tid) => {
      try {
        const cached = localStorage.getItem(`mock_session_${tid}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.status === 'in_progress') {
            mergedMocksMap.set(tid, {
              id: `local-${tid}`,
              test_id: tid,
              test_title: meta.title || 'Mock Test',
              exam_type: meta.exam_type || 'Banking Exam',
              score: 0,
              total_marks: meta.total_marks || 100,
              cutoff_marks: meta.cutoff_marks ?? 55,
              status: 'in_progress',
              date: new Date(parsed.updated_at || Date.now()).toISOString(),
            });
          }
        }
      } catch (e) {}
    });

    // Check localStorage submitted attempts
    try {
      const localMocks = JSON.parse(localStorage.getItem('bsca_mock_attempts') || '{}');
      Object.keys(localMocks).forEach((tid) => {
        const att = localMocks[tid];
        const meta = mocksMap.get(tid);
        if (!mergedMocksMap.has(tid)) {
          mergedMocksMap.set(tid, {
            id: `local-sub-${tid}`,
            test_id: tid,
            test_title: meta?.title || 'Mock Test',
            exam_type: meta?.exam_type || 'Banking Exam',
            score: Number(att.score || 0),
            total_marks: Number(att.total_marks || meta?.total_marks || 100),
            cutoff_marks: Number(meta?.cutoff_marks ?? 55),
            status: att.status || 'submitted',
            date: new Date().toISOString(),
          });
        }
      });
    } catch (e) {}

    // Merge DB mock attempts
    (dbMockAttemptsRes.data || []).forEach((att: any) => {
      const meta = mocksMap.get(att.test_id);
      const existing = mergedMocksMap.get(att.test_id);
      if (!existing || att.status === 'in_progress' || existing.status !== 'in_progress') {
        mergedMocksMap.set(att.test_id, {
          id: att.id,
          test_id: att.test_id,
          test_title: meta?.title || 'Full-Length Mock Test',
          exam_type: meta?.exam_type || 'Banking Exam',
          score: Number(att.score || 0),
          total_marks: Number(att.total_marks || meta?.total_marks || 100),
          cutoff_marks: Number(meta?.cutoff_marks ?? 55),
          status: att.status || 'submitted',
          date: att.completed_at || att.created_at || new Date().toISOString(),
        });
      }
    });

    setMockAttempts(Array.from(mergedMocksMap.values()));

    // 5. Merge BSCA Quiz Attempts
    const quizMetaMap = new Map<string, { title: string; quiz_date: string }>();
    (quizzesCatalogRes.data || []).forEach((q: any) => quizMetaMap.set(q.id, q));

    const mergedQuizzesMap = new Map<string, EnrichedQuizAttempt>();
    try {
      const localQuizzes = JSON.parse(localStorage.getItem('bsca_quiz_attempts') || '{}');
      Object.keys(localQuizzes).forEach((qid) => {
        const att = localQuizzes[qid];
        const meta = quizMetaMap.get(qid);
        mergedQuizzesMap.set(qid, {
          quiz_id: qid,
          quiz_title: meta?.title || 'Daily GA Quiz',
          quiz_date: meta?.quiz_date || new Date().toISOString(),
          score: Number(att.score || 0),
          total_questions: Number(att.total_questions || 10),
        });
      });
    } catch (e) {}

    (dbQuizAttemptsRes.data || []).forEach((att: any) => {
      const meta = quizMetaMap.get(att.quiz_id);
      mergedQuizzesMap.set(att.quiz_id, {
        quiz_id: att.quiz_id,
        quiz_title: meta?.title || 'Daily GA Quiz',
        quiz_date: meta?.quiz_date || att.completed_at || new Date().toISOString(),
        score: Number(att.score || 0),
        total_questions: Number(att.total_questions || 10),
      });
    });

    setQuizAttempts(Array.from(mergedQuizzesMap.values()));

    // 6. Exam Countdowns
    if (countdownsRes.data) {
      setExamCountdowns(countdownsRes.data as ExamCountdown[]);
    }

    setLoading(false);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setStatusMsg('');

    try {
      localStorage.setItem('bs_student_target_exam', targetExam);

      const { error: profileError } = await supabase.from('profiles').upsert(
        [
          {
            id: user.id,
            email: user.email,
            student_name: studentName.trim(),
            mobile_number: mobileNumber.trim(),
          },
        ],
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: studentName.trim() },
      });

      if (authError) throw authError;

      if (wmStanding.entry || wmStats.bestScore > 0) {
        const upserted = await upsertWordMatrixLeaderboardEntry({
          userId: user.id,
          name: studentName.trim() || 'Banking Aspirant',
          targetExam,
          bestScore: wmStanding.entry?.bestScore ?? wmStats.bestScore,
          bestClearTimeMs: wmStanding.entry?.bestClearTimeMs ?? wmStats.bestClearTimeMs,
          boardsCleared: wmStanding.entry?.boardsCleared ?? wmStats.boardsCleared,
          bestWinStreak: wmStanding.entry?.bestWinStreak ?? wmStats.bestWinStreak,
        });
        setWmStanding(getUserWordMatrixRank(user.id, upserted.entries));
      }

      setStatusMsg('✅ Profile & Target Exam preferences saved successfully!');
    } catch (err: any) {
      setStatusMsg(`⚠️ Error updating profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center font-bold space-y-4">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs uppercase tracking-widest text-slate-400">Loading Your Learning Hub...</p>
      </div>
    );
  }

  // Computed Analytics
  const submittedMocks = mockAttempts.filter((m) => m.status === 'submitted');
  const inProgressMocks = mockAttempts.filter((m) => m.status === 'in_progress');
  const clearedMocksCount = submittedMocks.filter((m) => m.score >= m.cutoff_marks).length;
  const avgMockPercentage =
    submittedMocks.length > 0
      ? (
          submittedMocks.reduce((acc, m) => acc + (m.score / (m.total_marks || 100)) * 100, 0) /
          submittedMocks.length
        ).toFixed(1)
      : '0.0';

  const totalQuizQuestions = quizAttempts.reduce((acc, q) => acc + (q.total_questions || 0), 0);
  const totalQuizCorrect = quizAttempts.reduce((acc, q) => acc + (q.score || 0), 0);
  const quizAccuracy = totalQuizQuestions > 0 ? Math.round((totalQuizCorrect / totalQuizQuestions) * 100) : 0;

  // Check active status for master courses
  const hasCriticalReasoning = coursePurchases.some(
    (c) => c.course_name?.toLowerCase().includes('critical reasoning') && (!c.expires_at || new Date(c.expires_at) > new Date())
  );
  const hasComputerCourse = coursePurchases.some(
    (c) => (c.course_name?.toLowerCase().includes('computer') || c.course_name?.toLowerCase().includes('pro pass')) && (!c.expires_at || new Date(c.expires_at) > new Date())
  );
  const hasMistakeNotebook = coursePurchases.some(
    (c) => (c.course_name?.toLowerCase().includes('mistake notebook') || c.course_name?.toLowerCase().includes('pro pass')) && (!c.expires_at || new Date(c.expires_at) > new Date())
  );

  // Recent 8 submitted mocks for trend graph
  const trendMocks = [...submittedMocks].slice(0, 8).reverse();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-emerald-500/10 blur-[140px] rounded-full z-0" />

      {/* Top Sticky Navbar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
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
                Student Learning Hub
              </span>
            </div>
          </Link>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-900/90 border border-white/[0.08] p-1 rounded-2xl text-xs overflow-x-auto">
            {[
              { id: 'overview', label: '📊 Overview' },
              { id: 'courses', label: '🎓 Courses & E-Books' },
              { id: 'tests', label: '🚀 Mock & Quiz Log' },
              { id: 'settings', label: '⚙️ Profile Settings' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2 rounded-xl font-bold transition whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/notebook"
              className="px-3.5 py-2 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-black text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <span>🔖</span>
              <span className="hidden sm:inline">Mistake Notebook</span>
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              ← Home
            </Link>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 font-bold text-xs rounded-xl transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        
        {/* HERO WELCOME & EXAM COUNTDOWN BANNER */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-950 border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl bg-grid-pattern">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                {(studentName || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                    🎯 Target: {targetExam}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    🔥 {streakCount} Day Target Streak
                  </span>
                  <Link
                    href="/word-matrix?tab=leaderboard"
                    className="text-[10px] font-black uppercase tracking-widest bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full transition"
                  >
                    🧩 Word Matrix:{' '}
                    {wmStanding.rank !== null ? `Rank #${wmStanding.rank}` : 'Play to Rank'}
                  </Link>
                  <Link
                    href="/ca-raid?tab=badges"
                    className="text-[10px] font-black uppercase tracking-widest bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full transition"
                  >
                    ⚔️ CA Boss Raid:{' '}
                    {raidStats.perfectBadges.length > 0
                      ? `🏅 ${raidStats.perfectBadges.length} Perfect Badge${raidStats.perfectBadges.length === 1 ? '' : 's'}`
                      : 'Fight Daily Boss'}
                  </Link>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Welcome back, {studentName || 'Aspirant'}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Track your mock test percentiles, daily consistency, and enrolled study packages in one place.
                </p>
              </div>
            </div>

            {/* Upcoming Exam Countdowns Strip */}
            {examCountdowns.length > 0 && (
              <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
                {examCountdowns.slice(0, 3).map((ex) => {
                  const diffDays = Math.max(
                    0,
                    Math.ceil((new Date(ex.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  );
                  return (
                    <div
                      key={ex.id}
                      className="bg-slate-950/90 border border-white/[0.08] px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-md"
                    >
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {ex.exam_name}
                        </span>
                        <span className="text-xs font-black text-amber-400">
                          {diffDays === 0 ? 'Today!' : `${diffDays} Days Left`}
                        </span>
                      </div>
                      <span className="text-lg">⏳</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* "RESUME WHERE YOU LEFT OFF" BANNER (IF ANY IN-PROGRESS MOCK EXISTS) */}
        {inProgressMocks.length > 0 && (
          <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-400/40 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-black shrink-0 shadow-md">
                ▶️
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                  Resume Paused Exam Session
                </span>
                <h3 className="text-base sm:text-lg font-black text-white">
                  {inProgressMocks[0].test_title}
                </h3>
                <p className="text-xs text-slate-400">
                  {inProgressMocks[0].exam_type} • Your timer and marked responses are saved.
                </p>
              </div>
            </div>
            <Link
              href={`/mock-test/${inProgressMocks[0].test_id}`}
              className="w-full sm:w-auto text-center px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition whitespace-nowrap"
            >
              Resume Mock Test →
            </Link>
          </div>
        )}

        {/* 4-CARD KPI SUMMARY BAR */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Mocks Completed</span>
              <span className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center text-sm">🚀</span>
            </div>
            <div className="text-3xl font-black text-white">{submittedMocks.length}</div>
            <p className="text-[11px] text-slate-400">
              <strong className="text-emerald-400">{clearedMocksCount} Cleared</strong> • Avg Score: {avgMockPercentage}%
            </p>
          </div>

          <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">GA Quizzes Solved</span>
              <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-sm">💡</span>
            </div>
            <div className="text-3xl font-black text-emerald-400">{quizAttempts.length}</div>
            <p className="text-[11px] text-slate-400">
              Accuracy: <strong className="text-white">{quizAccuracy}%</strong> ({totalQuizCorrect}/{totalQuizQuestions} Qs)
            </p>
          </div>

          <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Library</span>
              <span className="w-8 h-8 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center text-sm">🎓</span>
            </div>
            <div className="text-3xl font-black text-amber-400">
              {(hasCriticalReasoning ? 1 : 0) + (hasComputerCourse ? 1 : 0) + unlockedEBooks.length}
            </div>
            <p className="text-[11px] text-slate-400">
              {(hasCriticalReasoning ? 1 : 0) + (hasComputerCourse ? 1 : 0)} Master Courses • {unlockedEBooks.length} E-Books
            </p>
          </div>

          <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Study Consistency</span>
              <span className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm">🔥</span>
            </div>
            <div className="text-3xl font-black text-purple-400">
              {Object.values(completedDaysMap).filter(Boolean).length} <span className="text-base font-bold text-slate-500">Days</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {completedCompChapters} Computer Chapters Completed
            </p>
          </div>
        </div>

        {/* ==================== TAB 1: OVERVIEW & ANALYTICS ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* DAILY STUDY MISSION + STREAK + XP LEADERBOARD */}
            <DailyMissionWidget
              currentUser={user}
              studentNameOverride={studentName}
              targetExamOverride={targetExam}
              variant="dashboard"
            />

            {/* WORD MATRIX INDIVIDUAL RANK & SPEED STANDING CARD */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-amber-400/25 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-xl flex flex-col items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                  <span className="text-[9px] uppercase tracking-wider leading-none opacity-80">
                    Rank
                  </span>
                  <span className="leading-tight">
                    {wmStanding.rank !== null ? `#${wmStanding.rank}` : '—'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                      🧩 Word Matrix Arena Standing
                    </span>
                    {wmStanding.rank !== null && wmStanding.rank <= 100 && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        🏆 Top 100 Global Board
                      </span>
                    )}
                    {wmStanding.rank !== null && wmStanding.rank > 100 && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        Individual Rank #{wmStanding.rank} of {wmStanding.totalPlayers}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {wmStanding.rank === null
                      ? 'Unranked — Complete 1 Word Matrix Board to Get Your Global Rank'
                      : wmStanding.rank <= 100
                      ? `Ranked #${wmStanding.rank} in the Top 100 Champions Board!`
                      : `Your Individual Global Rank: #${wmStanding.rank} (+${wmStanding.pointsToTop100} pts to enter Top 100)`}
                  </h3>

                  <p className="text-xs text-slate-400">
                    Best Score:{' '}
                    <strong className="text-amber-300">
                      {wmStanding.entry?.bestScore ?? wmStats.bestScore} pts
                    </strong>{' '}
                    • Fastest 4×4 Clear:{' '}
                    <strong className="text-emerald-400">
                      {(wmStanding.entry?.bestClearTimeMs ?? wmStats.bestClearTimeMs) !== null
                        ? `${(
                            ((wmStanding.entry?.bestClearTimeMs ??
                              wmStats.bestClearTimeMs) as number) / 1000
                          ).toFixed(1)}s`
                        : '--'}
                    </strong>{' '}
                    • Boards Cleared:{' '}
                    <strong className="text-white">
                      {wmStanding.entry?.boardsCleared ?? wmStats.boardsCleared}
                    </strong>{' '}
                    • Best Streak:{' '}
                    <strong className="text-white">
                      {wmStanding.entry?.bestWinStreak ?? wmStats.bestWinStreak}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Link
                  href="/word-matrix?tab=leaderboard"
                  className="px-4 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-amber-300 font-black text-xs transition"
                >
                  🏆 View Top 100 →
                </Link>
                <Link
                  href="/word-matrix"
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition"
                >
                  🎮 Play Word Matrix
                </Link>
              </div>
            </div>

            {/* DAILY CURRENT AFFAIRS BOSS RAID & PERFECT-SCORE BADGES CARD */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-rose-500/25 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 via-amber-500 to-amber-400 text-slate-950 font-black text-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                  ⚔️
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-400">
                      ⚔️ Daily Current Affairs Raid (&ldquo;The CA Boss Fight&rdquo;)
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                      🏅 {raidStats.perfectBadges.length} Perfect Slayer Badge
                      {raidStats.perfectBadges.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {raidStats.perfectBadges.length > 0
                      ? `Latest Badge: ${raidStats.perfectBadges[0].tierLabel} (${raidStats.perfectBadges[0].dateKey})`
                      : 'Score 100% Within the Speed Limit to Mint a Perfect Boss Slayer Badge!'}
                  </h3>

                  <p className="text-xs text-slate-400">
                    Raids Completed: <strong className="text-white">{raidStats.raidsPlayed}</strong> •
                    Total Boss Damage:{' '}
                    <strong className="text-rose-400">
                      {raidStats.totalDamageDealt.toLocaleString()} DMG
                    </strong>{' '}
                    • Best Raid Score:{' '}
                    <strong className="text-emerald-400">{raidStats.bestScore}/10</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <Link
                  href="/ca-raid?tab=badges"
                  className="px-4 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-amber-300 font-black text-xs transition"
                >
                  🏅 Badges ({raidStats.perfectBadges.length}) →
                </Link>
                <Link
                  href="/ca-raid"
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 transition"
                >
                  ⚔️ Enter CA Boss Raid
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left 2 Columns: Mock Score Trend Chart */}
              <div className="lg:col-span-2 bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/[0.08] pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">
                      Performance Trajectory
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-white">Recent Mock Test Score Trend (%)</h2>
                  </div>
                  <Link href="/tests" className="text-xs font-bold text-amber-400 hover:underline">
                    Attempt New Mock →
                  </Link>
                </div>

                {trendMocks.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="text-3xl">📈</div>
                    <p className="text-sm font-bold text-white">No Completed Mocks Yet</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Complete your first full-length or sectional mock test to unlock your visual score trajectory.
                    </p>
                    <Link
                      href="/tests"
                      className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition"
                    >
                      Go to Mock Test Series →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Bar & Threshold Chart */}
                    <div className="relative h-52 bg-slate-950/80 border border-white/[0.06] rounded-2xl p-5 flex items-end justify-around gap-3 pt-10">
                      {/* 55% Reference Cut-off Line */}
                      <div
                        className="absolute left-4 right-4 border-t border-dashed border-amber-400/50 flex justify-end items-center pointer-events-none"
                        style={{ bottom: '55%' }}
                      >
                        <span className="text-[9px] font-bold uppercase bg-slate-900 text-amber-400 px-1.5 py-0.5 rounded -mt-4 border border-amber-400/30">
                          Typical Cut-off
                        </span>
                      </div>

                      {trendMocks.map((m, idx) => {
                        const pct = Math.max(5, Math.min(100, Math.round((m.score / (m.total_marks || 100)) * 100)));
                        const passed = m.score >= m.cutoff_marks;
                        return (
                          <div key={m.id + idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                            <span className="text-[10px] font-black text-slate-200">
                              {m.score.toFixed(1)}
                            </span>
                            <div
                              style={{ height: `${pct}%` }}
                              className={`w-full max-w-[42px] rounded-t-xl transition-all duration-300 ${
                                passed
                                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-lg shadow-emerald-500/20'
                                  : 'bg-gradient-to-t from-blue-600 to-sky-400 shadow-lg shadow-blue-500/20'
                              }`}
                            />
                            <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[70px]" title={m.test_title}>
                              {m.test_title}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Cleared Cut-off
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> Attempted
                        </span>
                      </div>
                      <span>Showing last {trendMocks.length} test(s)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: 30-Day Consistency Heatmap */}
              <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between space-y-5">
                <div className="border-b border-white/[0.08] pb-4 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                      Habit Tracker
                    </span>
                    <h2 className="text-lg font-black text-white">30-Day Target Matrix</h2>
                  </div>
                  <Link href="/targets" className="text-xs font-bold text-emerald-400 hover:underline">
                    Open Hub →
                  </Link>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                    const isDone = completedDaysMap[day];
                    return (
                      <Link
                        key={day}
                        href="/targets"
                        title={`Day ${day}: ${isDone ? 'Completed' : 'Pending'}`}
                        className={`h-9 rounded-xl text-[11px] font-bold flex items-center justify-center border transition ${
                          isDone
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                            : 'bg-slate-950/80 border-white/[0.06] text-slate-500 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        D{day}
                      </Link>
                    );
                  })}
                </div>

                <div className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-3.5 text-xs text-slate-400 flex items-center justify-between">
                  <span>Completed Days:</span>
                  <strong className="text-emerald-400 font-black">
                    {Object.values(completedDaysMap).filter(Boolean).length} / 30 Days
                  </strong>
                </div>
              </div>
            </div>

            {/* Quick Study Hub Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/critical-reasoning"
                className="bg-slate-900/70 hover:bg-slate-900 border border-white/[0.08] hover:border-blue-500/40 rounded-2xl p-5 flex items-center gap-4 transition group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center text-2xl shrink-0">
                  🧠
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                    {hasCriticalReasoning ? '✓ Enrolled' : 'Master Course'}
                  </span>
                  <h4 className="text-sm font-black text-white group-hover:text-blue-400 transition">
                    Critical Reasoning
                  </h4>
                </div>
              </Link>

              <Link
                href="/computer-awareness"
                className="bg-slate-900/70 hover:bg-slate-900 border border-white/[0.08] hover:border-amber-400/40 rounded-2xl p-5 flex items-center gap-4 transition group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-400 flex items-center justify-center text-2xl shrink-0">
                  💻
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                    {hasComputerCourse ? '✓ Enrolled' : `${completedCompChapters} Chapters Read`}
                  </span>
                  <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition">
                    Computer Awareness
                  </h4>
                </div>
              </Link>

              <Link
                href="/rrb-pdf-course"
                className="bg-slate-900/70 hover:bg-slate-900 border border-white/[0.08] hover:border-purple-500/40 rounded-2xl p-5 flex items-center gap-4 transition group"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center text-2xl shrink-0">
                  📚
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                    Bilingual PDFs
                  </span>
                  <h4 className="text-sm font-black text-white group-hover:text-purple-400 transition">
                    RRB Practice Course
                  </h4>
                </div>
              </Link>

              <Link
                href="/calc-lab"
                className="bg-slate-900/70 hover:bg-slate-900 border border-white/[0.08] hover:border-emerald-500/40 rounded-2xl p-5 flex items-center gap-4 transition group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-2xl shrink-0">
                  ⚡
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                    60s Blitz Drills
                  </span>
                  <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition">
                    Calculation Speed Lab
                  </h4>
                </div>
              </Link>
            </div>

            {/* 🔖 Smart Mistake & Revision Notebook Banner */}
            <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/90 to-rose-500/10 border border-amber-400/25 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center text-2xl shrink-0">
                  🔖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                      Smart Vault
                    </span>
                    <span className="text-[11px] font-bold text-rose-400">Auto-Captures Wrong Answers</span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    Mistake &amp; Revision Notebook
                  </h3>
                  <p className="text-xs text-slate-400">
                    Review bookmarked questions, add personal formula notes, and launch a custom &ldquo;Fix Your Mistakes&rdquo; practice drill.
                  </p>
                </div>
              </div>
              <Link
                href="/notebook"
                className="px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition shrink-0"
              >
                {hasMistakeNotebook ? 'Open Mistake Notebook →' : '🔒 Unlock Mistake Notebook →'}
              </Link>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: MY COURSES & E-BOOKS ==================== */}
        {activeTab === 'courses' && (
          <div className="space-y-8 animate-fade-in">
            {/* Master Courses Section */}
            <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">🎓 Master Courses &amp; Subscriptions</h2>
                  <p className="text-xs text-slate-400">Access your unlocked courses or explore available masterclasses.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    href="/courses"
                    className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-slate-200 font-black text-xs rounded-xl transition flex items-center gap-1.5"
                  >
                    <span>🎓</span>
                    <span>Browse All Free &amp; Paid Courses →</span>
                  </Link>
                  {isProPassVisible && (
                    <Link
                      href="/pro-pass"
                      className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
                    >
                      <span>👑</span>
                      <span>Explore PRO Pass Plans →</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Critical Reasoning Card */}
                <div className="bg-slate-950/80 border border-blue-500/30 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">🧠</span>
                      <span
                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                          hasCriticalReasoning
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                        }`}
                      >
                        {hasCriticalReasoning ? '✓ Active Subscription' : '🔒 Paid Course'}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">Critical Reasoning Mastery Course</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Bilingual English/Hinglish chapters on Assumptions, Inferences, Courses of Action &amp; CBT Chapter Mocks.
                    </p>
                  </div>
                  <Link
                    href="/critical-reasoning"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl text-center transition block shadow-lg shadow-blue-600/20"
                  >
                    {hasCriticalReasoning ? 'Continue Learning →' : 'Unlock Course →'}
                  </Link>
                </div>

                {/* Computer Awareness Card */}
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">💻</span>
                      <span
                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                          hasComputerCourse
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                        }`}
                      >
                        {hasComputerCourse ? '✓ Active Subscription' : '🔒 Paid Course'}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">Complete Computer Awareness (2026)</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Structured markdown notes, shortcut tables, and downloadable chapter-wise MCQ PDFs for RRB &amp; IBPS Mains.
                    </p>
                  </div>
                  <Link
                    href="/computer-awareness"
                    className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl text-center transition block shadow-lg shadow-amber-500/20"
                  >
                    {hasComputerCourse ? 'Continue Learning →' : 'Unlock Course →'}
                  </Link>
                </div>

                {/* Smart Mistake Notebook & Unlimited Re-Attempt Drills Card */}
                <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl p-6 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-2xl">🔖</span>
                      <span
                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                          hasMistakeNotebook
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        }`}
                      >
                        {hasMistakeNotebook ? '✓ Active Subscription' : '🔒 Paid Vault'}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-white">Smart Mistake Notebook &amp; Drills</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Auto-captures wrong mock/quiz answers, personal formula notes &amp; unlimited &ldquo;Fix Your Mistakes&rdquo; practice drills.
                    </p>
                  </div>
                  <Link
                    href="/notebook"
                    className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl text-center transition block shadow-lg shadow-rose-500/20"
                  >
                    {hasMistakeNotebook ? 'Open Revision Vault →' : '🔒 Unlock Vault (₹99 w/ BSOL) →'}
                  </Link>
                </div>
              </div>
            </div>

            {/* Unlocked E-Books Shelf */}
            <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
              <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">📚 My Unlocked E-Books</h2>
                  <p className="text-xs text-slate-400">Instant PDF downloads for all e-books you have purchased.</p>
                </div>
                <Link href="/ebooks" className="text-xs font-bold text-amber-400 hover:underline">
                  Browse E-Book Store →
                </Link>
              </div>

              {unlockedEBooks.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="text-3xl">📖</div>
                  <p className="text-sm font-bold text-white">No Purchased E-Books Yet</p>
                  <p className="text-xs text-slate-400">Any e-book you unlock from the E-Books Store will appear here for lifetime download.</p>
                  <Link
                    href="/ebooks"
                    className="inline-block px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
                  >
                    Explore E-Books Store →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {unlockedEBooks.map((book) => (
                    <div
                      key={book.id}
                      className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between space-y-4"
                    >
                      <div className="flex gap-4">
                        {book.cover_url && (
                          <img
                            src={book.cover_url}
                            alt={book.title}
                            className="w-16 h-24 object-cover rounded-xl border border-slate-800 shrink-0"
                          />
                        )}
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                            ✓ Unlocked
                          </span>
                          <h4 className="font-bold text-white text-sm leading-snug pt-1">{book.title}</h4>
                          <p className="text-[11px] text-slate-400">{book.author}</p>
                        </div>
                      </div>
                      <a
                        href={book.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl text-center transition block"
                      >
                        ⬇️ Download PDF
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 🧾 Payment History & Downloadable Tax Receipts */}
            {coursePurchases.length > 0 && (
              <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">
                    🧾 Payment Receipts &amp; Tax Invoices
                  </h2>
                  <p className="text-xs text-slate-400">
                    Download official payment receipts for your enrolled courses and PRO Pass bundles.
                  </p>
                </div>

                <div className="space-y-3">
                  {coursePurchases.map((pur) => (
                    <div
                      key={pur.id}
                      className="bg-slate-950/85 border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-white">{pur.course_name}</span>
                          <span className="text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            ✓ Verified
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Paid: <strong className="text-amber-400">₹{pur.amount_paid}</strong> •{' '}
                          Date: {new Date(pur.created_at || Date.now()).toLocaleDateString('en-IN')}
                          {pur.expires_at
                            ? ` • Valid till ${new Date(pur.expires_at).toLocaleDateString('en-IN')}`
                            : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          downloadPurchaseReceipt({
                            receiptId: pur.id || 'ORDER',
                            itemName: pur.course_name,
                            itemType: pur.course_name?.includes('PRO Pass')
                              ? 'PRO Pass Bundle'
                              : 'Master Course',
                            amountPaid: pur.amount_paid,
                            paymentId: pur.payment_id || 'ONLINE',
                            purchaseDate: pur.created_at,
                            expiryDate: pur.expires_at,
                            studentName: studentName || 'Aspirant',
                            studentEmail: user?.email || '',
                          })
                        }
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-amber-400/30 text-amber-300 font-bold text-xs rounded-xl transition shrink-0"
                      >
                        🧾 Download Receipt
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: MOCK & QUIZ HISTORY ==================== */}
        {activeTab === 'tests' && (
          <div className="space-y-8 animate-fade-in">
            {/* Mock Tests Table */}
            <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">🚀 Mock Test Attempts Log</h2>
                  <p className="text-xs text-slate-400">Review your scorecards, solutions, or resume paused tests.</p>
                </div>
                <Link href="/tests" className="text-xs font-bold text-blue-400 hover:underline">
                  All Mock Tests →
                </Link>
              </div>

              {mockAttempts.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-sm font-bold text-white">No mock test attempts recorded yet.</p>
                  <Link href="/tests" className="inline-block text-xs text-amber-400 font-bold hover:underline">
                    Attempt your first Mock Test →
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {mockAttempts.map((att) => {
                    const isSub = att.status === 'submitted';
                    const passed = att.score >= att.cutoff_marks;
                    return (
                      <div
                        key={att.id}
                        className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-extrabold uppercase bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                              {att.exam_type}
                            </span>
                            {isSub ? (
                              <span
                                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                                  passed
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                Score: {att.score.toFixed(1)} / {att.total_marks} (Cut-off: {att.cutoff_marks})
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                                ⏳ Paused Session
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm sm:text-base font-bold text-white">{att.test_title}</h4>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          {isSub ? (
                            <>
                              <Link
                                href={`/mock-test/${att.test_id}/result`}
                                className="flex-1 sm:flex-initial text-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition"
                              >
                                📊 Scorecard
                              </Link>
                              <Link
                                href={`/mock-test/${att.test_id}?mode=solution`}
                                className="flex-1 sm:flex-initial text-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 font-bold text-xs rounded-xl transition"
                              >
                                👁️ Solutions
                              </Link>
                            </>
                          ) : (
                            <Link
                              href={`/mock-test/${att.test_id}`}
                              className="w-full sm:w-auto text-center px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
                            >
                              ▶️ Resume Test
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BSCA Daily Quizzes Log */}
            <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
              <div className="flex justify-between items-center border-b border-white/[0.08] pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">💡 BSCA Daily Quiz History</h2>
                  <p className="text-xs text-slate-400">Your completed General Awareness quizzes and scores.</p>
                </div>
                <Link href="/bsca-quiz" className="text-xs font-bold text-emerald-400 hover:underline">
                  Open Quiz Hub →
                </Link>
              </div>

              {quizAttempts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No daily GA quizzes completed yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quizAttempts.map((q) => (
                    <div
                      key={q.quiz_id}
                      className="bg-slate-950/80 border border-white/[0.08] rounded-2xl p-4 flex justify-between items-center gap-3"
                    >
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">
                          📅 {new Date(q.quiz_date).toLocaleDateString()}
                        </span>
                        <h4 className="text-sm font-bold text-white mt-0.5">{q.quiz_title}</h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-black text-emerald-400 block">
                          {q.score} / {q.total_questions}
                        </span>
                        <Link href="/bsca-quiz" className="text-[10px] text-amber-400 font-bold hover:underline">
                          Review →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: PROFILE SETTINGS ==================== */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-7 sm:p-8 shadow-2xl space-y-6 animate-fade-in">
            <div className="border-b border-white/[0.08] pb-4">
              <h2 className="text-lg sm:text-xl font-black text-white">⚙️ Aspirant Profile Settings</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Update your display name for mock test leaderboards and set your primary target exam.
              </p>
            </div>

            {statusMsg && (
              <div className="p-3.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs rounded-xl font-bold">
                {statusMsg}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Email Address (Verified)
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-slate-950/60 border border-white/[0.06] rounded-xl p-3.5 text-xs text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Full Name / Leaderboard Display Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3.5 text-sm text-white outline-none focus:border-amber-400 transition"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Primary Target Exam
                </label>
                <select
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3.5 text-sm text-white font-semibold outline-none focus:border-amber-400 transition"
                >
                  <option value="SBI PO & IBPS PO 2026">SBI PO &amp; IBPS PO 2026</option>
                  <option value="SBI Clerk & IBPS Clerk 2026">SBI Clerk &amp; IBPS Clerk 2026</option>
                  <option value="IBPS RRB PO & Clerk 2026">IBPS RRB PO &amp; Clerk 2026</option>
                  <option value="RBI Grade B & Assistant">RBI Grade B &amp; Assistant</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Mobile Number (WhatsApp Updates)
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3.5 text-sm text-white outline-none focus:border-amber-400 transition"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition"
              >
                {saving ? 'Saving Preferences...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}
