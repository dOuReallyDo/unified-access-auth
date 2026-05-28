import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const { data } = await supabaseAdmin().from('audit_logs').select('*, users!audit_logs_target_user_id_fkey(email), apps(slug)').order('created_at', { ascending: false }).limit(100);
  return <table><thead><tr><th>Time</th><th>Event</th><th>User</th><th>App</th><th>Metadata</th></tr></thead><tbody>{data?.map((row) => <tr key={row.id}><td>{row.created_at}</td><td>{row.event}</td><td>{row.users?.email}</td><td>{row.apps?.slug}</td><td><code>{JSON.stringify(row.metadata)}</code></td></tr>)}</tbody></table>;
}
