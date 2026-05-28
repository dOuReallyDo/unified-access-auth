import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

async function count(table: string) {
  const { count } = await supabaseAdmin().from(table).select('*', { count: 'exact', head: true });
  return count ?? 0;
}

export default async function AdminHome() {
  const [apps, users, access, devices] = await Promise.all([count('apps'), count('users'), count('user_app_access'), count('trusted_devices')]);
  return <div className="grid grid-3">
    <div className="card"><h2>{apps}</h2><p>Apps</p></div>
    <div className="card"><h2>{users}</h2><p>Users</p></div>
    <div className="card"><h2>{access}</h2><p>Access grants</p></div>
    <div className="card"><h2>{devices}</h2><p>Trusted devices/sessions</p></div>
  </div>;
}
