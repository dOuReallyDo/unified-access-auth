import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ ok: true, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() });
}
