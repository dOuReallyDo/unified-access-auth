import { createUserAction } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { data: users } = await supabaseAdmin().from('users').select('*').order('created_at', { ascending: false });
  return <div className="grid"><section className="card"><h2>Create user</h2><form action={createUserAction} className="form-grid">
    <label>Admin key<input name="adminKey" type="password" required /></label>
    <label>Email<input name="email" type="email" required /></label>
    <label>Display name<input name="display_name" /></label><button>Create</button></form></section>
    <table><thead><tr><th>Email</th><th>Name</th><th>Active</th><th>Last login</th></tr></thead><tbody>{users?.map((user) => <tr key={user.id}><td>{user.email}</td><td>{user.display_name}</td><td>{String(user.is_active)}</td><td>{user.last_login_at}</td></tr>)}</tbody></table></div>;
}
