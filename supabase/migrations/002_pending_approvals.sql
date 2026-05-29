-- Add pending_approvals table for admin approval flow
create table if not exists public.pending_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_email text not null,
  app_slug text not null,
  app_name text not null,
  request_ip inet,
  user_agent text,
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_pending_approvals_status on public.pending_approvals(status);
create index if not exists idx_pending_approvals_user on public.pending_approvals(user_id);

alter table public.pending_approvals enable row level security;