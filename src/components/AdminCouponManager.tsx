'use client';

import React, { useEffect, useState } from 'react';
import {
  PromoCoupon,
  CouponTarget,
  ProPassConfig,
  ProPassPlan,
  getPromoCoupons,
  addPromoCoupon,
  togglePromoCouponActive,
  deletePromoCoupon,
  getProPassConfig,
  setProPassVisibility,
  upsertProPassPlan,
  toggleProPassPlanActive,
  deleteProPassPlan,
  getNotebookPlans,
  upsertNotebookPlan,
  toggleNotebookPlanActive,
  deleteNotebookPlan,
  syncMonetizationFromSupabase,
} from '@/lib/monetization';

export default function AdminCouponManager() {
  const [subTab, setSubTab] = useState<'PRO_PASS_PLANS' | 'NOTEBOOK_PLANS' | 'COUPONS'>('PRO_PASS_PLANS');
  const [coupons, setCoupons] = useState<PromoCoupon[]>([]);
  const [proPassConfig, setProPassConfig] = useState<ProPassConfig>({
    isVisibleOnWebsite: true,
    plans: [],
  });
  const [notebookPlans, setNotebookPlans] = useState<ProPassPlan[]>([]);

  // Coupon Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(50);
  const [applicableTo, setApplicableTo] = useState<CouponTarget>('ALL');
  const [description, setDescription] = useState('');

  // PRO Pass Plan Form State
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planDurationMonths, setPlanDurationMonths] = useState<number>(3);
  const [planOriginalPrice, setPlanOriginalPrice] = useState<number>(999);
  const [planLaunchPrice, setPlanLaunchPrice] = useState<number>(349);
  const [planBadge, setPlanBadge] = useState('PRELIMS + MAINS');
  const [planIsPopular, setPlanIsPopular] = useState(false);

  // Mistake Notebook Plan Form State
  const [editingNbId, setEditingNbId] = useState<string | null>(null);
  const [nbTitle, setNbTitle] = useState('');
  const [nbDurationMonths, setNbDurationMonths] = useState<number>(3);
  const [nbOriginalPrice, setNbOriginalPrice] = useState<number>(249);
  const [nbLaunchPrice, setNbLaunchPrice] = useState<number>(129);
  const [nbBadge, setNbBadge] = useState('PRELIMS + MAINS');
  const [nbIsPopular, setNbIsPopular] = useState(false);

  const [toast, setToast] = useState('');

  useEffect(() => {
    setCoupons(getPromoCoupons());
    setProPassConfig(getProPassConfig());
    setNotebookPlans(getNotebookPlans());

    syncMonetizationFromSupabase(true).then((synced) => {
      setProPassConfig(synced.proPassConfig);
      setNotebookPlans(synced.notebookPlans);
      setCoupons(synced.coupons);
    });
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  };

  // --- PRO PASS HANDLERS ---
  const handleToggleWebsiteVisibility = () => {
    const nextState = !proPassConfig.isVisibleOnWebsite;
    const updated = setProPassVisibility(nextState);
    setProPassConfig(updated);
    showToast(
      nextState
        ? '👁️ PRO Pass is now VISIBLE across the website!'
        : '🙈 PRO Pass is now HIDDEN from the website!'
    );
  };

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim() || planDurationMonths <= 0) return;

    const updated = upsertProPassPlan({
      id: editingPlanId || undefined,
      title: planTitle.trim(),
      durationMonths: Number(planDurationMonths),
      originalPrice: Number(planOriginalPrice),
      launchPrice: Number(planLaunchPrice),
      badge: planBadge.trim().toUpperCase(),
      isPopular: planIsPopular,
      isActive: true,
    });

    setProPassConfig(updated);
    setEditingPlanId(null);
    setPlanTitle('');
    setPlanBadge('');
    setPlanIsPopular(false);
    showToast('✓ Saved PRO Pass Plan!');
  };

  const handleEditPlanClick = (plan: ProPassPlan) => {
    setEditingPlanId(plan.id);
    setPlanTitle(plan.title);
    setPlanDurationMonths(plan.durationMonths);
    setPlanOriginalPrice(plan.originalPrice);
    setPlanLaunchPrice(plan.launchPrice);
    setPlanBadge(plan.badge || '');
    setPlanIsPopular(Boolean(plan.isPopular));
  };

  const handleTogglePlanActive = (planId: string) => {
    setProPassConfig(toggleProPassPlanActive(planId));
    showToast('✓ Updated plan active status');
  };

  const handleDeletePlan = (planId: string) => {
    setProPassConfig(deleteProPassPlan(planId));
    showToast('🗑️ Deleted PRO Pass plan');
  };

  // --- MISTAKE NOTEBOOK PLAN HANDLERS ---
  const handleSaveNotebookPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nbTitle.trim() || nbDurationMonths <= 0) return;

    const updated = upsertNotebookPlan({
      id: editingNbId || undefined,
      title: nbTitle.trim(),
      durationMonths: Number(nbDurationMonths),
      originalPrice: Number(nbOriginalPrice),
      launchPrice: Number(nbLaunchPrice),
      badge: nbBadge.trim().toUpperCase(),
      isPopular: nbIsPopular,
      isActive: true,
    });

    setNotebookPlans(updated);
    setEditingNbId(null);
    setNbTitle('');
    setNbBadge('');
    setNbIsPopular(false);
    showToast('✓ Saved Mistake Notebook Duration Plan!');
  };

  const handleEditNotebookPlanClick = (plan: ProPassPlan) => {
    setEditingNbId(plan.id);
    setNbTitle(plan.title);
    setNbDurationMonths(plan.durationMonths);
    setNbOriginalPrice(plan.originalPrice);
    setNbLaunchPrice(plan.launchPrice);
    setNbBadge(plan.badge || '');
    setNbIsPopular(Boolean(plan.isPopular));
  };

  const handleToggleNotebookPlanActive = (planId: string) => {
    setNotebookPlans(toggleNotebookPlanActive(planId));
    showToast('✓ Updated Mistake Notebook plan status');
  };

  const handleDeleteNotebookPlan = (planId: string) => {
    setNotebookPlans(deleteNotebookPlan(planId));
    showToast('🗑️ Deleted Mistake Notebook plan');
  };

  // --- COUPON HANDLERS ---
  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || discountValue <= 0) return;

    const finalVal =
      discountType === 'PERCENT' ? Math.min(100, Math.max(1, Number(discountValue))) : Number(discountValue);

    const updated = addPromoCoupon({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: finalVal,
      applicableTo,
      description:
        description.trim() ||
        `${
          discountType === 'PERCENT'
            ? finalVal === 100
              ? '100% FREE Scholarship Unlock'
              : `${finalVal}% OFF`
            : `Flat ₹${finalVal} OFF`
        } Promo Offer`,
      isActive: true,
    });
    setCoupons(updated);
    setCode('');
    setDescription('');
    showToast(`🎉 Published promo code "${code.trim().toUpperCase()}" (${finalVal}${discountType === 'PERCENT' ? '%' : '₹'} OFF)!`);
  };

  const handleToggleCoupon = (id: string) => {
    setCoupons(togglePromoCouponActive(id));
    showToast('✓ Updated coupon status');
  };

  const handleDeleteCoupon = (id: string) => {
    setCoupons(deletePromoCoupon(id));
    showToast('🗑️ Deleted coupon');
  };

  return (
    <div className="space-y-6">
      {/* Top Bar + Global PRO Pass Visibility Switch */}
      <div className="bg-slate-900/85 border border-white/[0.08] rounded-3xl p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shadow-xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block">
            Monetization, Multi-Duration Plans &amp; Uncapped Coupons
          </span>
          <h2 className="text-xl font-black text-white mt-0.5">
            👑 PRO Pass, 🔖 Mistake Notebook Plans &amp; 0–100% Promo Coupons
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure 1M / 3M / 6M / 12M validity plans for PRO Pass and Mistake Notebook, toggle PRO Pass visibility, or issue up to 100% FREE promo codes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Global Show/Hide PRO Pass Toggle */}
          <button
            type="button"
            onClick={handleToggleWebsiteVisibility}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black border transition flex items-center gap-2 shadow-lg ${
              proPassConfig.isVisibleOnWebsite
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
            }`}
          >
            <span>{proPassConfig.isVisibleOnWebsite ? '👁️' : '🙈'}</span>
            <span>
              PRO Pass on Website: {proPassConfig.isVisibleOnWebsite ? 'VISIBLE' : 'HIDDEN'}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setSubTab('PRO_PASS_PLANS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                subTab === 'PRO_PASS_PLANS'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              👑 PRO Pass Plans ({proPassConfig.plans.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('NOTEBOOK_PLANS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                subTab === 'NOTEBOOK_PLANS'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🔖 Mistake Notebook Plans ({notebookPlans.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('COUPONS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${
                subTab === 'COUPONS'
                  ? 'bg-amber-400 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎟️ Promo Coupons ({coupons.length})
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
          {toast}
        </div>
      )}

      {subTab === 'PRO_PASS_PLANS' ? (
        /* ==================== PRO PASS DURATION PLANS MANAGER ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSavePlan}
            className="lg:col-span-5 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {editingPlanId ? '✏️ Edit PRO Pass Plan' : '➕ Create PRO Pass Duration Plan'}
              </h3>
              {editingPlanId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlanId(null);
                    setPlanTitle('');
                  }}
                  className="text-xs text-slate-400 hover:text-white font-bold"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Quick Duration Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Quick Duration Presets:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { m: 1, title: '1 Month Starter Pass', orig: 499, launch: 199, badge: '1 MONTH' },
                  { m: 3, title: '3 Months Target Pass', orig: 999, launch: 349, badge: '3 MONTHS' },
                  { m: 6, title: '6 Months Pro Pass', orig: 1499, launch: 499, badge: 'MOST POPULAR' },
                  { m: 12, title: '12 Months Ultimate Pass', orig: 2499, launch: 799, badge: 'BEST VALUE' },
                ].map((preset) => (
                  <button
                    key={preset.m}
                    type="button"
                    onClick={() => {
                      setPlanDurationMonths(preset.m);
                      setPlanTitle(preset.title);
                      setPlanOriginalPrice(preset.orig);
                      setPlanLaunchPrice(preset.launch);
                      setPlanBadge(preset.badge);
                    }}
                    className="py-2 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/[0.08] text-amber-300 font-black text-xs transition"
                  >
                    {preset.m}M
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Plan Title
              </label>
              <input
                type="text"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                placeholder="e.g. 3 Months Target Pass"
                required
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Months
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={planDurationMonths}
                  onChange={(e) => setPlanDurationMonths(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={planOriginalPrice}
                  onChange={(e) => setPlanOriginalPrice(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Sale Price (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={planLaunchPrice}
                  onChange={(e) => setPlanLaunchPrice(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-black text-amber-400 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Top Badge Text
                </label>
                <input
                  type="text"
                  value={planBadge}
                  onChange={(e) => setPlanBadge(e.target.value)}
                  placeholder="MOST POPULAR"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-4 select-none">
                <input
                  type="checkbox"
                  checked={planIsPopular}
                  onChange={(e) => setPlanIsPopular(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <span className="text-xs font-bold text-amber-300">
                  Highlight as Default Popular Plan
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition"
            >
              {editingPlanId ? 'Update PRO Pass Plan →' : 'Save PRO Pass Plan →'}
            </button>
          </form>

          {/* Configured PRO Pass Plans List */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Active &amp; Configured PRO Pass Tiers ({proPassConfig.plans.length})
              </h3>
              <span className="text-xs text-slate-400">
                Click &ldquo;Edit&rdquo; to change prices or durations anytime
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {proPassConfig.plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-4 border flex flex-col justify-between space-y-3 ${
                    plan.isPopular
                      ? 'bg-amber-400/10 border-amber-400/40'
                      : 'bg-slate-950/90 border-white/[0.08]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                        {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          plan.isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {plan.isActive ? '● Active' : '○ Hidden'}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white pt-1">{plan.title}</h4>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-amber-400">₹{plan.launchPrice}</span>
                      <span className="text-xs text-slate-500 line-through">₹{plan.originalPrice}</span>
                      {plan.badge && (
                        <span className="text-[10px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => handleEditPlanClick(plan)}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePlanActive(plan.id)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                    >
                      {plan.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : subTab === 'NOTEBOOK_PLANS' ? (
        /* ==================== MISTAKE NOTEBOOK DURATION PLANS MANAGER ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveNotebookPlan}
            className="lg:col-span-5 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                {editingNbId ? '✏️ Edit Mistake Notebook Plan' : '➕ Create Mistake Notebook Duration Plan'}
              </h3>
              {editingNbId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNbId(null);
                    setNbTitle('');
                  }}
                  className="text-xs text-slate-400 hover:text-white font-bold"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Quick Duration Presets for Mistake Notebook */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Quick Duration Presets:
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { m: 1, title: '1 Month Vault Access', orig: 149, launch: 79, badge: 'QUICK REVISION' },
                  { m: 3, title: '3 Months Vault Access', orig: 249, launch: 129, badge: 'PRELIMS + MAINS' },
                  { m: 6, title: '6 Months Vault Access', orig: 399, launch: 199, badge: 'MOST POPULAR' },
                  { m: 12, title: '12 Months Vault Access', orig: 599, launch: 299, badge: 'BEST VALUE' },
                ].map((preset) => (
                  <button
                    key={preset.m}
                    type="button"
                    onClick={() => {
                      setNbDurationMonths(preset.m);
                      setNbTitle(preset.title);
                      setNbOriginalPrice(preset.orig);
                      setNbLaunchPrice(preset.launch);
                      setNbBadge(preset.badge);
                    }}
                    className="py-2 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/[0.08] text-amber-300 font-black text-xs transition"
                  >
                    {preset.m}M
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Plan Title
              </label>
              <input
                type="text"
                value={nbTitle}
                onChange={(e) => setNbTitle(e.target.value)}
                placeholder="e.g. 3 Months Vault Access"
                required
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Months
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={nbDurationMonths}
                  onChange={(e) => setNbDurationMonths(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={nbOriginalPrice}
                  onChange={(e) => setNbOriginalPrice(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Sale Price (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  value={nbLaunchPrice}
                  onChange={(e) => setNbLaunchPrice(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-black text-amber-400 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Top Badge Text
                </label>
                <input
                  type="text"
                  value={nbBadge}
                  onChange={(e) => setNbBadge(e.target.value)}
                  placeholder="MOST POPULAR"
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-4 select-none">
                <input
                  type="checkbox"
                  checked={nbIsPopular}
                  onChange={(e) => setNbIsPopular(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <span className="text-xs font-bold text-amber-300">
                  Highlight as Default Popular Plan
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition"
            >
              {editingNbId ? 'Update Mistake Notebook Plan →' : 'Save Mistake Notebook Plan →'}
            </button>
          </form>

          {/* Configured Mistake Notebook Plans List */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Active &amp; Configured Mistake Notebook Tiers ({notebookPlans.length})
              </h3>
              <span className="text-xs text-slate-400">
                Click &ldquo;Edit&rdquo; to change durations (1M/3M/6M/12M) or prices anytime
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {notebookPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-4 border flex flex-col justify-between space-y-3 ${
                    plan.isPopular
                      ? 'bg-amber-400/10 border-amber-400/40'
                      : 'bg-slate-950/90 border-white/[0.08]'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                        {plan.durationMonths} {plan.durationMonths === 1 ? 'Month' : 'Months'}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          plan.isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {plan.isActive ? '● Active' : '○ Hidden'}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white pt-1">{plan.title}</h4>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-amber-400">₹{plan.launchPrice}</span>
                      <span className="text-xs text-slate-500 line-through">₹{plan.originalPrice}</span>
                      {plan.badge && (
                        <span className="text-[10px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => handleEditNotebookPlanClick(plan)}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold text-xs transition"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleNotebookPlanActive(plan.id)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                    >
                      {plan.isActive ? 'Hide' : 'Show'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNotebookPlan(plan.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ==================== UNCAPPED PROMO COUPONS MANAGER ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateCoupon}
            className="lg:col-span-5 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                ➕ Create Promo Code (Up to 100% OFF)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDiscountType('PERCENT');
                  setDiscountValue(100);
                  setDescription('100% Free VIP / Educator Scholarship Unlock');
                }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/25 transition"
              >
                ⚡ Set 100% FREE
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Coupon Code (e.g. FREE100, BSOL, SBI2026)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                required
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-black uppercase text-white outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Discount Type
                </label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                >
                  <option value="PERCENT">Percentage (1% – 100%)</option>
                  <option value="FLAT">Flat Amount (₹ — No Cap)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                  Value ({discountType === 'PERCENT' ? 'Up to 100%' : '₹'})
                </label>
                <input
                  type="number"
                  min={1}
                  max={discountType === 'PERCENT' ? 100 : 100000}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  required
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Applicable Product
              </label>
              <select
                value={applicableTo}
                onChange={(e) => setApplicableTo(e.target.value as CouponTarget)}
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-amber-400"
              >
                <option value="ALL">All Courses, PRO Pass &amp; Mistake Notebook</option>
                <option value="PRO_PASS">BankingSolutions PRO Pass Only</option>
                <option value="MISTAKE_NOTEBOOK">Smart Mistake Notebook &amp; Drills Only</option>
                <option value="CRITICAL_REASONING">Critical Reasoning Course Only</option>
                <option value="COMPUTER">Computer Awareness Course Only</option>
                <option value="EBOOKS">E-Books Only</option>
                <option value="TOPIC_PRACTICE">Topic-wise Question Practice Only</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                Offer Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 100% Free Access Scholarship Code"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition"
            >
              Publish Promo Coupon →
            </button>
          </form>

          {/* Active Coupons List */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider border-b border-white/[0.08] pb-3">
              Configured Promo Codes ({coupons.length})
            </h3>

            <div className="space-y-3">
              {coupons.map((cpn) => (
                <div
                  key={cpn.id}
                  className="bg-slate-950/90 border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 font-mono font-black text-xs">
                        🎟️ {cpn.code}
                      </span>
                      <span className="text-xs font-black text-emerald-400">
                        {cpn.discountType === 'PERCENT'
                          ? cpn.discountValue === 100
                            ? '100% FREE UNLOCK'
                            : `${cpn.discountValue}% OFF`
                          : `Flat ₹${cpn.discountValue} OFF`}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/25">
                        {cpn.applicableTo}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          cpn.isActive
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {cpn.isActive ? '● Active' : '○ Paused'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{cpn.description}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleCoupon(cpn.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition"
                    >
                      {cpn.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(cpn.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
