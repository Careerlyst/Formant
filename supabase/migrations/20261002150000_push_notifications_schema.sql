-- Migration: 20261002150000_push_notifications_schema.sql
-- Description: Creates public.push_subscriptions table and ensures public.notifications
--              supports both user_id and recipient_id, with robust RLS policies.

begin;

-- ============================================================================
-- 1. Ensure public.notifications table exists and has consistent schema
-- ============================================================================
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  order_id bigint references public.orders(id) on delete cascade,
  type text not null default 'system',
  priority text not null default 'normal',
  title text not null,
  body text,
  action_url text,
  link text,
  metadata jsonb default '{}'::jsonb,
  is_read boolean default false,
  read_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Ensure all expected columns exist if the table was created previously
alter table public.notifications
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists recipient_id uuid references public.profiles(id) on delete cascade,
  add column if not exists order_id bigint references public.orders(id) on delete cascade,
  add column if not exists type text not null default 'system',
  add column if not exists priority text not null default 'normal',
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists action_url text,
  add column if not exists link text,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists is_read boolean default false,
  add column if not exists read_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

-- Ensure sync between user_id and recipient_id if one is set but not the other
create or replace function public.sync_notification_recipient()
returns trigger as $$
begin
  if new.user_id is null and new.recipient_id is not null then
    new.user_id := new.recipient_id;
  elsif new.recipient_id is null and new.user_id is not null then
    new.recipient_id := new.user_id;
  end if;

  if new.action_url is null and new.link is not null then
    new.action_url := new.link;
  elsif new.link is null and new.action_url is not null then
    new.link := new.action_url;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_notification_recipient on public.notifications;
create trigger trg_sync_notification_recipient
  before insert or update on public.notifications
  for each row execute function public.sync_notification_recipient();

-- Enable RLS on notifications
alter table public.notifications enable row level security;

-- Grants on notifications
grant select, update on table public.notifications to authenticated;
grant insert, delete on table public.notifications to authenticated;

-- Notifications RLS: Users can view and update their own notifications
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can view own notifications'
  ) then
    create policy "Users can view own notifications"
      on public.notifications
      for select
      to authenticated
      using (
        (select auth.uid()) = user_id or (select auth.uid()) = recipient_id
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users can update own notifications'
  ) then
    create policy "Users can update own notifications"
      on public.notifications
      for update
      to authenticated
      using (
        (select auth.uid()) = user_id or (select auth.uid()) = recipient_id
      );
  end if;
end $$;

-- Notifications RLS: Staff can view, insert, update, and delete all notifications
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'Staff manage notifications'
  ) then
    create policy "Staff manage notifications"
      on public.notifications
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.user_roles
          where user_roles.user_id = (select auth.uid())
            and lower(user_roles.role) in ('admin', 'expert', 'support', 'finance')
        )
      )
      with check (
        exists (
          select 1
          from public.user_roles
          where user_roles.user_id = (select auth.uid())
            and lower(user_roles.role) in ('admin', 'expert', 'support', 'finance')
        )
      );
  end if;
end $$;

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_recipient_id on public.notifications(recipient_id);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- ============================================================================
-- 2. Create public.push_subscriptions table
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_success_at timestamptz,
  invalidated_at timestamptz
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Grants
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

-- RLS: Client self-management
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can view own push subscriptions'
  ) then
    create policy "Users can view own push subscriptions"
      on public.push_subscriptions
      for select
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can insert own push subscriptions'
  ) then
    create policy "Users can insert own push subscriptions"
      on public.push_subscriptions
      for insert
      to authenticated
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can update own push subscriptions'
  ) then
    create policy "Users can update own push subscriptions"
      on public.push_subscriptions
      for update
      to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can delete own push subscriptions'
  ) then
    create policy "Users can delete own push subscriptions"
      on public.push_subscriptions
      for delete
      to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end $$;

-- RLS: Staff can view all subscriptions to resolve push delivery targets
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Staff can view all push subscriptions'
  ) then
    create policy "Staff can view all push subscriptions"
      on public.push_subscriptions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.user_roles
          where user_roles.user_id = (select auth.uid())
            and lower(user_roles.role) in ('admin', 'expert', 'support', 'finance')
        )
      );
  end if;
end $$;

-- RLS: Staff can invalidate subscriptions on 404/410 push responses
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Staff can update push subscriptions'
  ) then
    create policy "Staff can update push subscriptions"
      on public.push_subscriptions
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.user_roles
          where user_roles.user_id = (select auth.uid())
            and lower(user_roles.role) in ('admin', 'expert', 'support', 'finance')
        )
      );
  end if;
end $$;

-- Indexes
create index if not exists idx_push_subs_user_id on public.push_subscriptions(user_id);
create index if not exists idx_push_subs_endpoint on public.push_subscriptions(endpoint);
create index if not exists idx_push_subs_valid on public.push_subscriptions(user_id) where invalidated_at is null;

commit;
