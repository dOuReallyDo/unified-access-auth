import { isAdmin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

const links = [
  ['/admin', 'Overview'], ['/admin/apps', 'Apps'], ['/admin/users', 'Users'], ['/admin/access', 'Access'], ['/admin/passkeys', 'Passkeys'], ['/admin/audit', 'Audit']
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authenticated = await isAdmin();
  if (!authenticated) {
    return (
      <main style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-card">
          <h1>Admin Login</h1>
          <div className="login-form" id="admin-login-form">
            <label>
              Password
              <input type="password" id="admin-password" placeholder="Admin password" />
            </label>
            <button id="admin-login-btn">Login</button>
            <p id="admin-error" style={{ color: 'var(--danger)', display: 'none' }}></p>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var btn = document.getElementById('admin-login-btn');
            var pwd = document.getElementById('admin-password');
            var err = document.getElementById('admin-error');
            btn.addEventListener('click', async function() {
              err.style.display = 'none';
              btn.disabled = true;
              btn.textContent = 'Logging in...';
              try {
                var res = await fetch('/api/admin/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: pwd.value })
                });
                if (res.ok) { window.location.reload(); }
                else { 
                  var data = await res.json();
                  err.textContent = data.error || 'Login failed';
                  err.style.display = 'block';
                  btn.disabled = false;
                  btn.textContent = 'Login';
                }
              } catch(e) {
                err.textContent = 'Network error';
                err.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Login';
              }
            });
            pwd.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') btn.click();
            });
          })();
        `}} />
      </main>
    );
  }

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin</h1>
        <button id="admin-logout-btn" className="btn-secondary" style={{ fontSize: 13 }}>Logout</button>
      </div>
      <nav className="nav">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
      {children}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var btn = document.getElementById('admin-logout-btn');
          if (btn) btn.addEventListener('click', async function() {
            await fetch('/api/admin/logout', { method: 'POST' });
            window.location.reload();
          });
        })();
      `}} />
    </main>
  );
}