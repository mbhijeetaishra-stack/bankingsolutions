'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DayWiseReaderPage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [loading, setLoading] = useState(true);
  const [courseData, setCourseData] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [dayContent, setDayContent] = useState<any>(null);
  const [totalDaysConfig, setTotalDaysConfig] = useState(50);

  useEffect(() => {
    async function fetchCourseDetails() {
      const { data: cData } = await supabase
        .from('pdf_courses')
        .select('*')
        .eq('id', courseId)
        .single();
      
      if (cData) setCourseData(cData);
      await fetchDayData(1);
      setLoading(false);
    }
    if (courseId) fetchCourseDetails();
  }, [courseId]);

  async function fetchDayData(dayNo: number) {
    const { data } = await supabase
      .from('rrb_course_days')
      .select('*')
      .eq('course_id', courseId)
      .eq('day_number', dayNo)
      .single();

    if (data) {
      setDayContent(data);
      if (data.total_days_config) setTotalDaysConfig(data.total_days_config);
    } else {
      setDayContent(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center font-bold space-y-3">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400">Loading Course Reader...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans p-6 md:p-10 space-y-8 relative overflow-x-hidden">
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-r from-purple-600/15 via-blue-600/10 to-amber-500/10 blur-[130px] rounded-full z-0" />

      {/* Header Banner */}
      <div className="relative z-10 max-w-7xl mx-auto bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-2xl">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block mb-1">
            Day-Wise Practice Schedule
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{courseData?.title || 'Practice Course'}</h1>
          <p className="text-xs text-slate-400 mt-1">{courseData?.description || 'Daily practice course.'}</p>
        </div>
        <Link href="/rrb-pdf-course" className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-white font-bold text-xs rounded-xl transition shrink-0">
          ← All Packages
        </Link>
      </div>

      {/* Day Selector Pill Grid */}
      <div className="relative z-10 max-w-7xl mx-auto bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-amber-400">📅 Select Practice Day</h3>
          <span className="text-[11px] font-bold text-slate-400">Viewing Day {selectedDay} of {totalDaysConfig}</span>
        </div>
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
          {Array.from({ length: totalDaysConfig }, (_, i) => i + 1).map((day) => (
            <button
              key={day}
              onClick={() => { setSelectedDay(day); fetchDayData(day); }}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition border ${
                selectedDay === day
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400/40 text-white shadow-lg shadow-purple-600/25'
                  : 'bg-slate-950/80 border-white/[0.06] text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Day {day}
            </button>
          ))}
        </div>
      </div>

      {/* Sections Grid (Reasoning & Quant) */}
      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Reasoning Section */}
        <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-7 flex flex-col justify-between space-y-5 shadow-xl">
          <div className="space-y-3">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-amber-400/10 text-amber-300 border border-amber-400/25 px-3 py-1 rounded-full">
              🧠 Reasoning Section — Day {selectedDay}
            </span>
            <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed font-medium pt-1">
              {dayContent?.reasoning_topics || 'No reasoning topics published for today.'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-4 border-t border-white/[0.08]">
            {dayContent?.eng_pdf_url && (
              <a href={dayContent.eng_pdf_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition">
                ⬇️ English PDF
              </a>
            )}
            {dayContent?.hindi_pdf_url && (
              <a href={dayContent.hindi_pdf_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl transition">
                ⬇️ हिन्दी PDF
              </a>
            )}
          </div>
        </div>

        {/* Quantitative Aptitude Section */}
        <div className="bg-slate-900/75 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-7 flex flex-col justify-between space-y-5 shadow-xl">
          <div className="space-y-3">
            <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-300 border border-blue-500/25 px-3 py-1 rounded-full">
              📊 Quantitative Aptitude — Day {selectedDay}
            </span>
            <div className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed font-medium pt-1">
              {dayContent?.quant_topics || 'No quant topics published for today.'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-4 border-t border-white/[0.08]">
            {dayContent?.quant_eng_pdf_url && (
              <a href={dayContent.quant_eng_pdf_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs rounded-xl transition">
                ⬇️ English PDF
              </a>
            )}
            {dayContent?.quant_hindi_pdf_url && (
              <a href={dayContent.quant_hindi_pdf_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-xl transition">
                ⬇️ हिन्दी PDF
              </a>
            )}
            {dayContent?.youtube_video_url && (
              <a href={dayContent.youtube_video_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition">
                ▶️ Video Solution
              </a>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
