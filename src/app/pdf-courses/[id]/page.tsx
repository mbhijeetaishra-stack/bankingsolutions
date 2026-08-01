'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CourseDetail {
  id: string;
  title: string;
  category: 'BSCA' | 'BSPS';
  description: string;
}

interface CoursePdf {
  id: string;
  day_number: number;
  title: string;
  pdf_url: string;
  release_date: string;
}

export default function DayWisePdfViewerPage() {
  const params = useParams();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [pdfs, setPdfs] = useState<CoursePdf[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCourseAndPdfs() {
      if (!courseId) return;
      setLoading(true);

      // Fetch Course Container
      const { data: courseData } = await supabase
        .from('pdf_courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseData) setCourse(courseData as CourseDetail);

      // Fetch Day PDFs
      const { data: pdfData } = await supabase
        .from('course_pdfs')
        .select('*')
        .eq('course_id', courseId)
        .order('day_number', { ascending: true });

      if (pdfData && pdfData.length > 0) {
        setPdfs(pdfData as CoursePdf[]);
        setActivePdfUrl(pdfData[0].pdf_url); // Default select Day 1 PDF
      }

      setLoading(false);
    }

    fetchCourseAndPdfs();
  }, [courseId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                course?.category === 'BSCA' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {course?.category || 'COURSE'}
            </span>
            <h1 className="text-base font-bold text-white">{course?.title || 'PDF Course'}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Day-Wise Reader & Download Portal</p>
        </div>

        <Link
          href="/pdf-courses"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
        >
          ← Back to Catalog
        </Link>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Days Schedule List (Left Side) */}
            <div className="lg:col-span-1 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Released Schedule ({pdfs.length} Days)
                </h2>
              </div>

              <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {pdfs.length === 0 ? (
                  <div className="p-6 bg-slate-800/40 border border-slate-800 rounded-xl text-center">
                    <p className="text-xs text-slate-400">No day PDFs released yet.</p>
                  </div>
                ) : (
                  pdfs.map((pdf) => {
                    const isActive = activePdfUrl === pdf.pdf_url;
                    return (
                      <div
                        key={pdf.id}
                        onClick={() => setActivePdfUrl(pdf.pdf_url)}
                        className={`p-4 rounded-2xl border transition cursor-pointer flex justify-between items-center ${
                          isActive
                            ? 'bg-[#1D63B8] text-white border-blue-400 shadow-lg'
                            : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-black uppercase opacity-80 block">Day {pdf.day_number}</span>
                          <h3 className="font-bold text-xs leading-snug">{pdf.title}</h3>
                        </div>

                        <a
                          href={pdf.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg border border-white/20 transition flex-shrink-0"
                          title="Open PDF in new tab"
                        >
                          ⬇ PDF
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Embedded PDF Reader (Right Side) */}
            <div className="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-2xl p-4 min-h-[650px] flex flex-col justify-center items-center">
              {activePdfUrl ? (
                <iframe
                  src={activePdfUrl}
                  className="w-full h-[700px] rounded-xl border border-slate-800 bg-white"
                  title="PDF Reader"
                />
              ) : (
                <div className="text-center space-y-3 p-8">
                  <div className="text-5xl">📖</div>
                  <h3 className="font-bold text-slate-300 text-base">Select a Day PDF to Preview</h3>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Click any Day PDF from the schedule on the left to read directly in your browser.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}