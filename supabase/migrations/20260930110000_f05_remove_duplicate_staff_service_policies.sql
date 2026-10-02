begin;

-- Existing services_staff_select/update policies already enforce the same
-- staff-only access. Remove only the redundant policies introduced by the
-- initial F-05 migration; retain all pre-existing policies.
drop policy if exists "Staff can view all services" on public.services;
drop policy if exists "Staff can update services" on public.services;

commit;
