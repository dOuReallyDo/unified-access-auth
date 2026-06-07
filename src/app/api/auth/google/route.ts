import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/auth/google?app=<slug>&returnTo=<url>
 *
 * Initiates Google OAuth flow via Supabase Auth.
 * After Google auth, Supabase redirects to /api/auth/google/callback.
 */
export async function GET(req: NextRequest) {
  const appSlug = req.nextUrl.searchParams.get('app') || '';
  const returnTo = req.nextUrl.searchParams.get('returnTo') || '';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Build the redirect URL for the callback
  const callbackUrl = new URL('/api/auth/google/callback', req.url);
  // Preserve app and returnTo in state (passed through OAuth)
  const state = Buffer.from(JSON.stringify({ app: appSlug, returnTo })).toString('base64');

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        state,
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ ok: false, error: error?.message || 'OAuth initiation failed' }, { status: 500 });
  }

  return NextResponse.redirect(data.url);
}