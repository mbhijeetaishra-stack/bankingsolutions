'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Chapter {
  id: string;
  chapter_number: number;
  language: 'english' | 'hinglish';
  title: string;
  subtitle?: string;
  markdown_content: string;
  is_locked: boolean;
  pdf_mcq_url?: string;
}

export default function CriticalReasoningReaderPage() {
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterNo, setSelectedChapterNo] = useState<number>(1);
  const [languageMode, setLanguageMode] = useState<'english' | 'hinglish'>('english');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUserAndFetchChapters();
  }, []);

  async function checkUserAndFetchChapters() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }

    const { data, error } = await supabase
      .from('admin_critical_reasoning_chapters')
      .select('*')
      .order('chapter_number', { ascending: true });

    if (!error && data && data.length > 0) {
      setChapters(data);
      setSelectedChapterNo(data[0].chapter_number);
    }
    setLoading(false);
  }

  // Get unique chapter numbers available in the system
  const uniqueChapterNumbers = Array.from(new Set(chapters.map((c) => c.chapter_number)));

  // Find the active chapter matching the selected number and current language mode
  const activeChapter = chapters.find(
    (c) => c.chapter_number === selectedChapterNo && c.language === languageMode
  ) || chapters.find((c) => c.chapter_number === selectedChapterNo); // fallback if exact language missing

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading Critical Reasoning Modules...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* TOP NAVBAR */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/tests" className="w-9 h-9 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center font-black text-sm shadow-md">
            CR
          </Link>
          <div>
            <h1 className="text-sm md:text-base font-bold text-white tracking-wide">Critical Reasoning Mastery</h1>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Banking Exam Preparation Series</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* LANGUAGE SWITCHER DROPDOWN / TOGGLE */}
          <div className="flex bg-slate-950 border border-slate-700 p-1 rounded-xl">
            <button
              onClick={() => setLanguageMode('english')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                languageMode === 'english' ? 'bg-[#1D63B8] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🇬🇧 English
            </button>
            <button
              onClick={() => setLanguageMode('hinglish')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                languageMode === 'hinglish' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🇮🇳 Hinglish
            </button>
          </div>

          <Link href="/tests" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition">
            Test Portal 🏠
          </Link>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* CHAPTERS SIDEBAR */}
        <aside className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 h-fit sticky top-24 shadow-xl">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider border-b border-slate-800 pb-2">
            Chapters Index
          </h3>
          <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
            {uniqueChapterNumbers.map((chNo) => {
              const chObj = chapters.find((c) => c.chapter_number === chNo);
              const isSelected = selectedChapterNo === chNo;

              return (
                <button
                  key={chNo}
                  onClick={() => setSelectedChapterNo(chNo)}
                  className={`w-full text-left p-3 rounded-xl transition text-xs font-bold flex justify-between items-center ${
                    isSelected
                      ? 'bg-[#1D63B8] text-white shadow-lg'
                      : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800/80'
                  }`}
                >
                  <span className="truncate">Chapter {chNo}: {chObj?.title || 'Module'}</span>
                  {chObj?.is_locked && <span className="text-[10px]">🔒</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* CHAPTER READER CONTENT */}
        <main className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          {!activeChapter ? (
            <div className="text-center py-20 text-slate-400 space-y-2">
              <div className="text-4xl">📖</div>
              <h3 className="text-base font-bold text-white">No Chapter Selected</h3>
              <p className="text-xs">Select a chapter from the sidebar or check back later for updates.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4 flex-wrap gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full">
                    Chapter {activeChapter.chapter_number} — {activeChapter.language.toUpperCase()} Mode
                  </span>
                  <h2 className="text-xl md:text-2xl font-black text-white mt-2">{activeChapter.title}</h2>
                </div>

                {activeChapter.pdf_mcq_url && (
                  <a
                    href={activeChapter.pdf_mcq_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-2"
                  >
                    <span>📄 Download Practice MCQs (PDF)</span>
                  </a>
                )}
              </div>

              {/* MARKDOWN RENDERER */}
              <div className="prose prose-invert max-w-none text-slate-200 leading-relaxed space-y-4 pt-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {activeChapter.markdown_content}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}