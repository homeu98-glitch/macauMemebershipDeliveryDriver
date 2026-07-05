create table if not exists public.driver_push_tokens (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null default 'android',
  device_label text,
  app_version text,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists driver_push_tokens_driver_id_idx
  on public.driver_push_tokens(driver_id);

create index if not exists driver_push_tokens_auth_user_id_idx
  on public.driver_push_tokens(auth_user_id);
