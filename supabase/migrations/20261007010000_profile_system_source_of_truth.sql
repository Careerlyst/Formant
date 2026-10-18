-- Formant profile source-of-truth and assessment projection.
-- Additive only: existing profile rows and RLS policies are preserved.

begin;

alter table public.profiles
  add column if not exists location text,
  add column if not exists skills jsonb,
  add column if not exists certifications text,
  add column if not exists preferences jsonb;

-- Move legacy extended profile values into the profile row without replacing
-- data that has already been written to the new columns.
update public.profiles as profile
set
  location = coalesce(profile.location, metadata.value ->> 'location'),
  skills = coalesce(profile.skills, metadata.value -> 'skills'),
  certifications = coalesce(profile.certifications, metadata.value ->> 'certifications'),
  preferences = coalesce(profile.preferences, metadata.value -> 'preferences')
from auth.users as auth_user
cross join lateral (
  select auth_user.raw_user_meta_data -> 'formant_profile_meta' as value
) as metadata
where profile.id = auth_user.id
  and jsonb_typeof(metadata.value) = 'object'
  and (
    profile.location is null
    or profile.skills is null
    or profile.certifications is null
    or profile.preferences is null
  );

-- This column grant enables profile writes; the existing self/staff RLS
-- policies continue to determine which profile rows each caller may update.
revoke update (location, skills, certifications, preferences)
  on table public.profiles from public, anon;
grant update (location, skills, certifications, preferences)
  on table public.profiles to authenticated;

create or replace function public.calculate_careerlyst_lead_score(p_answers jsonb)
returns integer
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_score integer := 0;
  v_services jsonb;
  v_service text;
begin
  v_services := p_answers -> 'service';
  if jsonb_typeof(v_services) = 'array' then
    for v_service in select jsonb_array_elements_text(v_services)
    loop
      if v_service in ('resume', 'linkedin', 'portfolio', 'github', 'cover_letter', 'interview') then
        v_score := v_score + 2;
        exit;
      end if;
    end loop;
  elsif jsonb_typeof(v_services) = 'string'
    and p_answers ->> 'service' in ('resume', 'linkedin', 'portfolio', 'github', 'cover_letter', 'interview') then
    v_score := v_score + 2;
  end if;

  if p_answers ->> 'situation' in ('job_search', 'career_switch', 'internship', 'interview', 'profile') then
    v_score := v_score + 2;
  end if;

  v_score := v_score + case p_answers ->> 'urgency'
    when 'less_than_day' then 4
    when '1_3_days' then 3
    when '1_week' then 2
    when '2_4_weeks' then 1
    else 0
  end;

  if p_answers ->> 'materials' = 'yes' then v_score := v_score + 1; end if;
  if p_answers ->> 'activity' in ('actively_applying', 'upcoming') then v_score := v_score + 2; end if;
  v_score := v_score + case p_answers ->> 'budget'
    when '50_100' then 2
    when '100_plus' then 2
    when '25_50' then 1
    else 0
  end;
  v_score := v_score + case p_answers ->> 'readiness'
    when 'now' then 3
    when 'few_days' then 2
    when 'few_weeks' then 1
    else 0
  end;
  return v_score;
end;
$function$;

revoke all on function public.calculate_careerlyst_lead_score(jsonb) from public, anon, authenticated;
alter function public.calculate_careerlyst_lead_score(jsonb) owner to postgres;

create or replace function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_assessment jsonb;
  v_answers jsonb;
  v_score integer;
  v_status text;
begin
  if (old.raw_user_meta_data -> 'careerlyst_lead_assessment')
      is not distinct from (new.raw_user_meta_data -> 'careerlyst_lead_assessment') then
    return new;
  end if;

  v_assessment := new.raw_user_meta_data -> 'careerlyst_lead_assessment';
  if v_assessment is null or jsonb_typeof(v_assessment) <> 'object' then
    return new;
  end if;

  v_answers := coalesce(v_assessment -> 'answers', '{}'::jsonb);
  v_score := public.calculate_careerlyst_lead_score(v_answers);
  v_status := case
    when v_score >= 10 then 'hot'
    when v_score >= 6 then 'warm'
    when v_score >= 3 then 'cold'
    else 'exploring'
  end;

  update public.profiles
  set lead_assessment = v_assessment,
      lead_score = v_score,
      lead_status = v_status,
      lead_assessment_completed_at = now()
  where id = new.id;

  return new;
end;
$function$;

alter function public.handle_user_metadata_update() owner to postgres;

-- Recompute existing assessment records from their answers, rather than
-- trusting potentially stale client-supplied leadScore/leadStatus metadata.
update public.profiles as profile
set lead_score = public.calculate_careerlyst_lead_score(profile.lead_assessment -> 'answers'),
    lead_status = case
      when public.calculate_careerlyst_lead_score(profile.lead_assessment -> 'answers') >= 10 then 'hot'
      when public.calculate_careerlyst_lead_score(profile.lead_assessment -> 'answers') >= 6 then 'warm'
      when public.calculate_careerlyst_lead_score(profile.lead_assessment -> 'answers') >= 3 then 'cold'
      else 'exploring'
    end
where jsonb_typeof(profile.lead_assessment) = 'object'
  and jsonb_typeof(profile.lead_assessment -> 'answers') = 'object';

commit;
