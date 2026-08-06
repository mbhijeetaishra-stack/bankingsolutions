import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/tests';

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    
    if (!error) {
      // Successfully verified! Redirecting to tests page or next destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If verification fails, redirect back home with an error flag
  return NextResponse.redirect(`${origin}/?error=verification_failed`);
}