'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import {
  DynamicCourse,
  DEFAULT_COURSE_PLANS,
  getDynamicCourses,
  syncDynamicCoursesFromSupabase,
} from '@/lib/courses';
import {
  PromoCoupon,
  ProPassPlan,
  getPromoCoupons,
  evaluatePromoCoupon,
  downloadPurchaseReceipt,
  getProPassConfig,
  syncMonetizationFromSupabase,
  checkAndClaimEmailGrants,
} from '@/lib/monetization';

const ADMIN_EMAIL = 'abhijeet9022102210@gmail.com';

function getYouTubeEmbedUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.includes('/embed/')) return rawUrl;
    }
  } catch (e) {}
  return null;
}

export default function DynamicCourseReaderPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || '';

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<DynamicCourse | null>(null);
  const [selectedChapterNo, setSelectedChapterNo] = useState<number>(1);
  const [languageMode, setLanguageMode] = useState<'english' | 'hinglish'>('english');

  // Auth & Subscription States
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [hasCourseAccess, setHasCourseAccess] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<string | null>(null);
  const [purchaseRecord, setPurchaseRecord] = useState<any>(null);
  const [isProPassVisible, setIsProPassVisible] = useState(true);

  // Paid Course Multi-Duration Plan & Coupon Checkout States
  const [selectedPlan, setSelectedPlan] = useState<ProPassPlan>(DEFAULT_COURSE_PLANS[2] || DEFAULT_COURSE_PLANS[0]);
  const [couponInput, setCouponInput] = useState('');
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    finalPrice: number;
    discountAmount: number;
    message: string;
  } | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<PromoCoupon[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const originalPrice = selectedPlan?.originalPrice || 499;
  const launchPrice = selectedPlan?.launchPrice || 249;
  const payableAmount = couponResult?.valid ? couponResult.finalPrice : launchPrice;

  useEffect(() => {
    setIsProPassVisible(getProPassConfig().isVisibleOnWebsite);
    setAvailableCoupons(
      getPromoCoupons().filter((c) => c.isActive && c.applicableTo === 'ALL')
    );
    syncMonetizationFromSupabase().then((synced) => {
      setIsProPassVisible(synced.proPassConfig.isVisibleOnWebsite);
      setAvailableCoupons(
        synced.coupons.filter((c) => c.isActive && c.applicableTo === 'ALL')
      );
    });

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    loadCourseAndSubscription();
  }, [slug]);

  async function loadCourseAndSubscription() {
    setLoading(true);
    let allCourses = getDynamicCourses();
    let matched = allCourses.find((c) => c.slug === slug || c.id === slug);

    if (!matched) {
      allCourses = await syncDynamicCoursesFromSupabase();
      matched = allCourses.find((c) => c.slug === slug || c.id === slug);
    }

    if (matched) {
      setCourse(matched);
      if (matched.chapters.length > 0) {
        setSelectedChapterNo(matched.chapters[0].chapterNumber);
      }
      const coursePlans =
        matched.plans && matched.plans.length > 0
          ? matched.plans
          : DEFAULT_COURSE_PLANS;
      setSelectedPlan(
        coursePlans.find((p) => p.isPopular) || coursePlans[0]
      );

      if (matched.isFree) {
        setHasCourseAccess(true);
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);

      if (session.user.email?.toLowerCase() === ADMIN_EMAIL) {
        setHasCourseAccess(true);
        setExpiresAtDate('Admin Lifetime');
        setLoading(false);
        return;
      }

      if (matched && !matched.isFree) {
        const emailGrants = await checkAndClaimEmailGrants(session.user);
        const matchedEmailGrant = emailGrants.find((g) => {
          const gName = g.courseName.toLowerCase();
          return (
            gName.includes(matched!.title.toLowerCase()) ||
            (matched!.includedInProPass && gName.includes('pro pass'))
          );
        });

        if (matchedEmailGrant) {
          setHasCourseAccess(true);
          setExpiresAtDate(
            matchedEmailGrant.expiresAt
              ? new Date(matchedEmailGrant.expiresAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Lifetime Access'
          );
        }

        const { data: purchases } = await supabase
          .from('student_course_purchases')
          .select('*')
          .eq('user_id', session.user.id);

        if (purchases && purchases.length > 0) {
          const validSub = purchases.find((p: any) => {
            const pName = (p.course_name || '').toLowerCase();
            const matchCourseTitle = pName.includes(matched!.title.toLowerCase());
            const matchProPass =
              matched!.includedInProPass && pName.includes('pro pass');
            const notExpired = !p.expires_at || new Date(p.expires_at) > new Date();
            return (matchCourseTitle || matchProPass) && notExpired;
          });

          if (validSub) {
            setHasCourseAccess(true);
            setPurchaseRecord(validSub);
            if (validSub.expires_at) {
              setExpiresAtDate(
                new Date(validSub.expires_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              );
            }
          }
        }
      }
    }

    setLoading(false);
  }

  const handleSelectPlan = (plan: ProPassPlan) => {
    setSelectedPlan(plan);
    if (couponInput.trim()) {
      const res = evaluatePromoCoupon(couponInput, plan.launchPrice, 'ALL');
      setCouponResult(res);
    }
  };

  const handleApplyCoupon = (codeToApply?: string) => {
    const raw = codeToApply !== undefined ? codeToApply : couponInput;
    setCouponInput(raw.toUpperCase());
    const res = evaluatePromoCoupon(raw, launchPrice, 'ALL');
    setCouponResult(res);
  };

  const handleBuyCourse = async () => {
    if (!course) return;
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    setIsProcessingPayment(true);
    const durationMonths = selectedPlan?.durationMonths || 6;
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + durationMonths);

    // Handle 100% Discount (₹0 Free Unlock via Promo Coupon)
    if (payableAmount <= 0) {
      const payload = {
        user_id: user.id,
        course_name: `${course.title} (${durationMonths}M)`,
        amount_paid: 0,
        payment_id: `FREE_COUPON_${couponInput || '100OFF'}`,
        expires_at: expiryDate.toISOString(),
      };

      const { error } = await supabase
        .from('student_course_purchases')
        .upsert([payload], { onConflict: 'user_id,course_name' });

      if (!error) {
        setHasCourseAccess(true);
        setPurchaseRecord(payload);
        setExpiresAtDate(
          expiryDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        );
        alert(
          `🎉 100% Discount Applied! "${course.title}" Unlocked Free for ${durationMonths} ${
            durationMonths === 1 ? 'Month' : 'Months'
          }!`
        );
      } else {
        alert(`Activation encountered an error: ${error.message}`);
      }
      setIsProcessingPayment(false);
      return;
    }

    const amountInPaise = payableAmount * 100;
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
      amount: amountInPaise,
      currency: 'INR',
      name: 'BankingSolutions',
      description: `${course.title} (${durationMonths} ${
        durationMonths === 1 ? 'Month' : 'Months'
      })`,
      handler: async function (response: any) {
        const payload = {
          user_id: user.id,
          course_name: `${course.title} (${durationMonths}M)`,
          amount_paid: payableAmount,
          payment_id: response.razorpay_payment_id,
          expires_at: expiryDate.toISOString(),
        };

        const { error } = await supabase
          .from('student_course_purchases')
          .upsert([payload], { onConflict: 'user_id,course_name' });

        if (!error) {
          setHasCourseAccess(true);
          setPurchaseRecord(payload);
          setExpiresAtDate(
            expiryDate.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          );
          alert(
            `🎉 "${course.title}" Unlocked for ${durationMonths} ${
              durationMonths === 1 ? 'Month' : 'Months'
            }!`
          );
        } else {
          alert(`Payment received, but DB update encountered an error: ${error.message}`);
        }
        setIsProcessingPayment(false);
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
      alert('Razorpay SDK failed to load. Please check your internet connection.');
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mr-3" />
        Loading Course Workspace...
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="text-4xl">🎓</div>
        <h2 className="text-xl font-black">Course Not Found</h2>
        <Link
          href="/courses"
          className="px-5 py-2.5 bg-amber-400 text-slate-950 font-black text-xs rounded-xl"
        >
          ← Back to Courses Catalog
        </Link>
      </div>
    );
  }

  const activeChapter =
    course.chapters.find((ch) => ch.chapterNumber === selectedChapterNo) ||
    course.chapters[0];

  const isChapterLocked =
    !course.isFree &&
    !hasCourseAccess &&
    activeChapter &&
    !activeChapter.isFreePreview;

  const embedVideoUrl = getYouTubeEmbedUrl(activeChapter?.videoUrl);
  const coursePlans =
    course.plans && course.plans.length > 0 ? course.plans : DEFAULT_COURSE_PLANS;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col">
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          loadCourseAndSubscription();
        }}
      />

      {/* TOP NAVBAR */}
      <header className="bg-slate-950/90 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4 flex flex-wrap justify-between items-center gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link
            href="/courses"
            className="w-10 h-10 bg-amber-400/15 border border-amber-400/35 text-amber-300 rounded-xl flex items-center justify-center text-xl shadow-md"
          >
            {course.icon || '🎓'}
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
                {course.title}
              </h1>
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                  course.isFree
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : hasCourseAccess
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                }`}
              >
                {course.isFree
                  ? '🎁 100% Free Course'
                  : hasCourseAccess
                  ? `✓ Unlocked ${expiresAtDate ? `• Till ${expiresAtDate}` : ''}`
                  : '🔒 Premium Course'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{course.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {!course.isFree && !hasCourseAccess && (
            <button
              type="button"
              onClick={handleBuyCourse}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition"
            >
              🔥 Unlock Course (₹{payableAmount})
            </button>
          )}

          {hasCourseAccess && purchaseRecord && (
            <button
              type="button"
              onClick={() =>
                downloadPurchaseReceipt({
                  receiptId: purchaseRecord.id || 'CRS2026',
                  itemName: purchaseRecord.course_name || course.title,
                  itemType: 'Master Course',
                  amountPaid: purchaseRecord.amount_paid || 0,
                  paymentId: purchaseRecord.payment_id || 'ONLINE',
                  purchaseDate: purchaseRecord.created_at || new Date().toISOString(),
                  expiryDate: purchaseRecord.expires_at,
                  studentName: user?.user_metadata?.full_name || 'Aspirant',
                  studentEmail: user?.email || '',
                })
              }
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-amber-400/30 text-amber-300 font-bold text-xs rounded-xl transition"
            >
              🧾 Receipt
            </button>
          )}

          {/* Language Switcher if Hinglish notes exist */}
          {activeChapter?.hinglishContent && (
            <div className="flex bg-slate-900 border border-white/[0.08] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLanguageMode('english')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  languageMode === 'english'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇬🇧 English
              </button>
              <button
                type="button"
                onClick={() => setLanguageMode('hinglish')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  languageMode === 'hinglish'
                    ? 'bg-amber-500 text-slate-950 font-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🇮🇳 Hinglish
              </button>
            </div>
          )}

          <Link
            href="/courses"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-white/[0.08] transition"
          >
            ← All Courses
          </Link>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CHAPTERS SIDEBAR */}
        <aside className="lg:col-span-3 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-4 space-y-3 lg:sticky lg:top-24 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Course Curriculum
            </h3>
            <span className="text-[10px] font-bold text-amber-400">
              {course.chapters.length} Chapters
            </span>
          </div>

          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {course.chapters.map((ch) => {
              const isSelected = selectedChapterNo === ch.chapterNumber;
              const locked =
                !course.isFree && !hasCourseAccess && !ch.isFreePreview;

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChapterNo(ch.chapterNumber)}
                  className={`w-full text-left p-3 rounded-xl transition text-xs font-bold flex justify-between items-center gap-2 ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-lg'
                      : 'bg-slate-950/70 hover:bg-slate-800 text-slate-300 border border-white/[0.06]'
                  }`}
                >
                  <span className="truncate">
                    Ch {ch.chapterNumber}: {ch.title}
                  </span>
                  <span className="text-[10px] shrink-0">
                    {locked ? '🔒' : '🔓'}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CHAPTER READER OR CHECKOUT GATE */}
        <main className="lg:col-span-9 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          {!activeChapter ? (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <div className="text-4xl">📖</div>
              <h3 className="text-base font-bold text-white">
                Chapters Coming Soon
              </h3>
              <p className="text-xs">
                New chapters for this course are being uploaded. Check back shortly!
              </p>
            </div>
          ) : isChapterLocked ? (
            /* 🔒 PAID COURSE MULTI-DURATION CHECKOUT & COUPON GATE */
            <div className="max-w-xl mx-auto py-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-amber-400/15 text-amber-400 border border-amber-400/30 rounded-2xl flex items-center justify-center text-3xl mx-auto">
                  🔒
                </div>
                <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-full">
                  Locked Premium Chapter
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Chapter {activeChapter.chapterNumber}: {activeChapter.title}
                </h2>
                <p className="text-xs text-slate-400">
                  Unlock full access to <strong className="text-white">{course.title}</strong> by selecting your preferred validity plan below.
                </p>
              </div>

              {/* Duration Plan Selector (1M / 3M / 6M / 12M) */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  ⏳ Select Course Validity Plan:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {coursePlans.map((plan) => {
                    const isSelected = selectedPlan?.id === plan.id;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => handleSelectPlan(plan)}
                        className={`text-left p-3 rounded-2xl border transition ${
                          isSelected
                            ? 'bg-amber-400/15 border-amber-400 shadow-lg'
                            : 'bg-slate-950/90 border-white/[0.08] hover:border-white/25'
                        }`}
                      >
                        <div className="text-xs font-black text-white">
                          {plan.durationMonths}{' '}
                          {plan.durationMonths === 1 ? 'Month' : 'Months'}
                        </div>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-sm font-black text-amber-400">
                            ₹{plan.launchPrice}
                          </span>
                          <span className="text-[10px] text-slate-500 line-through">
                            ₹{plan.originalPrice}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 space-y-3">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                  🎟️ Have a Promo Code?
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter code (e.g. BSOL)"
                    className="flex-1 bg-slate-900 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-black uppercase text-white outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 font-black text-xs rounded-xl transition"
                  >
                    Apply
                  </button>
                </div>

                {couponResult && (
                  <p
                    className={`text-xs font-bold ${
                      couponResult.valid ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {couponResult.message}
                  </p>
                )}

                {availableCoupons.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableCoupons.map((cpn) => (
                      <button
                        key={cpn.id}
                        type="button"
                        onClick={() => handleApplyCoupon(cpn.code)}
                        className="px-2.5 py-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 text-[11px] font-black transition"
                      >
                        🎟️ {cpn.code}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isProcessingPayment}
                onClick={handleBuyCourse}
                className="w-full py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/25 transition cursor-pointer"
              >
                {isProcessingPayment
                  ? 'Activating Access...'
                  : payableAmount <= 0
                  ? `⚡ Unlock Course for FREE (₹0) →`
                  : `Unlock ${selectedPlan?.durationMonths || 6}M Access for ₹${payableAmount} →`}
              </button>

              {isProPassVisible && course.includedInProPass && (
                <div className="text-center pt-2">
                  <Link
                    href="/pro-pass"
                    className="text-xs font-black text-amber-300 hover:underline"
                  >
                    👑 Or get this course + all other courses inside BankingSolutions PRO Pass →
                  </Link>
                </div>
              )}
            </div>
          ) : (
            /* 🔓 UNLOCKED CHAPTER CONTENT */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
                    Chapter {activeChapter.chapterNumber}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    {activeChapter.title}
                  </h2>
                  {activeChapter.subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {activeChapter.subtitle}
                    </p>
                  )}
                </div>

                {activeChapter.pdfUrl && (
                  <a
                    href={activeChapter.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-lg transition flex items-center gap-2 shrink-0"
                  >
                    <span>📥</span>
                    <span>Download Chapter PDF</span>
                  </a>
                )}
              </div>

              {/* Optional Embedded YouTube Video Lecture */}
              {embedVideoUrl && (
                <div className="rounded-2xl overflow-hidden border border-white/[0.1] bg-slate-950 aspect-video shadow-xl">
                  <iframe
                    src={embedVideoUrl}
                    title={activeChapter.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Markdown Notes Body */}
              <div className="prose prose-invert prose-amber max-w-none text-sm leading-relaxed bg-slate-950/60 border border-white/[0.06] rounded-2xl p-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {languageMode === 'hinglish' && activeChapter.hinglishContent
                    ? activeChapter.hinglishContent
                    : activeChapter.markdownContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

