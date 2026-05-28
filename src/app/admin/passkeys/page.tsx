import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function PasskeysPage() {
  const { data } = await supabaseAdmin().from('passkey_credentials').select('id,credential_id,device_name,last_used_at,created_at,users(email)').order('created_at', { ascending: false });
  return <table><thead><tr><th>User</th><th>Credential</th><th>Device</th><th>Last used</th></tr></thead><tbody>{data?.map((p) => {
    const user = Array.isArray(p.users) ? p.users[0] : p.users;
    return <tr key={p.id}><td>{user?.email}</td><td><code>{String(p.credential_id).slice(0, 18)}…</code></td><td>{p.device_name}</td><td>{p.last_used_at}</td></tr>;
  })}</tbody></table>;
}
