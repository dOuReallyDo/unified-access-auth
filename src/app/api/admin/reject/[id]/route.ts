import { NextRequest, NextResponse } from 'next/server';
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

  // Reject: mark as rejected
  await supabase
    .from('pending_approvals')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id);

  await audit('otp.approval_rejected', {
    targetUserId: approval.user_id,
    appId: approval.app_id,
    metadata: { approvalId: id },
  });

  return new Response(
    `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
      <h1>❌ Rifiutato</h1>
      <p><strong>${approval.user_email}</strong> → <strong>${approval.app_name}</strong></p>
      <p>Accesso negato.</p>
      <p><a href="/admin">Torna alla dashboard</a></p>
      </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}