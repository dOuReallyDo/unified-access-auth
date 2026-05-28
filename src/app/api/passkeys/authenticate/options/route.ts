import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { z } from 'zod';
import { getOrCreateUser } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';
import { rpID } from '@/lib/webauthn';

const Body = z.object({ email: z.string().email().optional() });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.message);
  const supabase = supabaseAdmin();
  let credentials: { credential_id: string; transports: string[] | null; user_id: string }[] | null = null;
  let userId: string | null = null;
  if (parsed.data.email) {
    const user = await getOrCreateUser(parsed.data.email);
    userId = user.id;
    const { data } = await supabase.from('passkey_credentials').select('credential_id,transports,user_id').eq('user_id', user.id);
    credentials = data;
  }
  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    allowCredentials: credentials?.map((c) => ({ id: c.credential_id, transports: (c.transports ?? undefined) as AuthenticatorTransport[] }))
  });
  const c = await cookies();
  c.set('webauthn_authentication_challenge', options.challenge, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/' });
  if (userId) c.set('webauthn_authentication_user', userId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/' });
  return NextResponse.json(options);
}
