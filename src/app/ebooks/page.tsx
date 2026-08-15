'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface EBook {
  id: string;
  title: string;
  author: string;
  description: string;
  cover_url: string;
  pdf_url: string;
  price: number;
}

export default function EBooksStorePage() {
  const [ebooks, setEbooks] = useState<EBook[]>([]);
  const [purchasedEBookIds, setPurchasedEBookIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEBooksAndPurchases();
  }, []);

  async function fetchEBooksAndPurchases() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      setCurrentUserId(session.user.id);

      // Fetch student's purchased ebooks
      const { data: purchases } = await supabase
        .from('student_ebook_purchases')
        .select('ebook_id')
        .eq('user_id', session.user.id);

      if (purchases) {
        setPurchasedEBookIds(purchases.map((p) => p.ebook_id));
      }
    }

    // Fetch all e-books
    const { data: booksData } = await supabase
      .from('ebooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (booksData) {
      setEbooks(booksData);
    }
    setLoading(false);
  }

  const handleBuyEBook = async (book: EBook) => {
    if (!currentUserId) {
      alert('Please log in to your account first to purchase this e-book!');
      return;
    }

    setProcessingId(book.id);
    const amountInPaise = Math.round(book.price * 100);

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
      amount: amountInPaise,
      currency: 'INR',
      name: 'BankingSolutions',
      description: `Purchase E-Book: ${book.title}`,
      handler: async function (response: any) {
        const { error } = await supabase.from('student_ebook_purchases').insert([
          {
            user_id: currentUserId,
            ebook_id: book.id,
            amount_paid: book.price,
            payment_id: response.razorpay_payment_id,
          },
        ]);

        if (error) {
          console.error("Purchase DB Error:", error);
          alert(`Payment received, but DB error: ${error.message}`);
        } else {
          setPurchasedEBookIds((prev) => [...prev, book.id]);
          alert('🎉 Payment Successful! E-Book unlocked permanently.');
        }
        setProcessingId(null);
      },
      prefill: {
        name: 'Banking Aspirant',
        email: '',
      },
      theme: { color: '#1D63B8' },
    };

    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } else {
      alert('Razorpay SDK failed to load.');
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mr-3"></div>
        Loading E-Book Store...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col selection:bg-amber-400 selection:text-slate-950">
      
      {/* HEADER */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 rounded-xl flex items-center justify-center font-black text-sm shadow-inner">
            BS
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold text-white tracking-tight">BankingSolutions E-Book Store</h1>
            <p className="text-[10px] md:text-[11px] text-slate-400 font-medium">Exam-Oriented Comprehensive Guides & Compilations</p>
          </div>
        </div>

        <Link
          href="/"
          className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-bold text-xs rounded-xl transition border border-blue-500/30 flex items-center gap-1.5"
        >
          <span>← Back to Home</span>
        </Link>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-12 space-y-8">
        <div className="text-center space-y-3 max-w-xl mx-auto">
          <span className="bg-amber-400/10 text-amber-400 border border-amber-400/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            📖 Premium Study Material
          </span>
          <h2 className="text-3xl font-black text-white tracking-tight">Expand Your Preparation Library</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Purchase expertly authored e-books with complete computer awareness, Banking Awareness compendiums, strategic exam shortcuts and many more.
          </p>
        </div>

        {ebooks.length === 0 ? (
          <div className="text-center py-20 bg-slate-950 border border-slate-800 rounded-3xl space-y-3">
            <span className="text-4xl">📚</span>
            <p className="text-xs text-slate-400">No e-books available for purchase right now. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ebooks.map((book) => {
              const isPurchased = purchasedEBookIds.includes(book.id);
              const isBuying = processingId === book.id;

              return (
                <div key={book.id} className="bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-6 shadow-xl hover:border-slate-700 transition">
                  <div className="space-y-4">
                    {book.cover_url && (
                      <div className="relative w-full h-52 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                        <img src={book.cover_url} alt={book.title} className="h-full object-cover rounded-xl" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          By {book.author || 'BankingSolutions'}
                        </span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          ₹{book.price}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-white text-base leading-snug">{book.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{book.description}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    {isPurchased ? (
                      <a
                        href={book.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl transition text-center block shadow-sm"
                      >
                        ✨ Download E-Book PDF ↓
                      </a>
                    ) : (
                      <button
                        onClick={() => handleBuyEBook(book)}
                        disabled={isBuying}
                        className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-lg transition transform hover:scale-[1.02]"
                      >
                        {isBuying ? 'Processing Payment...' : `🚀 Buy Now for ₹${book.price}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-800 py-6 px-6 text-center text-xs text-slate-500">
        © 2026 BankingSolutions. All rights reserved.
      </footer>
    </div>
  );
}