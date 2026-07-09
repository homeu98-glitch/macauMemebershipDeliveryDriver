-- Driver app release versions (APK URLs managed in Supabase Storage)

create table if not exists public.driver_app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  apk_url text not null,
  release_notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null,
  is_active boolean not null default false
);

create unique index if not exists driver_app_releases_version_key
  on public.driver_app_releases(version);

-- ensure only one active release
create unique index if not exists driver_app_releases_single_active
  on public.driver_app_releases((is_active))
  where is_active = true;

alter table public.driver_app_releases enable row level security;

drop policy if exists admin_users_can_manage_driver_app_releases on public.driver_app_releases;
create policy admin_users_can_manage_driver_app_releases
  on public.driver_app_releases
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());
