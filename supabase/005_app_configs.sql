-- App-level key-value config storage
-- Run this after 004_driver_push_tokens.sql

create table if not exists public.app_configs (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_configs enable row level security;

-- service_role can always access; this policy is for direct authenticated admin access if ever needed.
drop policy if exists admin_users_can_manage_app_configs on public.app_configs;
create policy admin_users_can_manage_app_configs
  on public.app_configs
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());
