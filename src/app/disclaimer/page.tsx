'use client';

import Link from 'next/link';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-8 md:p-12 space-y-6 shadow-xl">
        <Link href="/" className="text-xs font-bold text-amber-400 hover:underline inline-block mb-4">
          ← Back to Homepage
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white">Disclaimer</h1>
        <p className="text-xs text-slate-400">Last updated: August 2026</p>

        <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed">
          <h2 className="text-white font-bold text-base pt-2">1. Educational Purpose Only</h2>
          <p>
            BankingSolutions is an independent educational platform designed to assist aspirants in preparing for competitive banking examinations (such as SBI PO/Clerk, IBPS PO/Clerk, and RBI examinations). We are not affiliated with, endorsed by, or officially connected with any government body, Institute of Banking Personnel Selection (IBPS), State Bank of India (SBI), or Reserve Bank of India (RBI).
          </p>

          <h2 className="text-white font-bold text-base pt-2">2. Accuracy of Information</h2>
          <p>
            While we strive to provide accurate mock tests, current affairs summaries, and exam notification updates, we make no representations or warranties of any kind regarding the completeness, reliability, or accuracy of the materials provided on this platform.
          </p>

          <h2 className="text-white font-bold text-base pt-2">3. Limitation of Liability</h2>
          <p>
            BankingSolutions shall not be held liable for any direct, indirect, or consequential loss or damage arising from the use of our mock tests, practice sheets, or reliance on exam notification analyses published on the website.
          </p>
        </div>
      </div>
    </div>
  );
}