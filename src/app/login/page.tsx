import { redirect } from 'next/navigation';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ app?: string; returnTo?: string }> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.app) params.set('app', sp.app);
  if (sp.returnTo) params.set('returnTo', sp.returnTo);
  const qs = params.toString();
  redirect(qs ? `/?${qs}` : '/');
}