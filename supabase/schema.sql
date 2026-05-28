create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  redirect_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.user_app_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  role text not null default 'user',
  is_active boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(user_id, app_id)
);

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  request_ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  device_name text,
  device_fingerprint_hash text,
  session_token_hash text unique,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  credential_id text not null unique,
  public_key bytea not null,
  counter bigint not null default 0,
  transports text[],
  device_name text,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  target_user_id uuid references public.users(id) on delete set null,
  app_id uuid references public.apps(id) on delete set null,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_app_access_user on public.user_app_access(user_id);
create index if not exists idx_user_app_access_app on public.user_app_access(app_id);
create index if not exists idx_otp_lookup on public.otp_codes(user_id, app_id, expires_at desc);
create index if not exists idx_trusted_devices_session on public.trusted_devices(session_token_hash);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_apps_updated_at on public.apps;
create trigger set_apps_updated_at before update on public.apps for each row execute function public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at before update on public.users for each row execute function public.set_updated_at();

alter table public.apps enable row level security;
alter table public.users enable row level security;
alter table public.user_app_access enable row level security;
alter table public.otp_codes enable row level security;
alter table public.trusted_devices enable row level security;
alter table public.passkey_credentials enable row level security;
alter table public.audit_logs enable row level security;

-- Access is intentionally mediated by server routes using SUPABASE_SERVICE_ROLE_KEY.
