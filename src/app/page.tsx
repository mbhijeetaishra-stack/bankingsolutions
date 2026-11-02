'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import ReviewsSection from '@/components/ReviewsSection';
import DailyMissionWidget from '@/components/DailyMissionWidget';
import ThemeToggle from '@/components/ThemeToggle';
import { getProPassConfig, syncMonetizationFromSupabase } from '@/lib/monetization';

interface EBook {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  pdf_url: string;
  price: number;
}

export default function BankingSolutionsHomePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marqueeNotices, setMarqueeNotices] = useState<Array<{ id: string; notice_text: string }>>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProPassVisible, setIsProPassVisible] = useState(() => getProPassConfig().isVisibleOnWebsite);
  
  // Computer Course Pop-up & E-Books State
  const [showPopup, setShowPopup] = useState(false);
  const [ebooks, setEbooks] = useState<EBook[]>([]);
  const [inProgressMock, setInProgressMock] = useState<{ id: string; title: string } | null>(null);

  const checkAdminStatus = (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const isUserAdmin = user.user_metadata?.is_admin === true || user.app_metadata?.role === 'admin';
    setIsAdmin(isUserAdmin);
  };

  const checkRecentInProgressMock = async (userId: string) => {
    const { data: attempt } = await supabase
      .from('mock_attempts')
      .select('test_id')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (attempt?.test_id) {
      const { data: testObj } = await supabase
        .from('mock_tests')
        .select('id, title')
        .eq('id', attempt.test_id)
        .maybeSingle();

      if (testObj) {
        setInProgressMock({ id: testObj.id, title: testObj.title });
      }
    }
  };

  useEffect(() => {
    syncMonetizationFromSupabase().then((synced) => {
      setIsProPassVisible(synced.proPassConfig.isVisibleOnWebsite);
    });

    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        checkAdminStatus(session.user);
        checkRecentInProgressMock(session.user.id);
      }
    });

    // Fetch Marquee Notices
    supabase
      .from('admin_marquee_notices')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (data) setMarqueeNotices(data);
      });

    // Fetch Published E-Books (Limit to 3 for Homepage preview)
    supabase
      .from('ebooks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setEbooks(data);
      });

    // Show computer course pop-up if not seen in this session
    const hasSeenPopup = sessionStorage.getItem('bs_computer_popup_seen');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setShowPopup(true);
        sessionStorage.setItem('bs_computer_popup_seen', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);
      if (user) {
        checkAdminStatus(user);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-[#020617] text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950 flex flex-col lg:flex-row relative">
      
      {/* AMBIENT BACKGROUND GLOWS */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-amber-500/10 via-blue-600/10 to-purple-500/5 blur-[130px] rounded-full" />
        <div className="absolute top-[35%] -left-48 w-[500px] h-[500px] bg-blue-600/5 blur-[140px] rounded-full" />
        <div className="absolute top-[55%] -right-48 w-[500px] h-[500px] bg-amber-500/5 blur-[140px] rounded-full" />
      </div>

      {/* COMPUTER COURSE POP-UP MODAL */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fade-in">
          <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900/95 to-slate-950 border border-amber-500/30 rounded-3xl p-7 md:p-9 shadow-[0_25px_70px_-15px_rgba(245,158,11,0.25)] text-center space-y-6 overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-400/20 blur-3xl pointer-events-none" />
            
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 rounded-full flex items-center justify-center text-xs font-bold transition"
              aria-label="Close modal"
            >
              ✕
            </button>

            <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400/20 to-amber-600/10 text-amber-400 border border-amber-400/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-amber-500/10">
              💻
            </div>

            <div className="space-y-2.5 relative">
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[11px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full">
                <span>🔥</span> Special Launch Offer
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Complete Computer Awareness Course
              </h2>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed max-w-md mx-auto">
                Master computer awareness for IBPS, SBI, and RBI exams. Get full syllabus notes, chapter MCQs, and 6 months access. Use code <strong className="text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">BSOL</strong> for ₹50 OFF!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 relative">
              <Link
                href="/computer-awareness"
                onClick={() => setShowPopup(false)}
                className="flex-1 py-3.5 px-6 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all duration-200 hover:-translate-y-0.5"
              >
                🚀 Explore Course (₹149 Onwards)
              </Link>
              <button
                onClick={() => setShowPopup(false)}
                className="py-3.5 px-5 bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/70 font-semibold text-xs sm:text-sm rounded-xl transition"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal Overlay */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          checkAdminStatus(user);
        }}
      />

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* --- DOCKED LEFT NAVIGATION SIDEBAR (Desktop Fixed, Mobile Drawer) --- */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 xl:w-72 bg-slate-950/95 lg:bg-slate-950/90 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col justify-between shrink-0 h-full transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header / Branding */}
        <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin flex-1">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-white p-1 shadow-md shadow-amber-400/10 shrink-0 group-hover:scale-105 transition-transform duration-200 border border-slate-200">
                <img
                  src="/channel-logo.png"
                  alt="BankingSolutions Logo"
                  className="h-full w-full object-contain rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="text-left min-w-0">
                <span className="text-base font-black tracking-tight text-white group-hover:text-amber-400 transition block leading-tight truncate">
                  BankingSolutions
                </span>
                <span className="text-[9px] text-amber-400/90 font-bold uppercase tracking-wider block mt-0.5 truncate">
                  Touch the sky with glory
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden w-7 h-7 rounded-lg bg-slate-900 border border-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center text-xs"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* PRO Pass Banner / Card */}
          {isProPassVisible && (
            <Link
              href="/pro-pass"
              className="block p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-900 border border-amber-400/35 hover:border-amber-400/60 shadow-sm transition group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/30 flex items-center gap-1">
                  <span>👑</span> PRO PASS
                </span>
                <span className="text-[11px] font-black text-amber-400 group-hover:translate-x-0.5 transition">
                  Join ↗
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-semibold mt-1.5 leading-snug">
                All Courses, Tests, PDFs &amp; BSCA unlocked.
              </p>
            </Link>
          )}

          {/* Navigation Links Group 1: Core Platforms */}
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 pb-0.5">
              Prepare &amp; Learn
            </div>
            {[
              { href: '/', label: 'Home Overview', icon: '🏠', active: true },
              { href: '/courses', label: 'Master Courses', icon: '🎓', badge: 'Hot' },
              { href: '/bsca', label: 'BSCA Current Affairs', icon: '📰', badge: 'Daily' },
              { href: '/critical-reasoning', label: 'Critical Reasoning', icon: '🧠', badge: 'Special' },
              { href: '/rrb-pdf-course', label: 'RRB PDF Course', icon: '📚' },
              { href: '/computer-awareness', label: 'Computer Awareness', icon: '💻' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                  item.active
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md font-black'
                    : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                      item.active
                        ? 'bg-slate-950 text-amber-300'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Navigation Links Group 2: Practice & Test */}
          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 pb-0.5">
              Practice &amp; Mocks
            </div>
            {[
              { href: '/tests', label: 'Mock Test Series', icon: '🚀', badge: 'CBT' },
              { href: '/practice', label: 'Smart Practice (BSPS)', icon: '🧮' },
              { href: '/calc-lab', label: 'Speed Calc Lab', icon: '⚡' },
              { href: '/word-matrix', label: 'Word Matrix (Vocab)', icon: '🧩' },
              { href: '/ca-raid', label: 'Daily CA Boss Raid', icon: '⚔️', badge: 'Raid' },
              { href: '/articles', label: 'Exam Alerts & Articles', icon: '📢' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border-white/[0.05]"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Navigation Links Group 3: Vault & Hub */}
          <div className="space-y-1 pt-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 pb-0.5">
              Personal Vault
            </div>
            {[
              { href: '/notebook', label: 'Mistake & Vault Notebook', icon: '🔖' },
              { href: '/profile', label: 'My Learning Hub', icon: '📊' },
              ...(isAdmin ? [{ href: '/admin', label: 'Admin Portal', icon: '⚙️', badge: 'Admin' }] : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between border bg-slate-900/60 hover:bg-slate-900 text-slate-300 hover:text-white border-white/[0.05]"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span className="text-sm shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar Footer: User / App Install */}
        <div className="p-3 border-t border-white/[0.08] space-y-2 shrink-0 bg-slate-950/90">
          {currentUser ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    {(currentUser.user_metadata?.full_name || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate text-xs font-bold text-slate-200">
                    {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow-md text-center"
            >
              Log In / Sign Up
            </button>
          )}

          {/* Theme Toggle in Sidebar */}
          <ThemeToggle variant="sidebar" />

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('bs-open-pwa-install'));
              }
            }}
            className="w-full py-1.5 px-2 bg-slate-900/80 hover:bg-slate-900 text-slate-400 hover:text-amber-300 text-[11px] font-bold rounded-lg border border-white/[0.06] transition flex items-center justify-center gap-1.5"
          >
            <span>📲</span> Install Web App
          </button>
        </div>
      </aside>

      {/* --- RIGHT CONTENT VIEWPORT (Scrolls Independently) --- */}
      <div className="flex-1 min-w-0 lg:h-screen lg:overflow-y-auto scrollbar-thin flex flex-col bg-[#020617]">
        {/* Sticky Top Bar for Right Pane */}
        <header className="sticky top-0 z-30 bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-900 border border-white/[0.08] text-amber-400 hover:text-amber-300 shrink-0"
              aria-label="Open Sidebar Menu"
            >
              ☰
            </button>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-black text-white flex items-center gap-2 truncate">
                <span>BankingSolutions Portal</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                  SBI · IBPS · RRB 2026
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isProPassVisible && (
              <Link
                href="/pro-pass"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400/15 to-orange-500/15 hover:from-amber-400/25 hover:to-orange-500/25 text-amber-300 border border-amber-400/35 font-black text-xs rounded-xl transition"
              >
                <span>👑</span>
                <span>PRO Pass</span>
              </Link>
            )}

            <Link
              href="/notebook"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/30 font-bold text-xs rounded-xl transition"
              title="Mistake Notebook"
            >
              <span>🔖</span>
              <span>Notebook</span>
            </Link>

            <Link
              href="/profile"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/[0.08] font-bold text-xs rounded-xl transition"
            >
              <span>📊</span>
              <span className="hidden sm:inline ml-1.5">Dashboard</span>
            </Link>

            {/* Dark / Light Mode Toggle Switch */}
            <ThemeToggle variant="switch" />

            {!currentUser && (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

      {/* --- MARQUEE NOTICES TICKER --- */}
      {marqueeNotices.length > 0 && (
        <div className="relative z-10 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 text-slate-950 font-bold text-xs py-2.5 px-4 overflow-hidden whitespace-nowrap shadow-md border-b border-amber-500/30 flex items-center">
          <div className="bg-slate-950 text-amber-400 px-3 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest mr-4 flex-shrink-0 shadow-sm z-10 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>UPDATES</span>
          </div>
          <div className="w-full overflow-hidden relative flex">
            <div className="animate-marquee-slow space-x-12 tracking-wide inline-block font-extrabold">
              {marqueeNotices.map((notice) => (
                <span key={notice.id} className="inline-flex items-center gap-3">
                  <span>{notice.notice_text}</span>
                  <span className="opacity-40">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 pt-14 sm:pt-20 pb-20 px-6 max-w-6xl mx-auto text-center bg-grid-pattern">
        {/* Personalized Student Quick-Bar when logged in */}
        {currentUser && (
          <div className="max-w-3xl mx-auto mb-8 bg-slate-900/80 backdrop-blur-xl border border-white/[0.1] rounded-2xl p-3.5 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                {(currentUser.user_metadata?.full_name || currentUser.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Welcome back, {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}!
                </span>
                <span className="text-[11px] text-slate-400">
                  {inProgressMock
                    ? `Paused Mock: ${inProgressMock.title}`
                    : 'View your mock score trends, enrolled courses & 30-day target streak.'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {inProgressMock && (
                <Link
                  href={`/mock-test/${inProgressMock.id}`}
                  className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition whitespace-nowrap"
                >
                  ▶️ Resume Test
                </Link>
              )}
              <Link
                href="/profile"
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.08] font-bold text-xs rounded-xl transition whitespace-nowrap"
              >
                📊 Open Learning Hub →
              </Link>
            </div>
          </div>
        )}

        {/* Top Pill Badge */}
        <div className="inline-flex items-center space-x-2.5 bg-slate-900/90 border border-amber-400/30 text-amber-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide mb-8 shadow-[0_0_30px_-5px_rgba(251,191,36,0.2)]">
          <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span>SBI PO/CLERK, IBPS PO/CLERK &amp; RRB 2026 Exam Ready</span>
        </div>

        {/* Main Hero Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4rem] font-black tracking-tight text-white mb-6 leading-[1.08] max-w-4xl mx-auto">
          Crack Banking Exams with{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
            Precision Content
          </span>{' '}
          &amp;{' '}
          <span className="bg-gradient-to-r from-blue-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
            Advanced Reasoning
          </span>
        </h1>

        <p className="text-slate-300/85 text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Master Critical Reasoning, Quantitative Aptitude, and General Awareness through structured Practice Sheets (BSPS), Current Affairs (BSCA), Real CBT Mock Simulations, and Master Courses.
        </p>

        {/* PRIMARY HERO CTAS */}
        <div className="flex flex-wrap justify-center items-center gap-3.5 mb-16">
          <Link
            href="/tests"
            className="px-7 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl transition-all duration-200 shadow-[0_10px_30px_-5px_rgba(245,158,11,0.35)] hover:shadow-[0_15px_35px_-5px_rgba(245,158,11,0.5)] hover:-translate-y-0.5 uppercase tracking-wider flex items-center gap-2.5"
          >
            <span>🚀</span>
            <span>Explore Mock Tests</span>
          </Link>

          <Link
            href="/critical-reasoning"
            className="px-7 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm rounded-2xl transition-all duration-200 shadow-[0_10px_30px_-5px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 uppercase tracking-wider flex items-center gap-2.5 border border-blue-400/20"
          >
            <span>🧠</span>
            <span>Critical Reasoning Course</span>
          </Link>

          <Link
            href="/pro-pass"
            className="px-7 py-4 bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-400/35 hover:border-amber-400/60 font-black text-xs sm:text-sm rounded-2xl transition-all duration-200 shadow-lg hover:-translate-y-0.5 uppercase tracking-wider flex items-center gap-2.5"
          >
            <span>👑</span>
            <span>12-Month PRO Pass</span>
          </Link>

          <Link
            href="/calc-lab"
            className="px-7 py-4 bg-slate-900/90 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400/60 font-black text-xs sm:text-sm rounded-2xl transition-all duration-200 shadow-lg hover:-translate-y-0.5 uppercase tracking-wider flex items-center gap-2.5"
          >
            <span>⚡</span>
            <span>Launch Calc Lab</span>
          </Link>
        </div>

        {/* TRUST METRICS STATS BAR */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-slate-900/70 p-6 sm:p-8 rounded-3xl border border-white/[0.08] backdrop-blur-xl max-w-4xl mx-auto text-center shadow-2xl">
          <div className="space-y-1 border-r border-white/[0.06] last:border-none pr-2">
            <span className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent block tracking-tight">
              11.5K+
            </span>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">
              Active Aspirants
            </span>
          </div>
          <div className="space-y-1 md:border-r border-white/[0.06] pr-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-400 block tracking-tight">
              BSPS
            </span>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">
              Daily Practice Sheets
            </span>
          </div>
          <div className="space-y-1 border-r border-white/[0.06] pr-2 pt-3 md:pt-0 border-t md:border-t-0">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 block tracking-tight">
              BSCA
            </span>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">
              Banking Current Affairs
            </span>
          </div>
          <div className="space-y-1 pt-3 md:pt-0 border-t md:border-t-0">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 block tracking-tight">
              CBT Engine
            </span>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest block">
              Real Exam Interface
            </span>
          </div>
        </div>
      </section>

      {/* --- DAILY STUDY TARGET CHECKLIST ("DAILY MISSION" + STREAK + XP LEADERBOARD) --- */}
      <section className="relative z-10 pb-16 px-6 max-w-6xl mx-auto">
        <DailyMissionWidget currentUser={currentUser} variant="homepage" />
      </section>

      {/* --- CORE PRACTICE HUBS SECTION --- */}
      <section className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-white/[0.08]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-400 block mb-2">
              Structured Preparation Ecosystem
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Core Practice Hubs &amp; Master Courses
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md">
            Every module is crafted to replicate exact SBI, IBPS, and RBI difficulty levels with step-by-step solutions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 0: Critical Reasoning Master Course */}
          <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950 border border-blue-500/30 hover:border-blue-400/70 rounded-3xl p-7 shadow-xl transition-all duration-300 hover:-translate-y-1 group flex flex-col justify-between overflow-hidden">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition" />
            <div className="space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-inner">
                  🧠
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full">
                  Master Course
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition tracking-tight">
                Critical Reasoning Mastery Course
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Master assumptions, inferences, courses of action, strong/weak arguments, and real CBT-style chapter practice mock exams.
              </p>
            </div>

            <Link
              href="/critical-reasoning"
              className="mt-7 w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2"
            >
              <span>Explore Course</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 1: Daily Targets Hub */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-emerald-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  🎯
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full">
                  Consistency Tracker
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition tracking-tight">
                Daily Targets &amp; Consistency Hub
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Day-wise micro-goals, track-wise routines (Beginner &amp; Repeater), strategy video guides, and daily streak tracking.
              </p>
            </div>
            <Link
              href="/targets"
              className="mt-7 w-full bg-slate-800/90 hover:bg-emerald-600 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Open Daily Targets Hub</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 2: BSPS Practice Sheets */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-blue-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  📄
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-300 border border-blue-500/20 px-3 py-1 rounded-full">
                  Daily PDFs
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-blue-400 transition tracking-tight">
                BSPS Practice Sheets
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Day-wise structured practice PDFs for Quant &amp; Reasoning. High-level DI sets, Puzzles, Arithmetic, and Speed Math sheets.
              </p>
            </div>
            <Link
              href="/pdf-courses?category=BSPS"
              className="mt-7 w-full bg-slate-800/90 hover:bg-blue-600 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Open BSPS Sheets</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 3: BSCA Current Affairs */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-amber-400/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  📰
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1 rounded-full">
                  General Awareness
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition tracking-tight">
                BSCA Current Affairs
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Daily &amp; monthly General Awareness PDFs curated for Banking, Financial News, RBI Notifications, and Static GK.
              </p>
            </div>
            <Link
              href="/bsca"
              className="mt-7 w-full bg-slate-800/90 hover:bg-amber-400 hover:text-slate-950 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Open BSCA Current Affairs</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 4: BSCA Daily GA Quiz */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-emerald-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  💡
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full">
                  Interactive Quiz
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition tracking-tight">
                BSCA Daily GA Quiz
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Interactive daily General Awareness quizzes with multiple-choice questions, instant scoring, and step-by-step explanations.
              </p>
            </div>
            <Link
              href="/bsca?tab=quiz"
              className="mt-7 w-full bg-slate-800/90 hover:bg-emerald-600 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Attempt Daily GA Quiz</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 5: CA One-Liners & Exam Updates */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-rose-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  📌
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20 px-3 py-1 rounded-full">
                  Live Feed
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-rose-400 transition tracking-tight">
                CA One-Liners &amp; Updates
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Live exam notifications, shift analyses, cut-off predictions, result announcements, and daily current affairs one-liners.
              </p>
            </div>
            <Link
              href="/updates"
              className="mt-7 w-full bg-slate-800/90 hover:bg-rose-600 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>View Exam Updates</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 6: Mock Tests */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-purple-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-purple-500/15 text-purple-400 border border-purple-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  📋
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-300 border border-purple-500/20 px-3 py-1 rounded-full">
                  Real CBT Engine
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-purple-400 transition tracking-tight">
                Full-Length Mock Tests
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Attempt complete SBI PO, IBPS PO &amp; Clerk mocks with sectional timers, question palette, and detailed performance analytics.
              </p>
            </div>
            <Link
              href="/tests"
              className="mt-7 w-full bg-slate-800/90 hover:bg-purple-600 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Start Practice Tests</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card: Topic-wise Question Practice */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-amber-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  🧮
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20 px-3 py-1 rounded-full">
                  10 Qs · Timed
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition tracking-tight">
                Topic-wise Question Practice
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Pick Percentage, Time &amp; Work, SI/CI or any arithmetic topic and solve 10 random exam-level questions against the clock, with full solutions.
              </p>
            </div>
            <Link
              href="/practice"
              className="mt-7 w-full bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Start Practice</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 7: Calculation Lab */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-emerald-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  ⚡
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full">
                  Speed Math
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-emerald-400 transition tracking-tight">
                Calculation Speed Lab
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Build mental math agility with 60-second blitz drills on Tables, Squares, Cubes, and Fraction-to-Percentage conversions.
              </p>
            </div>
            <Link
              href="/calc-lab"
              className="mt-7 w-full bg-slate-800/90 hover:bg-emerald-600 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Launch Calc Lab</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 7B: Word Matrix (Vocabulary Match & Drag) */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-amber-400/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-amber-400/15 text-amber-400 border border-amber-400/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  🧩
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full">
                  4×4 Vocab &amp; Jargon
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition tracking-tight">
                Word Matrix: Match &amp; Drag
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Clear a 4×4 grid of 8 Banking Jargon (Repo Rate, Haircut, NPA, CAMELS) or Editorial Vocab pairs in under 45 seconds with 3 lives!
              </p>
            </div>
            <Link
              href="/word-matrix"
              className="mt-7 w-full bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Play Word Matrix</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Card 7C: Daily Current Affairs Raid ("The CA Boss Fight") */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-rose-500/50 rounded-3xl p-7 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 bg-rose-500/15 text-rose-400 border border-rose-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner">
                  ⚔️
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full">
                  10-Q Daily Raid
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-rose-400 transition tracking-tight">
                CA Raid: The Boss Fight
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Pick any specific Date or Month Boss Fight, study curated Current Affairs news, deal Boss damage to unlock a 1-Page Revision PDF, and earn Perfect Slayer badges!
              </p>
            </div>
            <Link
              href="/ca-raid"
              className="mt-7 w-full bg-slate-800/90 hover:bg-rose-500 text-white font-bold text-xs py-3.5 rounded-xl transition flex items-center justify-center gap-2 border border-white/[0.06]"
            >
              <span>Enter CA Boss Fight</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
          
          {/* Card 8: Computer Awareness Course */}
          <div className="relative bg-gradient-to-b from-slate-900/95 to-slate-950 border border-amber-500/30 hover:border-amber-400/80 rounded-3xl p-7 shadow-xl transition-all duration-300 hover:-translate-y-1 group flex flex-col justify-between overflow-hidden">
            <div className="absolute -right-12 -top-12 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition" />
            <div className="space-y-4 relative">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-amber-400/15 text-amber-400 border border-amber-400/25 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-inner">
                  💻
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/15 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full">
                  Bestseller
                </span>
              </div>
              <h3 className="text-xl font-black text-white group-hover:text-amber-400 transition tracking-tight">
                Computer Awareness Master Course
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Complete markdown chapters, architecture tables, keyboard shortcuts, and practice MCQ PDFs with 6 months full access.
              </p>
            </div>

            <Link
              href="/computer-awareness"
              className="mt-7 w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              <span>Explore Course</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        {/* FEATURED COMPUTER & REASONING COURSES BANNERS */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-950/70 via-slate-900 to-slate-950 border border-blue-500/30 hover:border-blue-400/50 rounded-3xl p-8 flex flex-col justify-between gap-6 shadow-2xl text-left transition">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="space-y-3 relative">
              <span className="inline-block bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">
                Featured Mains Course
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">Critical Reasoning Mastery</h3>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                Master high-weightage verbal logic questions for SBI &amp; IBPS PO Mains with chapter-wise CBT test simulations and bilingual explanations.
              </p>
            </div>
            <Link
              href="/critical-reasoning"
              className="relative px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-blue-600/25 transition text-center"
            >
              Access Critical Reasoning →
            </Link>
          </div>

          <div className="relative overflow-hidden bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-950 border border-amber-500/30 hover:border-amber-400/50 rounded-3xl p-8 flex flex-col justify-between gap-6 shadow-2xl text-left transition">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
            <div className="space-y-3 relative">
              <span className="inline-block bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg">
                Featured Computer Course
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">Complete Computer Awareness (2026)</h3>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                6 Months Complete Access • Chapter-wise Markdown Notes • Topic-wise MCQ PDFs. Use coupon <strong className="text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded">BSOL</strong>.
              </p>
            </div>
            <Link
              href="/computer-awareness"
              className="relative px-6 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 transition text-center"
            >
              Access Computer Course →
            </Link>
          </div>
        </div>

        {/* PUBLISHED E-BOOKS SECTION */}
        {ebooks.length > 0 && (
          <div className="mt-20 space-y-6">
            <div className="flex justify-between items-end border-b border-white/[0.08] pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 block mb-1">
                  Digital Study Material
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">📚 Published E-Books Library</h2>
              </div>
              <Link href="/ebooks" className="text-xs font-bold text-amber-400 hover:text-amber-300 transition flex items-center gap-1">
                <span>View All E-Books</span>
                <span>→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {ebooks.map((book) => (
                <div
                  key={book.id}
                  className="bg-slate-900/70 backdrop-blur-md border border-white/[0.08] hover:border-amber-400/40 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex gap-4 items-start">
                    {book.cover_url && (
                      <img
                        src={book.cover_url}
                        alt={book.title}
                        className="w-20 h-28 object-cover rounded-2xl border border-slate-800 shadow-md shrink-0"
                      />
                    )}
                    <div className="space-y-2 flex-1">
                      <span className="inline-block text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-md">
                        ₹{book.price}
                      </span>
                      <h4 className="font-bold text-white text-base leading-snug">{book.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{book.description}</p>
                    </div>
                  </div>

                  <Link
                    href="/ebooks"
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl text-center transition shadow-md block"
                  >
                    Buy / Get E-Book →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- YOUTUBE CHANNEL SUBSCRIBE CALLOUT BANNER --- */}
        <div className="mt-20 relative overflow-hidden bg-gradient-to-r from-red-950/50 via-slate-900 to-slate-900 border border-red-500/30 hover:border-red-500/60 rounded-3xl p-8 sm:p-10 shadow-2xl transition flex flex-col md:flex-row items-center justify-between gap-6 text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="h-16 w-16 bg-gradient-to-br from-red-500 to-red-700 text-white rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-red-600/30 flex-shrink-0">
              ▶
            </div>
            <div className="space-y-1.5">
              <span className="inline-block bg-red-500/15 text-red-300 border border-red-500/25 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md">
                Official YouTube Community
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Join 11,500+ Aspirants on YouTube</h3>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed max-w-xl">
                Subscribe to <strong className="text-white font-bold">@Banking_Solutions</strong> for daily puzzle strategies, reasoning marathons, and instant exam notification breakdowns.
              </p>
            </div>
          </div>
          <a
            href="https://www.youtube.com/@Banking_Solutions"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto justify-center px-7 py-4 bg-red-600 hover:bg-red-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-red-600/30 transition whitespace-nowrap flex items-center gap-2.5 hover:-translate-y-0.5"
          >
            <span>🔴</span>
            <span>Subscribe on YouTube</span>
          </a>
        </div>

        {/* Admin Portal Card Banner */}
        {isAdmin && (
          <div className="mt-12 bg-slate-900/90 border border-amber-400/30 hover:border-amber-400 rounded-3xl p-7 transition flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0 shadow-inner">
                ⚙️
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Admin Test &amp; Content Portal</h3>
                <p className="text-xs text-slate-400">
                  Publish One-Liners, build BSCA Quizzes, upload Excel Mock Tests, and manage day-wise BSPS / BSCA PDFs &amp; E-Books.
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs px-6 py-3.5 rounded-xl transition text-center flex-shrink-0 shadow-md"
            >
              Open Admin Portal →
            </Link>
          </div>
        )}
      </section>
        
      {/* --- PROFESSIONAL FOOTER --- */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#020617] py-16 px-6 text-slate-400 text-xs">
        {/* REVIEW & RATING CARD SECTION */}
        <div className="mb-16">
          <ReviewsSection
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12 border-t border-white/[0.08] pt-14">
          
          {/* LEFT SIDE: LOGO & ABOUT */}
          <div className="space-y-4 max-w-sm">
            <div className="flex items-center space-x-3">
              <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-white p-1 shadow-lg shadow-amber-400/10 flex-shrink-0 border border-slate-200">
                <img
                  src="/channel-logo.png"
                  alt="BankingSolutions Logo"
                  className="h-full w-full object-contain rounded-xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="h-full w-full bg-white flex items-center justify-center text-slate-950 font-black text-sm absolute inset-0 -z-10">
                  BS
                </div>
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-white block leading-tight">
                  BankingSolutions
                </span>
                <span className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest block">
                  Touch the sky with glory
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              BankingSolutions is a premier ed-tech platform dedicated to empowering banking exam aspirants with structured practice sheets (BSPS), current affairs (BSCA), Real CBT test series, and daily consistency hubs.
            </p>
            <p className="text-[11px] text-slate-500 font-semibold">
              Official Channel: @Banking_Solutions • 11.5K+ Aspirants
            </p>
          </div>

          {/* RIGHT SIDE: USEFUL LINKS & LEGAL POLICIES */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-left w-full md:w-auto">
            
            {/* Quick Hubs */}
            <div className="space-y-3">
              <h4 className="text-white font-black uppercase tracking-wider text-[11px]">Platforms</h4>
              <ul className="space-y-2.5 font-medium">
                <li><Link href="/targets" className="hover:text-emerald-400 transition">Daily Targets Hub</Link></li>
                <li><Link href="/critical-reasoning" className="hover:text-blue-400 transition">Critical Reasoning</Link></li>
                <li><Link href="/rrb-pdf-course" className="hover:text-purple-400 transition">RRB PDF Course</Link></li>
                <li><Link href="/pdf-courses?category=BSPS" className="hover:text-blue-400 transition">BSPS Sheets</Link></li>
                <li><Link href="/bsca" className="hover:text-amber-400 transition">BSCA Current Affairs</Link></li>
                <li><Link href="/calc-lab" className="hover:text-emerald-400 transition">Calculation Lab</Link></li>
                <li><Link href="/word-matrix" className="hover:text-amber-400 transition">Word Matrix (Vocab)</Link></li>
                <li><Link href="/ca-raid" className="hover:text-rose-400 transition">Daily CA Boss Raid</Link></li>
              </ul>
            </div>

            {/* Test & Updates */}
            <div className="space-y-3">
              <h4 className="text-white font-black uppercase tracking-wider text-[11px]">Resources</h4>
              <ul className="space-y-2.5 font-medium">
                <li><Link href="/tests" className="hover:text-amber-400 transition">Mock Test Series</Link></li>
                <li><Link href="/bsca?tab=quiz" className="hover:text-emerald-400 transition">Daily GA Quiz</Link></li>
                <li><Link href="/computer-awareness" className="hover:text-amber-400 transition">Computer Awareness</Link></li>
                <li><Link href="/ebooks" className="hover:text-amber-400 transition">E-Books Store</Link></li>
                <li><Link href="/updates" className="hover:text-rose-400 transition">Exam One-Liners</Link></li>
                {isAdmin && <li><Link href="/admin" className="hover:text-amber-400 transition">Admin Portal ⚙️</Link></li>}
              </ul>
            </div>

            {/* Legal & Compliance */}
            <div className="space-y-3 col-span-2 sm:col-span-1">
              <h4 className="text-white font-black uppercase tracking-wider text-[11px]">Legal &amp; Policies</h4>
              <ul className="space-y-2.5 font-medium">
                <li><Link href="/privacy" className="hover:text-slate-200 transition">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-slate-200 transition">Terms &amp; Conditions</Link></li>
                <li><Link href="/disclaimer" className="hover:text-slate-200 transition">Disclaimer</Link></li>
                <li><Link href="/refund" className="hover:text-slate-200 transition">Refund &amp; Cancellation</Link></li>
              </ul>
            </div>

          </div>

        </div>

        {/* BOTTOM COPYRIGHT ROW */}
        <div className="max-w-7xl mx-auto border-t border-white/[0.06] mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-[11px]">
          <p>BankingSolutions © 2026. All rights reserved.</p>
          <p>Designed for competitive banking aspirants across India.</p>
        </div>
      </footer>
      </div>
    </div>
  );
}
