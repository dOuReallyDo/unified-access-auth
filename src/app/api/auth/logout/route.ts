import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sha256 } from '@/lib/crypto';
import { bearerOrCookieToken, jsonError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  const token = await bearerOrCookieToken();
  if (!token) return jsonError('Missing session token', 401);
  const supabase = supabaseAdmin();
  await supabase.from('trusted_devices').update({ revoked_at: new Date().toISOString() }).eq('session_token_hash', sha256(token));
  const c = await cookies();
  c.delete('ua_session');
  return NextResponse.json({ ok: true });
}
