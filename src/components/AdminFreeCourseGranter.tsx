'use client';

import React, { useEffect, useState } from 'react';
import {
  EmailCourseGrant,
  getEmailCourseGrants,
  grantFreeCourseByEmail,
  revokeEmailCourseGrant,
  syncEmailCourseGrantsFromSupabase,
} from '@/lib/monetization';
import {
  DynamicCourse,
  getDynamicCourses,
  syncDynamicCoursesFromSupabase,
} from '@/lib/courses';

const BUILTIN_COURSE_OPTIONS = [
  {
    value: 'BankingSolutions PRO Pass (All-In-One Access)',
    label: '👑 All-In-One PRO Pass (Unlocks All Courses + Mistake Notebook)',
  },
  {
    value: 'Critical Reasoning Mastery Course',
    label: '🧠 Critical Reasoning Mastery Course',
  },
  {
    value: 'Computer Awareness Course',
    label: '💻 Computer Awareness Course',
  },
  {
    value: 'Smart Mistake Notebook & Drills',
    label: '🔖 Smart Mistake Notebook & Re-Attempt Vault',
  },
  {
    value: 'RRB PO & Clerk PDF Course',
    label: '📚 RRB PO & Clerk PDF Course',
  },
  {
    value: 'Topic-wise Question Practice',
    label: '🧮 Topic-wise Question Practice',
  },
];

export default function AdminFreeCourseGranter() {
  const [grants, setGrants] = useState<EmailCourseGrant[]>([]);
  const [dynamicCourses, setDynamicCourses] = useState<DynamicCourse[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(
    'Critical Reasoning Mastery Course'
  );
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [note, setNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setGrants(getEmailCourseGrants());
    setDynamicCourses(getDynamicCourses());

    syncEmailCourseGrantsFromSupabase().then(setGrants);
    syncDynamicCoursesFromSupabase().then(setDynamicCourses);
  }, []);

  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emails = emailInput
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes('@'));

    if (emails.length === 0) {
      setStatusMsg('⚠️ Please enter at least one valid student email address.');
      return;
    }

    setSubmitting(true);
    setStatusMsg('Unlocking course for student email(s)...');
    const updated = await grantFreeCourseByEmail({
      emails,
      courseName: selectedCourse,
      durationMonths,
      note,
    });
    setGrants(updated);
    setEmailInput('');
    setNote('');
    setSubmitting(false);
    setStatusMsg(
      `🎉 Granted free access to "${selectedCourse}" for ${emails.join(', ')} (${
        durationMonths === 0 ? 'Lifetime' : `${durationMonths} Month(s)`
      })!`
    );
  };

  const handleRevoke = async (grant: EmailCourseGrant) => {
    if (
      !confirm(
        `Revoke free access to "${grant.courseName}" for ${grant.email}?`
      )
    ) {
      return;
    }
    const updated = await revokeEmailCourseGrant(grant.id);
    setGrants(updated);
    setStatusMsg(`🗑️ Revoked "${grant.courseName}" access for ${grant.email}.`);
  };

  // Combine built-in courses + Admin-created courses (avoiding duplicates)
  const allCourseOptions = (() => {
    const map = new Map<string, string>();
    BUILTIN_COURSE_OPTIONS.forEach((opt) => map.set(opt.value, opt.label));
    dynamicCourses.forEach((c) => {
      if (!map.has(c.title)) {
        const startPrice = c.plans?.[0]?.launchPrice ?? 199;
        map.set(
          c.title,
          `🎓 ${c.title} (${c.isFree ? 'Free Course' : `Paid • From ₹${startPrice}`})`
        );
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  })();

  const filteredGrants = grants.filter(
    (g) =>
      g.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.note || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-6 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block">
            Direct Student Enrollment by Email ID
          </span>
          <h2 className="text-xl font-black text-white mt-0.5">
            🎁 Grant Free Course / PRO Pass Access by Email ID
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enter any student&apos;s Email ID below to unlock any Course, Mistake Notebook, or All-In-One PRO Pass for free. Works immediately even if the student registers later with that email!
          </p>
        </div>
        <div className="bg-slate-950 border border-emerald-500/30 px-4 py-2.5 rounded-2xl text-right">
          <div className="text-lg font-black text-emerald-400 leading-none">
            {grants.length}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            Active Email Grants
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg('')}
            className="text-emerald-300 hover:text-white ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grant Form */}
      <form
        onSubmit={handleGrantSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-950/90 border border-slate-800 rounded-2xl p-5"
      >
        <div className="lg:col-span-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-amber-300 mb-1.5">
            1. Student Email ID(s) *
          </label>
          <textarea
            rows={2}
            required
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="e.g. rahul@gmail.com (or paste multiple emails separated by comma)"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
          />
        </div>

        <div className="lg:col-span-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-amber-300 mb-1.5">
            2. Select Course / Pass to Unlock *
          </label>
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold outline-none focus:border-amber-400"
          >
            {allCourseOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400 mt-1">
            Selecting <strong>All-In-One PRO Pass</strong> unlocks all courses + Mistake Notebook at once.
          </p>
        </div>

        <div className="lg:col-span-2">
          <label className="block text-[11px] font-black uppercase tracking-wider text-amber-300 mb-1.5">
            3. Validity Duration
          </label>
          <select
            value={durationMonths}
            onChange={(e) => setDurationMonths(Number(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-emerald-300 font-bold outline-none focus:border-amber-400"
          >
            <option value={1}>1 Month</option>
            <option value={3}>3 Months</option>
            <option value={6}>6 Months</option>
            <option value={12}>12 Months (1 Year)</option>
            <option value={24}>24 Months (2 Years)</option>
            <option value={0}>♾️ Lifetime Access</option>
          </select>
        </div>

        <div className="lg:col-span-2 flex flex-col justify-between gap-2">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              Reason / Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Giveaway / UPI"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            {submitting ? 'Unlocking...' : '🎁 Grant Free Access'}
          </button>
        </div>
      </form>

      {/* Granted Emails List */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-black text-white">
            📋 Students with Admin-Granted Free Course Access ({filteredGrants.length})
          </h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student email or course..."
            className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 min-w-[240px]"
          />
        </div>

        {filteredGrants.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
            No email grants found yet. Enter a student&apos;s email above to unlock any course for free.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-black text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Student Email ID</th>
                  <th className="p-3.5">Unlocked Course / Pass</th>
                  <th className="p-3.5">Validity / Expiry</th>
                  <th className="p-3.5">Note</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {filteredGrants.map((g) => {
                  const isExpired =
                    g.expiresAt ? new Date(g.expiresAt) <= new Date() : false;
                  return (
                    <tr key={g.id} className="hover:bg-slate-950/50 transition">
                      <td className="p-3.5 font-mono font-bold text-amber-300">
                        {g.email}
                      </td>
                      <td className="p-3.5 font-bold text-white">
                        {g.courseName}
                      </td>
                      <td className="p-3.5">
                        {g.durationMonths === 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                            ♾️ Lifetime
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                              isExpired
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {g.durationMonths}M • Ends{' '}
                            {g.expiresAt
                              ? new Date(g.expiresAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Never'}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-400">{g.note || '—'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRevoke(g)}
                          className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-[11px] rounded-xl transition"
                        >
                          Revoke Access
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

