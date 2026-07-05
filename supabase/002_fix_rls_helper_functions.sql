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
  limit 1;
$$;

grant execute on function public.is_admin_user() to anon, authenticated, service_role;
grant execute on function public.current_driver_id() to anon, authenticated, service_role;
