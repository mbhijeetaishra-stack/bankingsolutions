'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-8 md:p-12 space-y-6 shadow-xl">
        <Link href="/" className="text-xs font-bold text-amber-400 hover:underline inline-block mb-4">
          ← Back to Homepage
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white">Terms & Conditions</h1>
        <p className="text-xs text-slate-400">Last updated: August 2026</p>

        <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed">
          <h2 className="text-white font-bold text-base pt-2">1. Acceptance of Terms</h2>
          <p>
            By accessing and using BankingSolutions, you agree to comply with and be bound by these Terms and Conditions. If you disagree with any part of these terms, please do not use our platform.
          </p>

          <h2 className="text-white font-bold text-base pt-2">2. User Accounts & Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your login credentials. You agree not to share your account or use the platform for any unlawful activities or unauthorized distribution of proprietary practice sheets (BSPS) and current affairs PDFs (BSCA).
          </p>

          <h2 className="text-white font-bold text-base pt-2">3. Intellectual Property</h2>
          <p>
            All content on BankingSolutions—including mock test questions, computer quizzes, calculated speed drills, and proprietary PDF layouts—is the intellectual property of BankingSolutions and protected by applicable copyright laws.
          </p>

          <h2 className="text-white font-bold text-base pt-2">4. Modification of Services</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the platform, test series, or study materials at any time without prior notice.
          </p>
        </div>
      </div>
    </div>
  );
}