import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppBySlug, getOrCreateUser, userHasAccess } from '@/lib/auth';
import { randomCode, sha256 } from '@/lib/crypto';
import { jsonError, requestMeta } from '@/lib/http';
import { sendOtpEmail } from '@/lib/mail';
import { supabaseAdmin } from '@/lib/supabase';
import { audit } from '@/lib/audit';

const Body = z.object({ email: z.string().email(), appSlug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.message);
  const { email, appSlug } = parsed.data;
  const meta = await requestMeta();
  const app = await getAppBySlug(appSlug);
  if (!app) return jsonError('App not found or inactive', 404);
  const user = await getOrCreateUser(email);
  const access = await userHasAccess(user.id, app.id);
  if (!access) {
    await audit('otp.denied.no_access', { targetUserId: user.id, appId: app.id, ip: meta.ip, userAgent: meta.userAgent });
    return jsonError('User has no access to this app', 403);
  }
  const code = randomCode();
  const supabase = supabaseAdmin();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from('otp_codes').insert({
    user_id: user.id,
    app_id: app.id,
    code_hash: sha256(code),
    expires_at: expires,
    request_ip: meta.ip,
    user_agent: meta.userAgent
  });
  if (error) return jsonError(error.message, 500);
  await sendOtpEmail(user.email, code, app.name);
  await audit('otp.requested', { targetUserId: user.id, appId: app.id, ip: meta.ip, userAgent: meta.userAgent });
  return NextResponse.json({ ok: true, expiresAt: expires });
}
