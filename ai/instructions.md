# Formant — AI Agent Instructions & Operating Rules

> **Target Audience:** Future AI agents and developers working on the Formant platform.  
> **Status:** Active & Mandatory.  
> **Last Verified:** 2026-10-01.

---

## 1. Project Overview & Identity

Formant (formerly *Careerlyst*) is a production React 19 web application providing bespoke career development and professional profile services (Resume/CV, LinkedIn, GitHub, Portfolio, Cover Letters, Interview Preparation). The platform includes a public marketing site, client onboarding & lead assessment, a comprehensive client dashboard, and an internal staff operations workspace (Admin Panel).

The application operates on a **dual-state architecture**:
1. **Supabase Cloud Backend:** PostgreSQL 17, Supabase Auth (GoTrue), Row Level Security (RLS), and PostgREST.
2. **Local Demo Store Fallback:** In-memory and `localStorage`-backed store (`careerlyst_demo`) enabling offline testing and self-contained demos without live credentials.

---

## 2. Core Project Rules

These rules have been verified from the existing codebase and must be strictly followed.

### Rule 1: Zero Untasked Source Code Modifications
- **Never** modify, refactor, reorganize, or delete existing source code, configuration files, or build scripts unless explicitly tasked by the user.
- **Never** rename or move existing components, CSS files, or utility modules without explicit user instruction.
- **Preserve documentation integrity:** Keep all existing comments, docstrings, and license headers intact.

### Rule 2: Strict Light-Only Design System
- The platform is strictly constrained to a **light theme** (`data-theme="light"`).
- **Design Tokens:**
  - Background Canvas: `--cream: #fbfaf3` (fallback `#f5f4ee` in legacy modules)
  - Surface Paper: `--paper: #ffffff`
  - Typography Primary: `--ink: #11120f`
  - Typography Muted: `--muted: #6d7069`
  - Hairline Borders: `--line: #deded5`
  - Primary Accent: `--lime: #c7f72f` (used for active underlines, tags, highlights)
  - Secondary Accent / Dark Buttons: `#11120f` with white text
  - Danger / Error: `--danger: #b94a48`
  - Success: `--green: #8fb61c`
- **Do NOT** reintroduce dark mode toggles, system color-scheme listeners, or dark theme overrides. `src/lib/theme.js` hardcodes `applyTheme()` to `'light'`.

### Rule 3: Database & Security Boundaries
- **Never expose the `service_role` key** anywhere in frontend code, client builds, or version control.
- **Never weaken Row Level Security (RLS)** policies on Supabase tables.
- **Preserve Column-Level Permissions on `public.profiles`:**
  - Authenticated clients (`authenticated` role) have **no `INSERT` or `UPDATE` privileges** on `public.profiles.email` or sensitive lead qualification columns (`lead_assessment`, `lead_score`, `lead_status`, `lead_assessment_completed_at`).
  - Client-side code in `src/pages/Dashboard.jsx` must **never** include `email` or `lead_*` in `.upsert()` or `.update()` payloads.
- **Role Verification:** Staff roles (`admin`, `expert`, `support`, `finance`) are stored in `public.user_roles`. Client-side route gating must always be backed by database RLS and server-side RPC checks.

### Rule 4: Respect Legacy Identifiers & Brand Mapping
The UI has been rebranded from **Careerlyst** to **Formant**, but internal identifiers remain tied to legacy naming to prevent database and state breakages:
- LocalStorage store key: `careerlyst_demo`
- Theme storage key: `careerlyst-theme`
- User metadata keys: `careerlyst_assessment_completed`, `careerlyst_lead_assessment`
- Database RPCs: `create_careerlyst_order`
- Vercel project slug: `careerlyst`
- Directory name: `Careerlyst-Full`
- **Do NOT** rename these keys without a complete, backward-compatible migration strategy approved by the user.

### Rule 5: Dual-State Preservation
Whenever a feature touches user data, orders, messages, or files, it must support both modes:
```javascript
import { supabase } from '../lib/supabase';
import { load, patch } from '../lib/store';

if (supabase) {
  // 1. Supabase Cloud PostgREST operation
} else {
  // 2. Local Demo fallback operation via patch()
}
```
Do not eliminate the demo fallback.

---

## 3. Architecture Constraints

### 3.1 Technology Stack & Versions
- **Runtime & Bundler:** Node.js LTS, Vite `^7.1.3` (`@vitejs/plugin-react` `^5.0.2`).
- **Framework:** React `^19.1.1`, React DOM `^19.1.1`.
- **Routing:** React Router DOM `^7.8.2` using `BrowserRouter` with `Routes` and `Route`.
- **Supabase SDK:** `@supabase/supabase-js` `^2.116.0`.
- **Styling Architecture:** Pure CSS. Global stylesheet `src/styles.css` (24,800+ lines) + scoped CSS files (`Preloader.css`, `admin-notifications.css`, `admin-reviews.css`, `admin-settings.css`).
  - *No CSS-in-JS libraries, no Tailwind, no styled-components.*

