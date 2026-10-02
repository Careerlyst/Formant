# Formant — Known Issues, Risks & Technical Debt

This document catalogs all currently identified bugs, broken or incomplete functionality, technical debt, security risks, and architecture gaps in the Formant codebase.  
**Note:** No issues are resolved in this document; each entry is strictly diagnostic.

---

## 1. `profiles.email` Inserted as NULL on New User Registration

- **Issue:** New user signup successfully creates an `auth.users` account, a profile row with the correct user name, and a default `client` role in `public.user_roles`. However, `public.profiles.email` is consistently inserted as `NULL`.
- **Severity:** High
- **Evidence:** User investigation in requests 8 and 9 noted that 9 existing profile rows had to be repaired manually. In `src/pages/Auth.jsx` (lines 308-316), `signUp` passes `{ data: { name: cleanName } }` without `email` in metadata. The database trigger `handle_new_user()` is responsible for reading `new.email` and inserting it into `public.profiles`. Furthermore, `authenticated` users have no column `UPDATE` or `INSERT` permissions on `profiles.email`.
- **Affected area:** Supabase trigger function `handle_new_user()`, `public.profiles` table, `src/pages/Auth.jsx`.
- **Current behavior:** New profiles are created with `email = NULL`.
- **Expected behavior:** `public.profiles.email` should match the registered email from `auth.users.email`.
- **Possible impact:** User profile shows empty email; admin directory shows empty email for clients; transactional communications and notification lookups relying on `profiles.email` fail.
- **Status:** Open / Confirmed.
- **Recommended next investigation/fix:** Inspect the deployed PL/pgSQL code for `handle_new_user()` in the Supabase Dashboard. Look for variable shadowing (e.g. `DECLARE email text;` conflicting with column `email`) or missing assignment in the `INSERT INTO public.profiles` clause. Fix the trigger function with `SECURITY DEFINER` so it properly inserts `new.email` without granting clients write access to the column.

---

## 2. Lead Assessment Data Disconnect Between Client Submission and Admin Review

- **Issue:** Client lead assessments completed at `/assessment` are saved to `auth.users.raw_user_meta_data`, but the Admin Leads portal at `/admin/leads` queries `public.profiles`.
- **Severity:** High
- **Evidence:**
  - `src/pages/LeadAssessment.jsx` (lines 328-336):
    ```javascript
    await supabase.auth.updateUser({
      data: {
        careerlyst_assessment_completed: true,
        careerlyst_lead_assessment: assessment
      }
    });
    ```
  - `src/pages/AdminLeads.jsx` (lines 191-205):
    ```javascript
    await supabase
      .from('profiles')
      .select('id, name, email, lead_assessment, lead_score, lead_status, lead_assessment_completed_at')
      .not('lead_assessment', 'is', null);
    ```
- **Affected area:** `src/pages/LeadAssessment.jsx`, `src/pages/AdminLeads.jsx`, `public.profiles` table.
- **Current behavior:** Completing the lead assessment writes data solely into user metadata in Supabase Auth. Because `public.profiles` is not updated, the admin leads table returns zero rows for newly assessed users.
- **Expected behavior:** Lead assessment answers, calculated score, and status should populate `public.profiles` so staff can view, score, and contact qualified leads.
- **Possible impact:** High-value prospective clients completing the assessment remain invisible to sales/operations staff in the admin workspace.
- **Status:** Open.
- **Recommended next investigation/fix:** Implement a database trigger or a security-definer RPC function (e.g. `submit_lead_assessment(p_assessment jsonb)`) that verifies the user's session and securely updates the `lead_assessment`, `lead_score`, `lead_status`, and `lead_assessment_completed_at` columns on `public.profiles`.

---

## 3. Missing Client-Side Role Guards on Admin Sub-Routes

