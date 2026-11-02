'use client';

import React, { useEffect, useState } from 'react';
import {
  BscaAccessConfig,
  BscaPlan,
  getBscaAccessConfig,
  saveBscaAccessConfig,
  syncBscaAccessConfig,
} from '@/lib/bscaAccess';
import { DurationUnit, formatPlanDuration } from '@/lib/practiceAccess';

const inputCls =
  'w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600';
const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5';

const emptyForm = {
  title: '',
  durationValue: 1,
  durationUnit: 'MONTHS' as DurationUnit,
  originalPrice: 149,
  price: 69,
  badge: '',
  isPopular: false,
  isActive: true,
};

function toDays(p: BscaPlan): number {
  return p.durationUnit === 'DAYS' ? p.durationValue : p.durationValue * 30;
}

export default function AdminBscaPricing() {
  const [config, setConfig] = useState<BscaAccessConfig>(getBscaAccessConfig);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statusMsg, setStatusMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void syncBscaAccessConfig().then(setConfig);
  }, []);

  async function persist(next: BscaAccessConfig, msg: string) {
    setSaving(true);
    setConfig(next);
    await saveBscaAccessConfig(next);
    setSaving(false);
    setStatusMsg(msg);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    const durationValue = Math.max(1, Math.round(Number(form.durationValue) || 1));
    const price = Math.max(0, Math.round(Number(form.price) || 0));
    const originalPrice = Math.max(price, Math.round(Number(form.originalPrice) || price));
    const plan: BscaPlan = {
      id: editingId || `bsca_plan_${Date.now()}`,
      title: form.title.trim() || `${formatPlanDuration({ durationValue, durationUnit: form.durationUnit })} CA Pass`,
      durationValue,
      durationUnit: form.durationUnit,
      originalPrice,
      price,
      badge: form.badge.trim() || undefined,
      isPopular: form.isPopular,
      isActive: form.isActive,
    };

    let plans = config.plans.map((p) => (plan.isPopular ? { ...p, isPopular: false } : p));
    plans = editingId ? plans.map((p) => (p.id === editingId ? plan : p)) : [...plans, plan];
    plans.sort((a, b) => toDays(a) - toDays(b));

    await persist({ ...config, plans }, editingId ? `✅ Plan "${plan.title}" updated.` : `✅ Plan "${plan.title}" added.`);
    resetForm();
  }

  function handleEdit(p: BscaPlan) {
    setEditingId(p.id);
    setForm({
      title: p.title,
      durationValue: p.durationValue,
      durationUnit: p.durationUnit,
      originalPrice: p.originalPrice,
      price: p.price,
      badge: p.badge || '',
      isPopular: !!p.isPopular,
      isActive: p.isActive,
    });
  }

  async function handleDeletePlan(id: string, title: string) {
    if (!confirm(`Are you sure you want to delete plan "${title}"?`)) return;
    const nextPlans = config.plans.filter((p) => p.id !== id);
    await persist({ ...config, plans: nextPlans }, `✅ Plan "${title}" deleted.`);
    if (editingId === id) resetForm();
  }

  async function handleTogglePaid(isPaid: boolean) {
    await persist(
      { ...config, isPaid },
      isPaid
        ? '🔒 Paid Mode enabled: Articles & One-Liners are Free, PDFs & Quizzes require Current Affairs or PRO Pass.'
        : '🔓 100% Free Mode enabled: All Current Affairs content is currently unlocked for all visitors.'
    );
  }

  const activePlans = config.plans.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      {/* Monetization Switch Banner */}
      <div
        className={`rounded-3xl border p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition shadow-xl ${
          config.isPaid
            ? 'bg-amber-950/20 border-amber-400/30'
            : 'bg-emerald-950/20 border-emerald-400/30'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${config.isPaid ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
            />
            <h3 className="text-base font-black text-white">
              {config.isPaid ? 'Current Affairs Pass: Paid Mode Active' : 'Current Affairs: 100% Free Mode Active'}
            </h3>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            {config.isPaid
              ? 'Daily news articles and one-liners are 100% Free for everyone (driving traffic & SEO). Day-Wise PDFs, Monthly Capsules, Daily Quizzes, and Search Vault require this Current Affairs Pass (or the all-in-one PRO Pass).'
              : 'Everything is currently free for all visitors without any subscription or pass requirement.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleTogglePaid(!config.isPaid)}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition border shadow-md ${
              config.isPaid
                ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/[0.1]'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400'
            }`}
          >
            {config.isPaid ? 'Switch to 100% Free Mode' : '✓ Keep Free Mode'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleTogglePaid(true)}
            className={`px-5 py-2.5 rounded-xl font-black text-xs transition border shadow-md ${
              config.isPaid
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-400'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-white/[0.1]'
            }`}
          >
            {config.isPaid ? '✓ Keep Paid Mode' : 'Switch to Paid Mode'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs font-bold animate-fadeIn">
          {statusMsg}
        </div>
      )}

      {/* Plan Form */}
      <form onSubmit={handleSavePlan} className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="text-base font-black text-white">
              {editingId ? '✏️ Edit Current Affairs Pass Plan' : '➕ Create New Current Affairs Plan'}
            </h3>
            <span className="text-xs text-slate-400">
              Students can purchase this pass to access ONLY Current Affairs without paying for full PRO Pass.
            </span>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1 rounded-lg bg-slate-800"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <span className={labelCls}>Plan Title</span>
            <input
              type="text"
              placeholder="e.g. 1 Month Current Affairs Pass"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <span className={labelCls}>Badge (Optional)</span>
            <input
              type="text"
              placeholder="e.g. MOST POPULAR, STARTER"
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <span className={labelCls}>Duration Value</span>
            <input
              type="number"
              min={1}
              value={form.durationValue}
              onChange={(e) => setForm({ ...form, durationValue: Number(e.target.value) })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <span className={labelCls}>Duration Unit</span>
            <select
              value={form.durationUnit}
              onChange={(e) => setForm({ ...form, durationUnit: e.target.value as DurationUnit })}
              className={inputCls}
            >
              <option value="MONTHS">Months</option>
              <option value="DAYS">Days</option>
            </select>
          </div>
          <div>
            <span className={labelCls}>Original MRP Price (₹)</span>
            <input
              type="number"
              min={0}
              value={form.originalPrice}
              onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <span className={labelCls}>Selling Offer Price (₹)</span>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className={inputCls}
              required
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={form.isPopular}
                onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded"
              />
              <span>Mark as &quot;Popular&quot; Choice</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded"
              />
              <span>Plan is Active (Visible in checkout)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Update Plan' : 'Save New Plan'}
            </button>
          </div>
        </div>
      </form>

      {/* Active Plans List */}
      <div className="bg-slate-900/80 border border-white/[0.08] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="text-base font-black text-white">Current Affairs Plans Bank</h3>
            <span className="text-xs text-slate-400">
              Showing {config.plans.length} total plans ({activePlans.length} active)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {config.plans.map((p) => {
            const discount =
              p.originalPrice > p.price
                ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
                : 0;

            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 transition relative ${
                  p.isPopular
                    ? 'bg-amber-950/20 border-amber-400/40 ring-1 ring-amber-400/40'
                    : 'bg-slate-950/70 border-white/[0.08]'
                } ${!p.isActive ? 'opacity-60' : ''}`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-400">
                      {formatPlanDuration(p)}
                    </span>
                    {(p.badge || p.isPopular) && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                        {p.badge || 'POPULAR'}
                      </span>
                    )}
                  </div>

                  <h4 className="font-black text-white text-base leading-snug">{p.title}</h4>

                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-2xl font-black text-amber-400">₹{p.price}</span>
                    {p.originalPrice > p.price && (
                      <span className="text-xs text-slate-500 line-through">₹{p.originalPrice}</span>
                    )}
                    {discount > 0 && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {discount}% OFF
                      </span>
                    )}
                  </div>

                  {!p.isActive && (
                    <span className="inline-block text-[10px] font-bold text-rose-300 bg-rose-500/10 px-2 py-0.5 rounded">
                      Hidden / Inactive
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => handleEdit(p)}
                    className="flex-1 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-bold text-xs border border-amber-400/30 transition text-center"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(p.id, p.title)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs border border-rose-500/30 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

