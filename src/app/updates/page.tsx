'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface UpdatePost {
  id: string;
  category: 'ONE_LINER' | 'NOTIFICATION' | 'RESULT' | 'EXPECTED_CUTOFF' | 'EXAM_ANALYSIS';
  title: string;
  content: string;
  exam_tag: string;
  is_pinned: boolean;
  post_date: string;
  image_url?: string;
  external_link?: string;
  created_at: string;
}

function UpdatesContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'ALL';

  const [posts, setPosts] = useState<UpdatePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUpdates();
  }, []);

  async function fetchUpdates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('updates_feed')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('post_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPosts(data as UpdatePost[]);
    }
    setLoading(false);
  }

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const matchesCategory = selectedCategory === 'ALL' ? true : post.category === selectedCategory;
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.exam_tag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group filtered posts by Date
  const groupedByDate: Record<string, UpdatePost[]> = {};
  filteredPosts.forEach((post) => {
    const dateKey = post.post_date
      ? new Date(post.post_date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : new Date(post.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

    if (!groupedByDate[dateKey]) {
      groupedByDate[dateKey] = [];
    }
    groupedByDate[dateKey].push(post);
  });

  const categoryBadgeMap: Record<string, { label: string; color: string }> = {
    ONE_LINER: { label: '📌 CA One-Liner', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    NOTIFICATION: { label: '📢 Notification', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    RESULT: { label: '🏆 Result Out', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    EXPECTED_CUTOFF: { label: '🎯 Expected Cut-Off', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    EXAM_ANALYSIS: { label: '📊 Shift Analysis', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' },
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center font-black text-slate-950 text-base shadow-lg">
            BS
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">Exam Updates & CA One-Liners</h1>
            <p className="text-[11px] text-slate-400">Date-Wise Daily Current Affairs & Live Exam Updates</p>
          </div>
        </div>

        <Link
          href="/"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition"
        >
          ← Return Home
        </Link>
      </header>

      {/* Search & Filter Bar */}
      <section className="bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800 py-8 px-6 text-center space-y-4">
        <div className="max-w-xl mx-auto">
          <input
            type="text"
            placeholder="Search news, cut-offs, or current affairs topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {[
            { id: 'ALL', label: '⚡ All Updates' },
            { id: 'ONE_LINER', label: '📌 CA One-Liners' },
            { id: 'NOTIFICATION', label: '📢 Notifications' },
            { id: 'EXPECTED_CUTOFF', label: '🎯 Cut-Offs' },
            { id: 'EXAM_ANALYSIS', label: '📊 Exam Analysis' },
            { id: 'RESULT', label: '🏆 Results' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                selectedCategory === tab.id
                  ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Date-Grouped Feed List */}
      <main className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full space-y-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : Object.keys(groupedByDate).length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <div className="text-4xl">📅</div>
            <h3 className="font-bold text-white text-lg">No Updates Found</h3>
            <p className="text-xs text-slate-400">Published one-liners and exam news will appear grouped by date here.</p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([dateLabel, datePosts]) => (
            <div key={dateLabel} className="space-y-4">
              {/* DATE HEADER BANNER */}
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400"></div>
                <h2 className="text-sm md:text-base font-black text-amber-400 uppercase tracking-wider bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800 inline-block shadow">
                  📅 {dateLabel}
                </h2>
                <div className="flex-1 h-[1px] bg-slate-800"></div>
              </div>

              {/* POSTS UNDER THIS DATE */}
              <div className="space-y-4">
                {datePosts.map((post) => {
                  const badge = categoryBadgeMap[post.category] || { label: post.category, color: 'bg-slate-800 text-slate-300' };
                  const contentLines = post.content.split('\n').filter((l) => l.trim().length > 0);

                  return (
                    <div
                      key={post.id}
                      className={`bg-slate-950/80 border rounded-2xl p-6 space-y-4 shadow-lg transition ${
                        post.is_pinned ? 'border-amber-400/60 shadow-amber-400/10' : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          {post.is_pinned && (
                            <span className="text-[10px] font-black uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                              📌 Pinned
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700">
                            {post.exam_tag}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-white leading-snug">{post.title}</h3>

                      {/* EMBEDDED BANNER IMAGE */}
                      {post.image_url && (
                        <div className="rounded-xl overflow-hidden border border-slate-800 max-h-96 my-2 bg-slate-900">
                          <img
                            src={post.image_url}
                            alt={post.title}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                      {/* CONTENT LINES & MARKDOWN TABLE RENDERER */}
                      <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed font-normal">
                        {contentLines.map((line, idx) => {
                          // Markdown Table Row Detector
                          if (line.includes('|')) {
                            const cells = line.split('|').filter((c) => c.trim().length > 0);
                            return (
                              <div key={idx} className="grid grid-cols-3 gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono my-1">
                                {cells.map((cell, cIdx) => (
                                  <span key={cIdx} className="font-semibold text-slate-200">{cell.trim()}</span>
                                ))}
                              </div>
                            );
                          }

                          return (
                            <p key={idx} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{line.replace(/^[•\-\*]\s*/, '')}</span>
                            </p>
                          );
                        })}
                      </div>

                      {/* ACTION LINK BUTTON */}
                      {post.external_link && (
                        <div className="pt-2">
                          <a
                            href={post.external_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow transition"
                          >
                            <span>🔗 Open Official Link / Document</span>
                            <span>→</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default function UpdatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">Loading Updates...</div>}>
      <UpdatesContent />
    </Suspense>
  );
}