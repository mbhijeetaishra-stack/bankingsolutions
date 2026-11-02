'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface TestCard {
  id: string;
  chapter_number: number;
  title: string;
  duration_minutes: number;
  total_marks: number;
  is_locked: boolean;
}

interface Attempt {
  test_id: string;
  is_submitted: boolean;
  score: number;
}

export default function CriticalReasoningTestsHub() {
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<TestCard[]>([]);
  const [attempts, setAttempts] = useState<{ [key: string]: Attempt }>({});
  const [hasPurchased, setHasPurchased] = useState(false);

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  async function checkUserAndFetchData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // 1. Check purchase
      const { data: purchaseData } = await supabase
        .from('student_course_purchases')
        .select('*')
        .eq('user_id', session.user.id)
        .ilike('course_name', '%Critical Reasoning%')
        .single();

      if (purchaseData && new Date(purchaseData.expires_at) > new Date()) {
        setHasPurchased(true);
      }

      // 2. Fetch user's test attempts
      const { data: attemptData } = await supabase
        .from('student_test_attempts')
        .select('test_id, is_submitted, score')
        .eq('user_id', session.user.id);

      if (attemptData) {
        const attemptMap: { [key: string]: Attempt } = {};
        attemptData.forEach((att) => {
          attemptMap[att.test_id] = att;
        });
        setAttempts(attemptMap);
      }
    }

    // 3. Fetch all tests
    const { data: testData } = await supabase
      .from('admin_tests')
      .select('*')
      .order('chapter_number', { ascending: true });

    if (testData) {
      setTests(testData);
    }
    setLoading(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold text-sm">Loading Test Portal...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex justify-between items-center border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white">Critical Reasoning Practice Tests 💻</h1>
            <p className="text-xs text-slate-400 mt-1">Attempt, pause, resume, and review your chapter-wise mock tests.</p>
          </div>
          <Link href="/critical-reasoning" className="px-4 py-2 bg-slate-900 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-800 transition">
            ← Back to Course Chapters
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tests.map((test) => {
            const isLocked = test.is_locked && !hasPurchased;
            const userAttempt = attempts[test.id];

            let buttonText = 'Start Test →';
            let badgeText = null;
            let buttonBg = 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25';

            if (userAttempt) {
              if (userAttempt.is_submitted === false) {
                buttonText = 'Resume Test ⏸️';
                badgeText = <span className="text-[10px] bg-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded">In Progress</span>;
                buttonBg = 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/25';
              } else {
                buttonText = 'View Analysis / Reattempt 📊';
                badgeText = <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded">Score: {userAttempt.score}</span>;
                buttonBg = 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700';
              }
            }

            return (
              <div key={test.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                      Chapter {test.chapter_number} Mock
                    </span>
                    <div className="flex items-center gap-2">
                      {badgeText}
                      {isLocked ? <span className="text-xs">🔒 Locked</span> : <span className="text-xs text-emerald-400 font-bold">🔓 Unlocked</span>}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-white">{test.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                    <span>⏱️ {test.duration_minutes} Mins</span>
                    <span>📝 {test.total_marks} Marks</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  {isLocked ? (
                    <Link href="/critical-reasoning" className="block text-center w-full py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl">
                      Unlock Course to Attempt 🚀
                    </Link>
                  ) : (
                    <Link href={`/critical-reasoning/test/${test.id}`} className={`block text-center w-full py-2.5 font-bold text-xs rounded-xl transition shadow-lg ${buttonBg}`}>
                      {buttonText}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}