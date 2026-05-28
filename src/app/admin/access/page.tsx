import { grantAccessAction } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const supabase = supabaseAdmin();
  const [{ data: users }, { data: apps }, { data: grants }] = await Promise.all([
    supabase.from('users').select('*').order('email'),
    supabase.from('apps').select('*').order('slug'),
    supabase.from('user_app_access').select('*, users(email), apps(slug,name)').order('granted_at', { ascending: false })
  ]);
  return <div className="grid"><section className="card"><h2>Grant access</h2><form action={grantAccessAction} className="form-grid">
    <label>Admin key<input name="adminKey" type="password" required /></label>
    <label>User<select name="user_id" required>{users?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}</select></label>
    <label>App<select name="app_id" required>{apps?.map((a) => <option key={a.id} value={a.id}>{a.slug}</option>)}</select></label>
    <label>Role<input name="role" defaultValue="user" /></label><button>Grant</button></form></section>
    <table><thead><tr><th>User</th><th>App</th><th>Role</th><th>Active</th></tr></thead><tbody>{grants?.map((g) => <tr key={g.id}><td>{g.users?.email}</td><td>{g.apps?.slug}</td><td>{g.role}</td><td>{String(g.is_active)}</td></tr>)}</tbody></table></div>;
}
