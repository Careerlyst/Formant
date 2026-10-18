-- Messaging hardening: isolate messages and attachments, provide bounded
-- thread reads, and keep read-state changes behind caller-validated RPCs.
begin;

create or replace function public.is_messaging_staff_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as r
    where r.user_id = auth.uid()
      and pg_catalog.lower(r.role) in ('admin', 'expert', 'support', 'finance')
  );
$$;
alter function public.is_messaging_staff_v1() owner to postgres;
revoke all on function public.is_messaging_staff_v1() from public, anon;
grant execute on function public.is_messaging_staff_v1() to authenticated;

create or replace function public.is_messaging_sender_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as r
    where r.user_id = auth.uid()
      and pg_catalog.lower(r.role) in ('admin', 'expert', 'support')
  );
$$;
alter function public.is_messaging_sender_v1() owner to postgres;
revoke all on function public.is_messaging_sender_v1() from public, anon;
grant execute on function public.is_messaging_sender_v1() to authenticated;

-- Production currently has two AFTER INSERT triggers that both notify the
-- client for the same staff message. Keep the newer Careerlyst notification
-- trigger and remove the legacy duplicate so a single message creates one
-- notification.
drop trigger if exists trg_notify_client_new_message on public.messages;

alter table public.messages enable row level security;
revoke all on table public.messages from public, anon, authenticated;
grant select on table public.messages to authenticated;
grant insert (order_id, sender_id, body) on table public.messages to authenticated;

-- The restrictive policies cap any older permissive policies that may exist
-- in a linked database, while the permissive policies below grant the intended
-- client/staff paths.
drop policy if exists formant_messages_select_boundary_v1 on public.messages;
create policy formant_messages_select_boundary_v1
  on public.messages as restrictive for select to authenticated
  using (
    public.is_messaging_staff_v1()
    or exists (
      select 1 from public.orders o
      where o.id = messages.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists formant_messages_select_v1 on public.messages;
create policy formant_messages_select_v1
  on public.messages for select to authenticated
  using (
    public.is_messaging_staff_v1()
    or exists (
      select 1 from public.orders o
      where o.id = messages.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists formant_messages_insert_boundary_v1 on public.messages;
create policy formant_messages_insert_boundary_v1
  on public.messages as restrictive for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.orders o
        where o.id = messages.order_id and o.user_id = auth.uid()
      )
      or (
        exists (
          select 1 from public.user_roles r
          where r.user_id = auth.uid()
            and pg_catalog.lower(r.role) in ('admin', 'expert', 'support')
        )
        and exists (select 1 from public.orders o where o.id = messages.order_id)
      )
    )
  );

drop policy if exists formant_messages_insert_v1 on public.messages;
create policy formant_messages_insert_v1
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.orders o
        where o.id = messages.order_id and o.user_id = auth.uid()
      )
      or (
        exists (
          select 1 from public.user_roles r
          where r.user_id = auth.uid()
            and pg_catalog.lower(r.role) in ('admin', 'expert', 'support')
        )
        and exists (select 1 from public.orders o where o.id = messages.order_id)
      )
    )
  );

-- No client/staff can directly rewrite message content or read_at. All read
-- receipts and attachment removal go through the narrow RPCs below.
revoke update, delete on table public.messages from public, anon, authenticated;

