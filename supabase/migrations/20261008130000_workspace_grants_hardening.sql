begin;

-- Remove the Supabase default table privileges from client-facing database
-- roles, then restore only row-level operations for authenticated callers.
-- RLS policies continue to decide which rows each caller can access.
revoke all privileges on table
  public.workspace_tasks,
  public.workspace_notes,
  public.workspace_goals,
  public.workspace_sessions
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.workspace_tasks,
  public.workspace_notes,
  public.workspace_goals,
  public.workspace_sessions
to authenticated;

commit;
