-- Persist a stable reference to the curated Formant avatar library.
-- Existing self-profile RLS policies continue to restrict which row a client can update.

begin;

alter table public.profiles
  add column if not exists avatar_id smallint;

-- Preview before applying: count all profiles that need an assignment.
-- select count(*) from public.profiles p
-- where p.avatar_id is null or p.avatar_id not between 1 and 76;

-- Stable deterministic backfill for every profile, including staff. Valid IDs
-- are never overwritten; UUID ordering distributes missing/invalid IDs across
-- the complete approved collection. Re-running leaves assigned IDs unchanged.
with ranked_profiles as (
  select p.id, row_number() over (order by p.id::text) as avatar_rank
  from public.profiles p
  where p.avatar_id is null or p.avatar_id not between 1 and 76
)
update public.profiles p
set avatar_id = (((ranked_profiles.avatar_rank - 1) % 76) + 1)::smallint
from ranked_profiles
where p.id = ranked_profiles.id;

-- Apply the constraint after repairing legacy out-of-range values.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_avatar_id_library_range'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_id_library_range
      check (avatar_id is null or avatar_id between 1 and 76);
  end if;
end
$$;

-- Preserve the column allowlist model even if a prior environment had a broad
-- table-level grant. Existing per-column grants remain in place.
revoke update on table public.profiles from public, anon, authenticated;
revoke update (avatar_id) on table public.profiles from public, anon, authenticated;

-- Avatar writes are deliberately narrower than the existing staff-wide
-- profiles UPDATE policy: callers can only change their own avatar column.
create or replace function public.save_own_profile_avatar_v1(p_avatar_id smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_saved_avatar_id smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication is required to save an avatar.' using errcode = '42501';
  end if;

  if p_avatar_id is null or p_avatar_id not between 1 and 76 then
    raise exception 'Avatar ID must be between 1 and 76.' using errcode = '22023';
  end if;

  update public.profiles
  set avatar_id = p_avatar_id
  where id = v_user_id
  returning avatar_id into v_saved_avatar_id;

  if not found then
    raise exception 'The authenticated profile row does not exist.' using errcode = 'P0002';
  end if;

  return v_saved_avatar_id;
end
$function$;
alter function public.save_own_profile_avatar_v1(smallint) owner to postgres;
revoke all on function public.save_own_profile_avatar_v1(smallint) from public, anon, authenticated;
grant execute on function public.save_own_profile_avatar_v1(smallint) to authenticated;

comment on column public.profiles.avatar_id is
  'Nullable stable ID from the curated Formant avatar library; null resolves to the approved local fallback avatar until onboarding saves a selection.';

commit;
