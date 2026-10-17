-- Add category-specific public content and PDF media to the existing Showcase.
-- Apply after 20261009150000_formant_showcase.sql. This migration preserves rows
-- and keeps the Showcase bucket private and editor-only for direct Storage access.

begin;

alter table public.showcase_projects
  add column if not exists long_description text not null default '',
  add column if not exists display_order integer not null default 0,
  add column if not exists portfolio_url text,
  add column if not exists portfolio_before_url text,
  add column if not exists public_profile_url text,
  add column if not exists public_repository_urls text[] not null default '{}',
  add column if not exists external_link_label text,
  add column if not exists public_download_enabled boolean not null default false;

alter table public.showcase_projects
  drop constraint if exists showcase_projects_display_order_nonnegative_v1,
  add constraint showcase_projects_display_order_nonnegative_v1 check (display_order >= 0),
  drop constraint if exists showcase_projects_public_urls_http_v1,
  add constraint showcase_projects_public_urls_http_v1 check (
    (portfolio_url is null or portfolio_url ~* '^https?://')
    and (portfolio_before_url is null or portfolio_before_url ~* '^https?://')
    and (public_profile_url is null or public_profile_url ~* '^https?://')
    and (external_link_label is null or char_length(external_link_label) <= 60)
    and pg_catalog.array_position(public_repository_urls, null) is null
    and (
      pg_catalog.cardinality(public_repository_urls) = 0
      or pg_catalog.array_to_string(public_repository_urls, E'\n') ~ '^https?://[^\n]+(\nhttps?://[^\n]+)*$'
    )
  );

alter table public.showcase_project_images
  drop constraint if exists showcase_project_images_presentation_check,
  add constraint showcase_project_images_presentation_check check (presentation in (
    'before', 'after', 'gallery', 'thumbnail', 'desktop', 'mobile',
    'document_before', 'document_after', 'document'
  )),
  drop constraint if exists showcase_project_images_content_type_check,
  add constraint showcase_project_images_content_type_check check (content_type in (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
  )),
  drop constraint if exists showcase_project_images_byte_size_check,
  add constraint showcase_project_images_byte_size_check check (
    byte_size between 1 and case when content_type = 'application/pdf' then 15728640 else 8388608 end
  ),
  drop constraint if exists showcase_project_images_document_type_check_v1,
  add constraint showcase_project_images_document_type_check_v1 check (
    (content_type = 'application/pdf' and presentation in ('document_before', 'document_after', 'document'))
    or (content_type <> 'application/pdf' and presentation not in ('document_before', 'document_after', 'document'))
  );

create index if not exists showcase_projects_display_order_idx_v1
  on public.showcase_projects (service_category, display_order, created_at desc)
  where is_published;

-- Keep the existing bucket private; permit only the explicitly supported PDF
-- media type in addition to the existing image types.
update storage.buckets
set public = false,
    file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'showcase-media';

-- The RPC is a public projection. Replace its return signature so it exposes
-- only approved Showcase fields and never returns Storage paths or identities.
drop function if exists public.list_published_showcase_v1(text, boolean);

create function public.list_published_showcase_v1(
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
    p.id,
    p.title,
    p.slug,
    p.project_type,
    p.service_category,
    p.short_description,
    p.long_description,
    p.portfolio_url,
    p.portfolio_before_url,
    p.public_profile_url,
    p.public_repository_urls,
    p.external_link_label,
    p.public_download_enabled,
    p.is_featured,
    p.featured_order,
    p.display_order,
    p.published_at,
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', i.id,
          'presentation', i.presentation,
          'sort_order', i.sort_order,
          'content_type', i.content_type,
          'byte_size', i.byte_size,
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
  order by p.is_featured desc,
    case when p.is_featured then p.featured_order else p.display_order end,
    p.display_order,
    p.published_at desc nulls last,
    p.created_at desc;
$function$;

alter function public.list_published_showcase_v1(text, boolean) owner to postgres;
revoke all on function public.list_published_showcase_v1(text, boolean) from public;
grant execute on function public.list_published_showcase_v1(text, boolean) to anon, authenticated;

commit;
