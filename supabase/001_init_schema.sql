-- Membership Delivery Driver
-- Supabase bootstrap SQL
-- Run this in the Supabase SQL editor.
-- Notes:
-- 1. This script assumes Supabase Auth is enabled.
-- 2. It creates rider onboarding, order, assignment, event, and storage policies.
-- 3. Backoffice approval can be handled by admin users stored in public.admin_users.

create extension if not exists pgcrypto;

create type public.approval_status as enum (
  'pending_review',
  'approved',
  'rejected',
  'suspended'
);

create type public.driver_availability as enum (
  'offline',
  'online'
);

create type public.order_status as enum (
  'new',
  'assigned',
  'accepted',
  'arrived_shop',
  'picked_up',
  'arrived_customer',
  'delivered',
  'failed',
  'canceled'
);

create type public.document_type as enum (
  'selfie',
  'macau_id',
  'driving_licence',
  'proof_of_delivery'
);

create type public.event_actor_type as enum (
  'driver',
  'admin',
  'system',
  'website'
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  external_driver_id text unique,
  full_name text not null,
  phone text not null,
  vehicle_type text,
  approval_status public.approval_status not null default 'pending_review',
  availability public.driver_availability not null default 'offline',
  profile_photo_path text,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_applications (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_status public.approval_status not null default 'pending_review',
  review_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  document_type public.document_type not null,
  storage_path text not null,
  verification_status public.approval_status not null default 'pending_review',
  uploaded_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  note text
);

create table if not exists public.driver_shifts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  availability public.driver_availability not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.driver_locations (
  id bigserial primary key,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  speed_mps numeric(8,2),
  heading numeric(6,2),
  captured_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  external_shop_id text unique,
  name text not null,
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  contact_name text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  external_customer_id text unique,
  name text,
  phone text,
  address text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  delivery_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  external_order_id text unique not null,
  shop_id uuid not null references public.shops(id),
  customer_id uuid not null references public.customers(id),
  status public.order_status not null default 'new',
  promised_at timestamptz,
  assigned_fee_mop numeric(10,2) not null default 0,
  offline_payment_note text,
  source_payload jsonb not null default '{}'::jsonb,
  callback_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_name text not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.order_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  canceled_at timestamptz,
  unique (order_id, driver_id)
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  actor_type public.event_actor_type not null,
  actor_user_id uuid,
  actor_driver_id uuid references public.driver_profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  storage_path text not null,
  proof_type public.document_type not null default 'proof_of_delivery',
  created_at timestamptz not null default now()
);

create table if not exists public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_id text,
  status text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

create table if not exists public.callback_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  event_type text not null,
  endpoint text not null,
  http_status integer,
  request_body jsonb not null default '{}'::jsonb,
  response_body jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now()
);

create index if not exists idx_driver_profiles_auth_user_id on public.driver_profiles(auth_user_id);
create index if not exists idx_driver_documents_driver_id on public.driver_documents(driver_id);
create index if not exists idx_driver_locations_driver_id_captured_at on public.driver_locations(driver_id, captured_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_assignments_driver_id on public.order_assignments(driver_id);
create index if not exists idx_order_events_order_id on public.order_events(order_id);
create index if not exists idx_delivery_proofs_order_id on public.delivery_proofs(order_id);

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select dp.id
  from public.driver_profiles dp
  where dp.auth_user_id = auth.uid()
  limit 1
$$;

grant execute on function public.is_admin_user() to anon, authenticated, service_role;
grant execute on function public.current_driver_id() to anon, authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_driver_profiles_updated_at on public.driver_profiles;
create trigger trg_driver_profiles_updated_at
before update on public.driver_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_shops_updated_at on public.shops;
create trigger trg_shops_updated_at
before update on public.shops
for each row
execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

alter table public.admin_users enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.driver_applications enable row level security;
alter table public.driver_documents enable row level security;
alter table public.driver_shifts enable row level security;
alter table public.driver_locations enable row level security;
alter table public.shops enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_assignments enable row level security;
alter table public.order_events enable row level security;
alter table public.delivery_proofs enable row level security;
alter table public.sync_logs enable row level security;
alter table public.callback_logs enable row level security;

-- Admin-only tables
drop policy if exists "admin users self read" on public.admin_users;
create policy "admin users self read"
on public.admin_users
for select
using (auth.uid() = user_id or public.is_admin_user());

drop policy if exists "admin full access admin_users" on public.admin_users;
create policy "admin full access admin_users"
on public.admin_users
for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- Driver profiles
drop policy if exists "drivers read own profile" on public.driver_profiles;
create policy "drivers read own profile"
on public.driver_profiles
for select
using (auth.uid() = auth_user_id or public.is_admin_user());

drop policy if exists "drivers insert own profile" on public.driver_profiles;
create policy "drivers insert own profile"
on public.driver_profiles
for insert
with check (auth.uid() = auth_user_id or public.is_admin_user());

drop policy if exists "drivers update own profile limited" on public.driver_profiles;
create policy "drivers update own profile limited"
on public.driver_profiles
for update
using (auth.uid() = auth_user_id or public.is_admin_user())
with check (auth.uid() = auth_user_id or public.is_admin_user());

-- Applications and documents
drop policy if exists "drivers manage own applications" on public.driver_applications;
create policy "drivers manage own applications"
on public.driver_applications
for all
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
)
with check (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

drop policy if exists "drivers manage own documents" on public.driver_documents;
create policy "drivers manage own documents"
on public.driver_documents
for all
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
)
with check (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

-- Shift and location
drop policy if exists "drivers manage own shifts" on public.driver_shifts;
create policy "drivers manage own shifts"
on public.driver_shifts
for all
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
)
with check (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

drop policy if exists "drivers manage own locations" on public.driver_locations;
create policy "drivers manage own locations"
on public.driver_locations
for all
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
)
with check (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

-- Shared lookup tables: drivers can read only
drop policy if exists "drivers read shops" on public.shops;
create policy "drivers read shops"
on public.shops
for select
using (auth.role() = 'authenticated');

drop policy if exists "admin manage shops" on public.shops;
create policy "admin manage shops"
on public.shops
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "drivers read customers for assigned work" on public.customers;
create policy "drivers read customers for assigned work"
on public.customers
for select
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.orders o
    join public.order_assignments oa on oa.order_id = o.id
    where o.customer_id = customers.id
      and oa.driver_id = public.current_driver_id()
  )
);

