import { createAppAction, toggleAppActiveAction } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function AppsPage() {
  const { data: apps } = await supabaseAdmin().from('apps').select('*').order('created_at', { ascending: false });
  return <div className="grid">
    <section className="card">
      <h2>Create app</h2>
      <form action={createAppAction} className="form-grid">
        <label>Slug<input name="slug" required placeholder="my-app" /></label>
        <label>Name<input name="name" required placeholder="My App" /></label>
        <label>Redirect URL<input name="redirect_url" placeholder="https://app.example.com/callback" /></label>
        <button>Create</button>
      </form>
    </section>
    <table>
      <thead><tr><th>Slug</th><th>Name</th><th>Redirect</th><th>Active</th><th></th></tr></thead>
      <tbody>{apps?.map((app: { id: string; slug: string; name: string; redirect_url: string | null; is_active: boolean }) => (
        <tr key={app.id}>
          <td><code>{app.slug}</code></td>
          <td>{app.name}</td>
          <td>{app.redirect_url}</td>
          <td>{app.is_active ? '✅' : '❌'}</td>
          <td>
            <form action={toggleAppActiveAction} style={{ display: 'inline' }}>
              <input type="hidden" name="id" value={app.id} />
              <input type="hidden" name="is_active" value={String(app.is_active)} />
              <button type="submit" className="btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}>
                {app.is_active ? 'Disable' : 'Enable'}
              </button>
            </form>
          </td>
        </tr>
      ))}</tbody>
    </table>
  </div>;
}