- **Issue:** While `/admin` is protected by `<AdminGate />`, sub-routes like `/admin/workspace`, `/admin/users`, `/admin/orders`, `/admin/projects`, `/admin/coupons`, `/admin/notifications`, and `/admin/settings` are wrapped only in `<Protected>`.
- **Severity:** Medium
- **Evidence:** In `src/main.jsx` (lines 336-460):
  ```jsx
  <Route path="/admin" element={<Protected><AdminGate /></Protected>} />
  <Route path="/admin/workspace" element={<Protected><AdminWorkspace /></Protected>} />
  <Route path="/admin/coupons" element={<Protected><AdminSimple title="Coupons" /></Protected>} />
  <Route path="/admin/notifications" element={<Protected><AdminNotifications /></Protected>} />
  ```
  `Protected` only validates `Boolean(session)`. Furthermore, `AdminSimple` has no internal `user_roles` query at all.
- **Affected area:** `src/main.jsx`, `src/pages/Admin.jsx`, `src/pages/AdminNotifications.jsx`.
- **Current behavior:** Any regular authenticated client who navigates directly to `/admin/coupons` or `/admin/notifications` will see the admin layout render. (Database queries will fail via RLS, but the admin shell renders).
- **Expected behavior:** Navigating to any `/admin/*` route without a valid staff role (`admin`, `expert`, `support`, `finance`) should immediately redirect to `/dashboard` or `/login`.
- **Possible impact:** Client confusion, exposure of internal operations page structures, and potential UI-level data leakage.
- **Status:** Open.
- **Recommended next investigation/fix:** Wrap all `/admin/*` routes inside a layout route utilizing `AdminGate`, or create a dedicated `AdminProtected` component in `src/components/AdminProtected.jsx`.

---

## 4. Discrepancy Between Committed Migrations and Live Database Schema

- **Issue:** The local repository files (`supabase-schema.sql` and `supabase/migrations/`) represent only a tiny fraction of the actual production database schema.
- **Severity:** High
- **Evidence:**
  - `supabase-schema.sql` only defines `profiles` (with 3 columns: `id`, `name`, `created_at`), `services`, `orders`, `order_items`, `messages`, `files`, `payments`, and `user_roles`.
  - `src/` actively queries tables not in `supabase-schema.sql` or `supabase/migrations/`: `reviews`, `service_packages`, `project_briefs`, `platform_settings`, `admin_audit_logs`.
  - `src/` actively queries columns on `public.profiles` not in migrations: `phone`, `target_role`, `experience`, `education`, `linkedin`, `github`, `portfolio`, `bio`, `lead_assessment`, `lead_score`, `lead_status`, `lead_assessment_completed_at`, `email`.
  - RPC `admin_list_directory_user_roles_v1` is called in `Admin.jsx` (line 1426) but has no SQL file in `supabase/migrations/`.
- **Affected area:** `supabase/` directory, database disaster recovery, local environment setup.
- **Current behavior:** Running `supabase db reset` in local development fails to recreate the schema expected by the frontend.
- **Expected behavior:** 100% of live database tables, columns, RLS policies, triggers, and RPCs should be documented in version-controlled migration files.
- **Possible impact:** Inability to run a working local development environment; high risk of environment drift between staging and production.
- **Status:** Technical Debt / High Risk.
- **Recommended next investigation/fix:** Run `supabase db pull` or export the schema from the Supabase hosted project (`bofsshercyihwnsbblzp`) into a baseline migration file.

---

## 5. Live Order Placement Disabled by Fail-Closed Exception

- **Issue:** The production order creation function intentionally blocks all order placement because payment gateway integration has not been finalized.
- **Severity:** Medium
- **Evidence:** In `supabase/migrations/20260928184028_f05_service_visibility_and_order_safety.sql` (lines 119-122):
  ```sql
  -- Payment verification is not integrated. Fail closed before inserting an order.
  raise exception 'Payment verification is not configured; no order was created.'
    using errcode = '55000';
  ```
  `grant execute` on `create_careerlyst_order` is also revoked from `authenticated`.
- **Affected area:** Order checkout flow, payment processing, `public.orders`.
- **Current behavior:** Order placement fails in Supabase mode; users can only place orders when running in localStorage demo mode.
- **Expected behavior:** Real payment processing (e.g. Stripe Checkout / Webhook) that verifies payment before creating active orders in PostgreSQL.
- **Possible impact:** Real customers cannot purchase career services on the live website.
- **Status:** Incomplete Feature.
- **Recommended next investigation/fix:** Build a Supabase Edge Function or backend endpoint integrating Stripe Checkout sessions and webhooks to verify payments before inserting rows into `public.orders` and `public.payments`.

