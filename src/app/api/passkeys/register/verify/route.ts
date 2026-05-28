import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { jsonError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';
import { origin, rpID, uint8ArrayToBytea } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RegistrationResponseJSON & { deviceName?: string };
  const c = await cookies();
  const expectedChallenge = c.get('webauthn_registration_challenge')?.value;
  const userId = c.get('webauthn_registration_user')?.value;
  if (!expectedChallenge || !userId) return jsonError('Missing registration challenge', 400);
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID()
  });
  if (!verification.verified || !verification.registrationInfo) return jsonError('Registration not verified', 401);
  const { credential } = verification.registrationInfo;
  const supabase = supabaseAdmin();
  const { error } = await supabase.from('passkey_credentials').insert({
    user_id: userId,
    credential_id: credential.id,
    public_key: uint8ArrayToBytea(credential.publicKey),
    counter: credential.counter,
    transports: body.response.transports ?? null,
    device_name: body.deviceName ?? null
  });
  if (error) return jsonError(error.message, 500);
  c.delete('webauthn_registration_challenge');
  c.delete('webauthn_registration_user');
  return NextResponse.json({ ok: true });
}
