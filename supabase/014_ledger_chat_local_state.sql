create table if not exists public.ledger_chat_event_inbox (
  event_id text primary key,
  external_order_id text not null,
  chat_room_ref text not null,
  room_kind text not null,
  message_id text not null,
  message_created_at timestamptz not null,
  sender_role text not null,
  sender_label text null,
  has_image boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create table if not exists public.driver_chat_room_state (
  chat_room_ref text primary key,
  external_order_id text not null,
  room_kind text not null,
  latest_message_id text not null,
  latest_message_at timestamptz not null,
  latest_sender_role text not null,
  latest_sender_label text null,
  has_image boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_chat_read_state (
  driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  chat_room_ref text not null,
  last_read_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (driver_id, chat_room_ref)
);

create index if not exists idx_ledger_chat_event_inbox_external_order_id on public.ledger_chat_event_inbox (external_order_id);
create index if not exists idx_driver_chat_room_state_external_order_id on public.driver_chat_room_state (external_order_id);
create index if not exists idx_driver_chat_room_state_latest_message_at on public.driver_chat_room_state (latest_message_at desc);
create index if not exists idx_driver_chat_read_state_driver_room on public.driver_chat_read_state (driver_id, chat_room_ref);

alter table public.ledger_chat_event_inbox enable row level security;
alter table public.driver_chat_room_state enable row level security;
alter table public.driver_chat_read_state enable row level security;

drop policy if exists admin_manage_ledger_chat_event_inbox on public.ledger_chat_event_inbox;
create policy admin_manage_ledger_chat_event_inbox on public.ledger_chat_event_inbox
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists admin_manage_driver_chat_room_state on public.driver_chat_room_state;
create policy admin_manage_driver_chat_room_state on public.driver_chat_room_state
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists admin_manage_driver_chat_read_state on public.driver_chat_read_state;
create policy admin_manage_driver_chat_read_state on public.driver_chat_read_state
for all to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
