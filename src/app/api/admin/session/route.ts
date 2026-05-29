import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { cookies } from 'next/headers';

export async function POST() {
  const authenticated = await isAdmin();
  if (!authenticated) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json({ ok: true, authenticated: true });
}