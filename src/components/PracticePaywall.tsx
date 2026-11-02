'use client';

import React, { useEffect, useState } from 'react';
import { evaluatePromoCoupon, syncMonetizationFromSupabase } from '@/lib/monetization';
import {
  PracticePlan,
  formatPlanDuration,
  getPracticeAccessConfig,
  recordPracticePurchase,
  syncPracticeAccessConfig,
} from '@/lib/practiceAccess';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any | null;
  onRequireLogin: () => void;
  onUnlocked: (expiresAt: string) => void;
  title?: string;
  description?: string;
  bullets?: string[];
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PracticePaywall({
  isOpen,
  onClose,
  user,
  onRequireLogin,
  onUnlocked,
  title = '🧮 Topic-wise Question Practice',
  description = 'Unlimited timed 10-question sets on every topic, with step-by-step solutions.',
  bullets = [
    '✅ Unlimited practice sessions',
    '✅ Fresh random questions every time',
    '✅ Text + image solutions',
    '✅ All arithmetic & quant topics',
  ],
}: Props) {
  const [plans, setPlans] = useState<PracticePlan[]>([]);
  const [selected, setSelected] = useState<PracticePlan | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const [couponPrice, setCouponPrice] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const apply = (list: PracticePlan[]) => {
      const active = list.filter((p) => p.isActive);
      setPlans(active);
      setSelected((cur) => (cur && active.find((p) => p.id === cur.id)) || active.find((p) => p.isPopular) || active[0] || null);
    };
    apply(getPracticeAccessConfig().plans);
    syncPracticeAccessConfig().then((c) => apply(c.plans));
    syncMonetizationFromSupabase(); // refresh coupons cache used by evaluatePromoCoupon

    if (!document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, []);

  // Re-evaluate coupon when switching plan
  useEffect(() => {
    if (!selected || !couponInput.trim() || couponPrice === null) return;
    const res = evaluatePromoCoupon(couponInput, selected.price, 'TOPIC_PRACTICE');
    setCouponPrice(res.valid ? res.finalPrice : null);
    setCouponMsg(res.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (!isOpen) return null;

  const payable = selected ? (couponPrice !== null ? couponPrice : selected.price) : 0;

  function applyCoupon() {
    if (!selected) return;
    const res = evaluatePromoCoupon(couponInput, selected.price, 'TOPIC_PRACTICE');
    setCouponMsg(res.message);
    setCouponPrice(res.valid ? res.finalPrice : null);
  }

  async function finish(paymentId: string, amount: number) {
    if (!selected) return;
    const { expiresAt, error } = await recordPracticePurchase({ userId: user.id, plan: selected, amountPaid: amount, paymentId });
    setProcessing(false);
    if (error) {
      alert(`Payment received, but activation failed: ${error}\nPlease contact support with payment ID ${paymentId}.`);
      return;
    }
    alert(`🎉 Topic-wise Practice unlocked till ${fmtDate(expiresAt)}!`);
    onUnlocked(expiresAt);
  }

  async function handleBuy() {
    if (!selected) return;
    if (!user) {
      onRequireLogin();
      return;
    }
    setProcessing(true);

    if (payable <= 0) {
      await finish(`FREE_COUPON_${couponInput.trim().toUpperCase() || 'ZERO_PRICE'}`, 0);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
      amount: payable * 100,
      currency: 'INR',
      name: 'BankingSolutions',
      description: `${selected.title} (${formatPlanDuration(selected)})`,
      handler: (response: any) => finish(response.razorpay_payment_id, payable),
      modal: { ondismiss: () => setProcessing(false) },
      prefill: {
        name: user?.user_metadata?.full_name || 'Banking Aspirant',
        email: user?.email || '',
      },
      theme: { color: '#F59E0B' },
    };

    if ((window as any).Razorpay) {
      new (window as any).Razorpay(options).open();
    } else {
      alert('Payment window is still loading. Please check your internet connection and try again.');
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-950 border border-amber-400/30 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Unlock Premium Access</span>
            <h2 className="text-xl font-black text-white mt-0.5">{title}</h2>
            <p className="text-xs text-slate-400 mt-1">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white shrink-0">✕</button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
          {bullets.map((b, bIdx) => (
            <li key={bIdx}>{b}</li>
          ))}
        </ul>

        {plans.length === 0 ? (
          <p className="text-sm text-rose-300 font-bold">Plans are not available right now. Please check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plans.map((p) => {
              const active = selected?.id === p.id;
              const off = p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`relative text-left rounded-2xl border p-4 transition ${
                    active ? 'bg-amber-400/10 border-amber-400 ring-1 ring-amber-400' : 'bg-slate-900 border-white/[0.08] hover:border-amber-400/40'
                  }`}
                >
                  {(p.badge || p.isPopular) && (
                    <span className="absolute -top-2.5 left-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                      {p.badge || 'POPULAR'}
                    </span>
                  )}
                  <span className="text-xs font-bold text-slate-300 block">{formatPlanDuration(p)}</span>
                  <span className="text-2xl font-black text-white block mt-1">₹{p.price}</span>
                  {off > 0 && (
                    <span className="text-[11px] text-slate-500">
                      <span className="line-through">₹{p.originalPrice}</span> <span className="text-emerald-400 font-bold">{off}% off</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {plans.length > 0 && (
          <>
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Have a coupon code?"
                  className="flex-1 bg-slate-900 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                />
                <button type="button" onClick={applyCoupon} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white">
                  Apply
                </button>
              </div>
              {couponMsg && <p className={`text-xs font-bold ${couponPrice !== null ? 'text-emerald-400' : 'text-rose-300'}`}>{couponMsg}</p>}
            </div>

            <button
              type="button"
              disabled={!selected || processing}
              onClick={handleBuy}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm disabled:opacity-50 transition"
            >
              {processing
                ? 'Processing…'
                : !user
                ? '🔐 Log in to continue'
                : payable <= 0
                ? `🎁 Unlock free for ${selected ? formatPlanDuration(selected) : ''}`
                : `Pay ₹${payable} · ${selected ? formatPlanDuration(selected) : ''}`}
            </button>
            <p className="text-[11px] text-center text-slate-500">🔒 Secure payment via Razorpay · Already have PRO Pass? It includes practice.</p>
          </>
        )}
      </div>
    </div>
  );
}

