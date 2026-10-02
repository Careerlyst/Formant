-- Migration: 20261001180000_fix_profiles_permissions_and_rls.sql
-- Description: Fix "permission denied for table profiles" by configuring column-level
--              permissions and Row Level Security (RLS) policies for public.profiles.
--
-- Security Design:
-- 1. Profiles are created exclusively by the auth trigger (handle_new_user) upon signup.
--    Table-level INSERT, DELETE, and TRUNCATE are revoked from authenticated and anon.
-- 2. Clients can only update their own row and only non-sensitive personal/career fields:
--    (name, phone, target_role, experience, education, linkedin, github, portfolio, bio).
-- 3. Sensitive fields (email, lead_assessment, lead_score, lead_status, lead_assessment_completed_at)
--    and system identifiers (id, created_at) remain strictly non-writable by clients.
-- 4. Existing RLS policies are preserved without blind drops; policies are created conditionally
--    only if an equivalent policy does not already exist.

begin;

-- Step 1: Ensure all standard profile columns exist before configuring column grants
alter table public.profiles
  add column if not exists phone text,
  add column if not exists target_role text,
  add column if not exists experience text,
  add column if not exists education text,
  add column if not exists linkedin text,
  add column if not exists github text,
  add column if not exists portfolio text,
  add column if not exists bio text;

-- Step 2: Ensure Row Level Security is active
alter table public.profiles enable row level security;

-- Step 3: Configure Table and Column Permissions (ACL Layer)
-- Revoke table-level write privileges from authenticated and anon roles
revoke insert, update, delete, truncate on table public.profiles from authenticated;
revoke insert, update, delete, truncate on table public.profiles from anon;

-- Grant table-level read privilege to authenticated users
grant select on table public.profiles to authenticated;

-- Grant column-level UPDATE strictly on permitted profile fields to authenticated users
grant update (
  name,
  phone,
  target_role,
  experience,
  education,
  linkedin,
  github,
  portfolio,
  bio
) on table public.profiles to authenticated;

-- Step 4: Conditionally configure RLS policies (preserves existing policies)

-- 4a. Client SELECT Policy: Authenticated users can view their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
      and (
        policyname = 'Users can view own profile'
        or policyname = 'profiles_user_select'
        or policyname = 'profiles_self_select'
        or policyname = 'Public profiles are viewable by everyone'
      )
  ) then
    create policy "Users can view own profile"
      on public.profiles
      for select
      to authenticated
      using ((select auth.uid()) = id);
  end if;
end $$;

-- 4b. Staff SELECT Policy: Staff members can view all profiles
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
      and (
        policyname = 'Staff can view all profiles'
        or policyname = 'profiles_staff_select'
        or policyname = 'Staff can view profiles'
      )
  ) then
    create policy "Staff can view all profiles"
      on public.profiles
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
  end if;
end $$;

-- 4c. Client UPDATE Policy: Authenticated users can update their own profile row
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
      and (
        policyname = 'Users can update own profile'
        or policyname = 'profiles_user_update'
        or policyname = 'profiles_self_update'
      )
  ) then
    create policy "Users can update own profile"
      on public.profiles
      for update
      to authenticated
      using ((select auth.uid()) = id)
      with check ((select auth.uid()) = id);
  end if;
end $$;

-- 4d. Staff UPDATE Policy: Staff members can update profiles
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'UPDATE'
      and (
        policyname = 'Staff can update profiles'
        or policyname = 'profiles_staff_update'
        or policyname = 'Staff can update all profiles'
      )
  ) then
    create policy "Staff can update profiles"
      on public.profiles
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
  end if;
end $$;

commit;
