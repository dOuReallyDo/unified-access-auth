import { redirect } from 'next/navigation';
import { supabaseAdmin } from './supabase';

export async function requireAdmin(formData?: FormData) {
  const configured = process.env.ADMIN_API_KEY;
  if (!configured) throw new Error('ADMIN_API_KEY not configured');
  const supplied = formData?.get('adminKey');
  if (supplied !== configured) throw new Error('Invalid admin key');
}

export async function createAppAction(formData: FormData) {
  'use server';
  await requireAdmin(formData);
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
  await requireAdmin(formData);
  const supabase = supabaseAdmin();
  await supabase.from('users').insert({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    display_name: String(formData.get('display_name') ?? '').trim() || null
  });
  redirect('/admin/users');
}

export async function grantAccessAction(formData: FormData) {
  'use server';
  await requireAdmin(formData);
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
