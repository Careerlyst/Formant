-- Formant Showcase: public published-content projection and staff-managed drafts.
-- Project/media records contain no client identity or source document fields.

begin;

create table public.showcase_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 140),
  project_type text not null check (project_type in ('client_work', 'sample_project')),
  service_category text not null check (service_category in (
    'cv_demo', 'resume_demo', 'portfolio_website_demo',
    'linkedin_before_after', 'github_before_after', 'cover_letter_demo'
  )),
  short_description text not null default '' check (char_length(short_description) <= 500),
  is_published boolean not null default false,
  is_featured boolean not null default false,
  featured_order integer not null default 0 check (featured_order >= 0),
  public_content_review_confirmed boolean not null default false,
  client_consent_confirmed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint showcase_client_work_consent_before_publish_v1
    check (project_type <> 'client_work' or not is_published or client_consent_confirmed),
  constraint showcase_public_content_review_before_publish_v1
    check (not is_published or public_content_review_confirmed)
);

create table public.showcase_project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.showcase_projects(id) on delete cascade,
  storage_path text not null unique,
  presentation text not null check (presentation in ('before', 'after', 'gallery')),
  sort_order integer not null default 0 check (sort_order >= 0),
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 8388608),
  alt_text text not null check (char_length(btrim(alt_text)) between 1 and 240),
  caption text not null default '' check (char_length(caption) <= 240),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint showcase_image_path_matches_project_v1
    check (pg_catalog.split_part(storage_path, '/', 1) = project_id::text and pg_catalog.strpos(storage_path, '..') = 0)
);

create index showcase_projects_public_category_order_idx
  on public.showcase_projects (service_category, is_featured desc, featured_order, published_at desc)
  where is_published;
create index showcase_projects_featured_order_idx
  on public.showcase_projects (featured_order, published_at desc)
  where is_published and is_featured;
create index showcase_project_images_project_order_idx
  on public.showcase_project_images (project_id, sort_order, created_at, id);

create or replace function public.is_showcase_staff_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles as role_row
    where role_row.user_id = auth.uid()
      and pg_catalog.lower(role_row.role) in ('admin', 'expert', 'support', 'finance')
  );
$function$;
alter function public.is_showcase_staff_v1() owner to postgres;
revoke all on function public.is_showcase_staff_v1() from public;
grant execute on function public.is_showcase_staff_v1() to anon, authenticated;

create or replace function public.is_showcase_editor_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles as role_row
    where role_row.user_id = auth.uid()
      and pg_catalog.lower(role_row.role) in ('admin', 'expert', 'support')
  );
$function$;
alter function public.is_showcase_editor_v1() owner to postgres;
revoke all on function public.is_showcase_editor_v1() from public;
grant execute on function public.is_showcase_editor_v1() to anon, authenticated;

alter table public.showcase_projects enable row level security;
alter table public.showcase_project_images enable row level security;
revoke all on table public.showcase_projects, public.showcase_project_images from public, anon, authenticated;
grant select, insert, update, delete on table public.showcase_projects, public.showcase_project_images to authenticated;

create policy showcase_projects_staff_select_v1
  on public.showcase_projects for select to authenticated
  using (public.is_showcase_staff_v1());
create policy showcase_projects_editor_insert_v1
  on public.showcase_projects for insert to authenticated
  with check (public.is_showcase_editor_v1() and created_by = auth.uid() and updated_by = auth.uid());
create policy showcase_projects_editor_update_v1
  on public.showcase_projects for update to authenticated
  using (public.is_showcase_editor_v1())
  with check (public.is_showcase_editor_v1() and updated_by = auth.uid());
create policy showcase_projects_editor_delete_v1
  on public.showcase_projects for delete to authenticated
  using (public.is_showcase_editor_v1());

create policy showcase_images_staff_select_v1
  on public.showcase_project_images for select to authenticated
  using (public.is_showcase_staff_v1());
create policy showcase_images_editor_insert_v1
  on public.showcase_project_images for insert to authenticated
  with check (
    public.is_showcase_editor_v1()
    and created_by = auth.uid()
    and exists (select 1 from public.showcase_projects p where p.id = project_id)
  );
