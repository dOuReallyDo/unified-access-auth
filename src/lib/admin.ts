import { redirect } from 'next/navigation';
import { supabaseAdmin } from './supabase';
import { requireAdminOrThrow } from './admin-auth';

export async function createAppAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  await supabase.from('apps').insert({
    slug: String(formData.get('slug') ?? '').trim(),
    name: String(formData.get('name') ?? '').trim(),
    redirect_url: String(formData.get('redirect_url') ?? '').trim() || null
  });
  redirect('/admin/apps');
}

export async function createUserAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  await supabase.from('users').insert({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    display_name: String(formData.get('display_name') ?? '').trim() || null
  });
  redirect('/admin/users');
}

export async function grantAccessAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  await supabase.from('user_app_access').upsert({
    user_id: String(formData.get('user_id')),
    app_id: String(formData.get('app_id')),
    role: String(formData.get('role') ?? 'user'),
    is_active: true,
    revoked_at: null
  }, { onConflict: 'user_id,app_id' });
  redirect('/admin/access');
}

export async function toggleAppActiveAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  const id = String(formData.get('id'));
  const isActive = formData.get('is_active') === 'true';
  await supabase.from('apps').update({ is_active: !isActive }).eq('id', id);
  redirect('/admin/apps');
}

export async function toggleUserActiveAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  const id = String(formData.get('id'));
  const isActive = formData.get('is_active') === 'true';
  await supabase.from('users').update({ is_active: !isActive }).eq('id', id);
  redirect('/admin/users');
}

export async function toggleAccessActiveAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  const id = String(formData.get('id'));
  const isActive = formData.get('is_active') === 'true';
  if (isActive) {
    await supabase.from('user_app_access').update({ is_active: false, revoked_at: new Date().toISOString() }).eq('id', id);
  } else {
    await supabase.from('user_app_access').update({ is_active: true, revoked_at: null }).eq('id', id);
  }
  redirect('/admin/access');
}

export async function revokeDeviceAction(formData: FormData) {
  'use server';
  await requireAdminOrThrow();
  const supabase = supabaseAdmin();
  const id = String(formData.get('id'));
  await supabase.from('trusted_devices').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  redirect('/admin/access');
}