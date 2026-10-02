create or replace function public.admin_list_directory_join_dates_v1()
returns table (user_id uuid, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_roles as caller_role
    where caller_role.user_id = auth.uid()
      and lower(caller_role.role) in ('admin', 'expert', 'support', 'finance')
  ) then
    raise exception 'insufficient_privilege'
      using errcode = '42501';
  end if;

  return query
    select auth_user.id, auth_user.created_at
    from auth.users as auth_user
    order by auth_user.created_at desc;
end;
$function$;

alter function public.admin_list_directory_join_dates_v1() owner to postgres;

revoke all on function public.admin_list_directory_join_dates_v1()
  from public, anon, authenticated;

grant execute on function public.admin_list_directory_join_dates_v1()
  to authenticated;
