import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { z } from 'zod';
import { getOrCreateUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';
import { rpID, rpName } from '@/lib/webauthn';

const Body = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.message);
  const user = await getOrCreateUser(parsed.data.email);
  const supabase = supabaseAdmin();
  const { data: existing } = await supabase.from('passkey_credentials').select('credential_id').eq('user_id', user.id);
  const options = await generateRegistrationOptions({
    rpName: rpName(),
    rpID: rpID(),
    userID: Buffer.from(user.id),
    userName: user.email,
    userDisplayName: user.display_name ?? user.email,
    attestationType: 'none',
    excludeCredentials: (existing ?? []).map((c) => ({ id: c.credential_id }))
  });
  const c = await cookies();
  c.set('webauthn_registration_challenge', options.challenge, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/' });
  c.set('webauthn_registration_user', user.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/' });
  return NextResponse.json(options);
}