create or replace function public.list_message_summaries_v1(p_order_ids bigint[] default null)
returns table (
  order_id bigint,
  latest_message_id bigint,
  latest_sender_id uuid,
  latest_body text,
  latest_created_at timestamptz,
  unread_count bigint,
  latest_unread_message_id bigint,
  latest_unread_body text,
  latest_unread_created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_is_staff boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  v_is_staff := public.is_messaging_staff_v1();
  if not v_is_staff and not exists (
    select 1 from public.user_roles r
    where r.user_id = v_user_id and pg_catalog.lower(r.role) = 'client'
  ) then
    raise insufficient_privilege using message = 'Messaging access denied';
  end if;

  return query
  select o.id,
    latest.id,
    latest.sender_id,
    latest.body,
    latest.created_at,
    coalesce(unread.count, 0)::bigint,
    unread_latest.id,
    unread_latest.body,
    unread_latest.created_at
  from public.orders o
  left join lateral (
    select m.id, m.sender_id, m.body, m.created_at
    from public.messages m
    where m.order_id = o.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  left join lateral (
    select pg_catalog.count(*) as count
    from public.messages m
    where m.order_id = o.id
      and m.sender_id <> v_user_id
      and m.read_at is null
      and (
        (v_is_staff and m.sender_id = o.user_id)
        or (not v_is_staff and m.sender_id <> v_user_id)
      )
  ) unread on true
  left join lateral (
    select m.id, m.body, m.created_at
    from public.messages m
    where m.order_id = o.id
      and m.sender_id = o.user_id
      and m.read_at is null
    order by m.created_at desc, m.id desc
    limit 1
  ) unread_latest on true
  where (v_is_staff or o.user_id = v_user_id)
    and (p_order_ids is null or o.id = any(p_order_ids))
  order by coalesce(latest.created_at, o.created_at) desc, o.id desc;
end;
$$;
alter function public.list_message_summaries_v1(bigint[]) owner to postgres;
revoke all on function public.list_message_summaries_v1(bigint[]) from public, anon, authenticated;
grant execute on function public.list_message_summaries_v1(bigint[]) to authenticated;

create or replace function public.list_message_thread_page_v1(
  p_order_id bigint,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint,
  order_id bigint,
  sender_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_user_id uuid;
  v_is_staff boolean;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  select o.user_id into v_order_user_id
  from public.orders o where o.id = p_order_id;
  v_is_staff := public.is_messaging_staff_v1();
  if v_order_user_id is null or (v_order_user_id <> v_user_id and not v_is_staff) then
    raise insufficient_privilege using message = 'Order messaging access denied';
  end if;

  return query
  select m.id, m.order_id, m.sender_id, m.body, m.created_at, m.read_at
  from public.messages m
  where m.order_id = p_order_id
    and (
      p_before_created_at is null
      or (m.created_at, m.id) < (p_before_created_at, p_before_id)
    )
  order by m.created_at desc, m.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;
alter function public.list_message_thread_page_v1(bigint, timestamptz, bigint, integer) owner to postgres;
revoke all on function public.list_message_thread_page_v1(bigint, timestamptz, bigint, integer) from public, anon, authenticated;
grant execute on function public.list_message_thread_page_v1(bigint, timestamptz, bigint, integer) to authenticated;

create or replace function public.mark_order_messages_read_v1(p_order_id bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_user_id uuid;
  v_is_staff boolean;
  v_count bigint;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  select o.user_id into v_order_user_id from public.orders o where o.id = p_order_id;
  v_is_staff := public.is_messaging_staff_v1();
  if v_order_user_id is null or (v_order_user_id <> v_user_id and not v_is_staff) then
    raise insufficient_privilege using message = 'Order messaging access denied';
  end if;

  update public.messages m
  set read_at = pg_catalog.clock_timestamp()
  where m.order_id = p_order_id
    and m.read_at is null
    and (
      (v_user_id = v_order_user_id and m.sender_id <> v_user_id)
      or (v_is_staff and m.sender_id = v_order_user_id)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
alter function public.mark_order_messages_read_v1(bigint) owner to postgres;
revoke all on function public.mark_order_messages_read_v1(bigint) from public, anon, authenticated;
grant execute on function public.mark_order_messages_read_v1(bigint) to authenticated;

create or replace function public.list_client_message_attachments_v1(
  p_order_ids bigint[] default null,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 100
)
returns table (
  id bigint,
  order_id bigint,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = v_user_id and pg_catalog.lower(r.role) = 'client'
  ) then
    raise insufficient_privilege using message = 'Client messaging access required';
  end if;

  return query
  select m.id, m.order_id, m.sender_id, m.body, m.created_at
  from public.messages m
  join public.orders o on o.id = m.order_id and o.user_id = v_user_id
  where pg_catalog.left(m.body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) = '__CAREERLYST_ATTACHMENT__:'
    and (p_order_ids is null or m.order_id = any(p_order_ids))
    and (
      p_before_created_at is null
      or (m.created_at, m.id) < (p_before_created_at, p_before_id)
    )
  order by m.created_at desc, m.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 100));
end;
$$;
alter function public.list_client_message_attachments_v1(bigint[], timestamptz, bigint, integer) owner to postgres;
revoke all on function public.list_client_message_attachments_v1(bigint[], timestamptz, bigint, integer) from public, anon, authenticated;
grant execute on function public.list_client_message_attachments_v1(bigint[], timestamptz, bigint, integer) to authenticated;

create or replace function public.admin_list_message_attachments_v1(p_limit integer default 100, p_offset integer default 0)
returns table (
  id bigint,
  order_id bigint,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_messaging_staff_v1() then
    raise insufficient_privilege using message = 'Staff messaging access required';
  end if;
  return query
  select m.id, m.order_id, m.sender_id, m.body, m.created_at
  from public.messages m
  where pg_catalog.left(m.body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) = '__CAREERLYST_ATTACHMENT__:'
  order by m.created_at desc, m.id desc
  limit greatest(1, least(coalesce(p_limit, 100), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
alter function public.admin_list_message_attachments_v1(integer, integer) owner to postgres;
revoke all on function public.admin_list_message_attachments_v1(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_message_attachments_v1(integer, integer) to authenticated;

create or replace function public.admin_remove_message_attachment_v1(p_message_id bigint, p_storage_path text)
returns table (storage_path text, message_deleted boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text;
  v_order_id bigint;
  v_payload jsonb;
  v_text text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and pg_catalog.lower(r.role) in ('admin', 'expert', 'support')
  ) then
    raise insufficient_privilege using message = 'Staff attachment management required';
  end if;

  select m.body, m.order_id into v_body, v_order_id
  from public.messages m where m.id = p_message_id for update;
  if v_body is null or pg_catalog.left(v_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) <> '__CAREERLYST_ATTACHMENT__:' then
    raise invalid_parameter_value using message = 'Message attachment was not found';
  end if;
  v_payload := pg_catalog.substr(v_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:') + 1)::jsonb;
  if coalesce(v_payload #>> '{attachment,path}', '') <> p_storage_path then
    raise insufficient_privilege using message = 'Attachment path does not match message';
  end if;

  v_text := coalesce(v_payload ->> 'text', '');
  if v_text <> '' then
    update public.messages set body = v_text where id = p_message_id;
    return query select p_storage_path, false;
  else
    delete from public.messages where id = p_message_id;
    return query select p_storage_path, true;
  end if;
end;
$$;
alter function public.admin_remove_message_attachment_v1(bigint, text) owner to postgres;
revoke all on function public.admin_remove_message_attachment_v1(bigint, text) from public, anon, authenticated;
grant execute on function public.admin_remove_message_attachment_v1(bigint, text) to authenticated;

-- The earlier RPC name is retired so an unverified legacy implementation
-- cannot remain callable after clients move to the order-scoped v1 RPC.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mark_order_messages_read'
  loop
    execute pg_catalog.format('revoke all on function %s from public, anon, authenticated', r.signature);
  end loop;
end $$;

create index if not exists messages_order_created_id_desc_idx
  on public.messages (order_id, created_at desc, id desc);
create index if not exists messages_order_unread_sender_idx
  on public.messages (order_id, sender_id) where read_at is null;
create index if not exists messages_attachment_created_id_desc_idx
  on public.messages (created_at desc, id desc)
  where pg_catalog.left(body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) = '__CAREERLYST_ATTACHMENT__:';

-- Keep this bucket private and bounded to the same 10 MB client-side limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  array[
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/zip',
    'image/jpeg', 'image/png', 'image/webp'
  ]::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object names use either <client-or-staff-uuid>/<order-id>/... or
-- orders/<order-id>/... . The order id is always the second path segment.
drop policy if exists formant_message_objects_select_boundary_v1 on storage.objects;
create policy formant_message_objects_select_boundary_v1
  on storage.objects as restrictive for select to public
  using (
    bucket_id <> 'message-attachments'
    or (
      auth.uid() is not null
      and (
        public.is_messaging_staff_v1()
        or exists (
          select 1 from public.orders o
          where o.id::text = split_part(storage.objects.name, '/', 2)
            and o.user_id = auth.uid()
        )
      )
    )
  );
drop policy if exists formant_message_objects_select_v1 on storage.objects;
create policy formant_message_objects_select_v1
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_messaging_staff_v1()
      or exists (
        select 1 from public.orders o
        where o.id::text = split_part(storage.objects.name, '/', 2)
          and o.user_id = auth.uid()
      )
    )
  );

drop policy if exists formant_message_objects_insert_boundary_v1 on storage.objects;
create policy formant_message_objects_insert_boundary_v1
  on storage.objects as restrictive for insert to public
  with check (
    bucket_id <> 'message-attachments'
    or (
      auth.uid() is not null
      and split_part(storage.objects.name, '/', 2) ~ '^[0-9]+$'
      and (
        (
          public.is_messaging_sender_v1()
          and exists (
            select 1 from public.orders o
            where o.id::text = split_part(storage.objects.name, '/', 2)
          )
        )
        or (
          split_part(storage.objects.name, '/', 1) = auth.uid()::text
          and exists (
            select 1 from public.orders o
            where o.id::text = split_part(storage.objects.name, '/', 2)
              and o.user_id = auth.uid()
          )
        )
      )
    )
  );
drop policy if exists formant_message_objects_insert_v1 on storage.objects;
create policy formant_message_objects_insert_v1
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and split_part(storage.objects.name, '/', 2) ~ '^[0-9]+$'
    and (
      (
        public.is_messaging_sender_v1()
        and exists (
          select 1 from public.orders o
          where o.id::text = split_part(storage.objects.name, '/', 2)
        )
      )
      or (
        split_part(storage.objects.name, '/', 1) = auth.uid()::text
        and exists (
          select 1 from public.orders o
          where o.id::text = split_part(storage.objects.name, '/', 2)
            and o.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists formant_message_objects_delete_boundary_v1 on storage.objects;
create policy formant_message_objects_delete_boundary_v1
  on storage.objects as restrictive for delete to public
  using (
    bucket_id <> 'message-attachments'
    or (
      auth.uid() is not null
      and (
        public.is_messaging_sender_v1()
        or (
          split_part(storage.objects.name, '/', 1) = auth.uid()::text
          and split_part(storage.objects.name, '/', 2) ~ '^[0-9]+$'
          and exists (
            select 1 from public.orders o
            where o.id::text = split_part(storage.objects.name, '/', 2)
              and o.user_id = auth.uid()
          )
          and not exists (
            select 1 from public.messages m
            where pg_catalog.strpos(m.body, storage.objects.name) > 0
          )
        )
      )
    )
  );
drop policy if exists formant_message_objects_delete_v1 on storage.objects;
create policy formant_message_objects_delete_v1
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      public.is_messaging_sender_v1()
      or (
        split_part(storage.objects.name, '/', 1) = auth.uid()::text
        and split_part(storage.objects.name, '/', 2) ~ '^[0-9]+$'
        and exists (
          select 1 from public.orders o
          where o.id::text = split_part(storage.objects.name, '/', 2)
            and o.user_id = auth.uid()
        )
        and not exists (
          select 1 from public.messages m
          where pg_catalog.strpos(m.body, storage.objects.name) > 0
        )
      )
    )
  );

-- Do not allow message-attachment objects to be updated through the Storage
-- API. Other buckets remain unaffected by this restrictive boundary.
drop policy if exists formant_message_objects_update_boundary_v1 on storage.objects;
create policy formant_message_objects_update_boundary_v1
  on storage.objects as restrictive for update to public
  using (bucket_id <> 'message-attachments')
  with check (bucket_id <> 'message-attachments');

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (
      select 1 from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
    ) then
      alter publication supabase_realtime add table public.orders;
    end if;
  end if;
end $$;

commit;
