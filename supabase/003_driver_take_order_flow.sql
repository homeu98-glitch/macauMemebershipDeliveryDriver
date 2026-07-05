drop policy if exists "drivers read assigned orders" on public.orders;
drop policy if exists "drivers read available and assigned orders" on public.orders;
create policy "drivers read available and assigned orders"
on public.orders
for select
using (
  public.is_admin_user()
  or status = 'new'
  or exists (
    select 1
    from public.order_assignments oa
    where oa.order_id = orders.id
      and oa.driver_id = public.current_driver_id()
      and oa.canceled_at is null
  )
);

drop policy if exists "drivers read customers for assigned work" on public.customers;
drop policy if exists "drivers read customers for visible work" on public.customers;
create policy "drivers read customers for visible work"
on public.customers
for select
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.orders o
    left join public.order_assignments oa on oa.order_id = o.id
    where o.customer_id = customers.id
      and (
        o.status = 'new'
        or (oa.driver_id = public.current_driver_id() and oa.canceled_at is null)
      )
  )
);

drop policy if exists "drivers read order items" on public.order_items;
drop policy if exists "drivers read visible order items" on public.order_items;
create policy "drivers read visible order items"
on public.order_items
for select
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.orders o
    left join public.order_assignments oa on oa.order_id = o.id
    where o.id = order_items.order_id
      and (
        o.status = 'new'
        or (oa.driver_id = public.current_driver_id() and oa.canceled_at is null)
      )
  )
);

drop policy if exists "drivers accept available orders" on public.order_assignments;
create policy "drivers accept available orders"
on public.order_assignments
for insert
with check (
  driver_id = public.current_driver_id()
  and exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.status = 'new'
  )
);

drop policy if exists "drivers update assigned orders" on public.orders;
create policy "drivers update assigned orders"
on public.orders
for update
using (
  public.is_admin_user()
  or exists (
    select 1
    from public.order_assignments oa
    where oa.order_id = orders.id
      and oa.driver_id = public.current_driver_id()
      and oa.canceled_at is null
  )
)
with check (
  public.is_admin_user()
  or exists (
    select 1
    from public.order_assignments oa
    where oa.order_id = orders.id
      and oa.driver_id = public.current_driver_id()
      and oa.canceled_at is null
  )
);