---

## 6. Massive Monolithic Stylesheet (`src/styles.css`)

- **Issue:** A single stylesheet file contains 24,821 lines (~800KB) of CSS rules.
- **Severity:** Medium
- **Evidence:** `src/styles.css` is 24,821 lines long. It combines landing page styles, responsive overrides, dashboard layouts, modals, buttons, and legacy Careerlyst CSS.
- **Affected area:** Frontend performance, code maintainability.
- **Current behavior:** Modifying any style requires searching a massive file; risk of unintentional selector collision and cascading bugs is high.
- **Expected behavior:** Modular domain stylesheets (e.g. `base.css`, `public.css`, `dashboard.css`, `admin.css`) or CSS modules.
- **Possible impact:** Increased bundle size, slower initial style parsing, developer slowdown.
- **Status:** Technical Debt.
- **Recommended next investigation/fix:** Perform an automated CSS audit to detect unused selectors, then incrementally partition `styles.css` into logical domain sheets.

---

## 7. Dual Brand Naming in Codebase (`Formant` vs `Careerlyst`)

- **Issue:** Codebase mixes the new brand name "Formant" with the legacy name "Careerlyst" across storage keys, RPCs, project configs, and components.
- **Severity:** Low
- **Evidence:**
  - Storage key: `careerlyst_demo`
  - Theme key: `careerlyst-theme`
  - Auth metadata: `careerlyst_assessment_completed`, `careerlyst_lead_assessment`
  - Database function: `create_careerlyst_order`
  - Vercel config: `"projectName": "careerlyst"`
  - Working directory: `Careerlyst-Full`
- **Affected area:** Developer experience, naming consistency.
- **Current behavior:** Mixed naming conventions throughout the stack.
- **Expected behavior:** Consistent brand naming conventions across all layers.
- **Possible impact:** Potential developer errors if someone introduces a `formant_*` key where a `careerlyst_*` key is expected, leading to state desynchronization.
- **Status:** Technical Debt.
- **Recommended next investigation/fix:** Maintain existing legacy keys for backward compatibility, and document all legacy aliases clearly in `instructions.md`.

---

## 8. Stray and Orphaned Files in Project Root

- **Issue:** The project root contains several unneeded files that clutter the repository.
- **Severity:** Low
- **Evidence:**
  - `Careerlyst-Full/tatus`: 4KB text file containing a raw git diff output.
  - `Careerlyst-Full/New Text Document.txt`: 0-byte blank file.
  - `Careerlyst-Full/previous-design.zip`: 479KB zip archive stored directly in the git repository.
- **Affected area:** Repository hygiene.
- **Current behavior:** Stray files committed or residing in working tree.
- **Expected behavior:** Clean project root containing only source code, configs, and documentation.
- **Possible impact:** Clutters directory listings and bloats repository clone size.
- **Status:** Technical Debt.
- **Recommended next investigation/fix:** Delete `tatus` and `New Text Document.txt`. Move `previous-design.zip` to cold backup storage.

---

## 9. Lack of Automated Test Coverage

- **Issue:** The project has no unit tests, integration tests, or end-to-end tests configured.
- **Severity:** Medium
- **Evidence:** `package.json` contains only `"scripts": { "dev": "vite", "build": "...", "preview": "vite preview" }`. There is no Vitest, Jest, Playwright, or Cypress dependency or config.
- **Affected area:** Quality assurance, regression prevention.
- **Current behavior:** Testing is entirely manual.
- **Expected behavior:** Automated unit tests for critical functions (`profileCompletion.js`, `evaluatePasswordStrength`, `calculateLeadScore`) and component smoke tests.
- **Possible impact:** High risk of regression when refactoring core files like `Auth.jsx`, `Dashboard.jsx`, or `Admin.jsx`.
- **Status:** Technical Debt.
- **Recommended next investigation/fix:** Install Vitest and React Testing Library; write regression tests for password evaluation, lead score calculation, profile completion, and auth session flows.
