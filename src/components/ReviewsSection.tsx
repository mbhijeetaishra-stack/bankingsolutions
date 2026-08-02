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
    <section className="py-16 px-6 max-w-7xl mx-auto border-t border-slate-800/80 space-y-12">
      {/* Header & Stats Banner */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-950 border border-slate-800 p-8 rounded-3xl shadow-2xl">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 text-amber-400 border border-amber-400/20 px-3 py-1 rounded-full text-xs font-black uppercase">
            <span>⭐ Student Reviews & Ratings</span>
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-white">What Aspirants Say About BankingSolutions</h2>
          <p className="text-xs text-slate-400 max-w-md">
            Real feedback from SBI PO, IBPS PO, and RRB candidates preparing with BSPS Practice Sheets and BSCA Current Affairs.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg flex-shrink-0">
          <div className="text-4xl font-black text-amber-400">{averageRating}</div>
          <div>
            <div className="text-amber-400 text-sm">★★★★★</div>
            <p className="text-xs text-slate-300 font-bold mt-0.5">Overall Rating</p>
            <p className="text-[10px] text-slate-500">Based on student feedback</p>
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
              className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl transition"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-amber-400 text-slate-950 font-black rounded-xl flex items-center justify-center text-xs">
                      {rev.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs leading-none">{rev.user_name}</h4>
                      <span className="text-[10px] text-slate-400">{rev.exam_target}</span>
                    </div>
                  </div>

                  <div className="text-amber-400 text-xs tracking-widest font-black">
                    {'★'.repeat(rev.rating)}
                    {'☆'.repeat(5 - rev.rating)}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed italic">"{rev.comment}"</p>
              </div>

              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                Verified Aspirant • {new Date(rev.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Review Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto space-y-6 shadow-2xl">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-bold text-white">Share Your Preparation Experience</h3>
          <p className="text-xs text-slate-400">Leave a review to help other aspirants preparing for Bank Exams.</p>
        </div>

        {statusMsg && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-xl font-bold text-center">
            {statusMsg}
          </div>
        )}

        {currentUser ? (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Your Rating</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-amber-400 font-bold outline-none"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5 Stars - Excellent)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 Stars - Good)</option>
                  <option value={3}>⭐⭐⭐ (3 Stars - Average)</option>
                  <option value={2}>⭐⭐ (2 Stars - Needs Improvement)</option>
                  <option value={1}>⭐ (1 Star - Poor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Target Exam</label>
                <select
                  value={examTarget}
                  onChange={(e) => setExamTarget(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white font-bold outline-none"
                >
                  <option value="SBI PO / Clerk">SBI PO / Clerk</option>
                  <option value="IBPS PO / Clerk">IBPS PO / Clerk</option>
                  <option value="IBPS RRB PO / Clerk">IBPS RRB PO / Clerk</option>
                  <option value="RBI Grade B / Assistant">RBI Grade B / Assistant</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Your Feedback / Review</label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="How did BSPS practice sheets or BSCA current affairs help your preparation?"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg uppercase tracking-wider transition"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        ) : (
          <div className="text-center py-4 space-y-3">
            <p className="text-xs text-slate-400">Please log in or create an account to leave a review.</p>
            <button
              onClick={onOpenAuth}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition"
            >
              Log In to Write a Review
            </button>
          </div>
        )}
      </div>
    </section>
  );
}