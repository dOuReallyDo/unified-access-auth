import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { randomToken, sha256 } from '@/lib/crypto';
import { jsonError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';
import { byteaToUint8Array, origin, rpID } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AuthenticationResponseJSON & { appSlug?: string; trustDays?: number };
  const c = await cookies();
  const expectedChallenge = c.get('webauthn_authentication_challenge')?.value;
  if (!expectedChallenge) return jsonError('Missing authentication challenge', 400);
  const supabase = supabaseAdmin();
  const { data: credential, error } = await supabase
    .from('passkey_credentials')
    .select('*, users(*)')
    .eq('credential_id', body.id)
    .single();
  if (error || !credential) return jsonError('Passkey not found', 404);
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
    credential: {
      id: credential.credential_id,
      publicKey: byteaToUint8Array(credential.public_key) as unknown as Uint8Array<ArrayBuffer>,
      counter: Number(credential.counter),
      transports: credential.transports ?? undefined
    }
  });
  if (!verification.verified) return jsonError('Authentication not verified', 401);
  await supabase.from('passkey_credentials').update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() }).eq('id', credential.id);
  let session = null;
  if (body.appSlug) {
    const { data: app } = await supabase.from('apps').select('*').eq('slug', body.appSlug).eq('is_active', true).single();
    if (!app) return jsonError('App not found or inactive', 404);
    const { data: access } = await supabase.from('user_app_access').select('*').eq('user_id', credential.user_id).eq('app_id', app.id).eq('is_active', true).maybeSingle();
    if (!access) return jsonError('User has no access to this app', 403);
    const token = randomToken();
    const expiresAt = new Date(Date.now() + (body.trustDays ?? 30) * 24 * 60 * 60 * 1000).toISOString();
    const inserted = await supabase.from('trusted_devices').insert({ user_id: credential.user_id, app_id: app.id, device_name: 'Passkey', session_token_hash: sha256(token), expires_at: expiresAt }).select('*').single();
    if (inserted.error) return jsonError(inserted.error.message, 500);
    c.set('ua_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(expiresAt), path: '/' });
    session = { token, expiresAt, app, role: access.role };
  }
  c.delete('webauthn_authentication_challenge');
  c.delete('webauthn_authentication_user');
  return NextResponse.json({ ok: true, user: credential.users, session });
}
