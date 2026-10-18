begin;

-- Service delivery is an order-level layer; existing order/payment lifecycle
-- columns remain untouched. Templates are keyed to the existing services rows.
create table public.service_workflow_templates (
  service_id uuid primary key references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_workflow_stages (
  service_id uuid not null references public.service_workflow_templates(service_id) on delete cascade,
  stage_key text not null check (stage_key ~ '^[a-z0-9_]+$'),
  sequence integer not null check (sequence > 0),
  admin_title text not null check (length(btrim(admin_title)) between 1 and 100),
  client_title text not null check (length(btrim(client_title)) between 1 and 100),
  client_description text not null default '',
  is_optional boolean not null default false,
  primary key (service_id, stage_key),
  unique (service_id, sequence)
);

create table public.order_roadmaps (
  order_id bigint primary key references public.orders(id) on delete cascade,
  service_id uuid not null references public.service_workflow_templates(service_id) on delete restrict,
  current_stage_key text not null,
  current_status text not null default 'CURRENT'
    check (current_status in ('CURRENT', 'BLOCKED', 'WAITING_ON_CLIENT', 'COMPLETED')),
  client_update text not null default '' check (length(client_update) <= 1200),
  client_action_title text not null default '' check (length(client_action_title) <= 160),
  client_action_description text not null default '' check (length(client_action_description) <= 1000),
  internal_reason text not null default '' check (length(internal_reason) <= 2000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (service_id, current_stage_key)
    references public.service_workflow_stages(service_id, stage_key)
    on update cascade on delete restrict,
  check (
    (current_status = 'WAITING_ON_CLIENT' and length(btrim(client_action_title)) > 0
      and length(btrim(client_action_description)) > 0)
    or current_status <> 'WAITING_ON_CLIENT'
  )
);

create table public.order_roadmap_history (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.order_roadmaps(order_id) on delete cascade,
  service_id uuid not null,
  previous_stage_key text not null,
  new_stage_key text not null,
  previous_status text not null check (previous_status in ('CURRENT', 'BLOCKED', 'WAITING_ON_CLIENT', 'COMPLETED')),
  new_status text not null check (new_status in ('CURRENT', 'BLOCKED', 'WAITING_ON_CLIENT', 'COMPLETED')),
  client_update text not null default '',
  client_action_title text not null default '',
  client_action_description text not null default '',
  internal_reason text not null default '' check (length(internal_reason) <= 2000),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (service_id, previous_stage_key)
    references public.service_workflow_stages(service_id, stage_key) on update cascade on delete restrict,
  foreign key (service_id, new_stage_key)
    references public.service_workflow_stages(service_id, stage_key) on update cascade on delete restrict
);

create index order_roadmap_history_order_created_idx
  on public.order_roadmap_history(order_id, created_at desc, id desc);

alter table public.service_workflow_templates enable row level security;
alter table public.service_workflow_stages enable row level security;
alter table public.order_roadmaps enable row level security;
alter table public.order_roadmap_history enable row level security;

-- These tables intentionally have no direct Data API grants. Public callers
-- receive the narrow client-safe projection from a checked RPC only.
revoke all privileges on table
  public.service_workflow_templates,
  public.service_workflow_stages,
  public.order_roadmaps,
  public.order_roadmap_history
from public, anon, authenticated;

grant all privileges on table
  public.service_workflow_templates,
  public.service_workflow_stages,
  public.order_roadmaps,
  public.order_roadmap_history
to service_role;

insert into public.service_workflow_templates (service_id)
select id from public.services
where name in ('Resume / CV', 'LinkedIn', 'GitHub', 'Portfolio', 'Cover Letter', 'Interview Preparation')
on conflict (service_id) do nothing;

with workflow(service_name, stage_key, sequence, admin_title, client_title, client_description) as (
  values
    ('Resume / CV','order_confirmed',1,'Order Confirmed','Order confirmed','Your resume project is ready to begin.'),
    ('Resume / CV','intake',2,'Intake','Information review','We are reviewing the information you shared.'),
    ('Resume / CV','career_role_review',3,'Career & Role Review','Career review','We are aligning your experience with your target role.'),
    ('Resume / CV','experience_analysis',4,'Experience Analysis','Experience analysis','We are identifying the strongest parts of your experience.'),
    ('Resume / CV','content_strategy',5,'Content Strategy','Resume strategy','We are planning how to present your career story.'),
    ('Resume / CV','resume_draft',6,'Resume Draft','Draft in progress','We are writing your tailored resume.'),
    ('Resume / CV','internal_review',7,'Internal Review','Quality review','Our team is reviewing the draft for clarity and accuracy.'),
    ('Resume / CV','client_review',8,'Client Review','Your review','Your resume will be ready for your feedback.'),
    ('Resume / CV','revision',9,'Revision','Refinements','We are refining the resume using your feedback.'),
    ('Resume / CV','final_quality_check',10,'Final Quality Check','Final review','We are checking the final details.'),
    ('Resume / CV','final_delivery',11,'Final Delivery','Final delivery','Your completed resume is being prepared for delivery.'),
    ('Resume / CV','complete',12,'Complete','Complete','Your resume project is complete.'),
    ('LinkedIn','order_confirmed',1,'Order Confirmed','Order confirmed','Your LinkedIn project is ready to begin.'),
    ('LinkedIn','profile_intake',2,'Profile Intake','Profile intake','We are gathering your profile and career details.'),
    ('LinkedIn','career_positioning',3,'Career Positioning','Career positioning','We are shaping how your experience is presented.'),
    ('LinkedIn','existing_profile_audit',4,'Existing Profile Audit','Profile review','We are reviewing your current LinkedIn profile.'),
    ('LinkedIn','content_strategy',5,'Content Strategy','Profile strategy','We are planning the content and structure for your profile.'),
    ('LinkedIn','profile_development',6,'Profile Development','Profile development','We are building your optimized profile content.'),
    ('LinkedIn','profile_optimization',7,'Profile Optimization','Profile optimization','We are refining your profile for clarity and discoverability.'),
    ('LinkedIn','internal_review',8,'Internal Review','Quality review','Our team is reviewing your profile draft.'),
    ('LinkedIn','client_review',9,'Client Review','Your review','Your profile draft will be ready for your feedback.'),
    ('LinkedIn','revision',10,'Revision','Refinements','We are refining your profile using your feedback.'),
    ('LinkedIn','final_quality_check',11,'Final Quality Check','Final review','We are checking the final profile details.'),
    ('LinkedIn','final_delivery',12,'Final Delivery','Final delivery','Your completed LinkedIn content is being prepared.'),
    ('LinkedIn','complete',13,'Complete','Complete','Your LinkedIn project is complete.'),
    ('GitHub','order_confirmed',1,'Order Confirmed','Order confirmed','Your GitHub project is ready to begin.'),
    ('GitHub','developer_intake',2,'Developer Intake','Developer intake','We are reviewing your developer background and goals.'),
    ('GitHub','career_project_review',3,'Career & Project Review','Career and project review','We are identifying the projects that best represent your work.'),
    ('GitHub','github_audit',4,'GitHub Audit','GitHub profile review','We are reviewing your GitHub profile and repositories.'),
    ('GitHub','repository_review',5,'Repository Review','Project review','We are reviewing your selected repositories.'),
    ('GitHub','content_structure_plan',6,'Content & Structure Plan','Profile plan','We are planning your profile and project presentation.'),
    ('GitHub','profile_optimization',7,'Profile Optimization','Profile optimization','We are improving your GitHub profile presentation.'),
    ('GitHub','repository_improvements',8,'Repository Improvements','Project improvements','We are improving how your GitHub projects are presented.'),
    ('GitHub','internal_review',9,'Internal Review','Quality review','Our team is reviewing the profile and project updates.'),
    ('GitHub','client_review',10,'Client Review','Your review','Your GitHub updates will be ready for your feedback.'),
    ('GitHub','revision',11,'Revision','Refinements','We are refining the updates using your feedback.'),
    ('GitHub','final_quality_check',12,'Final Quality Check','Final review','We are checking the final project details.'),
    ('GitHub','final_delivery',13,'Final Delivery','Final delivery','Your completed GitHub updates are being prepared.'),
    ('GitHub','complete',14,'Complete','Complete','Your GitHub project is complete.'),
    ('Portfolio','order_confirmed',1,'Order Confirmed','Order confirmed','Your portfolio project is ready to begin.'),
    ('Portfolio','discovery',2,'Discovery','Discovery','We are learning about your goals and the work you want to showcase.'),
    ('Portfolio','career_positioning',3,'Career Positioning','Career positioning','We are shaping the story your portfolio will tell.'),
    ('Portfolio','project_review',4,'Project Review','Project review','We are reviewing the projects you want to feature.'),
    ('Portfolio','portfolio_strategy',5,'Portfolio Strategy','Portfolio strategy','We are planning the structure and direction of your portfolio.'),
    ('Portfolio','content_architecture',6,'Content Architecture','Portfolio structure','We are organizing the portfolio content and sections.'),
    ('Portfolio','portfolio_development',7,'Portfolio Development','Portfolio development','We are building your professional portfolio.'),
    ('Portfolio','project_presentation',8,'Project Presentation','Project presentation','We are refining how your projects are presented.'),
    ('Portfolio','internal_review',9,'Internal Review','Quality review','Our team is reviewing the portfolio.'),
    ('Portfolio','client_review',10,'Client Review','Your review','Your portfolio draft will be ready for your feedback.'),
    ('Portfolio','revision',11,'Revision','Refinements','We are refining your portfolio using your feedback.'),
    ('Portfolio','final_quality_check',12,'Final Quality Check','Final review','We are checking the final portfolio details.'),
    ('Portfolio','final_delivery',13,'Final Delivery','Final delivery','Your completed portfolio is being prepared.'),
    ('Portfolio','complete',14,'Complete','Complete','Your portfolio project is complete.'),
    ('Cover Letter','order_confirmed',1,'Order Confirmed','Order confirmed','Your cover letter project is ready to begin.'),
    ('Cover Letter','job_details_received',2,'Job Details Received','Application details','We are reviewing the role and application details you shared.'),
    ('Cover Letter','candidate_review',3,'Candidate Review','Candidate review','We are reviewing your experience and strengths.'),
    ('Cover Letter','role_analysis',4,'Role Analysis','Role analysis','We are analyzing what the opportunity requires.'),
    ('Cover Letter','opportunity_positioning',5,'Opportunity Positioning','Application positioning','We are connecting your experience to this opportunity.'),
    ('Cover Letter','letter_strategy',6,'Letter Strategy','Letter strategy','We are planning a focused story for your application.'),
    ('Cover Letter','first_draft',7,'First Draft','Draft in progress','We are writing your tailored cover letter.'),
    ('Cover Letter','internal_review',8,'Internal Review','Quality review','Our team is reviewing your cover letter draft.'),
    ('Cover Letter','client_review',9,'Client Review','Your review','Your cover letter will be ready for your feedback.'),
    ('Cover Letter','revision',10,'Revision','Refinements','We are refining the letter using your feedback.'),
    ('Cover Letter','final_quality_check',11,'Final Quality Check','Final review','We are checking the final details.'),
    ('Cover Letter','final_delivery',12,'Final Delivery','Final delivery','Your completed cover letter is being prepared.'),
    ('Cover Letter','complete',13,'Complete','Complete','Your cover letter project is complete.'),
    ('Interview Preparation','order_confirmed',1,'Order Confirmed','Order confirmed','Your interview preparation is ready to begin.'),
    ('Interview Preparation','candidate_intake',2,'Candidate Intake','Candidate intake','We are reviewing your background and interview goals.'),
    ('Interview Preparation','role_analysis',3,'Role Analysis','Role analysis','We are analyzing the role and its requirements.'),
    ('Interview Preparation','interview_research',4,'Interview Research','Interview research','We are researching likely interview topics.'),
    ('Interview Preparation','preparation_strategy',5,'Preparation Strategy','Preparation plan','We are building a focused preparation approach.'),
    ('Interview Preparation','question_development',6,'Question Development','Practice questions','We are preparing role-specific practice questions.'),
    ('Interview Preparation','practice_preparation',7,'Practice Preparation','Practice preparation','We are organizing materials for your practice.'),
    ('Interview Preparation','mock_practice_session',8,'Mock / Practice Session','Practice session','Your practice session is being prepared or scheduled.'),
    ('Interview Preparation','feedback_evaluation',9,'Feedback & Evaluation','Feedback','We are preparing practical feedback and evaluation.'),
    ('Interview Preparation','client_review',10,'Client Review','Your review','Your preparation plan will be ready for your feedback.'),
    ('Interview Preparation','revision_refinement',11,'Revision / Refinement','Refinements','We are refining the preparation plan using your feedback.'),
    ('Interview Preparation','final_preparation_plan',12,'Final Preparation Plan','Final preparation plan','Your final interview preparation plan is being prepared.'),
    ('Interview Preparation','complete',13,'Complete','Complete','Your interview preparation project is complete.')
)
insert into public.service_workflow_stages(service_id, stage_key, sequence, admin_title, client_title, client_description)
select s.id, w.stage_key, w.sequence, w.admin_title, w.client_title, w.client_description
from workflow w join public.services s on s.name = w.service_name
on conflict (service_id, stage_key) do update set
  sequence = excluded.sequence,
  admin_title = excluded.admin_title,
  client_title = excluded.client_title,
  client_description = excluded.client_description;

create or replace function public.initialize_order_roadmap_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_service_id uuid;
  v_first_stage text;
begin
  select s.id into v_service_id
  from public.services s
  join public.service_workflow_templates t on t.service_id = s.id
  where lower(btrim(s.name)) = lower(btrim(coalesce(new.service_name, '')))
  limit 1;
  if v_service_id is null then return new; end if;
  select stage_key into v_first_stage from public.service_workflow_stages
  where service_id = v_service_id order by sequence limit 1;
  if v_first_stage is not null then
    insert into public.order_roadmaps(order_id, service_id, current_stage_key, current_status)
    values (new.id, v_service_id, v_first_stage, 'CURRENT')
    on conflict (order_id) do nothing;
  end if;
  return new;
end;
$function$;

alter function public.initialize_order_roadmap_v1() owner to postgres;
revoke all on function public.initialize_order_roadmap_v1() from public, anon, authenticated;

create trigger orders_initialize_roadmap_v1
after insert on public.orders
for each row execute function public.initialize_order_roadmap_v1();

insert into public.order_roadmaps(order_id, service_id, current_stage_key, current_status)
select o.id, s.id, first_stage.stage_key, 'CURRENT'
from public.orders o
join public.services s on lower(btrim(s.name)) = lower(btrim(coalesce(o.service_name, '')))
join public.service_workflow_templates t on t.service_id = s.id
cross join lateral (
  select stage_key from public.service_workflow_stages st
  where st.service_id = s.id order by st.sequence limit 1
) first_stage
on conflict (order_id) do nothing;

create or replace function public.admin_get_order_roadmap_v1(p_order_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select lower(r.role) into v_role from public.user_roles r where r.user_id = auth.uid();
  if coalesce(v_role, '') not in ('admin', 'expert', 'support', 'finance') then
    raise exception 'Staff authorization is required.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'order_id', r.order_id,
    'service_id', r.service_id,
    'service_name', s.name,
    'current_stage_key', r.current_stage_key,
    'current_status', r.current_status,
    'client_update', r.client_update,
    'client_action_title', r.client_action_title,
    'client_action_description', r.client_action_description,
    'internal_reason', r.internal_reason,
    'updated_by', r.updated_by,
    'updated_at', r.updated_at,
    'progress', case when r.current_status = 'COMPLETED' then 100 else coalesce((
      select floor(100.0 * count(*) filter (where st.sequence < current_stage.sequence and not st.is_optional)
        / nullif(count(*) filter (where not st.is_optional), 0))::integer
      from public.service_workflow_stages st where st.service_id = r.service_id
    ), 0) end,
    'stages', (select jsonb_agg(jsonb_build_object(
      'stage_key', st.stage_key, 'sequence', st.sequence, 'admin_title', st.admin_title,
      'client_title', st.client_title, 'client_description', st.client_description,
      'is_optional', st.is_optional,
      'status', case when st.sequence < current_stage.sequence then 'COMPLETED'
        when st.stage_key = r.current_stage_key then r.current_status else 'NOT_STARTED' end
    ) order by st.sequence) from public.service_workflow_stages st where st.service_id = r.service_id),
    'history', (select coalesce(jsonb_agg(jsonb_build_object(
      'previous_stage_key', h.previous_stage_key, 'new_stage_key', h.new_stage_key,
      'previous_status', h.previous_status, 'new_status', h.new_status,
      'client_update', h.client_update, 'client_action_title', h.client_action_title,
      'client_action_description', h.client_action_description, 'internal_reason', h.internal_reason,
      'actor_id', h.actor_id, 'created_at', h.created_at
    ) order by h.created_at desc, h.id desc), '[]'::jsonb)
      from public.order_roadmap_history h where h.order_id = r.order_id)
  ) into v_result
  from public.order_roadmaps r
  join public.services s on s.id = r.service_id
  join public.service_workflow_stages current_stage
    on current_stage.service_id = r.service_id and current_stage.stage_key = r.current_stage_key
  where r.order_id = p_order_id;
  if v_result is null then raise exception 'No roadmap is configured for this order.' using errcode = 'P0002'; end if;
  return v_result;
end;
$function$;

create or replace function public.admin_update_order_roadmap_v1(
  p_order_id bigint,
  p_stage_key text,
  p_status text default 'CURRENT',
  p_client_update text default '',
  p_client_action_title text default '',
  p_client_action_description text default '',
  p_internal_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_roadmap public.order_roadmaps%rowtype;
  v_current_sequence integer;
  v_target_sequence integer;
  v_last_sequence integer;
  v_status text := upper(coalesce(p_status, 'CURRENT'));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select lower(r.role) into v_role from public.user_roles r where r.user_id = auth.uid();
  if coalesce(v_role, '') not in ('admin', 'expert', 'support') then
    raise exception 'Roadmap editing requires an authorized staff role.' using errcode = '42501';
  end if;
  if v_status not in ('CURRENT', 'BLOCKED', 'WAITING_ON_CLIENT', 'COMPLETED') then
    raise exception 'Invalid roadmap status.' using errcode = '22023';
  end if;
  if length(coalesce(p_client_update, '')) > 1200
    or length(coalesce(p_client_action_title, '')) > 160
    or length(coalesce(p_client_action_description, '')) > 1000
    or length(coalesce(p_internal_reason, '')) > 2000 then
    raise exception 'Roadmap update exceeds the allowed length.' using errcode = '22023';
  end if;
  select * into v_roadmap from public.order_roadmaps where order_id = p_order_id for update;
  if not found then raise exception 'No roadmap is configured for this order.' using errcode = 'P0002'; end if;
  select sequence into v_current_sequence from public.service_workflow_stages
    where service_id = v_roadmap.service_id and stage_key = v_roadmap.current_stage_key;
  select sequence into v_target_sequence from public.service_workflow_stages
    where service_id = v_roadmap.service_id and stage_key = p_stage_key;
  if v_target_sequence is null then raise exception 'The selected stage does not belong to this service.' using errcode = '22023'; end if;
  select max(sequence) into v_last_sequence from public.service_workflow_stages where service_id = v_roadmap.service_id and not is_optional;
  if abs(v_target_sequence - v_current_sequence) > 1 then
    raise exception 'Move one stage at a time to preserve the delivery sequence.' using errcode = '22023';
  end if;
  if v_target_sequence < v_current_sequence and length(btrim(coalesce(p_internal_reason, ''))) = 0 then
    raise exception 'Provide an internal reason when reopening an earlier stage.' using errcode = '22023';
  end if;
  if v_status = 'COMPLETED' and v_target_sequence <> v_last_sequence then
    raise exception 'Only the final required stage can be marked complete.' using errcode = '22023';
  end if;
  if v_status = 'WAITING_ON_CLIENT' and (length(btrim(coalesce(p_client_action_title, ''))) = 0 or length(btrim(coalesce(p_client_action_description, ''))) = 0) then
    raise exception 'A client-safe action is required while waiting on the client.' using errcode = '22023';
  end if;
  insert into public.order_roadmap_history(
    order_id, service_id, previous_stage_key, new_stage_key, previous_status, new_status,
    client_update, client_action_title, client_action_description, internal_reason, actor_id
  ) values (
    p_order_id, v_roadmap.service_id, v_roadmap.current_stage_key, p_stage_key,
    v_roadmap.current_status, v_status, coalesce(p_client_update, ''),
    coalesce(p_client_action_title, ''), coalesce(p_client_action_description, ''),
    coalesce(p_internal_reason, ''), auth.uid()
  );
  update public.order_roadmaps set
    current_stage_key = p_stage_key,
    current_status = v_status,
    client_update = coalesce(p_client_update, ''),
    client_action_title = case when v_status = 'WAITING_ON_CLIENT' then btrim(coalesce(p_client_action_title, '')) else '' end,
    client_action_description = case when v_status = 'WAITING_ON_CLIENT' then btrim(coalesce(p_client_action_description, '')) else '' end,
    internal_reason = coalesce(p_internal_reason, ''),
    updated_by = auth.uid(), updated_at = now()
  where order_id = p_order_id;
  v_result := public.admin_get_order_roadmap_v1(p_order_id);
  return v_result;
end;
$function$;

create or replace function public.get_my_order_roadmaps_v1(p_order_ids bigint[] default null)
returns table (
  order_id bigint,
  service_name text,
  current_stage_key text,
  current_stage_title text,
  current_status text,
  progress integer,
  client_update text,
  client_action_title text,
  client_action_description text,
  stages jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
begin
  if v_user_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  select lower(r.role) into v_role from public.user_roles r where r.user_id = v_user_id;
  if coalesce(v_role, '') <> 'client' then raise exception 'Client authorization is required.' using errcode = '42501'; end if;
  return query
  select r.order_id, s.name, r.current_stage_key, current_stage.client_title,
    r.current_status,
    case when r.current_status = 'COMPLETED' then 100 else coalesce((
      select floor(100.0 * count(*) filter (where st.sequence < current_stage.sequence and not st.is_optional)
        / nullif(count(*) filter (where not st.is_optional), 0))::integer
      from public.service_workflow_stages st where st.service_id = r.service_id
    ), 0) end,
    r.client_update, r.client_action_title, r.client_action_description,
    (select jsonb_agg(jsonb_build_object(
      'stage_key', st.stage_key, 'sequence', st.sequence, 'title', st.client_title,
      'description', st.client_description, 'is_optional', st.is_optional,
      'status', case when st.sequence < current_stage.sequence then 'COMPLETED'
        when st.stage_key = r.current_stage_key then r.current_status else 'NOT_STARTED' end
    ) order by st.sequence) from public.service_workflow_stages st where st.service_id = r.service_id)
  from public.order_roadmaps r
  join public.orders o on o.id = r.order_id and o.user_id = v_user_id
  join public.services s on s.id = r.service_id
  join public.service_workflow_stages current_stage
    on current_stage.service_id = r.service_id and current_stage.stage_key = r.current_stage_key
  where p_order_ids is null or r.order_id = any(p_order_ids)
  order by r.order_id;
end;
$function$;

alter function public.admin_get_order_roadmap_v1(bigint) owner to postgres;
alter function public.admin_update_order_roadmap_v1(bigint, text, text, text, text, text, text) owner to postgres;
alter function public.get_my_order_roadmaps_v1(bigint[]) owner to postgres;

revoke all on function public.admin_get_order_roadmap_v1(bigint) from public, anon, authenticated;
revoke all on function public.admin_update_order_roadmap_v1(bigint, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_my_order_roadmaps_v1(bigint[]) from public, anon, authenticated;
grant execute on function public.admin_get_order_roadmap_v1(bigint) to authenticated;
grant execute on function public.admin_update_order_roadmap_v1(bigint, text, text, text, text, text, text) to authenticated;
grant execute on function public.get_my_order_roadmaps_v1(bigint[]) to authenticated;

commit;
