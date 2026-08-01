'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface MockItem {
  id: string;
  title: string;
  exam_type?: string;
  duration_minutes?: number;
  total_marks?: number;
  questions?: any[];
  created_at: string;
}

export default function TestListPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin'>('student');
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Tests & Filter State
  const [mocks, setMocks] = useState<MockItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  useEffect(() => {
    checkUserSession();
  }, []);

  async function checkUserSession() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);
      
      // Fetch User Role from Profile
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

      // Fetch Available Mock Tests
      await fetchMocks();
    } else {
      setUser(null);
    }
    setLoading(false);
  }

  async function fetchMocks() {
    const { data, error } = await supabase
      .from('mock_tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMocks(data);
    }
  }

  // Handle Login / Signup
  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    if (authMode === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
      else if (data.user) checkUserSession();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else if (data.user) {
        alert('Registration successful! Logging you in...');
        checkUserSession();
      }
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setMocks([]);
  }

  // Filter Logic
  const filteredMocks = mocks.filter((mock) => {
    const matchesSearch = mock.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (mock.exam_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedFilter === 'ALL') return matchesSearch;
    return matchesSearch && (mock.exam_type || '').toUpperCase().includes(selectedFilter);
  });

  // --------------------------------------------------------------------------
  // 1. LOADING SCREEN
  // --------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-bold space-y-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs tracking-wide text-slate-400">Verifying Account & Access Permissions...</p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. UNAUTHENTICATED USER: SHOW LOGIN / SIGNUP PORTAL
  // --------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-pink-600 rounded-2xl flex items-center justify-center font-black text-xl text-white mx-auto shadow-md">
              BS
            </div>
            <h1 className="text-xl font-bold text-white">BankingSolutions Portal</h1>
            <p className="text-xs text-slate-400">Please log in to access your mock tests and practice series.</p>
          </div>

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

  // --------------------------------------------------------------------------
  // 3. AUTHENTICATED STUDENT / ADMIN PORTAL VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* BRAND NAVBAR WITH USER ROLE BADGE */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pink-600 rounded-lg flex items-center justify-center font-black text-sm text-white shadow-md">
            BS
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">BankingSolutions Test Portal</h1>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{user.email}</span>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                userRole === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {userRole === 'admin' ? '🛡️ Admin Account' : '🎓 Student'}
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

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* HERO BANNER & SEARCH */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 py-8 px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Full-Length & Sectional Mock Tests</h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Real exam pattern simulations for SBI PO, IBPS PO, BSCA Current Affairs & BSPS Practice Sheets.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between max-w-4xl mx-auto pt-2">
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Search test by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#1D63B8]"
              />
            </div>

            <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 flex-wrap">
              {['ALL', 'SBI PO', 'IBPS PO', 'SECTIONAL', 'BSCA', 'BSPS'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    selectedFilter === tab ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MOCK TESTS GRID LINKED DYNAMICALLY TO /mock-test/[id] */}
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
            <p className="text-xs text-slate-400">No mock tests available matching your filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMocks.map((mock) => {
              let qCount = 0;
              if (mock.questions) {
                const parsed = typeof mock.questions === 'string' ? JSON.parse(mock.questions) : mock.questions;
                if (Array.isArray(parsed)) qCount = parsed.length;
              }

              return (
                <div
                  key={mock.id}
                  className="bg-slate-800/60 border border-slate-700/70 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:shadow-xl hover:bg-slate-800/80 transition group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full">
                        {mock.exam_type || 'SBI PO Prelims'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(mock.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-bold text-white text-base group-hover:text-blue-300 transition leading-snug">
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
                  </div>

                  {/* CRITICAL ROUTING LINK WITH MOCK UUID */}
                  <Link
                    href={`/mock-test/${mock.id}`}
                    className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-bold text-xs rounded-xl text-center shadow-lg transition flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                  >
                    <span>Start Test Now</span>
                    <span>→</span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}