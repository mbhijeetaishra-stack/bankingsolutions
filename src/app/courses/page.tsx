'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DynamicCourse,
  getDynamicCourses,
  syncDynamicCoursesFromSupabase,
} from '@/lib/courses';
import { getProPassConfig, syncMonetizationFromSupabase } from '@/lib/monetization';

export default function AllCoursesCatalogPage() {
  const [dynamicCourses, setDynamicCourses] = useState<DynamicCourse[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'FREE' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProPassVisible, setIsProPassVisible] = useState(true);

  useEffect(() => {
    setIsProPassVisible(getProPassConfig().isVisibleOnWebsite);
    syncMonetizationFromSupabase().then((synced) => {
      setIsProPassVisible(synced.proPassConfig.isVisibleOnWebsite);
    });
    const local = getDynamicCourses().filter((c) => c.isPublished);
    setDynamicCourses(local);

    syncDynamicCoursesFromSupabase().then((remote) => {
      setDynamicCourses(remote.filter((c) => c.isPublished));
    });
  }, []);

  // Core built-in platform courses so students see everything in one place
  const builtInCourses = [
    {
      id: 'builtin_cr',
      title: 'Critical Reasoning Mastery Course',
      subtitle: 'Bilingual Statement-Assumption, Inference & Cause-Effect',
      description:
        'Master high-weightage Mains Critical Reasoning with English & Hinglish chapters and Real CBT chapter-wise practice tests.',
      icon: '🧠',
      badge: 'MAINS FLAGSHIP',
      isFree: false,
      priceLabel: '₹249 w/ BSOL',
      href: '/critical-reasoning',
      chaptersCountLabel: 'Bilingual Chapters + Mocks',
    },
    {
      id: 'builtin_comp',
      title: 'Complete Computer Awareness (2026)',
      subtitle: 'IBPS RRB PO/Clerk, SBI & RBI Assistant Special',
      description:
        'Full syllabus coverage of Networking, DBMS, OS, MS Office shortcuts, and downloadable chapter-wise MCQ PDFs.',
      icon: '💻',
      badge: 'RRB & MAINS',
      isFree: false,
      priceLabel: '₹149 w/ BSOL',
      href: '/computer-awareness',
      chaptersCountLabel: 'Chapter Notes + MCQ PDFs',
    },
    {
      id: 'builtin_rrb',
      title: '50-Day RRB PO & Clerk PDF Target Course',
      subtitle: 'Day-by-Day Bilingual Quant, Reasoning, GA & Computer PDFs',
      description:
        'Structured 50-day study plan with daily bilingual practice PDFs and video solution links.',
      icon: '📚',
      badge: '50-DAY PLAN',
      isFree: true,
      priceLabel: 'Free / Open Access',
      href: '/rrb-pdf-course',
      chaptersCountLabel: '50 Daily Target Modules',
    },
    {
      id: 'builtin_bsca',
      title: 'BSPS & BSCA Daily Practice PDF Courses',
      subtitle: 'Current Affairs & Banking Practice Sheets',
      description:
        'Download daily and monthly Current Affairs (BSCA) and Practice Sheets (BSPS) curated for upcoming banking exams.',
      icon: '📰',
      badge: 'DAILY PDFS',
      isFree: true,
      priceLabel: 'Free PDF Downloads',
      href: '/pdf-courses?category=BSCA',
      chaptersCountLabel: 'Daily & Monthly PDFs',
    },
  ];

  const unifiedList = [
    ...dynamicCourses.map((c) => {
      const lowestPlan =
        c.plans && c.plans.length > 0
          ? [...c.plans].sort((a, b) => a.launchPrice - b.launchPrice)[0]
          : null;
      return {
        id: c.id,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        icon: c.icon || '🎓',
        badge: c.badge || (c.isFree ? '100% FREE COURSE' : 'PREMIUM COURSE'),
        isFree: c.isFree,
        priceLabel: c.isFree
          ? '100% FREE (₹0)'
          : `From ₹${lowestPlan?.launchPrice || 149}`,
        href: `/courses/${c.slug}`,
        chaptersCountLabel: `${c.chapters.length} Chapters`,
      };
    }),
    ...builtInCourses,
  ].filter((item) => {
    if (filterType === 'FREE' && !item.isFree) return false;
    if (filterType === 'PAID' && item.isFree) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col relative overflow-x-hidden">
      {/* Ambient Top Glow */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-gradient-to-r from-amber-500/10 via-blue-600/10 to-emerald-500/10 blur-[140px] rounded-full z-0" />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-white/[0.08] px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-lg shadow-lg shadow-amber-500/20">
              🎓
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Courses &amp; Masterclasses Catalog
              </h1>
              <p className="text-xs text-slate-400">
                Free Foundation Batches, Bilingual Master Courses &amp; Daily Target PDFs
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            {isProPassVisible && (
              <Link
                href="/pro-pass"
                className="px-3.5 py-2 bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-amber-300 font-black text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <span>👑</span>
                <span>PRO Pass</span>
              </Link>
            )}
            <Link
              href="/profile"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              📊 Dashboard
            </Link>
            <Link
              href="/"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-slate-200 font-bold text-xs rounded-xl transition"
            >
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {/* Filter & Search Bar */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shadow-xl">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-white/[0.08]">
            {[
              { id: 'ALL', label: '🎓 All Courses' },
              { id: 'FREE', label: '🎁 Free Courses' },
              { id: 'PAID', label: '💳 Premium Courses' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition ${
                  filterType === tab.id
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search courses by topic or exam..."
            className="bg-slate-950 border border-white/[0.08] focus:border-amber-400/50 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none w-full sm:w-80"
          />
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {unifiedList.map((course) => (
            <div
              key={course.id}
              className="bg-slate-900/80 backdrop-blur-xl border border-white/[0.08] hover:border-amber-400/35 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-xl transition group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-2xl">
                    {course.icon}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        course.isFree
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                      }`}
                    >
                      {course.badge}
                    </span>
                  </div>
                </div>

                <div>
                  <h2 className="text-lg font-black text-white group-hover:text-amber-400 transition">
                    {course.title}
                  </h2>
                  <p className="text-xs font-bold text-amber-300/90 mt-0.5">
                    {course.subtitle}
                  </p>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {course.description}
                </p>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/[0.08]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">
                    📖 {course.chaptersCountLabel}
                  </span>
                  <span
                    className={`font-black ${
                      course.isFree ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {course.priceLabel}
                  </span>
                </div>

                <Link
                  href={course.href}
                  className={`w-full py-3 rounded-xl font-black text-xs text-center block transition shadow-lg ${
                    course.isFree
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20'
                  }`}
                >
                  {course.isFree ? '🎁 Start Free Course →' : '🚀 Open Course →'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

