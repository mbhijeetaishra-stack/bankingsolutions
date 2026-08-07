import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/tests';

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    });
    
    if (!error && data?.user) {
      // Safely create/update the profile record
      await supabase.from('profiles').upsert([
        {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || 'Aspirant',
          role: 'student',
          is_admin: false,
        }
      ], { onConflict: 'id' });

      // Redirect with ?verified=true so the popup triggers
      return NextResponse.redirect(`${origin}${next}?verified=true`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=verification_failed`);
}