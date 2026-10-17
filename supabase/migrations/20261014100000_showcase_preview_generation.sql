-- Track staff-triggered preview rendering without exposing source documents.
-- Apply only after reviewing the renderer deployment and Edge Function setup.

begin;

create table public.showcase_preview_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  source_kind text not null check (source_kind in ('pdf', 'website')),
  source_media_id uuid references public.showcase_project_images(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  overview_title text,
  overview_description text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint showcase_preview_job_source_v1 check (
    (source_kind = 'pdf')
    or (source_kind = 'website' and source_media_id is null)
  ),
  constraint showcase_preview_job_overview_length_v1 check (
    (overview_title is null or char_length(overview_title) <= 200)
    and (overview_description is null or char_length(overview_description) <= 1000)
    and (error_message is null or char_length(error_message) <= 1000)
  )
);

create table public.showcase_preview_job_outputs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.showcase_preview_jobs(id) on delete cascade,
  media_id uuid not null references public.showcase_project_images(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  created_at timestamptz not null default now(),
  unique (job_id, page_number),
  unique (media_id)
);

create index showcase_preview_jobs_project_created_idx_v1
  on public.showcase_preview_jobs (project_id, created_at desc);
create index showcase_preview_outputs_job_page_idx_v1
  on public.showcase_preview_job_outputs (job_id, page_number);

alter table public.showcase_preview_jobs enable row level security;
alter table public.showcase_preview_job_outputs enable row level security;
revoke all on public.showcase_preview_jobs, public.showcase_preview_job_outputs from public, anon, authenticated;
grant select on public.showcase_preview_jobs, public.showcase_preview_job_outputs to authenticated;
grant select, insert, update, delete on public.showcase_preview_jobs, public.showcase_preview_job_outputs to service_role;

create policy showcase_preview_jobs_staff_select_v1
  on public.showcase_preview_jobs for select to authenticated
  using (public.is_showcase_staff_v1());
create policy showcase_preview_outputs_staff_select_v1
  on public.showcase_preview_job_outputs for select to authenticated
  using (public.is_showcase_staff_v1());

commit;
