'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function VerifyPage() {
  const [status, setStatus] = useState('Verifying your account...');
  const router = useRouter();

  useEffect(() => {
    // Supabase automatically parses tokens from URL hashes/query params on load
    const handleAuthVerification = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error || !data.session) {
        // If hash tokens need manual handling or exchange
        const { error: sessionError } = await supabase.auth.getUser();
        if (sessionError) {
          setStatus('Verification link expired or invalid.');
          return;
        }
      }

      setStatus('Success! Redirecting to your targets...');
      setTimeout(() => {
        router.push('/targets');
      }, 1500);
    };

    handleAuthVerification();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
        <h1 className="text-xl font-bold text-amber-400">⚡ BankingSolutions Verification</h1>
        <p className="text-sm text-slate-300">{status}</p>
      </div>
    </div>
  );
}