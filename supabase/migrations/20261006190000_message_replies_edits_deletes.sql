begin;

alter table public.messages
  add column if not exists reply_to_message_id bigint,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
grant insert (reply_to_message_id) on table public.messages to authenticated;

-- A composite reference makes cross-order replies impossible at the database
-- boundary while retaining the referenced message for soft-deleted originals.
create unique index if not exists messages_order_id_id_unique_v1
  on public.messages (order_id, id);
do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_reply_same_order_v1'
  ) then
    alter table public.messages
      add constraint messages_reply_same_order_v1
      foreign key (order_id, reply_to_message_id)
      references public.messages (order_id, id)
      on delete restrict;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_no_self_reply_v1'
  ) then
    alter table public.messages
      add constraint messages_no_self_reply_v1
      check (reply_to_message_id is null or reply_to_message_id <> id);
  end if;
end $$;
create index if not exists messages_reply_to_message_id_idx_v1
  on public.messages (reply_to_message_id) where reply_to_message_id is not null;

-- Deleted rows remain in the conversation for reply integrity, but they must
-- not create unread counts or make an order appear to need a reply.
create or replace function public.list_message_summaries_v1(p_order_ids bigint[] default null)
returns table (
  order_id bigint, latest_message_id bigint, latest_sender_id uuid,
  latest_body text, latest_created_at timestamptz, unread_count bigint,
  latest_unread_message_id bigint, latest_unread_body text,
  latest_unread_created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_is_staff boolean;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  v_is_staff := public.is_messaging_staff_v1();
  if not v_is_staff and not exists (
    select 1 from public.user_roles r where r.user_id = v_user_id and pg_catalog.lower(r.role) = 'client'
  ) then raise insufficient_privilege using message = 'Messaging access denied'; end if;
  return query
  select o.id, latest.id, latest.sender_id, latest.body, latest.created_at,
    coalesce(unread.count, 0)::bigint, unread_latest.id, unread_latest.body, unread_latest.created_at
  from public.orders o
  left join lateral (
    select m.id, m.sender_id, m.body, m.created_at from public.messages m
    where m.order_id = o.id and m.deleted_at is null
    order by m.created_at desc, m.id desc limit 1
  ) latest on true
  left join lateral (
    select pg_catalog.count(*) as count from public.messages m
    where m.order_id = o.id and m.deleted_at is null and m.sender_id <> v_user_id and m.read_at is null
      and ((v_is_staff and m.sender_id = o.user_id) or (not v_is_staff and m.sender_id <> v_user_id))
  ) unread on true
  left join lateral (
    select m.id, m.body, m.created_at from public.messages m
    where m.order_id = o.id and m.deleted_at is null and m.sender_id = o.user_id and m.read_at is null
    order by m.created_at desc, m.id desc limit 1
  ) unread_latest on true
  where (v_is_staff or o.user_id = v_user_id)
    and (p_order_ids is null or o.id = any(p_order_ids))
  order by coalesce(latest.created_at, o.created_at) desc, o.id desc;
end;
$$;
alter function public.list_message_summaries_v1(bigint[]) owner to postgres;
revoke all on function public.list_message_summaries_v1(bigint[]) from public, anon, authenticated;
grant execute on function public.list_message_summaries_v1(bigint[]) to authenticated;

-- Keep the existing reader untouched; this sibling includes only the extra
-- metadata needed by the upgraded UI and retains the same bounded checks.
create or replace function public.list_message_thread_actions_v1(
  p_order_id bigint,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint, order_id bigint, sender_id uuid, body text,
  created_at timestamptz, read_at timestamptz,
  reply_to_message_id bigint, edited_at timestamptz, deleted_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_user_id uuid;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  select o.user_id into v_order_user_id from public.orders o where o.id = p_order_id;
  if v_order_user_id is null or (v_order_user_id <> v_user_id and not public.is_messaging_staff_v1()) then
    raise insufficient_privilege using message = 'Order messaging access denied';
  end if;
  return query
    select m.id, m.order_id, m.sender_id, m.body, m.created_at, m.read_at,
           m.reply_to_message_id, m.edited_at, m.deleted_at
    from public.messages m
    where m.order_id = p_order_id
      and (p_before_created_at is null or (m.created_at, m.id) < (p_before_created_at, p_before_id))
    order by m.created_at desc, m.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;
alter function public.list_message_thread_actions_v1(bigint, timestamptz, bigint, integer) owner to postgres;
revoke all on function public.list_message_thread_actions_v1(bigint, timestamptz, bigint, integer) from public, anon, authenticated;
grant execute on function public.list_message_thread_actions_v1(bigint, timestamptz, bigint, integer) to authenticated;

create or replace function public.get_message_reply_context_v1(p_message_id bigint)
returns table (
  id bigint, order_id bigint, sender_id uuid, body text, created_at timestamptz,
  read_at timestamptz, reply_to_message_id bigint, edited_at timestamptz, deleted_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_order_user_id uuid;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  select o.user_id into v_order_user_id
  from public.messages m join public.orders o on o.id = m.order_id
  where m.id = p_message_id;
  if v_order_user_id is null or (v_order_user_id <> auth.uid() and not public.is_messaging_staff_v1()) then
    raise insufficient_privilege using message = 'Message access denied';
  end if;
  return query select m.id, m.order_id, m.sender_id, m.body, m.created_at, m.read_at,
                      m.reply_to_message_id, m.edited_at, m.deleted_at
    from public.messages m where m.id = p_message_id;
end;
$$;
alter function public.get_message_reply_context_v1(bigint) owner to postgres;
revoke all on function public.get_message_reply_context_v1(bigint) from public, anon, authenticated;
grant execute on function public.get_message_reply_context_v1(bigint) to authenticated;

create or replace function public.edit_message_v1(p_message_id bigint, p_body text)
returns table (
  id bigint, order_id bigint, sender_id uuid, body text, created_at timestamptz,
  read_at timestamptz, reply_to_message_id bigint, edited_at timestamptz, deleted_at timestamptz
)
language plpgsql security definer set search_path = ''
as $$
declare v_order_id bigint; v_order_user_id uuid;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if p_body is null or pg_catalog.length(pg_catalog.btrim(p_body)) = 0 or pg_catalog.length(p_body) > 2000
     or pg_catalog.left(p_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) = '__CAREERLYST_ATTACHMENT__:' then
    raise invalid_parameter_value using message = 'Only non-empty text messages up to 2000 characters can be edited';
  end if;
  select m.order_id, o.user_id into v_order_id, v_order_user_id
  from public.messages m join public.orders o on o.id = m.order_id
  where m.id = p_message_id and m.sender_id = auth.uid() and m.deleted_at is null
  for update of m;
  if v_order_id is null or not (
    (v_order_user_id = auth.uid() and exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and pg_catalog.lower(r.role) = 'client'
    )) or public.is_messaging_sender_v1()
  ) then raise insufficient_privilege using message = 'Only the message sender may edit this message'; end if;
  return query update public.messages m set body = p_body, edited_at = pg_catalog.now()
    where m.id = p_message_id
    returning m.id, m.order_id, m.sender_id, m.body, m.created_at, m.read_at,
              m.reply_to_message_id, m.edited_at, m.deleted_at;
end;
$$;
alter function public.edit_message_v1(bigint, text) owner to postgres;
revoke all on function public.edit_message_v1(bigint, text) from public, anon, authenticated;
grant execute on function public.edit_message_v1(bigint, text) to authenticated;

create or replace function public.delete_message_v1(p_message_id bigint)
returns table (id bigint, order_id bigint, sender_id uuid, created_at timestamptz,
               read_at timestamptz, reply_to_message_id bigint, edited_at timestamptz,
               deleted_at timestamptz, storage_path text)
language plpgsql security definer set search_path = ''
as $$
declare v_order_id bigint; v_order_user_id uuid; v_body text; v_payload jsonb; v_deleted_at timestamptz := pg_catalog.now();
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  select m.order_id, o.user_id, m.body into v_order_id, v_order_user_id, v_body
  from public.messages m join public.orders o on o.id = m.order_id
  where m.id = p_message_id and m.sender_id = auth.uid() and m.deleted_at is null
  for update of m;
  if v_order_id is null or not (
    (v_order_user_id = auth.uid() and exists (
      select 1 from public.user_roles r where r.user_id = auth.uid() and pg_catalog.lower(r.role) = 'client'
    )) or public.is_messaging_sender_v1()
  ) then raise insufficient_privilege using message = 'Only the message sender may delete this message'; end if;
  if pg_catalog.left(v_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) = '__CAREERLYST_ATTACHMENT__:' then
    begin v_payload := pg_catalog.substr(v_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:') + 1)::jsonb;
    exception when others then v_payload := '{}'::jsonb; end;
  end if;
  return query update public.messages m set body = 'This message was deleted.', deleted_at = v_deleted_at
    where m.id = p_message_id
    returning m.id, m.order_id, m.sender_id, m.created_at, m.read_at,
      m.reply_to_message_id, m.edited_at, m.deleted_at, coalesce(v_payload #>> '{attachment,path}', '');
end;
$$;
alter function public.delete_message_v1(bigint) owner to postgres;
revoke all on function public.delete_message_v1(bigint) from public, anon, authenticated;
grant execute on function public.delete_message_v1(bigint) to authenticated;

-- Keep the existing staff attachment-removal API compatible with soft-delete
-- and reply references; never physically remove a message row.
create or replace function public.admin_remove_message_attachment_v1(p_message_id bigint, p_storage_path text)
returns table (storage_path text, message_deleted boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_body text; v_payload jsonb; v_text text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles r where r.user_id = auth.uid()
      and pg_catalog.lower(r.role) in ('admin', 'expert', 'support')
  ) then raise insufficient_privilege using message = 'Staff attachment management required'; end if;
  select m.body into v_body from public.messages m where m.id = p_message_id and m.deleted_at is null for update;
  if v_body is null or pg_catalog.left(v_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:')) <> '__CAREERLYST_ATTACHMENT__:' then
    raise invalid_parameter_value using message = 'Message attachment was not found';
  end if;
  v_payload := pg_catalog.substr(v_body, pg_catalog.length('__CAREERLYST_ATTACHMENT__:') + 1)::jsonb;
  if coalesce(v_payload #>> '{attachment,path}', '') <> p_storage_path then
    raise insufficient_privilege using message = 'Attachment path does not match message';
  end if;
  v_text := coalesce(v_payload ->> 'text', '');
  if v_text <> '' then
    update public.messages set body = v_text, edited_at = pg_catalog.now() where id = p_message_id;
    return query select p_storage_path, false;
  else
    update public.messages set body = 'This message was deleted.', deleted_at = pg_catalog.now() where id = p_message_id;
    return query select p_storage_path, true;
  end if;
end;
$$;
alter function public.admin_remove_message_attachment_v1(bigint, text) owner to postgres;
revoke all on function public.admin_remove_message_attachment_v1(bigint, text) from public, anon, authenticated;
grant execute on function public.admin_remove_message_attachment_v1(bigint, text) to authenticated;

commit;
