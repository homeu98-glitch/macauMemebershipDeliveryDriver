-- Adds a lightweight heartbeat timestamp for driver presence.
-- Used to decide "effective online" even when geolocation is unavailable.

alter table if exists public.driver_profiles
  add column if not exists last_heartbeat_at timestamptz;

create index if not exists idx_driver_profiles_last_heartbeat_at
  on public.driver_profiles (last_heartbeat_at);
