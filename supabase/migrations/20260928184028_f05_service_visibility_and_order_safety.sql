begin;

alter table public.services
  add column if not exists show_on_services_page boolean not null default true,
  add column if not exists accept_orders boolean not null default true;

create policy "Staff can view all services"
  on public.services
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles as staff_role
      where staff_role.user_id = (select auth.uid())
        and lower(staff_role.role) in ('admin', 'expert', 'support', 'finance')
    )
  );

create policy "Staff can update services"
  on public.services
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles as staff_role
      where staff_role.user_id = (select auth.uid())
        and lower(staff_role.role) in ('admin', 'expert', 'support', 'finance')
    )
  )
  with check (
    exists (
      select 1
      from public.user_roles as staff_role
      where staff_role.user_id = (select auth.uid())
        and lower(staff_role.role) in ('admin', 'expert', 'support', 'finance')
    )
  );

create or replace function public.create_careerlyst_order(
  p_service_name text,
  p_package_name text,
  p_total numeric,
  p_currency text default 'USD',
  p_client_notes text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_match_count integer;
  v_service_active boolean;
  v_service_accepts_orders boolean;
  v_package_active boolean;
  v_package_price numeric;
  v_package_currency text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select count(*)
    into v_match_count
  from public.services as service_row
  join public.service_packages as package_row
    on package_row.service_id = service_row.id
  where lower(btrim(service_row.name)) = lower(btrim(coalesce(p_service_name, '')))
    and lower(btrim(package_row.name)) = lower(btrim(coalesce(p_package_name, '')));

  if v_match_count = 0 then
    raise exception 'The requested service package was not found.'
      using errcode = '22023';
  elsif v_match_count > 1 then
    raise exception 'The requested service package is ambiguous.'
      using errcode = '22023';
  end if;

  select
      service_row.active,
      service_row.accept_orders,
      package_row.active,
      package_row.price,
      package_row.currency
    into
      v_service_active,
      v_service_accepts_orders,
      v_package_active,
      v_package_price,
      v_package_currency
  from public.services as service_row
  join public.service_packages as package_row
    on package_row.service_id = service_row.id
  where lower(btrim(service_row.name)) = lower(btrim(coalesce(p_service_name, '')))
    and lower(btrim(package_row.name)) = lower(btrim(coalesce(p_package_name, '')));

  if not v_service_active or not v_package_active or not v_service_accepts_orders then
    raise exception 'This service is not currently available for ordering.'
      using errcode = '55000';
  end if;

  if p_total is null or p_total <> v_package_price then
    raise exception 'The submitted total does not match the package price.'
      using errcode = '22023';
  end if;

  if p_currency is null
     or btrim(p_currency) = ''
     or upper(btrim(p_currency)) <> upper(btrim(v_package_currency)) then
    raise exception 'The submitted currency does not match the package currency.'
      using errcode = '22023';
  end if;

  -- Payment verification is not integrated. Fail closed before inserting an order.
  raise exception 'Payment verification is not configured; no order was created.'
    using errcode = '55000';
end;
$function$;

alter function public.create_careerlyst_order(text, text, numeric, text, text)
  owner to postgres;

revoke all on function public.create_careerlyst_order(text, text, numeric, text, text)
  from public, anon, authenticated;

commit;
