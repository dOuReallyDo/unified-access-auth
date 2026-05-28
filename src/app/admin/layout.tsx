const links = [
  ['/admin', 'Overview'], ['/admin/apps', 'Apps'], ['/admin/users', 'Users'], ['/admin/access', 'Access'], ['/admin/passkeys', 'Passkeys'], ['/admin/audit', 'Audit']
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <main><h1>Admin</h1><nav className="nav">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>{children}</main>;
}
