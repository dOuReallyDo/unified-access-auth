import { createUserAction, toggleUserActiveAction } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { data: users } = await supabaseAdmin().from('users').select('*').order('created_at', { ascending: false });
  return <div className="grid">
    <section className="card">
      <h2>Create user</h2>
      <form action={createUserAction} className="form-grid">
        <label>Email<input name="email" type="email" required /></label>
        <label>Display name<input name="display_name" /></label>
        <button>Create</button>
      </form>
    </section>
    <table>
      <thead><tr><th>Email</th><th>Name</th><th>Active</th><th>Last login</th><th></th></tr></thead>
      <tbody>{users?.map((user: { id: string; email: string; display_name: string | null; is_active: boolean; last_login_at: string | null }) => (
        <tr key={user.id}>
          <td>{user.email}</td>
          <td>{user.display_name}</td>
          <td>{user.is_active ? '✅' : '❌'}</td>
          <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—'}</td>
          <td>
            <form action={toggleUserActiveAction} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="is_active" value={String(user.is_active)} />
              <button type="submit" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                {user.is_active ? 'Suspend' : 'Activate'}
              </button>
            </form>
          </td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}