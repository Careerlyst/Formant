# Formant — Technical Decisions Log

This document records the architectural, security, and design decisions evident in the Formant codebase, ordered chronologically where verifiable from git history, migration timestamps, and code artifacts.

---

## 1. Single-Page Application (SPA) Architecture using React & Vite

- **Decision:** Build the entire platform as a client-side Single-Page Application (SPA) using React (v19) and Vite (v7), routed via React Router DOM (v7).
- **Why it appears to have been made:** Provides fast development turnaround, instant hot-module replacement (HMR), lightweight client builds, and seamless page transitions without full-page server roundtrips.
- **Current implementation:** `index.html` loads `src/main.jsx`. Vite bundles assets into `dist/`. Client-side routing is handled by `BrowserRouter` in `src/main.jsx` with routes defined in an `<App />` component. Vercel SPA routing is enforced via `vercel.json` rewrite (`/(.*) -> /index.html`).
- **Files/components affected:** `package.json`, `vite.config.js`, `index.html`, `vercel.json`, `src/main.jsx`.
- **Known trade-offs:** Initial JavaScript payload must load before the application is interactive; client-side rendering requires SEO considerations if public pages need search indexing.
- **Evidence/source in the project:** `package.json` (`react: ^19.1.1`, `vite: ^7.1.3`), `vercel.json` rewrites, git commit `40a8157` ("Initial Careerlyst deployment").
- **Reason status:** Verified from project structure and deployment configuration.

---

## 2. Dual-State Architecture (Supabase Cloud + Local Demo Store)

- **Decision:** Implement a dual-state layer where features function against Supabase when credentials exist, but fall back seamlessly to an in-browser local store (`localStorage`) when Supabase is disconnected or unconfigured.
- **Why it appears to have been made:** Allows instantaneous testing, demonstration to stakeholders, and offline UI development without requiring every developer or test environment to possess live Supabase database credentials.
- **Current implementation:** `src/lib/supabase.js` exports `supabase` or `null` based on environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). `src/lib/store.js` manages local state under the key `careerlyst_demo`, triggering custom `window` events (`careerlyst-store`) for real-time reactivity across components.
- **Files/components affected:** `src/lib/supabase.js`, `src/lib/store.js`, `src/components/Protected.jsx`, `src/pages/Auth.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Admin.jsx`, `src/pages/LeadAssessment.jsx`.
- **Known trade-offs:** Requires writing and maintaining dual logic branches across authentication, profile management, orders, messages, and files; local storage has a 5MB browser limit and lacks relational integrity.
- **Evidence/source in the project:** `README.md` ("Demo mode using localStorage so the UI can be tested immediately"), `src/lib/supabase.js` lines 9-18, `src/lib/store.js` lines 1-16.
- **Reason status:** Verified from documentation and codebase implementations.

---

## 3. Platform Rebranding to "Formant" with Legacy Identifiers Preserved

- **Decision:** Rebrand the public identity from "Careerlyst" to "Formant" while intentionally preserving internal storage keys, database table names, RPC names, and metadata properties.
- **Why it appears to have been made:** A visual and brand refresh was executed, but changing database functions, database triggers, localStorage keys, and existing user metadata would have broken active user sessions, unmigrated test accounts, and deployed Postgres triggers.
- **Current implementation:** Public copy, headings, logos (`Logo.jsx`), HTML title (`TitleManager`), and meta tags reference "Formant". Under the hood, localStorage uses `careerlyst_demo` and `careerlyst-theme`, user metadata uses `careerlyst_lead_assessment`, database functions use `create_careerlyst_order`, and Vercel project is `careerlyst`.
- **Files/components affected:** `index.html`, `README.md`, `src/components/Logo.jsx`, `src/lib/store.js`, `src/lib/theme.js`, `src/pages/Auth.jsx`, `src/pages/LeadAssessment.jsx`, `supabase/migrations/20260928184028_f05_service_visibility_and_order_safety.sql`.
- **Known trade-offs:** Cognitive disconnect for engineers and AI tools encountering two different names; potential for typo bugs if a developer uses `formant_*` where `careerlyst_*` is expected.
- **Evidence/source in the project:** Git commits `cb9a4d9` ("Add admin service management"), `85359ee` ("Update Careerlyst services and admin"), and `b828cd6` ("Update admin services"); `src/components/Logo.jsx`.
- **Reason status:** Inferred from codebase naming patterns and commit progression.

---

## 4. Single Monolithic CSS File with Custom Property Design Tokens

