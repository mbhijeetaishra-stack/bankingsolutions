'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import {
  NotebookItem,
  getNotebookItems,
  toggleBookmarkQuestion,
  updateNotebookNote,
  toggleMasteredStatus,
  removeNotebookItem,
} from '@/lib/notebook';
import {
  PromoCoupon,
  ProPassPlan,
  getPromoCoupons,
  evaluatePromoCoupon,
  downloadPurchaseReceipt,
  getProPassConfig,
  getNotebookPlans,
  DEFAULT_NOTEBOOK_PLANS,
  syncMonetizationFromSupabase,
  checkAndClaimEmailGrants,
} from '@/lib/monetization';

const ADMIN_EMAIL = 'abhijeet9022102210@gmail.com';

export default function MistakeNotebookPage() {
  const [items, setItems] = useState<NotebookItem[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [hasNotebookAccess, setHasNotebookAccess] = useState(false);
  const [expiresAtDate, setExpiresAtDate] = useState<string | null>(null);
  const [purchaseRecord, setPurchaseRecord] = useState<any>(null);
  const [isProPassVisible, setIsProPassVisible] = useState(true);

  // Configurable Duration Plans (1 Month / 3 Months / 6 Months / 12 Months)
  const [notebookPlans, setNotebookPlans] = useState<ProPassPlan[]>(DEFAULT_NOTEBOOK_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<ProPassPlan>(
    DEFAULT_NOTEBOOK_PLANS.find((p) => p.isPopular) || DEFAULT_NOTEBOOK_PLANS[2] || DEFAULT_NOTEBOOK_PLANS[0]
  );

  // Standalone Checkout & Promo States
  const originalPrice = selectedPlan?.originalPrice || 399;
  const launchPrice = selectedPlan?.launchPrice || 199;
  const [couponInput, setCouponInput] = useState('');
  const [couponResult, setCouponResult] = useState<{
    valid: boolean;
    finalPrice: number;
    discountAmount: number;
    message: string;
  } | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<PromoCoupon[]>([]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const payableAmount = couponResult?.valid ? couponResult.finalPrice : launchPrice;

  const [filterMode, setFilterMode] = useState<'ALL' | 'MISTAKES' | 'BOOKMARKED' | 'NOTES' | 'MASTERED'>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideAnswersMode, setHideAnswersMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [selectedPracticeOpt, setSelectedPracticeOpt] = useState<Record<string, number>>({});

  // Note editing states
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  // "Fix Your Mistakes" Interactive Drill States
  const [drillActive, setDrillActive] = useState(false);
  const [drillQuestions, setDrillQuestions] = useState<NotebookItem[]>([]);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillAnswers, setDrillAnswers] = useState<Record<number, number>>({});
  const [drillSubmitted, setDrillSubmitted] = useState(false);

  useEffect(() => {
    setItems(getNotebookItems());
    const applyNotebookSync = (
      visible: boolean,
      rawPlans: ProPassPlan[],
      couponsList: PromoCoupon[]
    ) => {
      setIsProPassVisible(visible);
      const activeNbPlans = rawPlans.filter((p) => p.isActive);
      const list = activeNbPlans.length > 0 ? activeNbPlans : DEFAULT_NOTEBOOK_PLANS;
      setNotebookPlans(list);
      const defaultPlan = list.find((p) => p.isPopular) || list[0];
      if (defaultPlan) setSelectedPlan(defaultPlan);
      setAvailableCoupons(
        couponsList.filter(
          (c) =>
            c.isActive &&
            (c.applicableTo === 'ALL' || c.applicableTo === 'MISTAKE_NOTEBOOK')
        )
      );
    };

    applyNotebookSync(
      getProPassConfig().isVisibleOnWebsite,
      getNotebookPlans(),
      getPromoCoupons()
    );
    syncMonetizationFromSupabase().then((synced) => {
      applyNotebookSync(
        synced.proPassConfig.isVisibleOnWebsite,
        synced.notebookPlans,
        synced.coupons
      );
    });

    checkNotebookSubscription();

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function checkNotebookSubscription() {
    setLoadingAccess(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);

      if (session.user.email?.toLowerCase() === ADMIN_EMAIL) {
        setHasNotebookAccess(true);
        setExpiresAtDate('Admin Lifetime');
        setLoadingAccess(false);
        return;
      }

      const emailGrants = await checkAndClaimEmailGrants(session.user);
      const matchedGrant = emailGrants.find(
        (g) =>
          g.courseName.toLowerCase().includes('mistake notebook') ||
          g.courseName.toLowerCase().includes('pro pass')
      );
      if (matchedGrant) {
        setHasNotebookAccess(true);
        setExpiresAtDate(
          matchedGrant.expiresAt
            ? new Date(matchedGrant.expiresAt).toLocaleDateString('en-IN', {
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
          const name = (p.course_name || '').toLowerCase();
          const isMatch =
            name.includes('mistake notebook') || name.includes('pro pass');
          const notExpired = !p.expires_at || new Date(p.expires_at) > new Date();
          return isMatch && notExpired;
        });

        if (validSub) {
          setHasNotebookAccess(true);
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
    setLoadingAccess(false);
  }

  const handleSelectNotebookPlan = (plan: ProPassPlan) => {
    setSelectedPlan(plan);
    if (couponInput.trim()) {
      const res = evaluatePromoCoupon(couponInput, plan.launchPrice, 'MISTAKE_NOTEBOOK');
      setCouponResult(res);
    }
  };

  const handleApplyNotebookCoupon = (codeToApply?: string) => {
    const raw = codeToApply !== undefined ? codeToApply : couponInput;
    setCouponInput(raw.toUpperCase());
    const res = evaluatePromoCoupon(raw, launchPrice, 'MISTAKE_NOTEBOOK');
    setCouponResult(res);
  };

  const handleBuyNotebookAccess = async () => {
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
        course_name: `Smart Mistake Notebook & Drills (${durationMonths}M)`,
        amount_paid: 0,
        payment_id: `FREE_COUPON_${couponInput || '100OFF'}`,
        expires_at: expiryDate.toISOString(),
      };

      const { error } = await supabase
        .from('student_course_purchases')
        .upsert([payload], { onConflict: 'user_id,course_name' });

      if (!error) {
        setHasNotebookAccess(true);
        setPurchaseRecord(payload);
        setExpiresAtDate(
          expiryDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        );
        alert(
          `🎉 100% Discount Applied! Smart Mistake Notebook & Unlimited Re-Attempt Drills Unlocked Free for ${durationMonths} ${
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
      description: `${selectedPlan?.title || 'Smart Mistake Notebook & Drills'} (${durationMonths} ${
        durationMonths === 1 ? 'Month' : 'Months'
      })`,
      handler: async function (response: any) {
        const payload = {
          user_id: user.id,
          course_name: `Smart Mistake Notebook & Drills (${durationMonths}M)`,
          amount_paid: payableAmount,
          payment_id: response.razorpay_payment_id,
          expires_at: expiryDate.toISOString(),
        };

        const { error } = await supabase
          .from('student_course_purchases')
          .upsert([payload], { onConflict: 'user_id,course_name' });

        if (!error) {
          setHasNotebookAccess(true);
          setPurchaseRecord(payload);
          setExpiresAtDate(
            expiryDate.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          );
          alert(
            `🎉 Smart Mistake Notebook & Unlimited Re-Attempt Drills Unlocked for ${durationMonths} ${
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

  const sections = ['ALL', ...Array.from(new Set(items.map((i) => i.section.toUpperCase()).filter(Boolean)))];

  const filteredItems = items.filter((item) => {
    if (filterMode === 'MISTAKES' && (!item.isMistake || item.mastered)) return false;
    if (filterMode === 'BOOKMARKED' && !item.isBookmarked) return false;
    if (filterMode === 'NOTES' && !item.personalNote.trim()) return false;
    if (filterMode === 'MASTERED' && !item.mastered) return false;

    if (sectionFilter !== 'ALL' && item.section.toUpperCase() !== sectionFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQuestion = item.questionText.toLowerCase().includes(q);
      const matchTitle = item.sourceTitle.toLowerCase().includes(q);
      const matchNote = item.personalNote.toLowerCase().includes(q);
      if (!matchQuestion && !matchTitle && !matchNote) return false;
    }

    return true;
  });

  const totalMistakes = items.filter((i) => i.isMistake && !i.mastered).length;
  const totalBookmarked = items.filter((i) => i.isBookmarked).length;
  const totalWithNotes = items.filter((i) => i.personalNote.trim().length > 0).length;
  const totalMastered = items.filter((i) => i.mastered).length;

  const handleStartMistakeDrill = () => {
    if (!hasNotebookAccess) {
      const gateEl = document.getElementById('notebook-paywall-gate');
      if (gateEl) gateEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const pool = items.filter((i) => !i.mastered && (i.isMistake || i.isBookmarked));
    const targetPool = pool.length > 0 ? pool.slice(0, 15) : items.slice(0, 15);
    if (targetPool.length === 0) return;

    setDrillQuestions(targetPool);
    setDrillIndex(0);
    setDrillAnswers({});
    setDrillSubmitted(false);
    setDrillActive(true);
  };

  const handleSaveNote = (id: string) => {
    const updated = updateNotebookNote(id, noteDraft);
    setItems(updated);
    setEditingNoteId(null);
  };

  const handleToggleMastered = (id: string) => {
    const updated = toggleMasteredStatus(id);
    setItems(updated);
  };

  const handleToggleBookmark = (item: NotebookItem) => {
    const { items: updated } = toggleBookmarkQuestion(item);
    setItems(updated);
  };

  const handleRemoveItem = (id: string) => {
    if (!confirm('Remove this question from your Revision Vault?')) return;
    const updated = removeNotebookItem(id);
    setItems(updated);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-600/10 blur-[140px] rounded-full z-0" />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          checkNotebookSubscription();
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-amber-500/20">
              🔖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Smart Bookmark &amp; Mistake Notebook
                </h1>
                {hasNotebookAccess ? (
                  <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 px-2.5 py-0.5 rounded-full">
                    ✓ Unlocked {expiresAtDate ? `• Till ${expiresAtDate}` : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/15 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
                    🔒 PRO Module
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Auto-captured wrong mock/quiz answers, saved bookmarks, and personal shortcut notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {hasNotebookAccess && items.length > 0 && !drillActive && (
              <button
                onClick={handleStartMistakeDrill}
                className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-rose-500/20 transition flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Fix Your Mistakes Quiz ({Math.min(15, items.filter((i) => !i.mastered).length || items.length)})</span>
              </button>
            )}
            {!hasNotebookAccess && (
              <button
                onClick={handleBuyNotebookAccess}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5"
              >
                <span>🔒</span>
                <span>Unlock Vault (₹{payableAmount})</span>
              </button>
            )}
            {hasNotebookAccess && purchaseRecord && (
              <button
                type="button"
                onClick={() =>
                  downloadPurchaseReceipt({
                    receiptId: purchaseRecord.id || 'VAULT2026',
                    itemName: purchaseRecord.course_name || 'Smart Mistake Notebook & Drills',
                    itemType: 'Master Course',
                    amountPaid: purchaseRecord.amount_paid || payableAmount,
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
            <Link
              href="/profile"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        
        {/* ==================== INTERACTIVE "FIX YOUR MISTAKES" DRILL MODE ==================== */}
        {drillActive ? (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-slate-900/85 backdrop-blur-xl border border-amber-400/30 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-2xl">
              <div>
                <button
                  onClick={() => setDrillActive(false)}
                  className="text-xs font-bold text-slate-400 hover:text-amber-400 transition block mb-1"
                >
                  ← Exit Drill to Revision Vault
                </button>
                <h2 className="text-xl font-black text-white">
                  ⚡ Fix Your Mistakes — Rapid Revision Drill
                </h2>
                <p className="text-xs text-slate-400">
                  Question {drillIndex + 1} of {drillQuestions.length} • Re-attempting your saved mistakes &amp; bookmarks
                </p>
              </div>

              {drillSubmitted ? (
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black px-4 py-2 rounded-xl text-sm">
                    Score:{' '}
                    {
                      drillQuestions.filter((q, idx) => drillAnswers[idx] === q.correctOptionIndex)
                        .length
                    }{' '}
                    / {drillQuestions.length}
                  </div>
                  <button
                    onClick={handleStartMistakeDrill}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
                  >
                    🔄 New Drill
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDrillSubmitted(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition"
                >
                  Submit Drill &amp; Check Accuracy
                </button>
              )}
            </div>

            {/* Active Drill Question Card */}
            {drillQuestions[drillIndex] && (() => {
              const q = drillQuestions[drillIndex];
              const selectedOpt = drillAnswers[drillIndex];
              const isRevealed = drillSubmitted || selectedOpt !== undefined;

              return (
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/[0.08] pb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase">
                        {q.section}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">
                        From: {q.sourceTitle}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        handleToggleMastered(q.id);
                        setDrillQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ? { ...item, mastered: !item.mastered } : item
                          )
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        q.mastered
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800 border-white/[0.08] text-slate-300 hover:text-white'
                      }`}
                    >
                      {q.mastered ? '✓ Marked as Mastered' : 'Mark as Mastered'}
                    </button>
                  </div>

                  {q.passageText && (
                    <div className="bg-slate-950/90 border-l-4 border-blue-400 p-4 rounded-r-2xl text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto custom-scrollbar">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block mb-1.5">
                        Passage / Directions
                      </span>
                      {q.passageText}
                    </div>
                  )}

                  <div className="text-sm sm:text-base font-bold text-white leading-relaxed whitespace-pre-line">
                    Q{drillIndex + 1}. {q.questionText}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {q.options.map((opt, optIdx) => {
                      const isPicked = selectedOpt === optIdx;
                      const isCorrect = q.correctOptionIndex === optIdx;

                      let style =
                        'bg-slate-950/80 border-white/[0.08] text-slate-200 hover:border-slate-600';
                      if (isRevealed) {
                        if (isCorrect) {
                          style = 'bg-emerald-500/15 border-emerald-500 text-emerald-200 font-bold';
                        } else if (isPicked && !isCorrect) {
                          style = 'bg-rose-500/15 border-rose-500 text-rose-200 font-bold';
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() =>
                            setDrillAnswers((prev) => ({ ...prev, [drillIndex]: optIdx }))
                          }
                          className={`p-4 rounded-2xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-3 ${style}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-900 border border-white/[0.1] flex items-center justify-center text-[11px] font-black text-amber-400 shrink-0">
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{opt}</span>
                          </div>
                          {isRevealed && isCorrect && (
                            <span className="text-xs font-black text-emerald-400 shrink-0">
                              ✓ Correct
                            </span>
                          )}
                          {isRevealed && isPicked && !isCorrect && (
                            <span className="text-xs font-black text-rose-400 shrink-0">
                              ✗ Incorrect
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isRevealed && (
                    <div className="space-y-3 pt-2 animate-fade-in">
                      {q.personalNote && (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-xs space-y-1">
                          <span className="font-black uppercase tracking-wider text-purple-300 block">
                            📝 Your Personal Shortcut / Note
                          </span>
                          <p className="text-slate-200 leading-relaxed whitespace-pre-line">
                            {q.personalNote}
                          </p>
                        </div>
                      )}
                      {(q.explanation || q.solutionImageUrl) && (
                        <div className="p-4 bg-amber-400/10 border border-amber-400/25 rounded-2xl text-xs space-y-2">
                          <span className="font-black uppercase tracking-wider text-amber-400 block">
                            💡 Official Solution &amp; Explanation
                          </span>
                          {q.explanation && (
                            <p className="text-slate-200 leading-relaxed whitespace-pre-line">
                              {q.explanation}
                            </p>
                          )}
                          {q.solutionImageUrl && (
                            <div className="my-2 text-center">
                              <img
                                src={q.solutionImageUrl}
                                alt="Solution Diagram"
                                className="max-w-full max-h-80 h-auto mx-auto rounded-xl border border-slate-700 shadow-md bg-white p-1"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Drill Navigation Footer */}
                  <div className="flex justify-between items-center pt-4 border-t border-white/[0.08]">
                    <button
                      disabled={drillIndex === 0}
                      onClick={() => setDrillIndex((i) => Math.max(0, i - 1))}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs rounded-xl transition"
                    >
                      ← Previous
                    </button>
                    <div className="flex gap-1.5 overflow-x-auto max-w-xs px-2">
                      {drillQuestions.map((_, i) => {
                        const ans = drillAnswers[i];
                        const corr = drillQuestions[i].correctOptionIndex;
                        return (
                          <button
                            key={i}
                            onClick={() => setDrillIndex(i)}
                            className={`w-7 h-7 rounded-lg text-[11px] font-bold shrink-0 transition ${
                              drillIndex === i
                                ? 'ring-2 ring-amber-400 bg-slate-800 text-white'
                                : ans === undefined
                                ? 'bg-slate-950 text-slate-500 border border-white/[0.06]'
                                : ans === corr
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      disabled={drillIndex === drillQuestions.length - 1}
                      onClick={() =>
                        setDrillIndex((i) => Math.min(drillQuestions.length - 1, i + 1))
                      }
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* ==================== STANDARD REVISION VAULT VIEW ==================== */
          <>
            {/* 4-CARD KPI SUMMARY BAR */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total in Vault
                </span>
                <span className="text-3xl font-black text-white block">{items.length}</span>
                <span className="text-[11px] text-slate-400 block">Saved across Mocks &amp; Quizzes</span>
              </div>

              <div className="bg-slate-900/75 backdrop-blur-xl border border-rose-500/25 rounded-3xl p-6 shadow-xl space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                  ❌ Unresolved Mistakes
                </span>
                <span className="text-3xl font-black text-rose-400 block">{totalMistakes}</span>
                <span className="text-[11px] text-slate-400 block">Auto-saved wrong answers</span>
              </div>

              <div className="bg-slate-900/75 backdrop-blur-xl border border-amber-400/25 rounded-3xl p-6 shadow-xl space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                  🔖 Bookmarked
                </span>
                <span className="text-3xl font-black text-amber-400 block">{totalBookmarked}</span>
                <span className="text-[11px] text-slate-400 block">
                  {totalWithNotes} with personal shortcut notes
                </span>
              </div>

              <div className="bg-slate-900/75 backdrop-blur-xl border border-emerald-500/25 rounded-3xl p-6 shadow-xl space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                  ✓ Mastered
                </span>
                <span className="text-3xl font-black text-emerald-400 block">{totalMastered}</span>
                <span className="text-[11px] text-slate-400 block">Reviewed &amp; resolved</span>
              </div>
            </div>

            {!hasNotebookAccess ? (
              /* ==================== 🔒 PREMIUM PAYWALL & CHECKOUT GATE ==================== */
              <div id="notebook-paywall-gate" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
                {/* Left: Why Unlock + Blurred Vault Preview */}
                <div className="lg:col-span-7 bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
                  <div className="space-y-2 border-b border-white/[0.08] pb-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-rose-500/15 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full">
                      <span>🔒</span> Premium Revision &amp; Re-Attempt Engine
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                      Turn Every Wrong Answer Into Guaranteed Marks
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {items.length > 0
                        ? `We have already auto-captured ${items.length} question(s) (${totalMistakes} wrong answers & ${totalBookmarked} bookmarks) from your Mock Tests and Daily Quizzes! Unlock your Vault to review and practice them.`
                        : 'Every wrong answer you make in Mock Tests or Daily Quizzes is automatically saved here so you can practice and master your weak areas before Exam Day.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        icon: '🤖',
                        title: 'Auto-Captured Mistake Log',
                        desc: 'Every wrong answer from Real CBT Mocks & Daily GA Quizzes is saved automatically.',
                      },
                      {
                        icon: '⚡',
                        title: 'Unlimited "Fix Your Mistakes" Drills',
                        desc: 'Launch custom 15-question rapid practice quizzes built exclusively from your unmastered mistakes.',
                      },
                      {
                        icon: '🙈',
                        title: 'Blind Re-Attempt Mode',
                        desc: 'Hide official answers and explanations to re-solve bookmarked questions without spoilers.',
                      },
                      {
                        icon: '📝',
                        title: 'Personal Formula & Shortcut Notes',
                        desc: 'Attach your own ratio tricks, formulas, and trap reminders to any question.',
                      },
                    ].map((feat) => (
                      <div
                        key={feat.title}
                        className="bg-slate-950/85 border border-white/[0.06] rounded-2xl p-4 space-y-1.5"
                      >
                        <div className="text-xl">{feat.icon}</div>
                        <h4 className="text-xs sm:text-sm font-black text-white">{feat.title}</h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{feat.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Blurred Teaser of Captured Questions */}
                  <div className="relative rounded-2xl border border-white/[0.08] bg-slate-950/90 p-5 overflow-hidden">
                    <div className="space-y-3 select-none blur-[4px] opacity-50 pointer-events-none">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-black">
                          ❌ Mistake Captured
                        </span>
                        <span className="px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black">
                          QUANT / REASONING
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white">
                        {items[0]?.questionText ||
                          'A sum of money invested at compound interest amounts to ₹14,520 in 2 years and ₹15,972 in 3 years...'}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-900 border border-white/[0.06]">
                          A. Option 1
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
                          B. Correct Solution
                        </div>
                      </div>
                    </div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-[2px] p-4 text-center">
                      <span className="text-xs font-black text-amber-300 uppercase tracking-wider bg-slate-900/95 border border-amber-400/35 px-4 py-2 rounded-xl shadow-lg">
                        🔒 {items.length > 0 ? `${items.length} Saved Questions Locked in Your Vault` : 'Mistake Vault & Re-Attempt Drills Locked'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Standalone Checkout with Multi-Duration Plan Selector */}
                <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-400/40 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_50px_-12px_rgba(251,191,36,0.25)] sticky top-24">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full">
                        {selectedPlan?.durationMonths || 6}{' '}
                        {selectedPlan?.durationMonths === 1 ? 'MONTH' : 'MONTHS'} ACCESS
                      </span>
                      <h3 className="text-xl font-black text-white mt-2">
                        {selectedPlan?.title || 'Smart Mistake Notebook'}
                      </h3>
                      <p className="text-xs text-slate-400">
                        + Unlimited &ldquo;Fix Your Mistakes&rdquo; Drills
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 line-through font-bold block">
                        ₹{originalPrice}
                      </span>
                      <span className="text-3xl font-black text-amber-400">₹{payableAmount}</span>
                      <span className="text-[10px] text-emerald-400 font-bold block">
                        Save ₹{Math.max(0, originalPrice - payableAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Select Duration Plan (1M / 3M / 6M / 12M) */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      ⏳ Choose Validity Duration:
                    </span>
                    <div className="grid grid-cols-2 gap-2.5">
                      {notebookPlans.map((plan) => {
                        const isSelected = selectedPlan?.id === plan.id;
                        return (
                          <button
                            key={plan.id}
                            type="button"
                            onClick={() => handleSelectNotebookPlan(plan)}
                            className={`text-left p-3 rounded-2xl border transition relative ${
                              isSelected
                                ? 'bg-amber-400/15 border-amber-400 shadow-lg shadow-amber-500/10'
                                : 'bg-slate-950/85 border-white/[0.08] hover:border-white/25'
                            }`}
                          >
                            {plan.badge && (
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mb-1 ${
                                  isSelected
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {plan.badge}
                              </span>
                            )}
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

                  {/* Promo Code Box */}
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
                        onClick={() => handleApplyNotebookCoupon()}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30 font-black text-xs rounded-xl transition shrink-0"
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
                      <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">
                          Tap to Apply Discount:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {availableCoupons.map((cpn) => (
                            <button
                              key={cpn.id}
                              type="button"
                              onClick={() => handleApplyNotebookCoupon(cpn.code)}
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
                    disabled={isProcessingPayment}
                    onClick={handleBuyNotebookAccess}
                    className="w-full py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/25 transition cursor-pointer"
                  >
                    {isProcessingPayment
                      ? 'Activating Access...'
                      : payableAmount <= 0
                      ? '⚡ Unlock Mistake Notebook for FREE (₹0) →'
                      : `Unlock Mistake Notebook for ₹${payableAmount} →`}
                  </button>

                  {isProPassVisible && (
                    <div className="pt-3 border-t border-white/[0.08] space-y-2 text-center">
                      <span className="text-[11px] text-slate-400 block">
                        Want Critical Reasoning + Computer Course + PRO Vault together?
                      </span>
                      <Link
                        href="/pro-pass"
                        className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/30 text-amber-300 font-black text-xs transition block"
                      >
                        👑 Included Free in BankingSolutions PRO Pass →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
            {/* FILTER & SEARCH BAR */}
            <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                {/* Category Filter Tabs */}
                <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-white/[0.08] text-xs gap-1 overflow-x-auto">
                  {[
                    { id: 'ALL', label: `All (${items.length})` },
                    { id: 'MISTAKES', label: `❌ Mistakes (${totalMistakes})` },
                    { id: 'BOOKMARKED', label: `🔖 Bookmarked (${totalBookmarked})` },
                    { id: 'NOTES', label: `📝 With Notes (${totalWithNotes})` },
                    { id: 'MASTERED', label: `✓ Mastered (${totalMastered})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setFilterMode(tab.id as any)}
                      className={`px-3.5 py-2 rounded-xl font-bold transition whitespace-nowrap ${
                        filterMode === tab.id
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search + Blind Practice Mode Toggle */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Search questions, test name, or notes..."
                    className="bg-slate-950 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 w-full sm:w-64"
                  />

                  <button
                    onClick={() => {
                      setHideAnswersMode(!hideAnswersMode);
                      setRevealedIds({});
                      setSelectedPracticeOpt({});
                    }}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition whitespace-nowrap ${
                      hideAnswersMode
                        ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/20'
                        : 'bg-slate-950 text-slate-300 border-white/[0.08] hover:text-white'
                    }`}
                  >
                    {hideAnswersMode ? '🙈 Answers Hidden (Click Option to Test)' : '👁️ Hide Answers to Practice'}
                  </button>
                </div>
              </div>

              {/* Section Filter Pills */}
              {sections.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/[0.06]">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">
                    Section:
                  </span>
                  {sections.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setSectionFilter(sec)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold uppercase transition ${
                        sectionFilter === sec
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-white/[0.06]'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* QUESTIONS LIST */}
            {filteredItems.length === 0 ? (
              <div className="bg-slate-900/60 border border-white/[0.08] rounded-3xl p-14 text-center space-y-4 max-w-lg mx-auto shadow-2xl">
                <div className="text-4xl">🔖</div>
                <h3 className="text-lg font-black text-white">Your Revision Vault is Empty</h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Whenever you answer a question wrongly in a Mock Test or BSCA Daily Quiz, it is automatically added here! You can also click{' '}
                  <strong className="text-amber-400">🔖 Save to Notebook</strong> on any question to bookmark it with personal notes.
                </p>
                <div className="flex justify-center gap-3 pt-2">
                  <Link
                    href="/tests"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition"
                  >
                    Attempt Mock Tests →
                  </Link>
                  <Link
                    href="/bsca-quiz"
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition"
                  >
                    Daily GA Quiz →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredItems.map((item, idx) => {
                  const showAnswer = !hideAnswersMode || revealedIds[item.id];
                  const practiceChoice = selectedPracticeOpt[item.id];

                  return (
                    <div
                      key={item.id}
                      className={`bg-slate-900/80 backdrop-blur-xl border rounded-3xl p-6 sm:p-7 space-y-5 shadow-xl transition ${
                        item.mastered
                          ? 'border-emerald-500/30'
                          : item.isMistake
                          ? 'border-rose-500/30'
                          : 'border-white/[0.08]'
                      }`}
                    >
                      {/* Top Metadata Row */}
                      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-white/[0.08] pb-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-white/[0.08] text-amber-400 font-black text-xs">
                            #{idx + 1}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase">
                            {item.section}
                          </span>
                          <span className="text-xs font-bold text-slate-300">
                            {item.sourceTitle}
                          </span>
                          {item.isMistake && !item.mastered && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase">
                              ❌ Wrong in Exam
                            </span>
                          )}
                          {item.mastered && (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase">
                              ✓ Mastered
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleMastered(item.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                              item.mastered
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-950 text-slate-300 border-white/[0.08] hover:border-emerald-500/40 hover:text-emerald-300'
                            }`}
                          >
                            {item.mastered ? '✓ Mastered' : 'Mark Mastered'}
                          </button>

                          <button
                            onClick={() => handleToggleBookmark(item)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                              item.isBookmarked
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                                : 'bg-slate-950 text-slate-400 border-white/[0.08] hover:text-amber-300'
                            }`}
                          >
                            {item.isBookmarked ? '🔖 Bookmarked' : '🔖 Bookmark'}
                          </button>

                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 rounded-xl bg-slate-950 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 border border-white/[0.06] transition text-xs"
                            title="Remove from Vault"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Optional Passage Context */}
                      {item.passageText && (
                        <details className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 text-xs text-slate-300">
                          <summary className="font-bold text-blue-400 cursor-pointer select-none">
                            📄 View Passage / Directions Context
                          </summary>
                          <div className="mt-3 pt-3 border-t border-white/[0.06] whitespace-pre-line leading-relaxed">
                            {item.passageText}
                          </div>
                        </details>
                      )}

                      {/* Question Text */}
                      <div className="text-sm sm:text-base font-bold text-white leading-relaxed whitespace-pre-line">
                        {item.questionText}
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {item.options.map((opt, optIdx) => {
                          const isCorrect = item.correctOptionIndex === optIdx;
                          const wasUserWrongChoice =
                            item.userSelectedOption === optIdx && !isCorrect;
                          const isPracticeSelected = practiceChoice === optIdx;

                          let optStyle =
                            'bg-slate-950/80 border-white/[0.08] text-slate-300 hover:border-slate-700';

                          if (showAnswer) {
                            if (isCorrect) {
                              optStyle =
                                'bg-emerald-500/15 border-emerald-500 text-emerald-200 font-bold';
                            } else if (isPracticeSelected && !isCorrect) {
                              optStyle =
                                'bg-rose-500/15 border-rose-500 text-rose-200 font-bold';
                            } else if (wasUserWrongChoice) {
                              optStyle =
                                'bg-rose-500/10 border-rose-500/40 text-rose-300';
                            }
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => {
                                if (hideAnswersMode) {
                                  setSelectedPracticeOpt((prev) => ({
                                    ...prev,
                                    [item.id]: optIdx,
                                  }));
                                  setRevealedIds((prev) => ({
                                    ...prev,
                                    [item.id]: true,
                                  }));
                                }
                              }}
                              className={`p-3.5 rounded-2xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-2 ${optStyle}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-black text-amber-400">
                                  {String.fromCharCode(65 + optIdx)}.
                                </span>
                                <span>{opt}</span>
                              </div>

                              {showAnswer && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {wasUserWrongChoice && (
                                    <span className="text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                                      Exam Choice
                                    </span>
                                  )}
                                  {isCorrect && (
                                    <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded">
                                      ✓ Correct
                                    </span>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Personal Shortcut Note & Official Explanation */}
                      <div className="space-y-3 pt-2">
                        {/* Personal Note Box */}
                        <div className="bg-slate-950/90 border border-purple-500/25 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                              📝 My Personal Shortcut / Formula Note
                            </span>
                            {editingNoteId !== item.id && (
                              <button
                                onClick={() => {
                                  setEditingNoteId(item.id);
                                  setNoteDraft(item.personalNote || '');
                                }}
                                className="text-[11px] font-bold text-amber-400 hover:underline"
                              >
                                {item.personalNote ? '✏️ Edit Note' : '+ Add Shortcut Note'}
                              </button>
                            )}
                          </div>

                          {editingNoteId === item.id ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                rows={2}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Write your formula, trick, or reason why you got this wrong..."
                                className="w-full bg-slate-900 border border-purple-500/40 rounded-xl p-3 text-xs text-white outline-none"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveNote(item.id)}
                                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg"
                                >
                                  Save Note
                                </button>
                              </div>
                            </div>
                          ) : item.personalNote ? (
                            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                              {item.personalNote}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              No personal note added yet. Click &ldquo;+ Add Shortcut Note&rdquo; to save a revision tip.
                            </p>
                          )}
                        </div>

                        {/* Official Solution */}
                        {showAnswer && (item.explanation || item.solutionImageUrl) && (
                          <div className="bg-slate-950/90 border border-amber-400/20 rounded-2xl p-4 space-y-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block">
                              💡 Official Solution &amp; Explanation
                            </span>
                            {item.explanation && (
                              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                {item.explanation}
                              </p>
                            )}
                            {item.solutionImageUrl && (
                              <div className="my-2 text-center">
                                <img
                                  src={item.solutionImageUrl}
                                  alt="Solution Diagram"
                                  className="max-w-full max-h-80 h-auto mx-auto rounded-xl border border-slate-700 shadow-md bg-white p-1"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

