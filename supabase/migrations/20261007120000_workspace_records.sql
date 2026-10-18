begin;

-- The Admin Workspace stores only delivery records that do not already have
-- an authoritative source. Client identity, order/service context, profile,
-- assessment, messages, and attachments remain in their existing systems.

create table if not exists public.workspace_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 180),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'waiting', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  client_visible boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_notes (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 5000),
  visibility text not null default 'internal' check (visibility in ('internal', 'shared')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_goals (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 180),
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'achieved', 'paused')),
  target_date date,
  client_visible boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null references public.orders(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 180),
  starts_at timestamptz not null,
  assigned_to uuid references auth.users(id) on delete set null,
  meeting_url text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text not null default '',
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_tasks_order_due_idx on public.workspace_tasks(order_id, due_at);
create index if not exists workspace_tasks_assignee_idx on public.workspace_tasks(assigned_to, status);
create index if not exists workspace_notes_order_created_idx on public.workspace_notes(order_id, created_at desc);
create index if not exists workspace_goals_order_status_idx on public.workspace_goals(order_id, status);
create index if not exists workspace_sessions_order_start_idx on public.workspace_sessions(order_id, starts_at);

alter table public.workspace_tasks enable row level security;
alter table public.workspace_notes enable row level security;
alter table public.workspace_goals enable row level security;
alter table public.workspace_sessions enable row level security;

grant select, insert, update, delete on public.workspace_tasks to authenticated;
grant select, insert, update, delete on public.workspace_notes to authenticated;
grant select, insert, update, delete on public.workspace_goals to authenticated;
grant select, insert, update, delete on public.workspace_sessions to authenticated;

-- All staff can read operational context. Only admin/expert/support can edit;
-- finance retains read-only access, matching the existing workspace behavior.
create policy workspace_tasks_staff_select_v1 on public.workspace_tasks
  for select to authenticated using (public.is_careerlyst_staff());
create policy workspace_tasks_staff_insert_v1 on public.workspace_tasks
  for insert to authenticated with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
    and created_by = auth.uid()
    and (assigned_to is null or exists (select 1 from public.user_roles r where r.user_id = assigned_to and lower(r.role) in ('admin', 'expert', 'support', 'finance')))
  );
create policy workspace_tasks_staff_update_v1 on public.workspace_tasks
  for update to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
    and (assigned_to is null or exists (select 1 from public.user_roles r where r.user_id = assigned_to and lower(r.role) in ('admin', 'expert', 'support', 'finance')))
  );
create policy workspace_tasks_staff_delete_v1 on public.workspace_tasks
  for delete to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  );
create policy workspace_tasks_client_select_v1 on public.workspace_tasks
  for select to authenticated using (
    client_visible
    and exists (select 1 from public.orders o join public.user_roles r on r.user_id = auth.uid()
      where o.id = workspace_tasks.order_id and o.user_id = auth.uid() and lower(r.role) = 'client')
  );

create policy workspace_notes_staff_select_v1 on public.workspace_notes
  for select to authenticated using (public.is_careerlyst_staff());
create policy workspace_notes_staff_insert_v1 on public.workspace_notes
  for insert to authenticated with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
    and created_by = auth.uid()
  );
create policy workspace_notes_staff_update_v1 on public.workspace_notes
  for update to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  );
create policy workspace_notes_staff_delete_v1 on public.workspace_notes
  for delete to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  );
create policy workspace_notes_client_select_v1 on public.workspace_notes
  for select to authenticated using (
    visibility = 'shared'
    and exists (select 1 from public.orders o join public.user_roles r on r.user_id = auth.uid()
      where o.id = workspace_notes.order_id and o.user_id = auth.uid() and lower(r.role) = 'client')
  );

create policy workspace_goals_staff_select_v1 on public.workspace_goals
  for select to authenticated using (public.is_careerlyst_staff());
create policy workspace_goals_staff_insert_v1 on public.workspace_goals
  for insert to authenticated with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
    and created_by = auth.uid()
  );
create policy workspace_goals_staff_update_v1 on public.workspace_goals
  for update to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  );
create policy workspace_goals_staff_delete_v1 on public.workspace_goals
  for delete to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  );
create policy workspace_goals_client_select_v1 on public.workspace_goals
  for select to authenticated using (
    client_visible
    and exists (select 1 from public.orders o join public.user_roles r on r.user_id = auth.uid()
      where o.id = workspace_goals.order_id and o.user_id = auth.uid() and lower(r.role) = 'client')
  );

create policy workspace_sessions_staff_select_v1 on public.workspace_sessions
  for select to authenticated using (public.is_careerlyst_staff());
create policy workspace_sessions_staff_insert_v1 on public.workspace_sessions
  for insert to authenticated with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
    and created_by = auth.uid()
    and (assigned_to is null or exists (select 1 from public.user_roles r where r.user_id = assigned_to and lower(r.role) in ('admin', 'expert', 'support', 'finance')))
  );
create policy workspace_sessions_staff_update_v1 on public.workspace_sessions
  for update to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
    and (assigned_to is null or exists (select 1 from public.user_roles r where r.user_id = assigned_to and lower(r.role) in ('admin', 'expert', 'support', 'finance')))
  );
create policy workspace_sessions_staff_delete_v1 on public.workspace_sessions
  for delete to authenticated using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and lower(r.role) in ('admin', 'expert', 'support'))
  );
commit;
