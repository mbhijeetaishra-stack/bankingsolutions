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
  topic_list?: string;
  pdf_url: string;
  release_date: string;
}

export default function DayWisePdfPage() {
  const params = useParams();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [pdfs, setPdfs] = useState<CoursePdf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourseAndPdfs() {
      if (!courseId) return;
      setLoading(true);

      // Fetch Course Details
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

      if (pdfData) setPdfs(pdfData as CoursePdf[]);
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
              className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${
                course?.category === 'BSCA' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {course?.category || 'BSPS'}
            </span>
            <h1 className="text-base font-bold text-white">{course?.title || 'Practice Sheet Schedule'}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Day-Wise Download Portal</p>
        </div>

        <Link
          href="/pdf-courses"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
        >
          ← Back to Catalog
        </Link>
      </header>

      {/* Main Schedule List */}
      <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : pdfs.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="text-4xl">📂</div>
            <h3 className="font-bold text-white text-lg">No Day Sheets Uploaded Yet</h3>
            <p className="text-xs text-slate-400">PDFs uploaded for this course will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pdfs.map((pdf) => {
              // Format topics list lines
              const topics = pdf.topic_list
                ? pdf.topic_list.split('\n').filter((line) => line.trim().length > 0)
                : [pdf.title];

              return (
                <div
                  key={pdf.id}
                  className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl hover:border-slate-700 transition"
                >
                  {/* LEFT: DAY LABEL */}
                  <div className="md:w-32 flex-shrink-0">
                    <span className="text-lg md:text-xl font-black text-white block">
                      Day {pdf.day_number}
                    </span>
                  </div>

                  {/* MIDDLE: BULLETED TOPICS BREAKDOWN */}
                  <div className="flex-1 space-y-2">
                    <ul className="space-y-1.5 text-xs text-slate-300 font-medium">
                      {topics.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-slate-400 leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* RIGHT: SINGLE CLEAN PDF DOWNLOAD BUTTON */}
                  <div className="md:w-auto w-full flex-shrink-0 pt-2 md:pt-0">
                    <a
                      href={pdf.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full md:w-auto px-6 py-3 bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 border border-purple-500/40"
                    >
                      <span>📥 Download PDF</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}