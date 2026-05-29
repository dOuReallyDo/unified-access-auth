import { grantAccessAction, toggleAccessActiveAction } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const supabase = supabaseAdmin();
  const [{ data: users }, { data: apps }, { data: grants }] = await Promise.all([
    supabase.from('users').select('*').order('email'),
    supabase.from('apps').select('*').order('slug'),
    supabase.from('user_app_access').select('*, users(email), apps(slug,name)').order('granted_at', { ascending: false })
  ]);
  return <div className="grid">
    <section className="card">
      <h2>Grant access</h2>
      <form action={grantAccessAction} className="form-grid">
        <label>User<select name="user_id" required>{users?.map((u: { id: string; email: string }) => <option key={u.id} value={u.id}>{u.email}</option>)}</select></label>
        <label>App<select name="app_id" required>{apps?.map((a: { id: string; slug: string; name: string }) => <option key={a.id} value={a.id}>{a.slug} — {a.name}</option>)}</select></label>
        <label>Role<input name="role" defaultValue="user" /></label>
        <button>Grant</button>
      </form>
    </section>
    <table>
      <thead><tr><th>User</th><th>App</th><th>Role</th><th>Active</th><th></th></tr></thead>
      <tbody>{grants?.map((g: { id: string; users: { email: string } | { email: string }[]; apps: { slug: string } | { slug: string }[]; role: string; is_active: boolean }) => {
        const userEmail = Array.isArray(g.users) ? g.users[0]?.email : g.users?.email;
        const appSlug = Array.isArray(g.apps) ? (g.apps[0] as { slug: string })?.slug : (g.apps as { slug: string })?.slug;
        return (
          <tr key={g.id}>
            <td>{userEmail}</td>
            <td>{appSlug}</td>
            <td>{g.role}</td>
            <td>{g.is_active ? '✅' : '❌'}</td>
            <td>
              <form action={toggleAccessActiveAction} style={{ display: 'inline' }}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="is_active" value={String(g.is_active)} />
                <button type="submit" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                  {g.is_active ? 'Revoke' : 'Restore'}
                </button>
              </form>
            </td>
          </tr>
        );
      })}</tbody>
    </table>
  </div>;
}