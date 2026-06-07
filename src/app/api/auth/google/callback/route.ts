import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAppBySlug, getOrCreateUser, userHasAccess } from '@/lib/auth';
import { randomToken, sha256 } from '@/lib/crypto';
import { requestMeta } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';
import { audit } from '@/lib/audit';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/google/callback
 *
 * Handles Google OAuth callback from Supabase.
 * Exchanges the auth code, gets user info, creates/recovers UAA user,
 * and redirects to the target app with a ua_token.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateB64 = req.nextUrl.searchParams.get('state') || '';

  let appSlug = '';
  let returnTo = '';
  try {
    const stateJson = Buffer.from(stateB64, 'base64').toString();
    const stateObj = JSON.parse(stateJson);
    appSlug = stateObj.app || '';
    returnTo = stateObj.returnTo || '';
  } catch { /* ignore invalid state */ }

  if (!code) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('app', appSlug);
    loginUrl.searchParams.set('error', 'oauth_no_code');
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Exchange code for session
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });

  const { data: authData, error: authError } = await supabase.auth.exchangeCodeForSession(code);
  if (authError || !authData.session) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('app', appSlug);
    loginUrl.searchParams.set('error', 'oauth_failed');
    return NextResponse.redirect(loginUrl);
  }

  const googleUser = authData.session.user;
  const email = googleUser.email;
  if (!email) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('app', appSlug);
    loginUrl.searchParams.set('error', 'no_email');
    return NextResponse.redirect(loginUrl);
  }

  const displayName = googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || email.split('@')[0];

  // Get the app
  const app = await getAppBySlug(appSlug);
  if (!app) {
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('error', 'app_not_found');
    return NextResponse.redirect(loginUrl);
  }

  // Create or get user, linking Google account
  const user = await getOrCreateUser(email);
  const db = supabaseAdmin();
  const updateData: Record<string, string> = { provider: 'google' };
  if (displayName && displayName !== email.split('@')[0]) {
    updateData.display_name = displayName;
  }
  if (googleUser.id) {
    updateData.google_id = googleUser.id;
  }
  await db.from('users').update(updateData).eq('id', user.id);

  // Check access — auto-grant for Google-authenticated users
  let access = await userHasAccess(user.id, app.id);
  if (!access) {
    const { error: grantError } = await db.from('user_app_access').insert({
      user_id: user.id,
      app_id: app.id,
      role: 'user',
      is_active: true,
    });
    if (!grantError) {
      access = { role: 'user', is_active: true };
    } else {
      // Duplicate — recheck
      access = await userHasAccess(user.id, app.id);
      if (!access) {
        const loginUrl = new URL('/', req.url);
        loginUrl.searchParams.set('app', appSlug);
        loginUrl.searchParams.set('error', 'access_denied');
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Create session token
  const meta = await requestMeta();
  const token = randomToken();
  const trustDays = 30;
  const expiresAt = new Date(Date.now() + trustDays * 24 * 60 * 60 * 1000).toISOString();

  await db.from('trusted_devices').insert({
    user_id: user.id,
    app_id: app.id,
    device_name: `Google OAuth (${meta.userAgent?.split(' ').slice(-1)[0] || 'Browser'})`,
    device_fingerprint_hash: meta.userAgent ? sha256(meta.userAgent) : null,
    session_token_hash: sha256(token),
    expires_at: expiresAt,
  });

  await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
  await audit('session.google_oauth', { targetUserId: user.id, appId: app.id, ip: meta.ip, userAgent: meta.userAgent });

  // Set session cookie
  const c = await cookies();
  c.set('ua_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(expiresAt), path: '/' });

  // Build redirect URL
  let destination = app.redirect_url || returnTo || '/';
  if (app.redirect_url) {
    try {
      const destUrl = new URL(app.redirect_url);
      destUrl.searchParams.set('ua_token', token);
      if (returnTo) {
        try {
          if (new URL(returnTo).origin === destUrl.origin) {
            destUrl.searchParams.set('returnTo', returnTo);
          }
        } catch { /* invalid returnTo */ }
      }
      destination = destUrl.toString();
    } catch { /* invalid redirect_url */ }
  }

  return NextResponse.redirect(destination);
}