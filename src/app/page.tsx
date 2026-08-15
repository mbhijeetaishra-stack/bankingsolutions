'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import AuthModal from '../components/AuthModal';
import ReviewsSection from '@/components/ReviewsSection';

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [marqueeNotices, setMarqueeNotices] = useState<any[]>([]);
  
  // Computer Course Pop-up & E-Books State
  const [showPopup, setShowPopup] = useState(false);
  const [ebooks, setEbooks] = useState<EBook[]>([]);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        checkAdminStatus(session.user);
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
      }, 1000); // Pops up 1 second after loading
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

  const checkAdminStatus = (user: any) => {
    const isUserAdmin = user.user_metadata?.is_admin === true || user.app_metadata?.role === 'admin';
    setIsAdmin(isUserAdmin);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAdmin(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-amber-400 selection:text-slate-950">
      
      {/* COMPUTER COURSE POP-UP MODAL */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl text-center space-y-6">
            <button
              onClick={() => setShowPopup(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full flex items-center justify-center text-xs font-bold transition"
            >
              ✕
            </button>

            <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
              💻
            </div>

            <div className="space-y-2">
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                🔥 Special Launch Offer
              </span>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Complete Computer Awareness Course</h2>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Master computer awareness for IBPS, SBI, and RBI exams. Get full syllabus, chapter MCQs, and 6 months access. Use code <strong className="text-amber-400 font-mono">BSOL</strong> for ₹50 OFF!
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="/computer-awareness"
                onClick={() => setShowPopup(false)}
                className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition transform hover:scale-105"
              >
                🚀 Explore Course (₹149 Onwards)
              </Link>
              <button
                onClick={() => setShowPopup(false)}
                className="py-3.5 px-5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
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

      {/* --- TOP NAVBAR --- */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          
          {/* Logo & Branding */}
          <Link href="/" className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative h-11 w-11 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-50 to-amber-50 p-0.5 shadow-lg shadow-amber-400/20 flex-shrink-0 group-hover:scale-105 transition">
              <img
                src="/channel-logo.png"
                alt="BankingSolutions Logo"
                className="h-full w-full object-cover rounded-[10px]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="h-full w-full bg-amber-400 flex items-center justify-center text-slate-950 font-black text-lg">
                BS
              </div>
            </div>

            <div className="text-left">
              <span className="text-lg font-black tracking-tight text-white group-hover:text-amber-400 transition block leading-tight">
                BankingSolutions
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">
                Touch the sky with glory
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-3">
        
            <Link
              href="/pdf-courses?category=BSCA"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 px-3 py-2 rounded-lg transition hidden md:block"
            >
              BSCA Current Affairs 📰
            </Link>
            <Link
              href="/ebooks"
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 px-3 py-2 rounded-lg transition hidden md:block"
            >
              E-Books Store 📖
            </Link>
            <Link
              href="/tests"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-lg transition hidden md:block"
            >
              Mock Tests
            </Link>
            <Link
              href="/calc-lab"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-3 py-2 rounded-lg transition hidden md:block"
            >
              Calculation Lab ⚡
            </Link>
            <Link href="/profile" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition">
              👤 Profile
            </Link>    
            
            {/* Admin Panel Link */}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 border border-amber-400/30 font-semibold px-3 py-2 rounded-lg transition"
              >
                Admin ⚙️
              </Link>
            )}

            {/* Auth Buttons */}
            {currentUser ? (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <span className="text-xs text-slate-300 font-medium hidden sm:block">
                  Hi, {currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold px-3 py-2 rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2 rounded-lg transition shadow-md shadow-amber-400/20"
                >
                  Log In/Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* --- MARQUEE NOTICES TICKER --- */}
      {marqueeNotices.length > 0 && (
        <div className="bg-amber-400 text-slate-950 font-bold text-xs py-2.5 px-4 overflow-hidden whitespace-nowrap shadow-inner border-b border-amber-500/30 flex items-center relative">
          <div className="bg-slate-950 text-amber-400 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider mr-4 flex-shrink-0 shadow z-10">
            📢 UPDATES
          </div>
          <div className="w-full overflow-hidden relative flex">
            <div className="animate-marquee-slow space-x-12 tracking-wide inline-block">
              {marqueeNotices.map((notice) => (
                <span key={notice.id} className="inline-flex items-center gap-2">
                  <span>{notice.notice_text}</span>
                  <span className="opacity-40">•</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center space-x-2 bg-amber-400/10 border border-amber-400/30 text-amber-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8">
          <span>🔥 SBI PO/CLERK, IBPS PO/CLERK & RRB PO/CLERK 2026 Ready</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto">
          Crack Banking Exams with <span className="text-blue-400">BSPS</span>, <span className="text-amber-400">BSCA</span> & <span className="text-emerald-400">Interactive Quizzes</span>
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Master Quant, Reasoning, and General Awareness with daily BankingSolutions Practice Sheets (BSPS), Current Affairs (BSCA) PDFs, daily One-Liners, and interactive GA Quizzes.
        </p>

        {/* HERO CTA BUTTONS */}
        <div className="flex flex-wrap justify-center items-center gap-3 mb-16">
          <Link
            href="/targets"
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shadow-xl shadow-emerald-600/20 uppercase tracking-wider flex items-center gap-2"
          >
            <span>🎯</span>
            <span>DAILY TARGETS HUB</span>
          </Link>

          <Link
            href="/pdf-courses?category=BSPS"
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition shadow-xl shadow-blue-600/20 uppercase tracking-wider flex items-center gap-2"
          >
            <span>📄</span>
            <span>BSPS PRACTICE SHEETS</span>
          </Link>

          <Link
            href="/pdf-courses?category=BSCA"
            className="px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shadow-xl shadow-amber-400/20 uppercase tracking-wider flex items-center gap-2"
          >
            <span>📰</span>
            <span>BSCA CURRENT AFFAIRS</span>
          </Link>

          <Link
            href="/bsca-quiz"
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition shadow-xl shadow-emerald-600/20 uppercase tracking-wider flex items-center gap-2"
          >
            <span>💡</span>
            <span>BSCA DAILY GA QUIZ</span>
          </Link>

          <Link
            href="/ebooks"
            className="px-6 py-3.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition shadow-xl shadow-amber-600/20 uppercase tracking-wider flex items-center gap-2"
          >
            <span>📖</span>
            <span>E-BOOK STORE</span>
          </Link>

          <Link
            href="/updates"
            className="px-6 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl transition shadow-xl shadow-rose-600/20 uppercase tracking-wider flex items-center gap-2"
          >
            <span>📌</span>
            <span>CA ONE-LINERS & UPDATES</span>
          </Link>

          <Link
            href="/tests"
            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold text-xs rounded-xl transition uppercase tracking-wider flex items-center gap-2"
          >
            <span>🚀</span>
            <span>Full Mock Tests</span>
          </Link>
          <Link
            href="/computer-awareness"
            className="px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl transition shadow-xl shadow-purple-600/30 uppercase tracking-wider flex items-center gap-2"
          >
            <span>💻</span>
            <span>Computer Awareness Course</span>
          </Link>
          <Link
            href="/calc-lab"
            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs rounded-xl transition uppercase tracking-wider flex items-center gap-2"
          >
            <span>⚡</span>
            <span>Calculation Lab</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur max-w-4xl mx-auto text-center">
          <div>
            <span className="text-2xl md:text-3xl font-black text-amber-400 block">11.5K+</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Subscribers</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-blue-400 block">BSPS</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Daily Sheets</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-amber-400 block">BSCA</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Banking GA</span>
          </div>
          <div>
            <span className="text-2xl md:text-3xl font-black text-emerald-400 block">TCS iON</span>
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Exam Engine</span>
          </div>
        </div>
      </section>

      {/* CORE HUBS SECTION */}
      <section className="py-16 px-6 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">Core Practice Hubs</h2>
          <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-semibold">Choose your preparation mode</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 0: Daily Targets Hub */}
          <div className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                🎯
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition leading-snug">
                Daily Targets & Consistency Hub
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Day-wise micro-goals, track-wise routines (Beginner & Repeater), video guides, and streak tracking.
              </p>
            </div>
            <Link
              href="/targets"
              className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              Open Daily Targets Hub →
            </Link>
          </div>

          {/* Card 1: BSPS Practice Sheets */}
          <div className="bg-slate-950 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                📄
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-400 transition leading-snug">
                BSPS Practice Sheets
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Day-wise structured practice PDFs for Quant & Reasoning. DI sets, Puzzles, Arithmetic, and Speed Math sheets.
              </p>
            </div>
            <Link
              href="/pdf-courses?category=BSPS"
              className="w-full bg-slate-800 hover:bg-blue-600 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              Open BSPS Sheets →
            </Link>
          </div>

          {/* Card 2: BSCA Current Affairs */}
          <div className="bg-slate-950 border border-slate-800 hover:border-amber-400/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                📰
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-400 transition leading-snug">
                BSCA Current Affairs
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Daily & monthly General Awareness PDFs curated for Banking, Financial News, RBI Notifications, and Static GK.
              </p>
            </div>
            <Link
              href="/pdf-courses?category=BSCA"
              className="w-full bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              Open BSCA Current Affairs →
            </Link>
          </div>

          {/* Card 3: BSCA Daily GA Quiz */}
          <div className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                💡
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition leading-snug">
                BSCA Daily GA Quiz
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Interactive daily General Awareness quizzes with multiple-choice questions, instant scoring, and step-by-step solution explanations.
              </p>
            </div>
            <Link
              href="/bsca-quiz"
              className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              Attempt Daily GA Quiz →
            </Link>
          </div>

          {/* Card 4: CA One-Liners & Exam Updates */}
          <div className="bg-slate-950 border border-slate-800 hover:border-rose-500/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                📌
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-rose-400 transition leading-snug">
                CA One-Liners & Updates
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Live exam notifications, shift analyses, cut-off predictions, result announcements, and daily current affairs one-liners.
              </p>
            </div>
            <Link
              href="/updates"
              className="w-full bg-slate-800 hover:bg-rose-600 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              View Exam Updates →
            </Link>
          </div>

          {/* Card 5: Mock Tests */}
          <div className="bg-slate-950 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                📋
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition leading-snug">
                Full-Length Mock Tests
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Attempt complete SBI PO & IBPS PO prelims mocks with real timers, question palette, and step-by-step solutions.
              </p>
            </div>
            <Link
              href="/tests"
              className="w-full bg-slate-800 hover:bg-purple-600 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              Start Practice Tests →
            </Link>
          </div>

          {/* Card 6: Calculation Lab */}
          <div className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 transition flex flex-col justify-between group">
            <div>
              <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center text-2xl mb-4 font-bold">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition leading-snug">
                Calculation Speed Lab
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                Build mental math agility with 60-second blitz drills on Tables, Squares, Cubes, and Fraction % conversions.
              </p>
            </div>
            <Link
              href="/calc-lab"
              className="w-full bg-slate-800 hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl transition text-center block"
            >
              Launch Calc Lab →
            </Link>
          </div>
          
          {/* Card 7: Computer Awareness Course */}
          <div className="bg-slate-900 border border-slate-800 hover:border-amber-400/50 rounded-2xl p-6 shadow-xl transition group flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-2xl flex items-center justify-center font-bold text-2xl">
                💻
              </div>
              <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition">
                Computer Awareness Master Course
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Complete markdown chapters, tables, exam shortcuts, and practice MCQ PDFs for 6 months access.
              </p>
            </div>

            <Link
              href="/computer-awareness"
              className="mt-6 w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg transition block"
            >
              Explore Course →
            </Link>
          </div>
        </div>

        {/* FEATURED COMPUTER COURSE BANNER */}
        <div className="mt-10">
          <div className="bg-gradient-to-r from-blue-950/60 to-slate-950 border border-blue-500/30 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl text-left">
            <div className="space-y-3 max-w-xl">
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-lg">
                Featured Master Course
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white">Complete Computer Awareness (2026 Edition)</h3>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                6 Months Complete Access • Chapter-wise Markdown Notes • Practice MCQ PDFs • 3-Day Launch Offer with Coupon <strong className="text-amber-400 font-mono">BSOL</strong>.
              </p>
            </div>
            <Link
              href="/computer-awareness"
              className="px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition whitespace-nowrap"
            >
              Access Computer Course →
            </Link>
          </div>
        </div>

        {/* PUBLISHED E-BOOKS SECTION */}
        {ebooks.length > 0 && (
          <div className="mt-16 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h2 className="text-lg md:text-xl font-extrabold text-white">📚 Published E-Books Library</h2>
              <Link href="/ebooks" className="text-xs font-bold text-amber-400 hover:underline">
                View All E-Books →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {ebooks.map((book) => (
                <div key={book.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:border-slate-700 transition">
                  <div className="flex gap-4 items-start">
                    {book.cover_url && (
                      <img src={book.cover_url} alt={book.title} className="w-20 h-28 object-cover rounded-xl border border-slate-800 shadow" />
                    )}
                    <div className="space-y-1.5 flex-1">
                      <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                        ₹{book.price}
                      </span>
                      <h4 className="font-bold text-white text-sm leading-snug">{book.title}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{book.description}</p>
                    </div>
                  </div>

                  <Link
                    href="/ebooks"
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl text-center transition shadow-sm block"
                  >
                    Buy / Get E-Book →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Portal Button */}
        {isAdmin && (
          <div className="mt-8 bg-slate-950 border border-amber-400/30 hover:border-amber-400 rounded-2xl p-6 transition flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="h-12 w-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center text-2xl font-bold flex-shrink-0">
                ⚙️
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Admin Test & Content Portal</h3>
                <p className="text-xs text-slate-400">
                  Publish One-Liners, build BSCA Quizzes, upload Excel Mock Tests, and manage day-wise BSPS / BSCA PDFs & E-Books.
                </p>
              </div>
            </div>
            <Link
              href="/admin"
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs px-6 py-3 rounded-xl transition text-center flex-shrink-0"
            >
              Open Admin Portal →
            </Link>
          </div>
        )}
      </section>
        
      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 px-6 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          
          {/* LEFT SIDE: LOGO & ABOUT */}
          <div className="space-y-4 max-w-sm">
            <div className="flex items-center space-x-3">
              <div className="relative h-10 w-10 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-50 to-amber-50 p-0.5 shadow-lg shadow-amber-400/20 flex-shrink-0">
                <img
                  src="/channel-logo.png"
                  alt="BankingSolutions Logo"
                  className="h-full w-full object-cover rounded-[10px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="h-full w-full bg-amber-400 flex items-center justify-center text-slate-950 font-black text-sm">
                  BS
                </div>
              </div>
              <div>
                <span className="text-base font-black tracking-tight text-white block leading-tight">
                  BankingSolutions
                </span>
                <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest block">
                  Touch the sky with glory
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              BankingSolutions is a professional ed-tech platform dedicated to empowering banking exam aspirants with structured practice sheets (BSPS), current affairs (BSCA), test series, and consistency habit hubs.
            </p>
            <p className="text-[11px] text-slate-600 font-semibold">
              Official Channel: @Banking_Solutions | 11.5K+ Aspirants
            </p>
          </div>

          {/* RIGHT SIDE: USEFUL LINKS & LEGAL POLICIES */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-left w-full md:w-auto">
            
            {/* Quick Hubs */}
            <div className="space-y-3">
              <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Platforms</h4>
              <ul className="space-y-2 font-medium">
                <li><Link href="/targets" className="hover:text-emerald-400 transition">Daily Targets Hub</Link></li>
                <li><Link href="/pdf-courses?category=BSPS" className="hover:text-blue-400 transition">BSPS Sheets</Link></li>
                <li><Link href="/pdf-courses?category=BSCA" className="hover:text-amber-400 transition">BSCA GA</Link></li>
                <li><Link href="/bsca-quiz" className="hover:text-emerald-400 transition">Daily GA Quiz</Link></li>
                <li><Link href="/calc-lab" className="hover:text-emerald-400 transition">Calculation Lab</Link></li>
              </ul>
            </div>

            {/* Test & Updates */}
            <div className="space-y-3">
              <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Resources</h4>
              <ul className="space-y-2 font-medium">
                <li><Link href="/tests" className="hover:text-amber-400 transition">Mock Test Series</Link></li>
                <li><Link href="/computer-awareness" className="hover:text-purple-400 transition">Computer Awareness</Link></li>
                <li><Link href="/ebooks" className="hover:text-amber-400 transition">E-Books Store</Link></li>
                <li><Link href="/updates" className="hover:text-rose-400 transition">Exam One-Liners</Link></li>
                {isAdmin && <li><Link href="/admin" className="hover:text-amber-400 transition">Admin Portal ⚙️</Link></li>}
              </ul>
            </div>

            {/* Legal & Compliance */}
            <div className="space-y-3 col-span-2 sm:col-span-1">
              <h4 className="text-white font-bold uppercase tracking-wider text-[11px]">Legal & Policies</h4>
              <ul className="space-y-2 font-medium">
                <li><Link href="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-slate-300 transition">Terms & Conditions</Link></li>
                <li><Link href="/disclaimer" className="hover:text-slate-300 transition">Disclaimer</Link></li>
                <li><Link href="/refund" className="hover:text-slate-300 transition">Refund & Cancellation</Link></li>
              </ul>
            </div>

          </div>

        </div>

        {/* BOTTOM COPYRIGHT ROW */}
        <div className="max-w-7xl mx-auto border-t border-slate-800/80 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-500 text-[11px]">
          <p>BankingSolutions © 2026. All rights reserved.</p>
          <p>Designed for competitive banking aspirants across India.</p>
        </div>

        {/* REVIEW & RATING CARD SECTION */}
        <div className="mt-6">
          <ReviewsSection
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        </div>
      </footer>
    </div>
  );
}