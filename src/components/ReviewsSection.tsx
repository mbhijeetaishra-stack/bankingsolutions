'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  user_name: string;
  rating: number;
  comment: string;
  exam_target: string;
  created_at: string;
}

export default function ReviewsSection({ currentUser, onOpenAuth }: { currentUser: any; onOpenAuth: () => void }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Form States
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [examTarget, setExamTarget] = useState('SBI PO / IBPS PO');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    setLoading(true);
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (data) setReviews(data as Review[]);
    setLoading(false);
  }

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return onOpenAuth();
    if (!comment.trim()) return setStatusMsg('⚠️ Please enter a review comment!');

    setSubmitting(true);
    setStatusMsg('');

    const userName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Aspirant';

    const { error } = await supabase.from('reviews').insert([
      {
        user_id: currentUser.id,
        user_name: userName,
        rating: Number(rating),
        comment: comment.trim(),
        exam_target: examTarget,
      },
    ]);

    if (error) {
      setStatusMsg(`Error: ${error.message}`);
    } else {
      setStatusMsg('🎉 Thank you for your review!');
      setComment('');
      fetchReviews();
    }
    setSubmitting(false);
  }

  // Calculate Average Rating
  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <section className="max-w-7xl mx-auto space-y-12">
      {/* Header & Stats Banner */}
      <div className="relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 border border-white/[0.08] p-8 sm:p-10 rounded-3xl shadow-2xl">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="space-y-2.5 text-center md:text-left relative">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 text-amber-300 border border-amber-400/25 px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider">
            <span>⭐ Student Reviews &amp; Ratings</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            What Aspirants Say About BankingSolutions
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg leading-relaxed">
            Real feedback from SBI PO, IBPS PO, and RRB candidates preparing with BSPS Practice Sheets and BSCA Current Affairs.
          </p>
        </div>

        <div className="flex items-center gap-5 bg-slate-950/90 border border-amber-400/25 px-7 py-5 rounded-2xl shadow-xl flex-shrink-0 relative">
          <div className="text-4xl sm:text-5xl font-black bg-gradient-to-b from-amber-300 to-amber-500 bg-clip-text text-transparent">
            {averageRating}
          </div>
          <div className="text-left">
            <div className="text-amber-400 text-base tracking-widest">★★★★★</div>
            <p className="text-xs text-white font-bold mt-0.5">Overall Rating</p>
            <p className="text-[11px] text-slate-400">Verified student feedback</p>
          </div>
        </div>
      </div>

      {/* Reviews Grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((rev) => (
            <div
              key={rev.id}
              className="bg-slate-900/60 backdrop-blur-md border border-white/[0.08] hover:border-amber-400/30 rounded-3xl p-6 flex flex-col justify-between space-y-5 shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="space-y-3.5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-sm shadow-md">
                      {rev.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-white text-xs sm:text-sm leading-tight">{rev.user_name}</h4>
                      <span className="text-[11px] text-amber-400/80 font-medium">{rev.exam_target}</span>
                    </div>
                  </div>

                  <div className="text-amber-400 text-xs tracking-widest font-black bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed text-left">
                  &ldquo;{rev.comment}&rdquo;
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-white/[0.06]">
                <span className="text-emerald-400/90 font-semibold">✓ Verified Aspirant</span>
                <span>{new Date(rev.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Review Card */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-white/[0.08] rounded-3xl p-8 max-w-2xl mx-auto space-y-6 shadow-2xl">
        <div className="text-center space-y-1.5">
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">Share Your Preparation Experience</h3>
          <p className="text-xs text-slate-400">Leave a review to help fellow aspirants preparing for Banking Exams.</p>
        </div>

        {statusMsg && (
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs rounded-xl font-bold text-center">
            {statusMsg}
          </div>
        )}

        {currentUser ? (
          <form onSubmit={handleSubmitReview} className="space-y-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3 text-xs text-amber-400 font-bold outline-none focus:border-amber-400 transition"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5 Stars - Excellent)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 Stars - Good)</option>
                  <option value={3}>⭐⭐⭐ (3 Stars - Average)</option>
                  <option value={2}>⭐⭐ (2 Stars - Needs Improvement)</option>
                  <option value={1}>⭐ (1 Star - Poor)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Target Exam</label>
                <select
                  value={examTarget}
                  onChange={(e) => setExamTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3 text-xs text-white font-bold outline-none focus:border-amber-400 transition"
                >
                  <option value="SBI PO / Clerk">SBI PO / Clerk</option>
                  <option value="IBPS PO / Clerk">IBPS PO / Clerk</option>
                  <option value="IBPS RRB PO / Clerk">IBPS RRB PO / Clerk</option>
                  <option value="RBI Grade B / Assistant">RBI Grade B / Assistant</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Your Feedback / Review</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How did BSPS practice sheets or BSCA current affairs help your preparation?"
                className="w-full bg-slate-950 border border-white/[0.1] rounded-xl p-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 uppercase tracking-wider transition"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-slate-400">Please log in or create an account to leave a review.</p>
            <button
              onClick={onOpenAuth}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition"
            >
              Log In to Write a Review
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