- **Decision:** Maintain styles primarily in a single global stylesheet (`src/styles.css`) spanning over 24,800 lines, supplemented by select module-specific stylesheets (`Preloader.css`, `admin-notifications.css`, `admin-reviews.css`, `admin-settings.css`).
- **Why it appears to have been made:** Avoided introducing build-time CSS processors, utility frameworks (e.g. Tailwind), or CSS-in-JS runtimes, relying directly on native CSS custom properties (`--cream`, `--ink`, `--lime`, `--line`).
- **Current implementation:** `src/styles.css` is imported in `src/main.jsx`. Design tokens are declared on `:root` and used across pages and components.
- **Files/components affected:** `src/main.jsx`, `src/styles.css`, all page and layout components.
- **Known trade-offs:** File size is large (~800KB); stylesheet lacks modularity and has dead code/duplicated rules; edits carry high risk of unintended cascade side-effects.
- **Evidence/source in the project:** `src/styles.css` line count (24,821 lines); `src/main.jsx` line 11.
- **Reason status:** Inferred from architecture.

---

## 5. Deprecation of Dark Mode in Favor of Strict Light-Only Aesthetic

- **Decision:** Permanently lock the platform theme to `light` and disable dark mode switching and system theme observation.
- **Why it appears to have been made:** The brand identity is grounded in an editorial warm-cream canvas (`#fbfaf3`) with black ink typography (`#11120f`) and lime highlights (`#c7f72f`). Supporting dark mode required substantial color system maintenance and created styling regressions across complex dashboard and admin tables.
- **Current implementation:** `src/lib/theme.js` defines `VALID_THEMES = new Set(['light'])`. Functions `normalizeThemePreference()`, `getStoredThemePreference()`, `resolveThemePreference()`, `applyTheme()`, and `applyStoredTheme()` all return `'light'` and set `document.documentElement.dataset.theme = 'light'`. `watchSystemTheme()` is a no-op stub kept for backward compatibility.
- **Files/components affected:** `src/lib/theme.js`, `src/main.jsx`, `src/pages/Dashboard.jsx`.
- **Known trade-offs:** Users preferring dark interfaces for accessibility or night reading cannot enable dark mode.
- **Evidence/source in the project:** Git commits `2449004` ("Update admin settings and disable dark theme") and `e822ea7` ("Add admin sections and disable dark theme"); `src/lib/theme.js` lines 1-79.
- **Reason status:** Verified from commit history and code comments.

---

## 6. Security Definer RPC for Staff User Directory Join Dates

- **Decision:** Create PostgreSQL RPC `admin_list_directory_join_dates_v1()` marked `security definer` with strict role inspection.
- **Why it appears to have been made:** User creation timestamps (`created_at`) are stored in `auth.users`, an internal Supabase Auth schema not directly accessible to client roles over PostgREST. Staff needed to view user registration dates in the admin user directory.
- **Current implementation:** Migration `20260928133709_admin_directory_join_dates.sql` creates the function with `security definer set search_path = ''`. It checks `public.user_roles` for caller membership in `('admin', 'expert', 'support', 'finance')` and returns `(user_id, created_at)`. Migration `20260928134338_restrict_join_dates_rpc_execute.sql` subsequently revoked execution from `service_role` and granted it strictly to `authenticated`.
- **Files/components affected:** `supabase/migrations/20260928133709_admin_directory_join_dates.sql`, `supabase/migrations/20260928134338_restrict_join_dates_rpc_execute.sql`, `src/pages/Admin.jsx` (line 1427).
- **Known trade-offs:** Running functions as `security definer` bypasses standard RLS; must be guarded against privilege escalation by sanitizing `search_path` and validating roles internally.
- **Evidence/source in the project:** Migration files 1 and 2; `src/pages/Admin.jsx` directory query.
- **Reason status:** Verified from migration SQL comments and implementation.

---

## 7. Fail-Closed Order Creation at Database Layer

- **Decision:** Create database function `public.create_careerlyst_order` that validates service and package active states, checks price matching, and then raises a hard exception blocking order creation until payment verification is implemented.
- **Why it appears to have been made:** Avoid accepting unpaid or unverified orders in the production database while the payment gateway (Stripe/PayPal) is still pending integration.
- **Current implementation:** Migration `20260928184028_f05_service_visibility_and_order_safety.sql` defines `create_careerlyst_order`. Lines 119-122 explicitly state:
  `-- Payment verification is not integrated. Fail closed before inserting an order.`
  `raise exception 'Payment verification is not configured; no order was created.' using errcode = '55000';`
  Furthermore, `revoke all on function ... from public, anon, authenticated;` was executed.
- **Files/components affected:** `supabase/migrations/20260928184028_f05_service_visibility_and_order_safety.sql`.
- **Known trade-offs:** Live Supabase orders cannot be submitted by users in production; orders only proceed in demo mode (`localStorage`).
- **Evidence/source in the project:** SQL code in migration file lines 119-130.
- **Reason status:** Verified from migration comments and SQL code.

---

## 8. Revoking Column Permissions on `public.profiles` for Clients

