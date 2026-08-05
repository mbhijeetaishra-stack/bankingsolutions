'use client';

import Link from 'next/link';

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-8 md:p-12 space-y-6 shadow-xl">
        <Link href="/" className="text-xs font-bold text-amber-400 hover:underline inline-block mb-4">
          ← Back to Homepage
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white">Refund & Cancellation Policy</h1>
        <p className="text-xs text-slate-400">Last updated: August 2026</p>

        <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed">
          <h2 className="text-white font-bold text-base pt-2">1. Digital Goods & Services</h2>
          <p>
            BankingSolutions provides digital educational resources, downloadable practice sheets (BSPS), current affairs documents (BSCA), and online test series access. Because these are immediate digital deliveries, all purchases and subscriptions are generally final.
          </p>

          <h2 className="text-white font-bold text-base pt-2">2. Cancellation Policy</h2>
          <p>
            Users may cancel their account or stop utilizing free/paid practice portals at any time. Active subscriptions or automated renewals (if applicable) can be terminated through your user account dashboard.
          </p>

          <h2 className="text-white font-bold text-base pt-2">3. Refund Eligibility</h2>
          <p>
            Refunds are evaluated on a case-by-case basis only if a technical error on our platform prevented you from accessing purchased materials or test series. If you encounter any billing disputes or technical lockouts, please contact our support desk immediately.
          </p>
        </div>
      </div>
    </div>
  );
}