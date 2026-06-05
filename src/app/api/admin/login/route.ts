import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { adminLogin, adminCookieOptions } from '@/lib/admin-auth';

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const result = await adminLogin(parsed.data.password);
  if (!result) return NextResponse.json({ error: 'Invalid password' }, { status: 401 });

  const c = await cookies();
  c.set(adminCookieOptions(result.token, result.expiresAt));

  return NextResponse.json({ ok: true, expiresAt: result.expiresAt });
}