-- Prevent duplicate concurrent rendering for the same Showcase source.
-- Failed and completed jobs remain retryable; stale processing jobs are
-- recovered by the Edge Function before it attempts a new job insert.

begin;

do $migration$
begin
  if exists (
    select 1
    from public.showcase_preview_jobs
    where status in ('queued', 'processing')
      and source_kind = 'pdf'
    group by project_id, source_media_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate active PDF preview jobs exist; resolve them before applying the single-flight index.';
  end if;

  if exists (
    select 1
    from public.showcase_preview_jobs
    where status in ('queued', 'processing')
      and source_kind = 'website'
    group by project_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate active website preview jobs exist; resolve them before applying the single-flight index.';
  end if;
end;
$migration$;

create unique index if not exists showcase_preview_jobs_one_active_pdf_per_source_v1
  on public.showcase_preview_jobs (
    project_id,
    (coalesce(source_media_id, '00000000-0000-0000-0000-000000000000'::uuid))
  )
  where source_kind = 'pdf' and status in ('queued', 'processing');

create unique index if not exists showcase_preview_jobs_one_active_website_per_project_v1
  on public.showcase_preview_jobs (project_id)
  where source_kind = 'website' and status in ('queued', 'processing');

commit;
