import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getAppBySlug, getOrCreateUser, userHasAccess } from '@/lib/auth';
import { randomToken, safeEqualHash, sha256 } from '@/lib/crypto';
import { jsonError, requestMeta } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';
import { audit } from '@/lib/audit';

const Body = z.object({
  email: z.string().email(),
  appSlug: z.string().min(1),
  code: z.string().regex(/^[A-Z2-9]{6}$/i),
  deviceName: z.string().optional(),
  trustDays: z.number().int().min(1).max(90).optional()
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.message);
  const { email, appSlug, code, deviceName, trustDays = 30 } = parsed.data;
  const meta = await requestMeta();
  const app = await getAppBySlug(appSlug);
  if (!app) return jsonError('App not found or inactive', 404);
  const user = await getOrCreateUser(email);
  const access = await userHasAccess(user.id, app.id);
  if (!access) return jsonError('User has no access to this app', 403);
  const supabase = supabaseAdmin();
  const { data: otp, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('user_id', user.id)
    .eq('app_id', app.id)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!otp || otp.attempts >= 5) return jsonError('Invalid or expired code', 401);
  if (!safeEqualHash(code, otp.code_hash)) {
    await supabase.from('otp_codes').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
    await audit('otp.verify_failed', { targetUserId: user.id, appId: app.id, ip: meta.ip, userAgent: meta.userAgent });
    return jsonError('Invalid or expired code', 401);
  }
  const token = randomToken();
  const expiresAt = new Date(Date.now() + trustDays * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);
  const { data: device, error: deviceError } = await supabase.from('trusted_devices').insert({
    user_id: user.id,
    app_id: app.id,
    device_name: deviceName ?? null,
    device_fingerprint_hash: meta.userAgent ? sha256(meta.userAgent) : null,
    session_token_hash: sha256(token),
    expires_at: expiresAt
  }).select('*').single();
  if (deviceError) return jsonError(deviceError.message, 500);
  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
  await audit('session.created', { targetUserId: user.id, appId: app.id, metadata: { deviceId: device.id }, ip: meta.ip, userAgent: meta.userAgent });
  const c = await cookies();
  c.set('ua_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', expires: new Date(expiresAt), path: '/' });
  return NextResponse.json({ ok: true, token, expiresAt, user: { id: user.id, email: user.email }, app: { id: app.id, slug: app.slug, name: app.name, redirect_url: app.redirect_url }, role: access.role });
}
