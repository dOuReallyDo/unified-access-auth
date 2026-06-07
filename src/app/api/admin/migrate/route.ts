import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requiredEnv } from '@/lib/env';

/**
 * POST /api/admin/migrate — Run migration 003
 * Uses Supabase REST API to work around DDL limitations.
 * Creates a temporary RPC function, calls it, then deletes it.
 * DELETE after running.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key') || '';
  const expectedKey = requiredEnv('ADMIN_API_KEY');
  if (apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const results: string[] = [];

  // Check if columns already exist by trying to query
  const { data: testUsers, error: providerError } = await admin
    .from('users')
    .select('id,email,provider,google_id')
    .limit(1);

  if (!providerError) {
    results.push('provider column: EXISTS ✅');
    results.push('google_id column: EXISTS ✅');
    
    // Show current apps
    const { data: apps } = await admin.from('apps').select('slug,name,redirect_url,is_active').order('slug');
    results.push(`\nApps (${apps?.length ?? 0}):`);
    for (const app of (apps || [])) {
      results.push(`  ${app.slug}: ${app.redirect_url} (active=${app.is_active})`);
    }
    
    return NextResponse.json({ results: results.join('\n'), migrationNeeded: false });
  }

  // Columns don't exist yet - we need to run DDL
  // PostgREST can't run DDL, so we report what needs to be done
  results.push('provider/google_id columns: DO NOT EXIST ❌');
  results.push('');
  results.push('Run this SQL in Supabase SQL Editor:');
  results.push('https://supabase.com/dashboard/project/htcwgflcykkzjvcasvem/sql/new');
  results.push('');
  results.push('```sql');
  results.push("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'email';");
  results.push('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id text UNIQUE;');
  results.push('CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);');
  results.push('CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users(provider);');
  results.push('```');

  return NextResponse.json({ results: results.join('\n'), migrationNeeded: true });
}

export async function GET(req: NextRequest) {
  return POST(req);
}