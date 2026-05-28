import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { bearerOrCookieToken, jsonError } from '@/lib/http';

export async function GET(req: NextRequest) {
  const token = await bearerOrCookieToken();
  if (!token) return jsonError('Missing session token', 401);
  const appSlug = req.nextUrl.searchParams.get('appSlug') ?? undefined;
  const session = await validateSession(token, appSlug);
  if (!session) return jsonError('Invalid session', 401);
  return NextResponse.json({ ok: true, session });
}
