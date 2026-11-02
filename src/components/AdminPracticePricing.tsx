'use client';

import React, { useEffect, useState } from 'react';
import {
  DEFAULT_PRACTICE_ACCESS,
  DurationUnit,
  PracticeAccessConfig,
  PracticePlan,
  formatPlanDuration,
  getPracticeAccessConfig,
  savePracticeAccessConfig,
  syncPracticeAccessConfig,
} from '@/lib/practiceAccess';

const inputCls =
  'w-full bg-slate-950 border border-white/[0.1] focus:border-amber-400/60 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600';
const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5';

const emptyForm = {
  title: '',
  durationValue: 1,
  durationUnit: 'MONTHS' as DurationUnit,
  originalPrice: 199,
  price: 99,
  badge: '',
  isPopular: false,
  isActive: true,
};

export default function AdminPracticePricing() {
  const [config, setConfig] = useState<PracticeAccessConfig>(DEFAULT_PRACTICE_ACCESS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statusMsg, setStatusMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(getPracticeAccessConfig());
    syncPracticeAccessConfig().then(setConfig);
  }, []);

  async function persist(next: PracticeAccessConfig, msg: string) {
    setSaving(true);
    setConfig(next);
    await savePracticeAccessConfig(next);
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
    const plan: PracticePlan = {
      id: editingId || `pq_${Date.now()}`,
      title: form.title.trim() || `${formatPlanDuration({ durationValue, durationUnit: form.durationUnit })} Practice Pass`,
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

  function handleEdit(p: PracticePlan) {
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

  const activePlans = config.plans.filter((p) => p.isActive);

  return (
    <div className="space-y-6">
      {/* Paid / free switch */}
      <div
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
          config.isPaid ? 'bg-amber-400/[0.06] border-amber-400/30' : 'bg-emerald-500/[0.06] border-emerald-500/30'
        }`}
      >
        <div>
          <h3 className="text-base font-black text-white">
            {config.isPaid ? '🔒 Paid mode is ON' : '🆓 Free mode is ON'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {config.isPaid
              ? 'Students must buy one of the active plans below (or have PRO Pass / a free email grant) to start practice sessions. Topics and question counts remain visible to everyone.'
              : 'Every student can practise for free. Turn paid mode on to start charging.'}
          </p>
          {config.isPaid && activePlans.length === 0 && (
            <p className="text-xs font-bold text-rose-300 mt-2">⚠️ No active plan – students cannot buy access. Add or activate a plan.</p>
          )}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            persist(
              { ...config, isPaid: !config.isPaid },
              config.isPaid ? '✅ Practice is now FREE for everyone.' : '✅ Practice is now PAID.'
            )
          }
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition shrink-0 ${
            config.isPaid ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
          }`}
        >
          {config.isPaid ? 'Make it Free' : 'Make it Paid'}
        </button>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-100 text-xs font-bold flex justify-between gap-4">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg('')} className="text-blue-300 hover:text-white">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Plan form */}
        <form onSubmit={handleSavePlan} className="lg:col-span-2 bg-slate-950/60 border border-white/[0.08] rounded-2xl p-5 space-y-4 h-fit">
          <h3 className="text-sm font-black text-white">{editingId ? '✏️ Edit plan' : '➕ Add plan'}</h3>

          <div>
            <span className={labelCls}>Plan name (optional)</span>
            <input
              className={inputCls}
              placeholder="e.g. 3 Months Practice Pass"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <span className={labelCls}>Duration</span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={form.durationValue}
                onChange={(e) => setForm({ ...form, durationValue: Number(e.target.value) })}
              />
              <select
                className={inputCls}
                value={form.durationUnit}
                onChange={(e) => setForm({ ...form, durationUnit: e.target.value as DurationUnit })}
              >
                <option value="DAYS">Days</option>
                <option value="MONTHS">Months</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={labelCls}>Selling price (₹)</span>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <span className={labelCls}>MRP / strike price (₹)</span>
              <input
                type="number"
                min={0}
                className={inputCls}
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <span className={labelCls}>Badge (optional)</span>
            <input
              className={inputCls}
              placeholder="e.g. BEST VALUE"
              value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm({ ...form, isPopular: e.target.checked })} />
              Highlight as most popular
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active (visible to students)
            </label>
          </div>

          <p className="text-[11px] text-slate-500">
            Selling price ₹0 = free unlock for that duration. Students can apply coupons that target “Topic-wise Question Practice” or “All”.
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? '💾 Update plan' : '➕ Add plan'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2.5 bg-slate-800 text-slate-200 font-bold text-xs rounded-xl">
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Plans list */}
        <div className="lg:col-span-3 space-y-3">
          <h3 className="text-sm font-black text-white">Plans ({config.plans.length})</h3>
          {config.plans.length === 0 && <p className="text-xs text-slate-500">No plans yet.</p>}
          {config.plans.map((p) => {
            const off = p.originalPrice > p.price ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  p.isActive ? 'bg-slate-950/70 border-white/[0.08]' : 'bg-slate-950/30 border-white/[0.04] opacity-60'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-white">{p.title}</span>
                    {p.badge && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                        {p.badge}
                      </span>
                    )}
                    {p.isPopular && <span className="text-[10px] font-black text-purple-300">★ POPULAR</span>}
                    {!p.isActive && <span className="text-[10px] font-black text-rose-300">HIDDEN</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    ⏳ {formatPlanDuration(p)} ·{' '}
                    <span className="text-emerald-400 font-black text-sm">₹{p.price}</span>{' '}
                    {off > 0 && (
                      <>
                        <span className="line-through">₹{p.originalPrice}</span> <span className="text-amber-300">({off}% off)</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" onClick={() => handleEdit(p)} className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white">
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      persist(
                        { ...config, plans: config.plans.map((x) => (x.id === p.id ? { ...x, isActive: !x.isActive } : x)) },
                        `✅ "${p.title}" ${p.isActive ? 'hidden' : 'activated'}.`
                      )
                    }
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    {p.isActive ? '🙈 Hide' : '👁️ Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Delete plan "${p.title}"? Students who already bought it keep their access.`)) return;
                      persist({ ...config, plans: config.plans.filter((x) => x.id !== p.id) }, `🗑️ "${p.title}" deleted.`);
                    }}
                    className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-slate-500 pt-2">
            Also unlocks practice: active PRO Pass, and “🎁 Grant Course by Email” → “Topic-wise Question Practice”.
          </p>
        </div>
      </div>
    </div>
  );
}

function toDays(p: PracticePlan) {
  return p.durationUnit === 'DAYS' ? p.durationValue : p.durationValue * 30;
}

