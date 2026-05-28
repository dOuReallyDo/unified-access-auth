import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function requestMeta() {
  const h = await headers();
  return {
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent') ?? null
  };
}

export async function bearerOrCookieToken(): Promise<string | null> {
  const h = await headers();
  const auth = h.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const c = await cookies();
  return c.get('ua_session')?.value ?? null;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
