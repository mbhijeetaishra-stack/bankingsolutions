'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function RRBCourseHubPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRRBCourses() {
      const { data } = await supabase
        .from('pdf_courses')
        .select('*')
        .ilike('title', '%RRB%'); // Filters out Current Affairs (August, June, etc.)
      
      if (data) setCourses(data);
      setLoading(false);
    }
    fetchRRBCourses();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans p-6 md:p-12 relative overflow-x-hidden">
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-r from-purple-600/15 via-blue-600/10 to-amber-500/10 blur-[130px] rounded-full z-0" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2">
              <span>📚</span> Structured 50-Day Study Plan
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              IBPS RRB PO &amp; Clerk Practice Packages
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              High-standard, exact exam-level bilingual daily practice sets.
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-white font-bold text-xs rounded-xl transition shrink-0"
          >
            ← Back to Home
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-slate-400 text-xs font-bold">Loading course packages...</div>
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-slate-900/70 backdrop-blur-md border border-white/[0.08] rounded-3xl p-12 text-center space-y-3 max-w-lg mx-auto shadow-2xl">
            <div className="text-3xl">📄</div>
            <p className="text-base font-bold text-white">No RRB courses published yet.</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Go to your Admin Portal under <strong className="text-amber-400">📚 RRB PDF Course</strong> and create a course container titled with &ldquo;RRB&rdquo;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] hover:border-purple-500/50 rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-6 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-purple-600/25 shrink-0">
                      RRB
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block mb-0.5">
                        Complete PDF Series
                      </span>
                      <h3 className="font-black text-white text-base sm:text-lg leading-snug group-hover:text-purple-300 transition">
                        {course.title}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 border border-white/[0.06] p-4 rounded-2xl text-left space-y-1">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {course.description || 'Structured Daily Practice Course'}
                    </p>
                  </div>

                  <ul className="space-y-2.5 text-xs font-semibold text-slate-300 pt-1">
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-black">✓</span>
                      <span>Bilingual Daily PDF Sheets (Eng / Hindi)</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[10px] font-black">✓</span>
                      <span>Exam-Level Reasoning &amp; Quant Sets</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    onClick={() => alert('Downloading official schedule PDF...')}
                    className="w-full py-3 bg-slate-950 hover:bg-slate-800 border border-purple-500/30 text-purple-300 font-bold text-xs rounded-2xl transition shadow-sm"
                  >
                    📅 Download Schedule
                  </button>
                  <Link
                    href={`/rrb-pdf-course/${course.id}`}
                    className="block w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-2xl text-center shadow-lg shadow-purple-600/25 transition"
                  >
                    Open Course Package →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
