'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { evaluatePromoCoupon, syncMonetizationFromSupabase } from '@/lib/monetization';
import {
  BscaPlan,
  getBscaAccessConfig,
  recordBscaPurchase,
  syncBscaAccessConfig,
} from '@/lib/bscaAccess';
import { formatPlanDuration } from '@/lib/practiceAccess';

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onRequireLogin: () => void;
  onUnlocked: (expiresAt: string) => void;
}

export default function BscaPaywall({ isOpen, onClose, user, onRequireLogin, onUnlocked }: Props) {
  const [plans, setPlans] = useState<BscaPlan[]>([]);
  const [selected, setSelected] = useState<BscaPlan | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [couponPrice, setCouponPrice] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const apply = (list: BscaPlan[]) => {
      const active = list.filter((p) => p.isActive);
      setPlans(active);
      setSelected((cur) => (cur && active.find((p) => p.id === cur.id)) || active.find((p) => p.isPopular) || active[0] || null);
    };
    apply(getBscaAccessConfig().plans);
    void syncBscaAccessConfig().then((c) => apply(c.plans));
    void syncMonetizationFromSupabase();

    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  function handleSelectPlan(plan: BscaPlan) {
    setSelected(plan);
    if (couponInput.trim() && couponPrice !== null) {
      const res = evaluatePromoCoupon(couponInput, plan.price, 'CURRENT_AFFAIRS');
      setCouponPrice(res.valid ? res.finalPrice : null);
      setCouponMsg(res.message);
    }
  }

  if (!isOpen) return null;

  const payable = selected ? (couponPrice !== null ? couponPrice : selected.price) : 0;

  function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!couponInput.trim()) {
      setCouponPrice(null);
      setCouponMsg('');
      return;
    }
    const res = evaluatePromoCoupon(couponInput, selected.price, 'CURRENT_AFFAIRS');
    if (res.valid) {
      setCouponPrice(res.finalPrice);
      setCouponMsg(`✅ Applied! You saved ₹${res.discountAmount}`);
    } else {
      setCouponPrice(null);
      setCouponMsg(res.message);
    }
  }

  async function handleProceedPayment() {
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!selected) return;

    setProcessing(true);

    const finish = async (paymentId: string, amount: number) => {
      const res = await recordBscaPurchase({
        userId: user.id,
        plan: selected,
        amountPaid: amount,
        paymentId,
      });
      setProcessing(false);
      if (res.error) {
        alert(`Payment recorded with warning: ${res.error}`);
      }
      onUnlocked(res.expiresAt);
    };

    // Free plan or 100% off coupon
    if (payable <= 0) {
      await finish(`free_bsca_${Date.now()}`, 0);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
      amount: Math.round(payable * 100),
      currency: 'INR',
      name: 'BankingSolutions',
      description: `BSCA Current Affairs Pass - ${selected.title}`,
      handler: (response: { razorpay_payment_id: string }) => finish(response.razorpay_payment_id, payable),
      modal: { ondismiss: () => setProcessing(false) },
      prefill: {
        name: user?.user_metadata?.full_name || 'Banking Aspirant',
        email: user?.email || '',
      },
      theme: { color: '#F59E0B' },
    };

    if (window.Razorpay) {
      new window.Razorpay(options).open();
    } else {
      alert('Payment window is still loading. Please check your internet connection and try again.');
      setProcessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-950 border border-amber-400/30 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                Standalone Current Affairs Access
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              📰 BSCA Current Affairs Pass
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Purchase access specifically for Current Affairs PDFs, Quizzes, and Capsules without paying for the full Pro Pass.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-900 border border-white/[0.08] text-slate-300 hover:text-white shrink-0 flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* What is Unlocked Checklist */}
        <div className="bg-slate-900/60 border border-white/[0.08] rounded-2xl p-4">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
            What this Pass Unlocks:
          </span>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">✓</span>
              <span>All 60+ Day-Wise CA PDF Sheets</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">✓</span>
              <span>Monthly Master Capsules &amp; Digests</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">✓</span>
              <span>Daily 10-Question GA Quizzes</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">✓</span>
              <span>6-Month Search &amp; Keyword Vault</span>
            </li>
          </ul>
          <p className="text-[11px] text-emerald-400/90 font-semibold mt-2.5 pt-2 border-t border-white/[0.06]">
            💡 Daily News Articles &amp; One-Liners remain 100% Free for everyone forever.
          </p>
        </div>

        {/* Plan Cards */}
        {plans.length === 0 ? (
          <p className="text-sm text-rose-300 font-bold">Current Affairs plans are not active right now. Please check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plans.map((p) => {
              const active = selected?.id === p.id;
              const off =
                p.originalPrice > p.price
                  ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
                  : 0;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPlan(p)}
                  className={`relative text-left rounded-2xl border p-4 transition ${
                    active
                      ? 'bg-amber-400/10 border-amber-400 ring-1 ring-amber-400 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-900 border-white/[0.08] hover:border-amber-400/40'
                  }`}
                >
                  {(p.badge || p.isPopular) && (
                    <span className="absolute -top-2.5 left-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                      {p.badge || 'POPULAR'}
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-300 block">{formatPlanDuration(p)}</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">₹{p.price}</span>
                    {p.originalPrice > p.price && (
                      <span className="text-xs text-slate-500 line-through">₹{p.originalPrice}</span>
                    )}
                  </div>
                  {off > 0 && <span className="text-[10px] font-bold text-emerald-400 mt-1 block">{off}% savings</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Coupon Section */}
        <form onSubmit={handleApplyCoupon} className="flex gap-2">
          <input
            type="text"
            placeholder="Have a promo coupon code?"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            className="flex-1 bg-slate-900 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-white/[0.08] transition"
          >
            Apply
          </button>
        </form>
        {couponMsg && (
          <p
            className={`text-xs font-bold ${
              couponMsg.includes('✅') ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {couponMsg}
          </p>
        )}

        {/* Action Button */}
        <button
          type="button"
          disabled={!selected || processing}
          onClick={handleProceedPayment}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition disabled:opacity-50"
        >
          {processing
            ? 'Processing Payment…'
            : selected
            ? `Unlock Current Affairs Pass • ₹${payable}`
            : 'Select a Plan'}
        </button>

        {/* Pro Pass Upsell Note */}
        <div className="text-center pt-1 border-t border-white/[0.06]">
          <p className="text-xs text-slate-400">
            Want Arithmetic Topic Practice, Mock Tests &amp; Critical Reasoning too?{' '}
            <Link href="/courses" className="text-amber-400 hover:underline font-bold">
              Check All-in-One PRO Pass ↗
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

