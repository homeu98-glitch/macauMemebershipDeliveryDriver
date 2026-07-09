-- Driver announcements (published by backoffice, shown in app "我的")

create table if not exists public.driver_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null,
  published boolean not null default true,
  published_at timestamptz
);

create index if not exists driver_announcements_created_at_idx
  on public.driver_announcements(created_at desc);

alter table public.driver_announcements enable row level security;

drop policy if exists admin_users_can_manage_driver_announcements on public.driver_announcements;
create policy admin_users_can_manage_driver_announcements
  on public.driver_announcements
  for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Drivers read published announcements
drop policy if exists drivers_can_read_published_announcements on public.driver_announcements;
create policy drivers_can_read_published_announcements
  on public.driver_announcements
  for select
  to authenticated
  using (published = true);
