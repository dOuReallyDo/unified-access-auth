import { supabaseAdmin } from './supabase';

export async function audit(event: string, data: {
  actorUserId?: string | null;
  targetUserId?: string | null;
  appId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const supabase = supabaseAdmin();
  await supabase.from('audit_logs').insert({
    event,
    actor_user_id: data.actorUserId ?? null,
    target_user_id: data.targetUserId ?? null,
    app_id: data.appId ?? null,
    metadata: data.metadata ?? {},
    ip: data.ip,
    user_agent: data.userAgent
  });
}
