import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No API key' });
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    return NextResponse.json({ domains: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
