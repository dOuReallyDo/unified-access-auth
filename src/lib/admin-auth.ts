import { cookies } from 'next/headers';
import { sha256, randomToken } from './crypto';
import { requiredEnv } from './env';
import { supabaseAdmin } from './supabase';
import { audit } from './audit';

const ADMIN_COOKIE = 'ua_admin';

/**
 * Admin auth strategy:
 * Phase 1 (now): Simple password → cookie with the password hash.
 *   Falls back gracefully if admin_sessions table doesn't exist yet.
 * Phase 2 (later): Full session table with expiry, IP tracking etc.
 * 
 * For now: admin logs in with ADMIN_API_KEY → we set a secure cookie
 * with a derived token. Subsequent requests validate the cookie.
 */

export async function adminLogin(password: string): Promise<{ token: string; expiresAt: string } | null> {
  const configured = requiredEnv('ADMIN_API_KEY');
  if (password !== configured) {
    await audit('admin.login_failed', {});
    return null;
  }
  // Create a derived session token (not the raw password)
  const token = `adm_${randomToken(24)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  // Try to store in admin_sessions table; if table doesn't exist that's OK
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('admin_sessions').insert({
    session_token_hash: sha256(token),
    expires_at: expiresAt,
  });
  
  // If table doesn't exist, we store a signed cookie with the password hash
  // This is still better than sending the raw key in every form
  const useFallback = !!error;
  
  await audit('admin.login', { metadata: { fallback: useFallback } });
  return { token: useFallback ? sha256(configured) : token, expiresAt };
}

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  
  const configured = requiredEnv('ADMIN_API_KEY');
  
  // Fallback: cookie contains the hash of the ADMIN_API_KEY
  if (token === sha256(configured)) return true;
  
  // Full mode: check admin_sessions table
  const supabase = supabaseAdmin();
  const { data } = await supabase.from('admin_sessions')
    .select('*')
    .eq('session_token_hash', sha256(token))
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  
  return !!data;
}

export async function requireAdminOrThrow(): Promise<void> {
  const ok = await isAdmin();
  if (!ok) throw new Error('Admin authentication required');
}

export function adminCookieOptions(token: string, expiresAt: string) {
  return { 
    name: ADMIN_COOKIE, 
    value: token, 
    options: { 
      httpOnly: true as const, 
      sameSite: 'lax' as const, 
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(expiresAt),
      path: '/' 
    }
  };
}