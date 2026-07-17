create extension if not exists pg_cron;

create index if not exists idx_order_assignments_active_accepted_at
on public.order_assignments (accepted_at)
where accepted_at is not null and canceled_at is null;

create index if not exists idx_order_events_order_created_type
on public.order_events (order_id, created_at desc, event_type);

create or replace function public.auto_complete_stale_orders(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_scanned_count integer := 0;
  v_completed_count integer := 0;
  v_completed_orders jsonb := '[]'::jsonb;
begin
  with candidates as (
    select
      o.id as order_id,
      o.external_order_id,
      assignment.driver_id,
      assignment.accepted_at
    from public.orders o
    join lateral (
      select
        oa.driver_id,
        oa.accepted_at
      from public.order_assignments oa
      where oa.order_id = o.id
        and oa.accepted_at is not null
        and oa.canceled_at is null
      order by oa.accepted_at desc nulls last
      limit 1
    ) assignment on true
    where o.status not in ('delivered', 'failed', 'canceled')
      and assignment.accepted_at <= v_now - interval '48 hours'
      and not exists (
        select 1
        from public.order_events oe
        where oe.order_id = o.id
          and oe.created_at > assignment.accepted_at
          and oe.event_type in (
            'picked_up',
            'arrived_shop',
            'arrived_customer',
            'delivered',
            'exception_reported',
            'issue_reported',
            'canceled',
            'cancel_requested',
            'driver_cancel_requested',
            'website.shop_owner_confirmed_driver_cancel',
            'website.shop_owner_rejected_driver_cancel'
          )
      )
    order by assignment.accepted_at asc
    limit greatest(coalesce(p_limit, 0), 0)
    for update of o skip locked
  ),
  updated_orders as (
    update public.orders o
    set
      status = 'delivered',
      updated_at = v_now
    from candidates c
    where o.id = c.order_id
      and o.status not in ('delivered', 'failed', 'canceled')
    returning
      o.id,
      o.external_order_id
  ),
  inserted_events as (
    insert into public.order_events (
      order_id,
      event_type,
      actor_type,
      actor_driver_id,
      payload,
      created_at
    )
    select
      c.order_id,
      'delivered',
      'system',
      c.driver_id,
      jsonb_build_object(
        'reason', 'auto_completed_after_48h_inactive',
        'note', '系統檢測到車手接單後 48 小時無後續操作，自動完成訂單',
        'accepted_at', c.accepted_at,
        'auto_completed_at', v_now
      ),
      v_now
    from candidates c
    join updated_orders u on u.id = c.order_id
    returning order_id
  )
  select
    (select count(*) from candidates),
    (select count(*) from updated_orders),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'order_id', c.order_id,
            'external_order_id', c.external_order_id,
            'accepted_at', c.accepted_at,
            'reason', 'auto_completed_after_48h_inactive'
          )
          order by c.accepted_at asc
        )
        from candidates c
        join updated_orders u on u.id = c.order_id
      ),
      '[]'::jsonb
    )
  into
    v_scanned_count,
    v_completed_count,
    v_completed_orders;

  insert into public.sync_logs (
    source,
    status,
    message,
    payload,
    processed_at
  )
  values (
    'auto_complete_stale_orders',
    case
      when v_completed_count > 0 then 'success'
      else 'noop'
    end,
    case
      when v_completed_count > 0 then format('自動完成 %s 張逾時無操作訂單。', v_completed_count)
      else '沒有符合條件的逾時無操作訂單。'
    end,
    jsonb_build_object(
      'scanned_count', v_scanned_count,
      'completed_count', v_completed_count,
      'completed_orders', v_completed_orders,
      'executed_at', v_now
    ),
    v_now
  );

  return jsonb_build_object(
    'scanned_count', v_scanned_count,
    'completed_count', v_completed_count,
    'completed_orders', v_completed_orders,
    'executed_at', v_now
  );
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'auto-complete-stale-orders'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'auto-complete-stale-orders',
  '0 0 * * *',
  $$select public.auto_complete_stale_orders(100);$$
);
