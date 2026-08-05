'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ExamCountdown {
  id: string;
  exam_name: string;
  exam_date: string;
}

interface ChecklistItem {
  id: string;
  item_key: string;
  label: string;
  completed: boolean;
}

export default function DailyTargetsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dashboard Control States
  const [trackMode, setTrackMode] = useState<'beginner' | 'repeater'>('beginner');
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [maxDaysCount, setMaxDaysCount] = useState<number>(1);

  // Dynamic States from Admin DB
  const [exams, setExams] = useState<ExamCountdown[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  
  const [streakCount, setStreakCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchInitialHubData();
  }, []);

  // Whenever selectedDay or trackMode changes, load that specific day's video and saved progress
  useEffect(() => {
    if (!loading) {
      loadDayProgressAndVideo(selectedDay, trackMode);
    }
  }, [selectedDay, trackMode]);

  async function fetchInitialHubData() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }

      // 1. Fetch Max Available Days from admin_targets_config to populate Day tabs dynamically
      const { data: configData } = await supabase
        .from('admin_targets_config')
        .select('day_number')
        .order('day_number', { ascending: false });

      if (configData && configData.length > 0) {
        const highestDay = configData[0].day_number || 1;
        setMaxDaysCount(Math.max(1, highestDay));
      }

      // 2. Fetch Exam Countdowns
      const { data: examData } = await supabase
        .from('admin_exam_countdowns')
        .select('*')
        .order('exam_date', { ascending: true });

      if (examData) {
        setExams(examData);
      }

      // 3. Calculate Real Streak from localStorage progress
      calculateUserStreak(maxDaysCount, trackMode);

      // Load Day 1 Beginner by default
      await loadDayProgressAndVideo(1, 'beginner');
    } catch (err) {
      console.error('Error loading hub core data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate streak: counts consecutive days where at least one item was completed
  function calculateUserStreak(totalDays: number, mode: string) {
    let streak = 0;
    for (let d = 1; d <= totalDays; d++) {
      const storageKey = `bsca_target_day_${d}_${mode}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const hasCompletedAny = parsed.some((item: any) => item.completed);
          if (hasCompletedAny) {
            streak += 1;
          } else {
            // Break streak if a day has no completed items
            break;
          }
        } catch (e) {
          break;
        }
      } else {
        break;
      }
    }
    setStreakCount(streak);
  }

  async function loadDayProgressAndVideo(dayNum: number, mode: 'beginner' | 'repeater') {
    try {
      // 1. Fetch YouTube video specific to this day and track mode
      const { data: videoData } = await supabase
        .from('admin_targets_config')
        .select('youtube_url')
        .eq('day_number', dayNum)
        .eq('track_mode', mode)
        .single();

      if (videoData) {
        setVideoUrl(videoData.youtube_url || '');
      } else {
        setVideoUrl('');
      }

      // 2. Fetch day-specific and track-specific checklist items from admin_day_checklist_items
      const { data: templateData } = await supabase
        .from('admin_day_checklist_items')
        .select('*')
        .eq('day_number', dayNum)
        .eq('track_mode', mode)
        .order('display_order', { ascending: true });

      if (templateData && templateData.length > 0) {
        const baseItems = templateData.map((t: any) => ({
          id: t.id,
          item_key: t.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          label: t.label,
          completed: false,
        }));

        // Unique storage key combining Day number and Track mode
        const storageKey = `bsca_target_day_${dayNum}_${mode}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
          const parsedSaved = JSON.parse(saved);
          const merged = baseItems.map((item) => {
            const found = parsedSaved.find((p: any) => p.item_key === item.item_key || p.label === item.label);
            return found ? { ...item, completed: found.completed } : item;
          });
          setChecklist(merged);
        } else {
          setChecklist(baseItems);
        }
      } else {
        setChecklist([]);
      }

      // Recalculate streak whenever day or track changes
      calculateUserStreak(maxDaysCount, mode);
    } catch (err) {
      console.error('Error loading day configuration:', err);
    }
  }

  const toggleChecklistItem = (id: string) => {
    const updated = checklist.map((item) =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updated);
    setIsSaved(false);
  };

  const handleSaveProgress = () => {
    try {
      const storageKey = `bsca_target_day_${selectedDay}_${trackMode}`;
      localStorage.setItem(storageKey, JSON.stringify(checklist));
      setIsSaved(true);
      calculateUserStreak(maxDaysCount, trackMode); // Update streak immediately on save
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {}
  };

  const getDaysLeft = (targetDateStr: string) => {
    const target = new Date(targetDateStr).getTime();
    const today = new Date().getTime();
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex items-center justify-center font-bold text-sm">
        Loading Daily Targets Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 font-sans flex flex-col">
      {/* TOP HEADER */}
      <header className="bg-[#1D63B8] text-white px-6 py-3 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white text-[#1D63B8] rounded font-black text-sm flex items-center justify-center shadow-inner">
            BS
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">BankingSolutions Daily Target & Consistency Hub</h1>
            <p className="text-[10px] text-blue-100 uppercase font-semibold">Track day-wise micro-goals & build unshakable streaks</p>
          </div>
        </div>

        <Link href="/" className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg transition border border-white/20">
          ← Back to Portal
        </Link>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 py-6 w-full space-y-6 flex-1">
        
        {/* CONFIG BAR: SELECTOR FOR BEGINNER/REPEATER & STREAK */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-500 mr-1">Select Track:</span>
            <button
              onClick={() => setTrackMode('beginner')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                trackMode === 'beginner'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🌱 Beginner Track
            </button>
            <button
              onClick={() => setTrackMode('repeater')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                trackMode === 'repeater'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🔥 Repeater Track
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              🔥 Active Streak: <span className="text-amber-600 font-black">{streakCount} Days</span>
            </div>
          </div>
        </div>

        {/* HORIZONTAL DAY TABS */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto flex items-center gap-2">
          <span className="text-xs font-black uppercase text-slate-400 px-2 flex-shrink-0">Select Day:</span>
          {Array.from({ length: maxDaysCount }, (_, i) => i + 1).map((dayNum) => (
            <button
              key={dayNum}
              onClick={() => setSelectedDay(dayNum)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition flex-shrink-0 ${
                selectedDay === dayNum
                  ? 'bg-[#1D63B8] text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Day {dayNum < 10 ? `0${dayNum}` : dayNum}
            </button>
          ))}
        </div>

        {/* EXAM COUNTDOWN TICKER CARDS */}
        {exams.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {exams.map((exam) => {
              const daysLeft = getDaysLeft(exam.exam_date);
              return (
                <div key={exam.id} className="bg-gradient-to-br from-blue-900 to-[#1D63B8] text-white p-4 rounded-2xl shadow-lg border border-blue-400/30 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Target Exam</span>
                    <h3 className="text-sm font-black pt-0.5">{exam.exam_name}</h3>
                  </div>
                  <div className="text-right bg-white/10 px-3 py-2 rounded-xl border border-white/20">
                    <span className="text-2xl font-black text-amber-300 block leading-none">{daysLeft}</span>
                    <span className="text-[9px] uppercase font-bold text-blue-100">Days Left</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* YOUTUBE VIDEO & CHECKLIST GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT 2 COLS: YOUTUBE VIDEO & PLAYER */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${trackMode === 'beginner' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    ✅ {trackMode.toUpperCase()} TARGET SESSION
                  </span>
                  <h2 className="text-base font-black text-slate-900 mt-1">DAY {selectedDay.toString().padStart(2, '0')} — Complete Daily Routine & Strategy</h2>
                </div>
                <span className="text-xs font-mono font-bold text-slate-500">YouTube Stream</span>
              </div>

              {/* EMBEDDED YOUTUBE VIDEO RESPONSIVE FRAME */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-950 shadow-inner">
                {videoUrl ? (
                  <iframe
                    src={videoUrl}
                    title="Daily Target YouTube Video"
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400 font-bold p-4 text-center">
                    No video link configured by admin for Day {selectedDay} ({trackMode}). Please add it in the admin panel.
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Watch the video above for guidance, speed-calculation shortcuts, and sectional strategy before marking off your items in the checklist!
              </p>
            </div>
          </div>

          {/* RIGHT COL: INTERACTIVE CHECKLIST PANEL */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="border-b pb-3 flex justify-between items-center">
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  🌱 DAY {selectedDay.toString().padStart(2, '0')} ({trackMode.toUpperCase()})
                </h3>
                <span className="text-[10px] font-bold bg-blue-50 text-[#1D63B8] border border-blue-200 px-2 py-0.5 rounded-full">
                  {checklist.filter((i) => i.completed).length} / {checklist.length} Done
                </span>
              </div>

              {/* CHECKLIST ITEMS */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {checklist.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No checklist items configured for Day {selectedDay} in admin panel.</p>
                ) : (
                  checklist.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleChecklistItem(item.id)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                        item.completed
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black ${
                        item.completed ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                      }`}>
                        {item.completed ? '✓' : ''}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t">
              {isSaved && (
                <div className="p-2 bg-emerald-100 text-emerald-800 text-center text-[11px] font-bold rounded-lg animate-fade-in">
                  🎉 Day {selectedDay} ({trackMode}) Progress Saved!
                </div>
              )}
              <button
                onClick={handleSaveProgress}
                className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow uppercase tracking-wider transition"
              >
                Save Day {selectedDay} Progress 💾
              </button>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTIONS: SOURCES & CONTENT (COMING SOON) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* SOURCES COLUMN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
              Coming Soon 🚀
            </div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              📚 Recommended Study Sources & PDFs
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Curated book chapters, editorial links, practice resource sheets, and official syllabus material referenced for Day {selectedDay} will be available here soon.
            </p>
          </div>

          {/* CONTENT COLUMN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
              Coming Soon 🚀
            </div>
            <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider">
              📝 Day-Wise Summary & Concept Notes
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Quick revision notes, shortcut formulas, vocabulary cards, and concise reading summaries for Day {selectedDay} will be integrated shortly.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}