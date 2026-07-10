-- Compliance / legal content / data retention
-- Run after 009_order_transaction_codes.sql

alter table public.driver_profiles
  add column if not exists accepted_terms_version text,
  add column if not exists accepted_terms_at timestamptz;

create or replace function public.purge_transaction_data_older_than_30_days()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.callback_logs
  where sent_at < timezone('utc', now()) - interval '30 days';

  delete from public.sync_logs
  where processed_at < timezone('utc', now()) - interval '30 days';

  delete from public.orders
  where created_at < timezone('utc', now()) - interval '30 days';
end;
$$;
