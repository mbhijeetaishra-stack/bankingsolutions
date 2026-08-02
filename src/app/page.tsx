'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import AuthModal from '../components/AuthModal';

export default function BankingSolutionsHomePage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser(session.user);
        checkAdminStatus(session.user);
      }
    });

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
          <div className="flex items-center space-x-3">
            <div className="relative h-11 w-11 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-50 to-amber-50 p-0.5 shadow-lg shadow-amber-400/20 flex-shrink-0">
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

            <div>
              <span className="text-lg font-black tracking-tight text-white block leading-tight">
                BankingSolutions
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">
                Touch the sky with glory
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-3">
            <Link
              href="/pdf-courses?category=BSPS"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg transition hidden md:block"
            >
              BSPS Sheets 📄
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
                  className="text-xs text-slate-300 hover:text-white font-semibold px-3 py-2 transition"
                >
                  Log In
                </button>
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2 rounded-lg transition shadow-md shadow-amber-400/20"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-16 pb-20 px-6 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center space-x-2 bg-amber-400/10 border border-amber-400/30 text-amber-400 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-8">
          <span>🔥 SBI PO/CLERK, IBPS PO/CLERK & RRB PO/CLERK 2026 Ready</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight max-w-4xl mx-auto">
          Crack Banking Exams with <span className="text-blue-400">BSPS</span>, <span className="text-amber-400">BSCA</span> & <span className="text-emerald-400">TCS iON Mocks</span>
        </h1>

        <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Master Quant, Reasoning, and General Awareness with daily BankingSolutions Practice Sheets (BSPS), Current Affairs (BSCA) PDFs, daily One-Liners, and mock tests.
        </p>

        {/* HERO CTA BUTTONS (MATCHING YOUR PINNED DESIGN) */}
        <div className="flex flex-wrap justify-center items-center gap-3 mb-16">
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
            href="/calc-lab"
            className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2"
          >
            <span>⚡</span>
            <span>Calculation Lab</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80 backdrop-blur max-w-4xl mx-auto text-center">
          <div>
            <span className="text-2xl md:text-3xl font-black text-amber-400 block">11.1K+</span>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
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

          {/* Card 3: CA One-Liners & Exam Updates */}
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

          {/* Card 4: Mock Tests */}
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

          {/* Card 5: Calculation Lab */}
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
        </div>

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
                  Publish One-Liners & Updates, upload Excel Mock Tests, and manage day-wise BSPS / BSCA PDFs.
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
      <footer className="border-t border-slate-800 bg-slate-950 py-10 px-6 text-center text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 bg-amber-400 rounded flex items-center justify-center text-slate-950 font-black text-xs">
              BS
            </div>
            <span className="font-bold text-slate-300">BankingSolutions © 2026</span>
          </div>

          <p className="text-slate-500">
            Official Channel: @Banking_Solutions | 11.1K+ Aspirants
          </p>

          <div className="flex space-x-4 font-semibold text-slate-400">
            <Link href="/pdf-courses?category=BSPS" className="hover:text-blue-400 transition">BSPS</Link>
            <Link href="/pdf-courses?category=BSCA" className="hover:text-amber-400 transition">BSCA</Link>
            <Link href="/updates" className="hover:text-rose-400 transition">Updates</Link>
            <Link href="/tests" className="hover:text-amber-400 transition">Tests</Link>
            <Link href="/calc-lab" className="hover:text-emerald-400 transition">Calc Lab</Link>
            {isAdmin && <Link href="/admin" className="hover:text-amber-400 transition">Admin</Link>}
          </div>
        </div>
      </footer>
    </div>
  );
}