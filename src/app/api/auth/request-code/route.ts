import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppBySlug, getOrCreateUser } from '@/lib/auth';
import { jsonError, requestMeta } from '@/lib/http';
import { sendOtpEmail } from '@/lib/mail';
import { supabaseAdmin } from '@/lib/supabase';
import { audit } from '@/lib/audit';
import { sendTelegramNotification, formatApprovalMessage, formatOtpRequestedMessage } from '@/lib/telegram';

const Body = z.object({ email: z.string().email(), appSlug: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.message, 400);

  const { email, appSlug } = parsed.data;
  const meta = await requestMeta();
  const app = await getAppBySlug(appSlug);
  if (!app) return jsonError('App not found or inactive', 404);

  const user = await getOrCreateUser(email);
  const supabase = supabaseAdmin();

  // Check if user has access
  const { data: access } = await supabase
    .from('user_app_access')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('app_id', app.id)
    .eq('is_active', true)
    .maybeSingle();

  // If user has explicit access, skip approval → generate OTP directly
  if (access) {
    return await generateAndSendOTP(user, app, meta, supabase);
  }

  // User does NOT have access → create pending approval request
  const { data: existingPending, error: checkError } = await supabase
    .from('pending_approvals')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('app_id', app.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingPending) {
    // Already a pending request — return it
    return NextResponse.json({
      ok: true,
      status: 'pending_approval',
      approvalId: existingPending.id,
      message: 'Richiesta già in attesa di approvazione',
    });
  }

  // Create new pending approval
  const { data: approval, error: insertError } = await supabase
    .from('pending_approvals')
    .insert({
      user_id: user.id,
      app_id: app.id,
      user_email: user.email,
      app_slug: app.slug,
      app_name: app.name,
      request_ip: meta.ip,
      user_agent: meta.userAgent,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !approval) {
    return jsonError(insertError?.message || 'Failed to create approval request', 500);
  }

  // Send Telegram notification to admin
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://unified-access-auth-woad.vercel.app';
  const tgMessage = formatApprovalMessage({
    approvalId: approval.id,
    userEmail: user.email,
    appName: app.name,
    appSlug: app.slug,
    requestIp: meta.ip,
    userAgent: meta.userAgent,
    baseUrl,
  });
  console.log('[request-code] Sending Telegram notification, chat_id:', tgMessage.chat_id);
  const tgResult = await sendTelegramNotification(tgMessage);
  console.log('[request-code] Telegram notification result:', tgResult);

  await audit('otp.approval_requested', {
    targetUserId: user.id,
    appId: app.id,
    metadata: { approvalId: approval.id },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({
    ok: true,
    status: 'pending_approval',
    approvalId: approval.id,
    message: 'Richiesta inviata. In attesa di approvazione da un amministratore.',
  });
}

async function generateAndSendOTP(
  user: { id: string; email: string },
  app: { id: string; name: string; slug: string },
  meta: { ip: string | null; userAgent: string | null },
  supabase: ReturnType<typeof supabaseAdmin>
) {
  const { randomCode, sha256 } = await import('@/lib/crypto');
  const code = randomCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabase.from('otp_codes').insert({
    user_id: user.id,
    app_id: app.id,
    code_hash: sha256(code),
    expires_at: expires,
    request_ip: meta.ip,
    user_agent: meta.userAgent,
  });

  if (error) return jsonError(error.message, 500);

  await sendOtpEmail(user.email, code, app.name);

  // Notify admin via Telegram for every OTP request
  const tgOtpMessage = formatOtpRequestedMessage({
    userEmail: user.email,
    appName: app.name,
    appSlug: app.slug,
    requestIp: meta.ip,
    userAgent: meta.userAgent,
  });
  sendTelegramNotification(tgOtpMessage).catch((err) =>
    console.error('[request-code] Telegram OTP notification failed:', err)
  );

  await audit('otp.requested', {
    targetUserId: user.id,
    appId: app.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ ok: true, expiresAt: expires });
}