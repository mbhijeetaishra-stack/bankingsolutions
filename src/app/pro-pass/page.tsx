'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import {
  PromoCoupon,
  ProPassPlan,
  getProPassConfig,
  getPromoCoupons,
  evaluatePromoCoupon,
  downloadPurchaseReceipt,
  syncMonetizationFromSupabase,
  checkAndClaimEmailGrants,
} from '@/lib/monetization';

const ADMIN_EMAIL = 'abhijeet9022102210@gmail.com';

export default function ProPassPage() {
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [hasProPass, setHasProPass] = useState(false);
  const [proPassPurchase, setProPassPurchase] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Dynamic PRO Pass Config & Plans from Admin
  const [isVisibleOnWebsite, setIsVisibleOnWebsite] = useState(true);
  const [plans, setPlans] = useState<ProPassPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProPassPlan | null>(null);

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [appliedResult, setAppliedResult] = useState<{
    valid: boolean;
    finalPrice: number;
    discountAmount: number;
    message: string;
  } | null>(null);
  const [activeCoupons, setActiveCoupons] = useState<PromoCoupon[]>([]);

  const baseLaunchPrice = selectedPlan?.launchPrice ?? 499;
  const originalPrice = selectedPlan?.originalPrice ?? 1499;
  const finalPayable = appliedResult?.valid ? appliedResult.finalPrice : baseLaunchPrice;

  useEffect(() => {
    const applyCfg = (cfg: ReturnType<typeof getProPassConfig>, couponsList: PromoCoupon[]) => {
      setIsVisibleOnWebsite(cfg.isVisibleOnWebsite);
      const activePlans = cfg.plans.filter((p) => p.isActive);
      setPlans(activePlans);
      const popularOrDefault =
        activePlans.find((p) => p.isPopular) || activePlans[0] || null;
      setSelectedPlan(popularOrDefault);
      setActiveCoupons(
        couponsList.filter(
          (c) => c.isActive && (c.applicableTo === 'ALL' || c.applicableTo === 'PRO_PASS')
        )
      );
    };

    applyCfg(getProPassConfig(), getPromoCoupons());
    syncMonetizationFromSupabase().then((synced) => {
      applyCfg(synced.proPassConfig, synced.coupons);
    });

    checkUserAndPass();

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // Re-evaluate applied coupon whenever the user switches duration plan
  useEffect(() => {
    if (couponCode.trim() && selectedPlan) {
      const res = evaluatePromoCoupon(
        couponCode,
        selectedPlan.launchPrice,
        'PRO_PASS'
      );
      setAppliedResult(res);
    }
  }, [selectedPlan]);

  async function checkUserAndPass() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      const emailGrants = await checkAndClaimEmailGrants(session.user);
      const matchedGrant = emailGrants.find((g) =>
        g.courseName.toLowerCase().includes('pro pass')
      );
      if (matchedGrant) {
        setHasProPass(true);
        setProPassPurchase({
          course_name: matchedGrant.courseName,
          amount_paid: 0,
          payment_id: `ADMIN_GRANT_${matchedGrant.id}`,
          expires_at: matchedGrant.expiresAt,
        });
      }
      const { data } = await supabase
        .from('student_course_purchases')
        .select('*')
        .eq('user_id', session.user.id)
        .ilike('course_name', '%PRO Pass%')
        .maybeSingle();

      if (data && (!data.expires_at || new Date(data.expires_at) > new Date())) {
        setHasProPass(true);
        setProPassPurchase(data);
      }
    }
  }

  const handleApplyCouponCode = (codeToTest?: string) => {
    const raw = codeToTest !== undefined ? codeToTest : couponCode;
    setCouponCode(raw.toUpperCase());
    const res = evaluatePromoCoupon(raw, baseLaunchPrice, 'PRO_PASS');
    setAppliedResult(res);
  };

  const activateProPassInDb = async (paymentId: string, paidAmount: number) => {
    if (!user || !selectedPlan) return;

    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (selectedPlan.durationMonths || 6));
    const isoExpiry = expiryDate.toISOString();

    const passTitle = `BankingSolutions PRO Pass (${selectedPlan.durationMonths} ${
      selectedPlan.durationMonths === 1 ? 'Month' : 'Months'
    })`;

    const purchasesPayload = [
      {
        user_id: user.id,
        course_name: passTitle,
        amount_paid: paidAmount,
        payment_id: paymentId,
        expires_at: isoExpiry,
      },
      {
        user_id: user.id,
        course_name: 'Critical Reasoning Mastery Course',
        amount_paid: 0,
        payment_id: paymentId,
        expires_at: isoExpiry,
      },
      {
        user_id: user.id,
        course_name: 'Computer Awareness Course',
        amount_paid: 0,
        payment_id: paymentId,
        expires_at: isoExpiry,
      },
      {
        user_id: user.id,
        course_name: 'Smart Mistake Notebook & Drills',
        amount_paid: 0,
        payment_id: paymentId,
        expires_at: isoExpiry,
      },
    ];

    const { error } = await supabase
      .from('student_course_purchases')
      .upsert(purchasesPayload, { onConflict: 'user_id,course_name' });

    if (!error) {
      setHasProPass(true);
      setProPassPurchase(purchasesPayload[0]);
      alert(
        `🎉 Welcome to ${passTitle}! All Master Courses & Smart Mistake Notebook are now unlocked.`
      );
    } else {
      alert(`Activation encountered a DB issue: ${error.message}`);
    }
    setIsProcessing(false);
  };

  const handleBuyProPass = async () => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!selectedPlan) return;

    setIsProcessing(true);

    // 100% Discount Code Support (₹0 Payable — Instant Free Activation)
    if (finalPayable <= 0) {
      await activateProPassInDb(`FREE_COUPON_${couponCode || '100'}`, 0);
      return;
    }

    const amountInPaise = finalPayable * 100;

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
      amount: amountInPaise,
      currency: 'INR',
      name: 'BankingSolutions',
      description: `${selectedPlan.title} (${selectedPlan.durationMonths}M All-Access)`,
      handler: async function (response: any) {
        await activateProPassInDb(response.razorpay_payment_id, finalPayable);
      },
      prefill: {
        name: user?.user_metadata?.full_name || 'Banking Aspirant',
        email: user?.email || '',
      },
      theme: { color: '#F59E0B' },
    };

    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      alert('Razorpay SDK is loading. Please check your connection and try again.');
      setIsProcessing(false);
    }
  };

  const isAdminViewer = user?.email?.toLowerCase() === ADMIN_EMAIL;

  // If Admin hid PRO Pass from website and user is not Admin
  if (!isVisibleOnWebsite && !isAdminViewer) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-white/[0.08] flex items-center justify-center text-3xl">
          👑
        </div>
        <h1 className="text-2xl font-black text-white">PRO Pass Enrollment Currently Paused</h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md">
          The bundled PRO Pass is currently unavailable. You can still enroll in individual courses and mock tests directly below.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/critical-reasoning"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl transition"
          >
            🧠 Critical Reasoning
          </Link>
          <Link
            href="/notebook"
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
          >
            🔖 Mistake Notebook
          </Link>
          <Link
            href="/"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
          >
            ← Back Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-gradient-to-r from-amber-500/15 via-blue-600/10 to-purple-600/15 blur-[140px] rounded-full z-0" />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          checkUserAndPass();
        }}
      />

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20">
              BS
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                Flexible All-In-One Membership
              </span>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
                BankingSolutions PRO Pass
              </h1>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            {!isVisibleOnWebsite && isAdminViewer && (
              <span className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black">
                🙈 Hidden from Public (Admin Preview)
              </span>
            )}
            <Link
              href="/profile"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              📊 Learning Hub
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-300 font-bold text-xs rounded-xl transition"
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full space-y-10">
        {/* Hero Banner */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-widest">
            <span>👑</span> Choose 1 Month, 3 Months, 6 Months or 12 Months
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            One Pass to Unlock{' '}
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Every Course, Mock &amp; Vault
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Get instant access to Critical Reasoning Mastery, Computer Awareness, Real CBT Full Mocks, RRB Bilingual PDFs, and the Smart Mistake Notebook for your preferred validity duration.
          </p>
        </div>

        {/* DURATION SELECTOR CARDS (1M / 3M / 6M / 12M etc.) */}
        {plans.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 text-center">
              Step 1: Select Your PRO Pass Validity Duration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const isSelected = selectedPlan?.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan)}
                    className={`p-5 rounded-3xl border text-left transition-all flex flex-col justify-between space-y-3 cursor-pointer relative ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-400/20 via-slate-900 to-slate-950 border-2 border-amber-400 shadow-[0_0_35px_-8px_rgba(251,191,36,0.35)] -translate-y-0.5'
                        : 'bg-slate-900/75 border-white/[0.08] hover:border-amber-400/40'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'}
                        </span>
                        {plan.badge && (
                          <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-white pt-1">{plan.title}</h4>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-400">
                          ₹{plan.launchPrice}
                        </span>
                        <span className="text-xs text-slate-500 line-through font-bold">
                          ₹{plan.originalPrice}
                        </span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-bold block mt-0.5">
                        ₹{Math.round(plan.launchPrice / Math.max(1, plan.durationMonths))}/month
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Pricing & Bundle Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: What's Included Breakdown */}
          <div className="lg:col-span-7 bg-slate-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div>
                <h3 className="text-lg font-black text-white">Everything Included in PRO Pass</h3>
                <p className="text-xs text-slate-400">
                  Designed for SBI PO/Clerk, IBPS PO/Clerk &amp; RRB PO/Clerk 2026
                </p>
              </div>
              <span className="text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full">
                All 5 Modules Included
              </span>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: '🧠',
                  title: 'Critical Reasoning Mastery Course (Bilingual)',
                  desc: 'Complete Statement-Assumption, Inference, Course of Action & Cause-Effect reader + downloadable MCQ PDFs.',
                  standalone: '₹499',
                },
                {
                  icon: '💻',
                  title: 'Computer Awareness Complete Course & Chapter Quizzes',
                  desc: 'Full RRB & Mains syllabus coverage with interactive chapter-wise practice tests.',
                  standalone: '₹199',
                },
                {
                  icon: '🔖',
                  title: 'Smart Mistake Notebook & Unlimited Re-Attempt Drills',
                  desc: 'Auto-captures wrong answers across all mocks and lets you launch custom "Fix Your Mistakes" quizzes.',
                  standalone: '₹299',
                },
                {
                  icon: '🚀',
                  title: 'Unlimited Real CBT Full-Length & Sectional Mock Tests',
                  desc: 'Real exam interface with Bilingual toggle, Time-Trap Detector, Topper Comparison & All-India Rank.',
                  standalone: '₹999',
                },
                {
                  icon: '📚',
                  title: '50-Day RRB PO & Clerk Bilingual PDF Course',
                  desc: 'Daily Reasoning, Quant, English, GA & Computer PDFs in English + Hindi with video solutions.',
                  standalone: '₹499',
                },
              ].map((feat) => (
                <div
                  key={feat.title}
                  className="bg-slate-950/80 border border-white/[0.06] rounded-2xl p-4 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-xl shrink-0">
                      {feat.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{feat.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs line-through text-slate-500 block">{feat.standalone}</span>
                    <span className="text-[10px] font-black uppercase text-emerald-400">Included ✓</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Checkout & Dynamic Coupon Card */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-400/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_50px_-12px_rgba(251,191,36,0.25)] sticky top-24">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full">
                  {selectedPlan?.badge || 'SELECTED PLAN'}
                </span>
                <h3 className="text-xl font-black text-white mt-2">
                  {selectedPlan?.title || 'PRO Pass'}
                </h3>
                <p className="text-xs text-slate-400">
                  Full {selectedPlan?.durationMonths || 6}-Month Unlimited Access
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 line-through font-bold block">
                  ₹{originalPrice}
                </span>
                <span className="text-3xl font-black text-amber-400">₹{finalPayable}</span>
                <span className="text-[10px] text-emerald-400 font-bold block">
                  Save ₹{Math.max(0, originalPrice - finalPayable)}
                </span>
              </div>
            </div>

            {hasProPass ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 text-xs space-y-1">
                  <span className="font-black text-sm text-emerald-300 block">
                    🎉 Your PRO Pass is Active!
                  </span>
                  <p>
                    You have full access to Critical Reasoning, Computer Awareness, Smart Mistake Notebook, and Mock Tests.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href="/critical-reasoning"
                    className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs text-center transition"
                  >
                    🧠 Critical Reasoning
                  </Link>
                  <Link
                    href="/notebook"
                    className="py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs text-center transition"
                  >
                    🔖 Mistake Notebook
                  </Link>
                </div>

                {proPassPurchase && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadPurchaseReceipt({
                        receiptId: proPassPurchase.id || 'PROPASS2026',
                        itemName: proPassPurchase.course_name || 'BankingSolutions PRO Pass',
                        itemType: 'PRO Pass Bundle',
                        amountPaid: proPassPurchase.amount_paid ?? finalPayable,
                        paymentId: proPassPurchase.payment_id || 'ONLINE',
                        purchaseDate: proPassPurchase.purchased_at || new Date().toISOString(),
                        expiryDate: proPassPurchase.expires_at,
                        studentName: user?.user_metadata?.full_name || 'Aspirant',
                        studentEmail: user?.email || '',
                      })
                    }
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/[0.1] text-slate-200 font-bold text-xs transition"
                  >
                    🧾 Download Tax Receipt / Invoice
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Promo Coupon Input */}
                <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    🎟️ Have a Promo / Educator Code?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code (e.g. BSOL)"
                      className="flex-1 bg-slate-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-black uppercase text-white outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyCouponCode()}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 font-black text-xs rounded-xl transition shrink-0"
                    >
                      Apply
                    </button>
                  </div>

                  {appliedResult && (
                    <p
                      className={`text-xs font-bold ${
                        appliedResult.valid ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {appliedResult.message}
                    </p>
                  )}

                  {/* Quick Tap Available Coupons */}
                  {activeCoupons.length > 0 && (
                    <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Available Offers (Tap to Apply):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeCoupons.map((cpn) => (
                          <button
                            key={cpn.id}
                            type="button"
                            onClick={() => handleApplyCouponCode(cpn.code)}
                            className="px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[11px] font-black transition"
                          >
                            🎟️ {cpn.code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleBuyProPass}
                  className="w-full py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/25 transition cursor-pointer"
                >
                  {isProcessing
                    ? 'Activating Access...'
                    : finalPayable <= 0
                    ? `🎉 Unlock ${selectedPlan?.durationMonths || 6}M PRO Pass FREE (₹0) →`
                    : `Unlock ${selectedPlan?.durationMonths || 6}M PRO Pass for ₹${finalPayable} →`}
                </button>

                <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 font-semibold pt-1">
                  <span>🔒 100% Secure Razorpay</span>
                  <span>•</span>
                  <span>⚡ Instant Activation</span>
                  <span>•</span>
                  <span>🧾 GST Receipt</span>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
