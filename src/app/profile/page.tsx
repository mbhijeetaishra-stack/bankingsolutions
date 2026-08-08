'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Profile Form Fields
  const [studentName, setStudentName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  async function fetchUserProfile() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      window.location.href = '/tests'; // Redirect to login/tests if not logged in
      return;
    }

    setUser(session.user);
    setEmail(session.user.email || '');

    // Fetch profile details
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('student_name, mobile_number, full_name')
      .eq('id', session.user.id)
      .single();

    if (!error && profile) {
      setStudentName(profile.student_name || profile.full_name || session.user.user_metadata?.full_name || '');
      setMobileNumber(profile.mobile_number || '');
    } else {
      // Fallback if profile row doesn't exist yet
      setStudentName(session.user.user_metadata?.full_name || '');
    }

    setLoading(false);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setStatusMsg('');

    try {
      const { error } = await supabase.from('profiles').upsert([
        {
          id: user.id,
          email: user.email,
          student_name: studentName.trim(),
          mobile_number: mobileNumber.trim(),
        }
      ], { onConflict: 'id' });

      if (error) throw error;

      setStatusMsg('✅ Profile updated successfully!');
    } catch (err: any) {
      setStatusMsg(`⚠️ Error updating profile: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-bold">
        Loading Profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-400 text-slate-950 rounded-lg flex items-center justify-center font-black text-sm shadow-md">
            BS
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">Aspirant Profile</h1>
            <p className="text-xs text-slate-400">Manage your account settings</p>
          </div>
        </div>

        <Link
          href="/tests"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-lg transition"
        >
          ← Back to Test Portal
        </Link>
      </header>

      {/* Main Form Container */}
      <main className="max-w-xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-xl space-y-6">
          <div className="border-b border-slate-700 pb-4">
            <h2 className="text-lg font-bold text-white">Personal Information</h2>
            <p className="text-xs text-slate-400">Update your display name and contact details for leaderboards.</p>
          </div>

          {statusMsg && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-xl font-bold">
              {statusMsg}
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Email Address (Locked)</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Full Name / Aspirant Name</label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#1D63B8]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Mobile Number</label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#1D63B8]"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-[#1D63B8] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition"
            >
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}