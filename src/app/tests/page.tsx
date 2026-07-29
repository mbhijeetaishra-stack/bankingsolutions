'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

interface MockTest {
  id: string;
  title: string;
  duration_minutes: number;
  total_marks: number;
  created_at: string;
}

export default function StudentTestsPage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMockTests();
  }, []);

  async function fetchMockTests() {
    setLoading(true);
    const { data, error } = await supabase
      .from('mock_tests')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (data) setTests(data);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">BankingSolutions - Practice Portal</h1>
            <p className="text-sm text-slate-500 mt-1">
              Select a mock test below to simulate real SBI PO & IBPS exam conditions.
            </p>
          </div>
          <a
            href="/admin"
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-2 rounded transition"
          >
            Admin Panel ⚙️
          </a>
        </header>

        {/* Tests Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500 font-medium">Loading available mock tests...</div>
        ) : tests.length === 0 ? (
          <div className="bg-white p-8 rounded-xl text-center border border-slate-200">
            <p className="text-slate-700 font-semibold mb-2">No Mock Tests Available Yet!</p>
            <p className="text-xs text-slate-500 mb-4">Go to the Admin Panel to create and publish your first mock test.</p>
            <a
              href="/admin"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded transition"
            >
              Go to Admin Panel
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tests.map((test) => (
              <div
                key={test.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                      Full Mock
                    </span>
                    <span className="text-xs text-slate-400 font-medium">100 Questions</span>
                  </div>

                  <h2 className="font-bold text-slate-800 text-base mb-2 line-clamp-2">{test.title}</h2>

                  <div className="flex items-center space-x-4 text-xs text-slate-600 mb-6 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <span className="block text-slate-400 text-[10px] font-semibold uppercase">Duration</span>
                      <span className="font-bold text-slate-700">{test.duration_minutes} Mins</span>
                    </div>
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div>
                      <span className="block text-slate-400 text-[10px] font-semibold uppercase">Total Marks</span>
                      <span className="font-bold text-slate-700">{test.total_marks} Marks</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/test/${test.id}`}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold text-sm py-2.5 rounded-lg transition block"
                >
                  Start Test Now
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}