-- Backfill assessment projections that predate the profiles source of truth.
-- Only fill profiles with no assessment record; never replace profile data.
begin;

update public.profiles as profile
set
  lead_assessment = source.assessment,
  lead_score = public.calculate_careerlyst_lead_score(source.assessment -> 'answers'),
  lead_status = case
    when public.calculate_careerlyst_lead_score(source.assessment -> 'answers') >= 10 then 'hot'
    when public.calculate_careerlyst_lead_score(source.assessment -> 'answers') >= 6 then 'warm'
    when public.calculate_careerlyst_lead_score(source.assessment -> 'answers') >= 3 then 'cold'
    else 'exploring'
  end,
  lead_assessment_completed_at = coalesce(
    profile.lead_assessment_completed_at,
    (source.assessment ->> 'completedAt')::timestamptz
  )
from auth.users as auth_user
cross join lateral (
  select auth_user.raw_user_meta_data -> 'careerlyst_lead_assessment' as assessment
) as source
where profile.id = auth_user.id
  and profile.lead_assessment is null
  and jsonb_typeof(source.assessment) = 'object'
  and jsonb_typeof(source.assessment -> 'answers') = 'object'
  and source.assessment ->> 'completedAt'
    ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$';

commit;