- **Decision:** Revoke `INSERT` and `UPDATE` permissions on sensitive columns (`email`, `lead_assessment`, `lead_score`, `lead_status`, `lead_assessment_completed_at`) from the `authenticated` role on table `public.profiles`.
- **Why it appears to have been made:** Prevent users from tampering with their verified email addresses or artificially manipulating their lead qualification score or sales priority status directly via client PostgREST calls.
- **Current implementation:** `Dashboard.jsx`'s `saveProfile` payload excludes `email` and `lead_*` fields. Profile upsert targets only editable personal/career details (`name`, `phone`, `target_role`, `experience`, `education`, `linkedin`, `github`, `portfolio`, `bio`).
- **Files/components affected:** `src/pages/Dashboard.jsx` (lines 830-864), `src/pages/Auth.jsx`.
- **Known trade-offs:** Clients cannot update their own email in `profiles` directly; initial email must be populated via an automated database trigger (`handle_new_user()`), and lead assessment submission must be stored in user metadata rather than the profile table.
- **Evidence/source in the project:** Prior prompt requirements (requests 8 & 9), `Dashboard.jsx` save payload structure.
- **Reason status:** Verified.

---

## 9. Storing Lead Assessment in Auth User Metadata

- **Decision:** Store the results of the 7-step lead assessment inside `auth.users.raw_user_meta_data` via `supabase.auth.updateUser()` rather than writing directly to `public.profiles`.
- **Why it appears to have been made:** Because column-level security on `public.profiles` prevents `authenticated` users from updating `lead_assessment` and `lead_score` directly, storing it in user metadata provides a working client-side persistence pathway.
- **Current implementation:** `src/pages/LeadAssessment.jsx` calls `supabase.auth.updateUser({ data: { careerlyst_assessment_completed: true, careerlyst_lead_assessment: assessment } })` and syncs with `patch()` in the local store.
- **Files/components affected:** `src/pages/LeadAssessment.jsx`, `src/pages/Auth.jsx` (`getPostAuthPath`), `src/pages/AdminLeads.jsx`.
- **Known trade-offs:** `AdminLeads.jsx` queries `public.profiles.lead_assessment`. Without a database trigger copying metadata into `public.profiles`, leads do not appear in the admin UI.
- **Evidence/source in the project:** `src/pages/LeadAssessment.jsx` lines 324-341.
- **Reason status:** Verified.

---

## 10. Bottom-to-Top GPU Slide Transition for Preloader

- **Decision:** Refactor the initial page preloader from a fade/scale spinner to an editorial bottom-to-top slide transition (`transform: translateY(-100%)`).
- **Why it appears to have been made:** To align with Formant's refined, high-end editorial aesthetic: smooth, restrained, non-distracting loading sequence without spinners or dramatic scaling.
- **Current implementation:** `src/components/Preloader.jsx` and `src/components/Preloader.css` animate the overlay from `translateY(0)` to `translateY(-100%)` using GPU-accelerated transforms and `cubic-bezier(0.76, 0, 0.24, 1)`.
- **Files/components affected:** `src/components/Preloader.jsx`, `src/components/Preloader.css`, `src/main.jsx`.
- **Known trade-offs:** Requires strict coordination with navigation so that internal section navigation does not re-mount or trigger the preloader.
- **Evidence/source in the project:** Request 1 in transcript, `src/components/Preloader.jsx`, `src/components/Preloader.css`.
- **Reason status:** Verified.

---

## 11. "Remember Me" Session Eviction Mechanism

- **Decision:** Provide user control over session persistence by introducing a client-side eviction check when "Remember Me" is unchecked.
- **Why it appears to have been made:** Supabase JS client v2 defaults to persisting tokens indefinitely in `localStorage`. Users unchecking "Remember Me" expect their session to expire when the browser tab/session closes.
- **Current implementation:** `src/lib/supabase.js` checks `formant_remember_me` in `localStorage`. If `false` and no active session marker exists in `sessionStorage`, it triggers `supabase.auth.signOut()`.
- **Files/components affected:** `src/lib/supabase.js`, `src/pages/Auth.jsx`.
- **Known trade-offs:** Relies on client-side storage coordination rather than native cookie-based session expiration; edge cases may occur if users open links across windows.
- **Evidence/source in the project:** `src/lib/supabase.js` lines 19-30, `src/pages/Auth.jsx` lines 188-205.
- **Reason status:** Verified.

---

## 12. Mobile Accordion Footer Navigation

- **Decision:** Transform footer link columns (Explore, Career, Support) into collapsible accordion sections on mobile viewports (< 768px).
- **Why it appears to have been made:** Reduce excessive vertical scrolling on mobile devices while maintaining quick access to all footer navigation items.
- **Current implementation:** `src/components/Footer.jsx` uses state-driven accordions with aria attributes (`aria-expanded`), toggle buttons, and compact vertical spacing. Desktop viewports retain the multi-column layout.
- **Files/components affected:** `src/components/Footer.jsx`, `src/styles.css`.
- **Known trade-offs:** Additional component state management for mobile disclosure toggles.
- **Evidence/source in the project:** Requests 4 and 5 in transcript; `src/components/Footer.jsx`.
- **Reason status:** Verified.
