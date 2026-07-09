-- Readable transaction codes for orders
-- Format: T + YYYYMMDDHH24MISS + 10-digit sequence

create sequence if not exists public.order_transaction_seq;

create or replace function public.generate_order_transaction_code()
returns text
language plpgsql
as $$
declare
  next_seq bigint;
begin
  next_seq := nextval('public.order_transaction_seq');
  return 'T' || to_char(timezone('Asia/Macau', now()), 'YYYYMMDDHH24MISS') || lpad(next_seq::text, 10, '0');
end;
$$;

alter table public.orders
  add column if not exists transaction_code text;

alter table public.orders
  alter column transaction_code set default public.generate_order_transaction_code();

update public.orders
set transaction_code = public.generate_order_transaction_code()
where transaction_code is null;

alter table public.orders
  alter column transaction_code set not null;

create unique index if not exists orders_transaction_code_key
  on public.orders(transaction_code);
