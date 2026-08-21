'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Chapter {
  id: string;
  chapter_number: number;
  language: 'english' | 'hinglish';
  title: string;
  subtitle?: string;
  markdown_content: string;
  is_locked: boolean;
  pdf_mcq_url?: string;
}

export default function CriticalReasoningReaderPage() {
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterNo, setSelectedChapterNo] = useState<number>(1);
  const [languageMode, setLanguageMode] = useState<'english' | 'hinglish'>('english');
  const [user, setUser] = useState<any>(null);
  const [hasPurchased, setHasPurchased] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Dynamic Pricing States (Fetched from admin settings)
  const [originalPrice, setOriginalPrice] = useState(1999);
  const [launchPrice, setLaunchPrice] = useState(499);
  const [couponDiscountedPrice, setCouponDiscountedPrice] = useState(249);

  const currentPrice = isCouponApplied ? couponDiscountedPrice : launchPrice;

  useEffect(() => {
    checkUserAndPurchases();
    fetchPricingSettings();
    
    // Load Razorpay Script dynamically
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function fetchPricingSettings() {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['cr_original_price', 'cr_launch_price', 'cr_coupon_price']);

      if (data) {
        data.forEach((item) => {
          if (item.setting_key === 'cr_original_price') setOriginalPrice(Number(item.setting_value));
          if (item.setting_key === 'cr_launch_price') setLaunchPrice(Number(item.setting_value));
          if (item.setting_key === 'cr_coupon_price') setCouponDiscountedPrice(Number(item.setting_value));
        });
      }
    } catch (e) {
      console.error("Error fetching pricing settings:", e);
    }
  }

  async function checkUserAndPurchases() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      setCurrentUserId(session.user.id);
      setUser(session.user);

      // Check if student has purchased Critical Reasoning
      const { data: purchaseData } = await supabase
        .from('student_course_purchases')
        .select('*')
        .eq('user_id', session.user.id)
        .ilike('course_name', '%Critical Reasoning%')
        .single();

      if (purchaseData && purchaseData.expires_at) {
        const expiresAt = new Date(purchaseData.expires_at);
        if (expiresAt > new Date()) {
          setHasPurchased(true);
          setExpiresAtDate(expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
        }
      }
    }

    const { data, error } = await supabase
      .from('admin_critical_reasoning_chapters')
      .select('*')
      .order('chapter_number', { ascending: true });

    if (!error && data && data.length > 0) {
      setChapters(data);
      setSelectedChapterNo(data[0].chapter_number);
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
      window.location.href = '/login';
      return;
    }

    setIsProcessingPayment(true);
    const amountInPaise = currentPrice * 100;

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
      amount: amountInPaise,
      currency: 'INR',
      name: 'BankingSolutions',
      description: `Critical Reasoning Mastery (${isCouponApplied ? `BSOL Offer - ₹${couponDiscountedPrice}` : `Launch Offer - ₹${launchPrice}`})`,
      handler: async function (response: any) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 Months Access

        const { error } = await supabase.from('student_course_purchases').upsert([
          {
            user_id: currentUserId,
            course_name: 'Critical Reasoning Mastery Course',
            amount_paid: currentPrice,
            payment_id: response.razorpay_payment_id,
            expires_at: expiryDate.toISOString(),
          },
        ], { onConflict: 'user_id,course_name' });

        if (error) {
          console.error("Purchase DB Error:", error);
          alert(`Payment received, but DB update failed: ${error.message}`);
        } else {
          setHasPurchased(true);
          setExpiresAtDate(expiryDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }));
          alert('🎉 Payment Successful! You have 6 months of full access.');
        }
        setIsProcessingPayment(false);
      },
      prefill: {
        name: user?.user_metadata?.full_name || 'Banking Aspirant',
        email: user?.email || '',
      },
      theme: { color: '#1D63B8' },
    };

    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      alert('Razorpay SDK failed to load. Please check your internet connection.');
      setIsProcessingPayment(false);
    }
  };

  const uniqueChapterNumbers = Array.from(new Set(chapters.map((c) => c.chapter_number)));
  const activeChapter = chapters.find(
    (c) => c.chapter_number === selectedChapterNo && c.language === languageMode
  ) || chapters.find((c) => c.chapter_number === selectedChapterNo);

  const isChapterLocked = activeChapter?.is_locked && !hasPurchased;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading Critical Reasoning Modules...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* TOP NAVBAR */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/tests" className="w-9 h-9 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center font-black text-sm shadow-md">
            CR
          </Link>
          <div>
            <h1 className="text-sm md:text-base font-bold text-white tracking-wide">Critical Reasoning Mastery</h1>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Banking Exam Preparation Series</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!hasPurchased ? (
            <button
              onClick={handleBuyCourse}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition animate-pulse flex items-center gap-2"
            >
              <span>🔥 Launch Offer: <span className="line-through opacity-75 font-normal">₹{originalPrice}</span> <strong className="text-sm">₹{currentPrice}</strong></span>
              {isCouponApplied && <span className="bg-slate-950 text-amber-400 text-[10px] px-1.5 py-0.5 rounded">BSOL Applied</span>}
            </button>
          ) : (
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold rounded-lg">
              ✨ Valid Till: {expiresAtDate}
            </span>
          )}

          {/* LANGUAGE SWITCHER */}
          <div className="flex bg-slate-950 border border-slate-700 p-1 rounded-xl">
            <button
              onClick={() => setLanguageMode('english')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                languageMode === 'english' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguageMode('hinglish')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                languageMode === 'hinglish' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🇮🇳 Hinglish
            </button>
          </div>

          <Link href="/tests" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition">
            Test Portal 🏠
          </Link>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* CHAPTERS SIDEBAR */}
        <aside className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-fit sticky top-24 shadow-xl">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800 pb-2">
            Chapters Index
          </h3>
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {uniqueChapterNumbers.map((chNo) => {
              const chObj = chapters.find((c) => c.chapter_number === chNo);
              const isSelected = selectedChapterNo === chNo;

              return (
                <button
                  key={chNo}
                  onClick={() => setSelectedChapterNo(chNo)}
                  className={`w-full text-left p-3 rounded-xl transition text-xs font-bold flex justify-between items-center ${
                    isSelected
                      ? 'bg-[#1D63B8] text-white shadow-lg'
                      : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                  }`}
                >
                  <span className="truncate">Chapter {chNo}: {chObj?.title || 'Module'}</span>
                  {chObj?.is_locked && !hasPurchased && <span className="text-[10px]">🔒</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* CHAPTER READER CONTENT */}
        <main className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          {!activeChapter ? (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <div className="text-4xl">📖</div>
              <h3 className="text-base font-bold text-white">No Chapter Selected</h3>
              <p className="text-xs">Select a chapter from the sidebar or check back later for updates.</p>
            </div>
          ) : isChapterLocked ? (
            /* 🔒 PAYWALL & COUPON LOCK SCREEN */
            <div className="text-center py-12 px-6 space-y-6 bg-slate-950/50 border border-amber-500/20 rounded-2xl">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner">
                🔒
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <span className="text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full">
                  Locked Premium Chapter
                </span>
                <h3 className="text-xl font-black text-white">Chapter {activeChapter.chapter_number}: {activeChapter.title}</h3>
                
                <div className="py-2 flex items-center justify-center gap-3">
                  <span className="text-lg text-slate-500 line-through font-bold">₹{originalPrice}</span>
                  <span className="text-2xl font-black text-amber-400">₹{launchPrice}</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">Launch Offer</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Unlock the complete Critical Reasoning Masterclass for 6 months. Use coupon code <strong className="text-amber-400 font-mono bg-amber-400/10 px-1.5 py-0.5 rounded">BSOL</strong> to get it for just <span className="text-white font-bold">₹{couponDiscountedPrice}</span>!
                </p>
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
                  <p className="text-xs text-emerald-400 font-bold">🎉 Coupon BSOL Applied! Price is now ₹{couponDiscountedPrice}</p>
                )}
                {couponError && (
                  <p className="text-xs text-rose-400 font-bold">{couponError}</p>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleBuyCourse}
                  disabled={isProcessingPayment}
                  className="px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition tracking-wide disabled:opacity-50"
                >
                  {isProcessingPayment ? 'Processing...' : `🚀 Pay ₹${currentPrice} & Unlock Critical Reasoning`}
                </button>
                {!user && (
                  <p className="text-[11px] text-slate-500 mt-3">
                    Already purchased? <Link href="/login" className="text-blue-400 underline">Sign in</Link> to your account.
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* 🔓 UNLOCKED CONTENT */
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4 flex-wrap gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full">
                    Chapter {activeChapter.chapter_number} — {activeChapter.language.toUpperCase()} Mode
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-white mt-2">{activeChapter.title}</h2>
                </div>

                {activeChapter.pdf_mcq_url && (
                  <a
                    href={activeChapter.pdf_mcq_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-2"
                  >
                    <span>📄 Download Practice MCQs (PDF)</span>
                  </a>
                )}
              </div>

              {/* MARKDOWN RENDERER */}
              <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed space-y-4 pt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeChapter.markdown_content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}