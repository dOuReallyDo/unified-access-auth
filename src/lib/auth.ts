import { sha256 } from './crypto';
import { supabaseAdmin } from './supabase';

export async function getAppBySlug(appSlug: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('apps').select('*').eq('slug', appSlug).eq('is_active', true).single();
  if (error || !data) return null;
  return data;
}

export async function getOrCreateUser(email: string) {
  const supabase = supabaseAdmin();
  const normalized = email.trim().toLowerCase();
  const existing = await supabase.from('users').select('*').eq('email', normalized).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const created = await supabase.from('users').insert({ email: normalized }).select('*').single();
  if (created.error) throw created.error;
  return created.data;
}

export async function userHasAccess(userId: string, appId: string) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('user_app_access')
    .select('role,is_active')
    .eq('user_id', userId)
    .eq('app_id', appId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function validateSession(token: string, appSlug?: string) {
  const supabase = supabaseAdmin();
  const tokenHash = sha256(token);
  let query = supabase
    .from('trusted_devices')
    .select('*, users(*), apps(*)')
    .eq('session_token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();
  const { data, error } = await query;
  if (error || !data) return null;
  const app = Array.isArray(data.apps) ? data.apps[0] : data.apps;
  if (appSlug && app?.slug !== appSlug) return null;
  await supabase.from('trusted_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  return data;
}
