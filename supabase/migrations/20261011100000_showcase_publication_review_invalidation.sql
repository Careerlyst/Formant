-- Keep publication approval current when public project content or media changes.
-- Apply after 20261010120000_showcase_category_content_v1.sql.

begin;

create or replace function public.invalidate_showcase_publication_on_project_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.is_published and row(
    new.title,
    new.slug,
    new.project_type,
    new.service_category,
    new.short_description,
    new.long_description,
    new.portfolio_url,
    new.portfolio_before_url,
    new.public_profile_url,
    new.public_repository_urls,
    new.external_link_label,
    new.public_download_enabled,
    new.public_content_review_confirmed,
    new.client_consent_confirmed
  ) is distinct from row(
    old.title,
    old.slug,
    old.project_type,
    old.service_category,
    old.short_description,
    old.long_description,
    old.portfolio_url,
    old.portfolio_before_url,
    old.public_profile_url,
    old.public_repository_urls,
    old.external_link_label,
    old.public_download_enabled,
    old.public_content_review_confirmed,
    old.client_consent_confirmed
  ) then
    new.is_published := false;
    new.published_at := null;
    new.public_content_review_confirmed := false;
    new.client_consent_confirmed := false;
  end if;
  return new;
end;
$function$;
alter function public.invalidate_showcase_publication_on_project_change_v1() owner to postgres;
revoke all on function public.invalidate_showcase_publication_on_project_change_v1() from public, anon, authenticated;

create trigger showcase_projects_invalidate_publication_v1
  before update on public.showcase_projects
  for each row execute function public.invalidate_showcase_publication_on_project_change_v1();

create or replace function public.invalidate_showcase_publication_on_media_change_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_project_id uuid;
  v_new_project_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_project_id := old.project_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_project_id := new.project_id;
  end if;

  update public.showcase_projects as project_row
  set is_published = false,
      published_at = null,
      public_content_review_confirmed = false,
      client_consent_confirmed = false,
      updated_by = coalesce(auth.uid(), project_row.updated_by)
  where project_row.id = v_old_project_id
    and project_row.is_published;

  if v_new_project_id is distinct from v_old_project_id then
    update public.showcase_projects as project_row
    set is_published = false,
        published_at = null,
        public_content_review_confirmed = false,
        client_consent_confirmed = false,
        updated_by = coalesce(auth.uid(), project_row.updated_by)
    where project_row.id = v_new_project_id
      and project_row.is_published;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;
alter function public.invalidate_showcase_publication_on_media_change_v1() owner to postgres;
revoke all on function public.invalidate_showcase_publication_on_media_change_v1() from public, anon, authenticated;

create trigger showcase_project_images_invalidate_publication_v1
  after insert or update or delete on public.showcase_project_images
  for each row execute function public.invalidate_showcase_publication_on_media_change_v1();

create or replace function public.list_published_showcase_v1(
  p_service_category text default null,
  p_featured_only boolean default false
)
returns table (
  project_id uuid,
  title text,
  slug text,
  project_type text,
  service_category text,
  short_description text,
  long_description text,
  portfolio_url text,
  portfolio_before_url text,
  public_profile_url text,
  public_repository_urls text[],
  external_link_label text,
  public_download_enabled boolean,
  is_featured boolean,
  featured_order integer,
  display_order integer,
  published_at timestamptz,
  images jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    project_row.id,
    project_row.title,
    project_row.slug,
    project_row.project_type,
    project_row.service_category,
    project_row.short_description,
    project_row.long_description,
    project_row.portfolio_url,
    project_row.portfolio_before_url,
    project_row.public_profile_url,
    project_row.public_repository_urls,
    project_row.external_link_label,
    project_row.public_download_enabled,
    project_row.is_featured,
    project_row.featured_order,
    project_row.display_order,
    project_row.published_at,
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', image_row.id,
          'presentation', image_row.presentation,
          'sort_order', image_row.sort_order,
          'content_type', image_row.content_type,
          'byte_size', image_row.byte_size,
          'alt_text', image_row.alt_text,
          'caption', image_row.caption
        ) order by image_row.sort_order, image_row.created_at, image_row.id
      )
      from public.showcase_project_images as image_row
      where image_row.project_id = project_row.id
    ), '[]'::jsonb)
  from public.showcase_projects as project_row
  where project_row.is_published
    and project_row.public_content_review_confirmed
    and (project_row.project_type <> 'client_work' or project_row.client_consent_confirmed)
    and (p_service_category is null or project_row.service_category = p_service_category)
    and (not coalesce(p_featured_only, false) or project_row.is_featured)
  order by project_row.is_featured desc,
    case when project_row.is_featured then project_row.featured_order else project_row.display_order end,
    project_row.display_order,
    project_row.published_at desc nulls last,
    project_row.created_at desc;
$function$;
alter function public.list_published_showcase_v1(text, boolean) owner to postgres;
revoke all on function public.list_published_showcase_v1(text, boolean) from public;
grant execute on function public.list_published_showcase_v1(text, boolean) to anon, authenticated;

commit;
