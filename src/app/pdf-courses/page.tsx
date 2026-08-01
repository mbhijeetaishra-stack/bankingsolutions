'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface PdfCourse {
  id: string;
  title: string;
  category: 'BSCA' | 'BSPS';
  description: string;
  created_at: string;
}

function CourseCatalogContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'ALL';

  const [courses, setCourses] = useState<PdfCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);

  useEffect(() => {
    async function fetchCourses() {
      setLoading(true);
      const { data, error } = await supabase
        .from('pdf_courses')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCourses(data as PdfCourse[]);
      }
      setLoading(false);
    }

    fetchCourses();
  }, []);

  const filteredCourses = courses.filter((c) =>
    selectedCategory === 'ALL' ? true : c.category === selectedCategory
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center font-black text-base text-white shadow-lg">
            BS
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">BankingSolutions PDF Hub</h1>
            <p className="text-[11px] text-slate-400">Day-Wise BSPS Practice Sheets & BSCA Current Affairs</p>
          </div>
        </div>

        <Link
          href="/"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
        >
          ← Return Home
        </Link>
      </header>

      {/* Hero Header & Filters */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 py-10 px-6 text-center space-y-4">
        <h2 className="text-2xl md:text-4xl font-black text-white">
          Structured Daily Practice & Current Affairs
        </h2>
        <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
          Access day-wise structured study material for Banking exams. High-level Quant & Reasoning practice sheets with complete step-by-step solutions and daily financial awareness.
        </p>

        <div className="flex justify-center gap-3 pt-2">
          {['ALL', 'BSPS', 'BSCA'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedCategory(tab)}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition ${
                selectedCategory === tab
                  ? tab === 'BSCA'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-[#1D63B8] text-white shadow-lg shadow-blue-600/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All Courses' : tab === 'BSPS' ? '📄 BSPS Practice Sheets' : '📰 BSCA Current Affairs'}
            </button>
          ))}
        </div>
      </section>

      {/* Course Catalog Grid */}
      <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 font-bold">Loading PDF Courses...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3 max-w-md mx-auto my-8">
            <div className="text-4xl">📂</div>
            <h3 className="font-bold text-white text-lg">No PDF Courses Found</h3>
            <p className="text-xs text-slate-400">
              No courses found for category "{selectedCategory}". Publish a new course container from the Admin Portal.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-slate-800/60 border border-slate-700/70 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col justify-between space-y-5 hover:shadow-2xl transition group"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                        course.category === 'BSCA'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {course.category === 'BSCA' ? 'BSCA – Banking Current Affairs' : 'BSPS – Practice Sheet'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(course.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-lg group-hover:text-blue-300 transition leading-snug">
                    {course.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {course.description || 'Complete day-wise downloadable study PDFs with step-by-step solutions.'}
                  </p>
                </div>

                <Link
                  href={`/pdf-courses/${course.id}`}
                  className={`w-full py-3.5 font-extrabold text-xs rounded-xl text-center shadow-lg transition flex items-center justify-center gap-2 ${
                    course.category === 'BSCA'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-[#1D63B8] hover:bg-blue-700 text-white'
                  }`}
                >
                  <span>View Day-Wise PDFs</span>
                  <span>→</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PdfCoursesCatalogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">Loading...</div>}>
      <CourseCatalogContent />
    </Suspense>
  );
}