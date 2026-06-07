import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requiredEnv } from '@/lib/env';

/**
 * GET /api/admin/migrate — One-shot migration endpoint
 * Adds provider and google_id columns to users table.
 * Also adds configuratore app.
 * Uses direct Supabase INSERT/UPDATE for what REST API can do,
 * and attempts DDL via a workaround.
 * DELETE this file after running.
 */
export async function GET(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key') || '';
  const expectedKey = requiredEnv('ADMIN_API_KEY');
  if (apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];
  const admin = supabaseAdmin();

  // Step 1: Try to add columns via REST API
  // We can't do ALTER TABLE via PostgREST, but we CAN check if the columns exist
  
  // Check if 'provider' column exists by querying with it
  const { data: testProvider, error: providerError } = await admin
    .from('users')
    .select('id,email,provider')
    .limit(1);

  if (providerError) {
    if (providerError.message.includes('column') && providerError.message.includes('provider')) {
      results.push('provider column: DOES NOT EXIST — needs DDL migration');
      results.push('RUN THIS SQL in Supabase SQL Editor:');
      results.push('ALTER TABLE public.users ADD COLUMN provider text NOT NULL DEFAULT \'email\';');
      results.push('ALTER TABLE public.users ADD COLUMN google_id text UNIQUE;');
      results.push('CREATE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id);');
      results.push('CREATE INDEX IF NOT EXISTS idx_users_provider ON public.users(provider);');
    } else {
      results.push(`provider check error: ${providerError.message}`);
    }
  } else {
    results.push(`provider column: EXISTS ✅ (${testProvider?.length ?? 0} users checked)`);
  }

  // Check google_id
  const { data: testGoogleId, error: googleIdError } = await admin
    .from('users')
    .select('id,google_id')
    .limit(1);

  if (googleIdError) {
    if (googleIdError.message.includes('column') && googleIdError.message.includes('google_id')) {
      results.push('google_id column: DOES NOT EXIST — needs DDL migration');
    } else {
      results.push(`google_id check error: ${googleIdError.message}`);
    }
  } else {
    results.push(`google_id column: EXISTS ✅`);
  }

  // Step 2: Ensure configuratore app exists
  const { data: apps, error: appsError } = await admin
    .from('apps')
    .select('slug,name,redirect_url,is_active')
    .order('slug');

  if (appsError) {
    results.push(`apps query error: ${appsError.message}`);
  } else {
    results.push(`\nApps in database (${apps.length}):`);
    for (const app of apps) {
      results.push(`  ${app.slug}: ${app.redirect_url} (active=${app.is_active})`);
    }
    
    // Check if configuratore exists
    if (!apps.find(a => a.slug === 'configuratore')) {
      const { data: newApp, error: insertError } = await admin
        .from('apps')
        .insert({ slug: 'configuratore', name: 'Configuratore Offerte WINDTRE', redirect_url: 'https://configuratore-offerte-w3.pages.dev', is_active: true })
        .select()
        .single();
      if (insertError) {
        results.push(`configuratore insert error: ${insertError.message}`);
      } else {
        results.push(`configuratore: CREATED ✅`);
      }
    } else {
      results.push(`configuratore: EXISTS ✅`);
    }
  }

  return NextResponse.json({ results: results.join('\n') });
}