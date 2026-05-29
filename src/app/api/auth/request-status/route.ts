import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '@/lib/http';
import { supabaseAdmin } from '@/lib/supabase';

const Query = z.object({
  approvalId: z.string().uuid(),
  email: z.string().email(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = Query.safeParse({
    approvalId: searchParams.get('approvalId'),
    email: searchParams.get('email'),
  });

  if (!parsed.success) return jsonError(parsed.error.message, 400);
  const { approvalId, email } = parsed.data;

  const supabase = supabaseAdmin();

  const { data: approval, error } = await supabase
    .from('pending_approvals')
    .select('id, status, user_email')
    .eq('id', approvalId)
    .eq('user_email', email)
    .maybeSingle();

  if (error || !approval) {
    return jsonError('Approval request not found', 404);
  }

  if (approval.status === 'approved') {
    // Also check if OTP was generated
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    return NextResponse.json({
      status: 'approved',
      message: 'Accesso approvato. Puoi richiedere un nuovo codice OTP.',
    });
  }

  if (approval.status === 'rejected') {
    return NextResponse.json({
      status: 'rejected',
      message: 'Richiesta di accesso negata.',
    });
  }

  return NextResponse.json({
    status: 'pending',
    message: 'In attesa di approvazione da un amministratore.',
  });
}