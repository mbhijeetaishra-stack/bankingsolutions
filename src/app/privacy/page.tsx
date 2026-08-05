'use client';

import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-8 md:p-12 space-y-6 shadow-xl">
        <Link href="/" className="text-xs font-bold text-amber-400 hover:underline inline-block mb-4">
          ← Back to Homepage
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white">Privacy Policy</h1>
        <p className="text-xs text-slate-400">Last updated: August 2026</p>

        <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed">
          <h2 className="text-white font-bold text-base pt-2">1. Information We Collect</h2>
          <p>
            When you register, log in, or interact with BankingSolutions, we collect personal information such as your name, email address, authentication details through Supabase, and your daily target/streak progress saved locally or via your account profile.
          </p>

          <h2 className="text-white font-bold text-base pt-2">2. How We Use Your Information</h2>
          <p>
            Your information is used strictly to provide, maintain, and improve our services—including tracking your mock test scores, saving your daily checklist habits, administering the admin and student portals, and sending important announcements regarding banking examinations.
          </p>

          <h2 className="text-white font-bold text-base pt-2">3. Data Security & Storage</h2>
          <p>
            We utilize secure cloud infrastructure (Supabase with Row-Level Security) to safeguard your account credentials and personal data against unauthorized access, alteration, disclosure, or destruction.
          </p>

          <h2 className="text-white font-bold text-base pt-2">4. Third-Party Services</h2>
          <p>
            We may embed content such as YouTube video players or utilize external authentication providers. These third-party services operate under their own respective privacy policies.
          </p>

          <h2 className="text-white font-bold text-base pt-2">5. Contact Us</h2>
          <p>
            If you have any questions or concerns regarding this Privacy Policy, please reach out via our official community channels or support links.
          </p>
        </div>
      </div>
    </div>
  );
}