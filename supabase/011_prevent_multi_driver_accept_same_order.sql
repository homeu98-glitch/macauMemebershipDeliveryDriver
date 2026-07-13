-- Ensure only one active assignment can exist per order.
-- If historical bad data exists, keep the newest active row and cancel the rest.

with ranked_active as (
  select
    id,
    row_number() over (
      partition by order_id
      order by coalesce(accepted_at, assigned_at) desc, assigned_at desc, id desc
    ) as rn
  from public.order_assignments
  where canceled_at is null
)
update public.order_assignments oa
set canceled_at = now()
from ranked_active ra
where oa.id = ra.id
  and ra.rn > 1;

create unique index if not exists idx_order_assignments_one_active_per_order
on public.order_assignments(order_id)
where canceled_at is null;