drop policy if exists "admin manage customers" on public.customers;
create policy "admin manage customers"
on public.customers
for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- Orders and related data
drop policy if exists "drivers read assigned orders" on public.orders;
create policy "drivers read assigned orders"
on public.orders
for select
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.order_assignments oa
    where oa.order_id = orders.id
      and oa.driver_id = public.current_driver_id()
  )
);

drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders"
on public.orders
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "drivers read order items" on public.order_items;
create policy "drivers read order items"
on public.order_items
for select
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.order_assignments oa
    where oa.order_id = order_items.order_id
      and oa.driver_id = public.current_driver_id()
  )
);

drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items"
on public.order_items
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "drivers read own assignments" on public.order_assignments;
create policy "drivers read own assignments"
on public.order_assignments
for select
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

drop policy if exists "drivers update own assignments" on public.order_assignments;
create policy "drivers update own assignments"
on public.order_assignments
for update
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
)
with check (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

drop policy if exists "admin manage assignments" on public.order_assignments;
create policy "admin manage assignments"
on public.order_assignments
for insert
with check (public.is_admin_user());

drop policy if exists "drivers read order events" on public.order_events;
create policy "drivers read order events"
on public.order_events
for select
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.order_assignments oa
    where oa.order_id = order_events.order_id
      and oa.driver_id = public.current_driver_id()
  )
);

drop policy if exists "drivers insert order events" on public.order_events;
create policy "drivers insert order events"
on public.order_events
for insert
with check (
  public.is_admin_user()
  or actor_driver_id = public.current_driver_id()
);

drop policy if exists "drivers manage delivery proofs" on public.delivery_proofs;
create policy "drivers manage delivery proofs"
on public.delivery_proofs
for all
using (
  driver_id = public.current_driver_id() or public.is_admin_user()
)
with check (
  driver_id = public.current_driver_id() or public.is_admin_user()
);

drop policy if exists "admin read sync logs" on public.sync_logs;
create policy "admin read sync logs"
on public.sync_logs
for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "admin read callback logs" on public.callback_logs;
create policy "admin read callback logs"
on public.callback_logs
for all
using (public.is_admin_user())
with check (public.is_admin_user());

-- Storage buckets
insert into storage.buckets (id, name, public)
values
  ('driver-documents', 'driver-documents', false),
  ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;

-- Storage policies: driver-documents
drop policy if exists "drivers upload own documents" on storage.objects;
create policy "drivers upload own documents"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "drivers read own documents" on storage.objects;
create policy "drivers read own documents"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
);

drop policy if exists "drivers update own documents" on storage.objects;
create policy "drivers update own documents"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
)
with check (
  bucket_id = 'driver-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
);

drop policy if exists "drivers delete own documents" on storage.objects;
create policy "drivers delete own documents"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'driver-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
);

-- Storage policies: delivery-proofs
drop policy if exists "drivers upload own proofs" on storage.objects;
create policy "drivers upload own proofs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'delivery-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "drivers read own proofs" on storage.objects;
create policy "drivers read own proofs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
);

drop policy if exists "drivers update own proofs" on storage.objects;
create policy "drivers update own proofs"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
)
with check (
  bucket_id = 'delivery-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
);

drop policy if exists "drivers delete own proofs" on storage.objects;
create policy "drivers delete own proofs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'delivery-proofs'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin_user()
  )
);