### 3.2 Routing & Navigation Principles
- All routes are registered in `src/main.jsx`.
- **Preloader Rule:** The `Preloader` component is rendered once at the application root (`src/main.jsx`). It is designed strictly for initial page startup and full application loads. It must **never** be triggered by internal in-page hash links (such as `/#how-it-works` or `/#process`).
- **Scroll & Title Management:** `ScrollManager` and `TitleManager` in `src/main.jsx` manage title updates and smooth scrolling to targets without page reloads.

---

## 4. Coding Conventions

Discovered patterns and conventions across the codebase:

1. **State & Effects:**
   - Use standard React hooks: `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`.
   - Always include a cleanup function in `useEffect` for listeners, intervals, and async cancel guards (`let mounted = true; return () => { mounted = false; };`).
2. **Form Handling & Validation:**
   - Explicit inline validation with a `touched` state object tracking blurred/submitted inputs.
   - Clean/trim input strings before submission (`const cleanEmail = email.trim();`).
   - Use regex-based email validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
   - Password criteria: Minimum 6 characters (Supabase default), with strength evaluation scoring length, uppercase, lowercase, numbers, and symbols.
3. **Error Handling & Feedback:**
   - Store error messages in component state (`const [error, setError] = useState('');`).
   - Log technical errors to `console.error` for debugging.
   - Present human-readable, actionable error messages in UI cards or banners.
4. **Styling Approach:**
   - Combine semantic HTML tags with CSS class names and inline style overrides where dynamic values are required.
   - Use CSS custom property fallbacks: `var(--ink, #11120f)`.

---

## 5. Modules Requiring Extreme Caution

| File / Module | Reason for Caution |
| :--- | :--- |
| `src/styles.css` | Massive monolith (24,800+ lines). Uncoordinated additions or selector rewrites can unintentionally break global layouts. |
| `src/lib/supabase.js` | Exports the client singleton and controls session cleanup when "Remember Me" is disabled. |
| `src/lib/store.js` | Single point of failure for demo mode. Manages `localStorage` serialization and window events. |
| `src/components/Protected.jsx` | Authenticates route entry. Delicate startup timing: must wait for `getSession()` to resolve to avoid false redirects. |
| `src/pages/Auth.jsx` | Critical 2,000+ line module containing login, registration, password recovery, strength scoring, and email verification screens. |
| `src/pages/Dashboard.jsx` | 4,000+ line module powering all client dashboard views. Profile updates must never target `email` or lead scoring columns. |
| `src/pages/Admin.jsx` | 4,600+ line module containing operations views and the `AdminGate` component. |
| `supabase-schema.sql` & `supabase/migrations/` | Database migrations. Any changes must maintain RLS and role constraints. |

---

## 6. Security-Sensitive Areas

1. **Role-Based Access Control (RBAC):**
   - User roles are: `client`, `admin`, `expert`, `support`, `finance`.
   - Never grant administrative permissions based purely on frontend state or email domain.
   - Always verify role via `public.user_roles` in PostgreSQL or via a security-definer RPC function.
2. **Orders & Checkout Safety:**
   - Database function `create_careerlyst_order` currently fails closed (`raise exception 'Payment verification is not configured; no order was created.'`). Do not bypass this fail-safe on production without verified server-side payment webhooks.
3. **Session & Credential Storage:**
   - Passwords and service keys must never be logged or persisted in `localStorage`.
   - Remember Me preference is recorded in `localStorage.getItem('formant_remember_me')`.

---

## 7. Testing & Validation Expectations

Before concluding any development task or recommending deployment:
1. **Production Build Verification:**
   - Run `npm run build` from `Careerlyst-Full`.
   - The build must exit code `0` with zero JSX syntax errors, import errors, or bundling failures.
2. **Dual-Mode Verification:**
   - Test that the feature behaves properly when Supabase is active.
   - Test that the feature fails gracefully or falls back to the demo store when Supabase is disconnected.
3. **Responsive Breakpoints:**
   - Mobile: 375px – 430px (verify footer accordions, nav hamburger menu, table card flows).
   - Tablet: 768px – 1024px.
   - Desktop: 1200px – 1440px+.
4. **Console Hygiene:**
   - Verify that no uncaught promise rejections or unhandled exceptions appear in the browser console.

---

## 8. User Approval Requirements

You must obtain explicit user approval before:
1. Executing any database schema migration, table drop, or column alteration.
2. Changing RLS policies, security-definer functions, or column permissions.
3. Installing new third-party dependencies via `npm install`.
4. Making irreversible changes to authentication flows, password policies, or session lifecycles.
5. Performing broad, automated refactors of `src/styles.css` or core page components.
