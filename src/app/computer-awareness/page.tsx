'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  subtitle: string;
  markdown_content: string;
  is_locked: boolean;
  pdf_mcq_url?: string;
}

export default function ComputerAwarenessPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [completedChapters, setCompletedChapters] = useState<string[]>([]);
  
  // Paid Access & Launch Offer States
  const [hasPurchased, setHasPurchased] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Countdown Timer States (Synced from Admin Panel)
  const [offerEndTime, setOfferEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Pricing details
  const basePrice = 199;
  const discountedPrice = 149;
  const currentPrice = isCouponApplied ? discountedPrice : basePrice;

  useEffect(() => {
    checkUserAndPurchases();
    fetchAdminSettings();

    const saved = localStorage.getItem('bs_completed_computer_chapters');
    if (saved) {
      try { setCompletedChapters(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Countdown Interval Effect
  useEffect(() => {
    if (!offerEndTime) return;

    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const difference = offerEndTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [offerEndTime]);

  async function fetchAdminSettings() {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('launch_offer_ends_at')
        .single();

      if (!error && data?.launch_offer_ends_at) {
        setOfferEndTime(new Date(data.launch_offer_ends_at).getTime());
      } else {
        setOfferEndTime(new Date().getTime() + 3 * 24 * 60 * 60 * 1000);
      }
    } catch (e) {
      setOfferEndTime(new Date().getTime() + 3 * 24 * 60 * 60 * 1000);
    }
  }

  async function checkUserAndPurchases() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      setCurrentUserId(session.user.id);
      
      const { data: purchaseData } = await supabase
        .from('student_course_purchases')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('course_name', 'Computer Awareness Course')
        .single();

      if (purchaseData && purchaseData.expires_at) {
        const expiresAt = new Date(purchaseData.expires_at);
        const now = new Date();
        
        if (expiresAt > now) {
          setHasPurchased(true);
          setExpiresAtDate(expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
        } else {
          setHasPurchased(false);
          setExpiresAtDate(null);
        }
      }
    }

    const { data, error } = await supabase
      .from('admin_computer_chapters')
      .select('*')
      .order('chapter_number', { ascending: true });

    if (!error && data && data.length > 0) {
      setChapters(data);
      setActiveChapterId(data[0].id);
    }
    setLoading(false);
  }

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (couponInput.trim().toUpperCase() === 'BSOL') {
      setIsCouponApplied(true);
      setCouponError('');
    } else {
      setCouponError('❌ Invalid Coupon Code. Try "BSOL"');
      setIsCouponApplied(false);
    }
  };

  const handleBuyCourse = async () => {
    if (!currentUserId) {
      alert('Please log in to your account first to purchase the course!');
      return;
    }

    setIsProcessingPayment(true);
    const amountInPaise = currentPrice * 100;

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
      amount: amountInPaise,
      currency: 'INR',
      name: 'BankingSolutions',
      description: `Complete Computer Awareness Course (${isCouponApplied ? 'BSOL Offer' : 'Standard'})`,
      handler: async function (response: any) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 Months Access

        const { error } = await supabase.from('student_course_purchases').upsert([
          {
            user_id: currentUserId,
            course_name: 'Computer Awareness Course',
            amount_paid: currentPrice,
            payment_id: response.razorpay_payment_id,
            expires_at: expiryDate.toISOString(),
          },
        ], { onConflict: 'user_id,course_name' });

        if (error) {
          console.error("Supabase Purchase Error:", error);
          alert(`Payment received, but DB error: ${error.message}`);
        } else {
          setHasPurchased(true);
          setExpiresAtDate(expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
          alert('🎉 Payment Successful! You have 6 months of full access.');
        }
        setIsProcessingPayment(false);
      },
      prefill: {
        name: 'Banking Aspirant',
        email: '',
      },
      theme: { color: '#1D63B8' },
    };

    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      alert('Razorpay SDK failed to load.');
      setIsProcessingPayment(false);
    }
  };

  const toggleChapterCompletion = (id: string) => {
    let updated: string[];
    if (completedChapters.includes(id)) {
      updated = completedChapters.filter((item) => item !== id);
    } else {
      updated = [...completedChapters, id];
    }
    setCompletedChapters(updated);
    localStorage.setItem('bs_completed_computer_chapters', JSON.stringify(updated));
  };

  const filteredChapters = chapters.filter(
    (ch) =>
      ch.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ch.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0];
  const activeIndex = chapters.findIndex((c) => c.id === activeChapterId);
  
  const progressPercentage = chapters.length > 0 ? Math.round((completedChapters.length / chapters.length) * 100) : 0;
  const isCurrentCompleted = activeChapter ? completedChapters.includes(activeChapter.id) : false;
  const isChapterLocked = activeChapter?.is_locked && !hasPurchased;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading Computer Awareness Portal...
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-900 text-slate-100 font-sans flex flex-col overflow-hidden selection:bg-blue-500 selection:text-white">
      {/* TOP HEADER */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center shrink-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 rounded-xl flex items-center justify-center font-black text-sm shadow-inner">
            BS
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold text-white tracking-tight">Complete Computer Awareness</h1>
            <p className="text-[10px] md:text-[11px] text-slate-400 font-medium">BankingSolutions Master Study Guide • 2026 Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!hasPurchased ? (
            <button
              onClick={handleBuyCourse}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition animate-pulse flex items-center gap-1.5"
            >
              <span>🔥 Launch Offer: ₹{currentPrice}</span>
              {isCouponApplied && <span className="bg-slate-950 text-amber-400 text-[10px] px-1.5 py-0.5 rounded">BSOL Applied</span>}
            </button>
          ) : (
            <span className="hidden sm:inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold rounded-lg">
              ✨ Valid Till: {expiresAtDate}
            </span>
          )}
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="md:hidden bg-slate-800 border border-slate-700 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs"
          >
            {isMobileSidebarOpen ? '✕ Close Menu' : '☰ Chapters'}
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs rounded-xl transition border border-blue-500/30 hidden sm:flex items-center gap-1.5"
          >
            <span>← Back to Portal</span>
          </Link>
        </div>
      </header>

      {/* BODY VIEWPORT CONTAINER */}
      <div className="flex-1 flex overflow-hidden relative">
        {isMobileSidebarOpen && (
          <div onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-20" />
        )}

        {/* LOCKED NON-SCROLLING SIDEBAR */}
        <aside
          className={`fixed md:relative inset-y-0 left-0 z-30 w-80 h-full bg-slate-950 border-r border-slate-800 p-4 flex flex-col space-y-4 shrink-0 transition-transform duration-300 overflow-hidden ${
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
        >
          {/* Progress Widget */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-2 shrink-0">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-300">Overall Progress</span>
              <span className="text-blue-400 font-mono">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full transition-all duration-500 rounded-full" style={{ width: `${progressPercentage}%` }} />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>{completedChapters.length} of {chapters.length} Completed</span>
              {hasPurchased && <span className="text-emerald-400 font-semibold sm:hidden">Valid: {expiresAtDate}</span>}
            </div>
          </div>

          <div className="shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search chapters..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Independently Scrollable Chapter List */}
          <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            {filteredChapters.map((ch) => {
              const isActive = ch.id === activeChapterId;
              const isCompleted = completedChapters.includes(ch.id);
              const locked = ch.is_locked && !hasPurchased;

              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChapterId(ch.id);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition flex flex-col space-y-1 border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/20'
                      : 'bg-slate-900/50 hover:bg-slate-900 text-slate-300 border-slate-800/80'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-xs tracking-tight flex items-center gap-1.5">
                      {isCompleted && <span className="text-emerald-400">✓</span>}
                      Chapter {ch.chapter_number} {locked && '🔒'}
                    </span>
                    {isActive && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-mono">Reading</span>}
                  </div>
                  <span className={`text-xs font-medium truncate ${isActive ? 'text-blue-50' : 'text-slate-200'}`}>
                    {ch.title}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* RIGHT CONTENT AREA */}
        <main className="flex-1 bg-slate-900 text-slate-100 p-6 md:p-12 overflow-y-auto flex flex-col justify-between">
          <div className="max-w-4xl mx-auto w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl p-6 md:p-10 shadow-xl space-y-6">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-3 text-xs font-bold">
              <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg uppercase tracking-wider">
                Chapter {activeChapter?.chapter_number} of {chapters.length} {isChapterLocked && '🔒 [Locked Preview]'}
              </span>

              {activeChapter && !isChapterLocked && (
                <button
                  onClick={() => toggleChapterCompletion(activeChapter.id)}
                  className={`px-4 py-2 rounded-xl transition font-bold text-xs flex items-center gap-2 border shadow-sm ${
                    isCurrentCompleted
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  <span>{isCurrentCompleted ? '✅ Completed' : '⭕ Mark as Completed'}</span>
                </button>
              )}
            </div>

            {/* CONDITIONAL CONTENT OR PAYWALL */}
            {isChapterLocked ? (
              <div className="py-12 px-6 text-center space-y-6 bg-slate-900/50 border border-amber-500/20 rounded-2xl my-6">
                <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
                  🔥
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h2 className="text-xl font-black text-white">Launch Offer: Ends Soon!</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unlock full access to all chapters, tables, and exam shortcuts for 6 months. Use coupon code <strong className="text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded">BSOL</strong> to get ₹50 OFF!
                  </p>

                  {/* Dynamic Countdown Timer Widget */}
                  <div className="flex justify-center items-center gap-2 pt-3 pb-1">
                    <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-center min-w-[50px]">
                      <span className="block text-base font-black text-amber-400 font-mono">{String(timeLeft.days).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Days</span>
                    </div>
                    <span className="text-amber-400 font-bold">:</span>
                    <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-center min-w-[50px]">
                      <span className="block text-base font-black text-amber-400 font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Hours</span>
                    </div>
                    <span className="text-amber-400 font-bold">:</span>
                    <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-center min-w-[50px]">
                      <span className="block text-base font-black text-amber-400 font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Mins</span>
                    </div>
                    <span className="text-amber-400 font-bold">:</span>
                    <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-center min-w-[50px]">
                      <span className="block text-base font-black text-amber-400 font-mono">{String(timeLeft.seconds).padStart(2, '0')}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Secs</span>
                    </div>
                  </div>
                </div>

                {/* Coupon Input Box */}
                <div className="max-w-xs mx-auto space-y-2">
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value)}
                      placeholder="Enter code (e.g. BSOL)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs uppercase font-mono text-white placeholder-slate-500 focus:border-amber-500 outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition"
                    >
                      Apply
                    </button>
                  </form>
                  {isCouponApplied && (
                    <p className="text-xs text-emerald-400 font-bold">🎉 Coupon BSOL Applied! Price is now ₹149</p>
                  )}
                  {couponError && (
                    <p className="text-xs text-rose-400 font-bold">{couponError}</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleBuyCourse}
                    disabled={isProcessingPayment}
                    className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-xl shadow-xl transition transform hover:scale-105"
                  >
                    {isProcessingPayment ? 'Processing...' : `🚀 Pay ₹${currentPrice} & Unlock Full Access`}
                  </button>
                  <p className="text-[10px] text-slate-500 mt-3">6 Months Access • Instant Unlock</p>
                </div>
              </div>
            ) : (
              <div>
                <article className="prose prose-invert prose-slate max-w-none text-slate-200 leading-relaxed text-sm md:text-base [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:bg-slate-800 [&_th]:text-white [&_th]:p-3 [&_th]:border [&_th]:border-slate-700 [&_td]:p-3 [&_td]:border [&_td]:border-slate-800 [&_td]:text-slate-300 [&_tr:hover]:bg-slate-900">
                  {activeChapter ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeChapter.markdown_content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-slate-500 text-xs">Select a chapter from the left menu.</p>
                  )}
                </article>

                {/* PDF MCQ Download Card */}
                {activeChapter?.pdf_mcq_url && (
                  <div className="mt-8 p-4 bg-slate-900 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-xl flex items-center justify-center font-bold text-lg">
                        📥
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Download Chapter Practice MCQs</h4>
                        <p className="text-[10px] text-slate-400">Get exam-oriented questions with detailed solutions in PDF format.</p>
                      </div>
                    </div>
                    <a
                      href={activeChapter.pdf_mcq_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-md whitespace-nowrap"
                    >
                      Download MCQ PDF ↓
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* NAVIGATION FOOTER */}
            <div className="border-t border-slate-800 pt-6 flex justify-between items-center gap-4">
              <button
                disabled={activeIndex <= 0}
                onClick={() => { if (activeIndex > 0) setActiveChapterId(chapters[activeIndex - 1].id); }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                ← Previous Chapter
              </button>

              <button
                disabled={activeIndex >= chapters.length - 1}
                onClick={() => { if (activeIndex < chapters.length - 1) setActiveChapterId(chapters[activeIndex + 1].id); }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition shadow-lg shadow-blue-600/20"
              >
                Next Chapter →
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}