import { createAppAction } from '@/lib/admin';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

export default async function AppsPage() {
  const { data: apps } = await supabaseAdmin().from('apps').select('*').order('created_at', { ascending: false });
  return <div className="grid"><section className="card"><h2>Create app</h2><form action={createAppAction} className="form-grid">
    <label>Admin key<input name="adminKey" type="password" required /></label>
    <label>Slug<input name="slug" required placeholder="my-app" /></label>
    <label>Name<input name="name" required placeholder="My App" /></label>
    <label>Redirect URL<input name="redirect_url" placeholder="https://app.example.com/callback" /></label>
    <button>Create</button></form></section>
    <table><thead><tr><th>Slug</th><th>Name</th><th>Redirect</th><th>Active</th></tr></thead><tbody>{apps?.map((app) => <tr key={app.id}><td><code>{app.slug}</code></td><td>{app.name}</td><td>{app.redirect_url}</td><td>{String(app.is_active)}</td></tr>)}</tbody></table></div>;
}
