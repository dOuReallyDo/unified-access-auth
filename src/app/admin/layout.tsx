const links = [
  ['/admin', 'Overview'], ['/admin/apps', 'Apps'], ['/admin/users', 'Users'], ['/admin/access', 'Access'], ['/admin/passkeys', 'Passkeys'], ['/admin/audit', 'Audit']
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin</h1>
      </div>
      <nav className="nav">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
      {children}
    </main>
  );
}
