import { NextRequest, NextResponse } from 'next/server';
import { getAppBySlug, getOrCreateUser } from '@/lib/auth';
import { randomCode, sha256 } from '@/lib/crypto';
import { jsonError } from '@/lib/http';
import { sendOtpEmail } from '@/lib/mail';
import { supabaseAdmin } from '@/lib/supabase';
import { audit } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  // Get the pending approval
  const { data: approval, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !approval) {
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h1>❌ Errore</h1>
        <p>Richiesta non trovata.</p>
        </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (approval.status !== 'pending') {
    const msg = approval.status === 'approved' ? '✅ Già approvata' : '❌ Già rifiutata';
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h1>${msg}</h1>
        <p>Questa richiesta è già stata ${approval.status === 'approved' ? 'approvata' : 'rifiutata'}.</p>
        </body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  // Approve: mark approval, grant access, generate OTP
  await supabase
    .from('pending_approvals')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id);

  // Grant user access to the app
  const { data: existingAccess } = await supabase
    .from('user_app_access')
    .select('id')
    .eq('user_id', approval.user_id)
    .eq('app_id', approval.app_id)
    .maybeSingle();

  if (!existingAccess) {
    await supabase.from('user_app_access').insert({
      user_id: approval.user_id,
      app_id: approval.app_id,
      role: 'user',
      is_active: true,
    });
  }

  // Generate OTP
  const user = await getOrCreateUser(approval.user_email);
  const app = await getAppBySlug(approval.app_slug);
  if (!app) return jsonError('App not found', 404);

  const code = randomCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await supabase.from('otp_codes').insert({
    user_id: user.id,
    app_id: app.id,
    code_hash: sha256(code),
    expires_at: expires,
  });

  // Send OTP via email
  await sendOtpEmail(user.email, code, app.name);

  await audit('otp.approval_granted', {
    targetUserId: user.id,
    appId: app.id,
    metadata: { approvalId: id },
  });

  return new Response(
    `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h1>✅ Approvato!</h1>
      <p><strong>${approval.user_email}</strong> → <strong>${approval.app_name}</strong></p>
      <p>Codice OTP inviato a ${approval.user_email}</p>
      <p><a href="/admin">Torna alla dashboard</a></p>
      </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}