import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING';
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasService = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonLen = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').length;
  const svcLen = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length;
  
  // Try to connect
  let dbStatus = 'unknown';
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { count, error } = await supabase.from('apps').select('*', { count: 'exact', head: true });
    if (error) dbStatus = `error: ${error.message}`;
    else dbStatus = `ok (${count} apps)`;
  } catch (e: any) {
    dbStatus = `exception: ${e.message}`;
  }

  return NextResponse.json({
    supabaseUrl: url,
    hasAnonKey: hasAnon,
    hasServiceKey: hasService,
    anonKeyLength: anonLen,
    serviceKeyLength: svcLen,
    dbStatus,
  });
}