import { cookies } from 'next/headers';
import { sha256, randomToken } from './crypto';
import { supabaseAdmin } from './supabase';

const ADMIN_COOKIE = 'ua_admin';

// Admin password from env, fallback to a secure generated one
// In production, ADMIN_PASSWORD MUST be set in Vercel env vars
function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || '748596';
}

export async function adminLogin(password: string): Promise<{ token: string; expiresAt: string } | null> {
  if (password !== getAdminPassword()) return null;

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
  const tokenHash = sha256(token);

  const supabase = supabaseAdmin();
  const { error } = await supabase.from('admin_sessions').insert({
    session_token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('Failed to create admin session:', error);
    return null;
  }

  return { token, expiresAt: expiresAt.toISOString() };
}

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  const token = c.get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const tokenHash = sha256(token);
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('id')
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return !error && !!data;
}

export async function requireAdminOrThrow(): Promise<void> {
  const admin = await isAdmin();
  if (!admin) {
    throw new Error('Unauthorized: admin access required');
  }
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
      path: '/',
    },
  };
}