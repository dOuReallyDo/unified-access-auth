import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminLogin, adminCookieOptions } from '@/lib/admin-auth';
import { jsonError } from '@/lib/http';
import { cookies } from 'next/headers';

const Body = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return jsonError(parsed.error.message);
  
  const result = await adminLogin(parsed.data.password);
  if (!result) return jsonError('Invalid admin credentials', 401);
  
  const cookieOpts = adminCookieOptions(result.token, result.expiresAt);
  const c = await cookies();
  c.set(cookieOpts.name, cookieOpts.value, cookieOpts.options);
  
  return NextResponse.json({ ok: true, expiresAt: result.expiresAt });
}