create policy showcase_images_editor_update_v1
  on public.showcase_project_images for update to authenticated
  using (public.is_showcase_editor_v1())
  with check (public.is_showcase_editor_v1());
create policy showcase_images_editor_delete_v1
  on public.showcase_project_images for delete to authenticated
  using (public.is_showcase_editor_v1());

create or replace function public.touch_showcase_project_updated_at_v1()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
alter function public.touch_showcase_project_updated_at_v1() owner to postgres;
revoke all on function public.touch_showcase_project_updated_at_v1() from public, anon, authenticated;
create trigger showcase_projects_touch_updated_at_v1
  before update on public.showcase_projects
  for each row execute function public.touch_showcase_project_updated_at_v1();

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
  is_featured boolean,
  featured_order integer,
  published_at timestamptz,
  images jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p.id,
    p.title,
    p.slug,
    p.project_type,
    p.service_category,
    p.short_description,
    p.is_featured,
    p.featured_order,
    p.published_at,
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', i.id,
          'presentation', i.presentation,
          'sort_order', i.sort_order,
          'alt_text', i.alt_text,
          'caption', i.caption
        ) order by i.sort_order, i.created_at, i.id
      )
      from public.showcase_project_images i
      where i.project_id = p.id
    ), '[]'::jsonb)
  from public.showcase_projects p
  where p.is_published
    and (p_service_category is null or p.service_category = p_service_category)
    and (not coalesce(p_featured_only, false) or p.is_featured)
  order by p.is_featured desc, p.featured_order, p.published_at desc nulls last, p.created_at desc;
$function$;
alter function public.list_published_showcase_v1(text, boolean) owner to postgres;
revoke all on function public.list_published_showcase_v1(text, boolean) from public;
grant execute on function public.list_published_showcase_v1(text, boolean) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('showcase-media', 'showcase-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- Restrictive boundaries prevent an older permissive Storage policy from
-- making Showcase draft media accessible to clients or anonymous visitors.
drop policy if exists showcase_media_select_boundary_v1 on storage.objects;
create policy showcase_media_select_boundary_v1
  on storage.objects as restrictive for select to public
  using (bucket_id <> 'showcase-media' or public.is_showcase_editor_v1());
drop policy if exists showcase_media_insert_boundary_v1 on storage.objects;
create policy showcase_media_insert_boundary_v1
  on storage.objects as restrictive for insert to public
  with check (bucket_id <> 'showcase-media' or public.is_showcase_editor_v1());
drop policy if exists showcase_media_update_boundary_v1 on storage.objects;
create policy showcase_media_update_boundary_v1
  on storage.objects as restrictive for update to public
  using (bucket_id <> 'showcase-media' or public.is_showcase_editor_v1())
  with check (bucket_id <> 'showcase-media' or public.is_showcase_editor_v1());
drop policy if exists showcase_media_delete_boundary_v1 on storage.objects;
create policy showcase_media_delete_boundary_v1
  on storage.objects as restrictive for delete to public
  using (bucket_id <> 'showcase-media' or public.is_showcase_editor_v1());

drop policy if exists showcase_media_staff_select_v1 on storage.objects;
create policy showcase_media_staff_select_v1
  on storage.objects for select to authenticated
  using (bucket_id = 'showcase-media' and public.is_showcase_editor_v1());
drop policy if exists showcase_media_staff_insert_v1 on storage.objects;
create policy showcase_media_staff_insert_v1
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'showcase-media'
    and public.is_showcase_editor_v1()
    and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
    and exists (
      select 1 from public.showcase_projects p
      where p.id::text = (storage.foldername(name))[1]
    )
  );
drop policy if exists showcase_media_staff_update_v1 on storage.objects;
create policy showcase_media_staff_update_v1
  on storage.objects for update to authenticated
  using (bucket_id = 'showcase-media' and public.is_showcase_editor_v1())
  with check (bucket_id = 'showcase-media' and public.is_showcase_editor_v1());
drop policy if exists showcase_media_staff_delete_v1 on storage.objects;
create policy showcase_media_staff_delete_v1 on storage.objects for delete to authenticated
  using (bucket_id = 'showcase-media' and public.is_showcase_editor_v1());

commit;
