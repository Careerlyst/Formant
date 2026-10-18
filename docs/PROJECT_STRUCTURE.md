# Formant — Project Structure & Architecture Guide

> **Document Status:** Active Baseline
> **Architecture:** Single-Page Application (SPA) with Dual-State Architecture (Cloud Supabase + Local Demo Store)
> **Framework:** React 19 (`react: ^19.1.1`), Vite 7 (`vite: ^7.1.3`), React Router 7 (`react-router-dom: ^7.8.2`)
> **Styling:** Native CSS custom properties, DM Sans & Manrope typography, strict light theme

---

## 1. High-Level System Architecture

Formant operates on a **dual-state architectural model**:
1. **Cloud Production Mode (Primary):** When `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) are present, the application connects to a remote Supabase project (PostgreSQL 17, GoTrue Auth, Row-Level Security, and Storage).
2. **Local Demo Store Mode (Fallback):** If Supabase credentials are not provided, or during offline demonstration, the client falls back to an in-browser reactive store (`careerlyst_demo` in `localStorage`) managed via `src/lib/store.js`.

```
[ Visitor / Client Browser ]
             │
             ├──► [ Preloader ] (src/components/Preloader.jsx)
             │
             ├──► [ Public Marketing Site ] (src/pages/PublicPages.jsx, Home.jsx, LegalPrivacy.jsx)
             │          ├── / (Home)
             │          ├── /services, /pricing, /about, /contact
             │          └── /privacy, /privacy-policy, /terms, /refund
             │
             ├──► [ Authentication Gateway ] (src/pages/Auth.jsx)
             │          ├── /login, /signup, /forgot, /reset-password
             │          └──► [ Lead Assessment Funnel ] (src/pages/LeadAssessment.jsx - /assessment)
             │
             ├──► [ Client Dashboard ] (src/components/Protected.jsx -> src/pages/Dashboard.jsx)
             │          ├── Overview (/dashboard)
             │          ├── Profile (/dashboard/profile)
             │          ├── Orders & Progress (/dashboard/orders)
             │          ├── Direct Messaging (/dashboard/messages)
             │          ├── Deliverable Files (/dashboard/files)
             │          └── Account Settings (/dashboard/settings)
             │
             └──► [ Staff Operations Workspace ] (Protected.jsx + AdminGate -> Admin.jsx & AdminWorkspace.jsx)
                        ├── Operations Overview (/admin)
                        ├── Project Command Center (/admin/workspace)
                        ├── User Directory & Roles (/admin/users)
                        ├── Service Catalog Management (/admin/services)
                        ├── Qualified Leads Pipeline (/admin/leads)
                        ├── Client Reviews Moderation (/admin/reviews)
                        ├── Push Notifications Broadcast (/admin/notifications)
                        └── Admin Settings (/admin/settings)
```

---

## 2. Directory Layout

```
Careerlyst-Full/
│
├── index.html                   # Single-page application HTML entry
├── package.json                 # Project dependencies, scripts, and metadata
├── vite.config.js               # Vite build configuration (React plugin)
├── vercel.json                  # Production hosting config with SPA rewrites
├── .env.example                 # Sanitized environment template
├── .gitignore                   # Version control exclusion rules
├── README.md                    # Repository orientation and setup guide
│
├── docs/                        # Formal architecture & operational documentation
│   └── PROJECT_STRUCTURE.md     # This comprehensive architectural breakdown
│
├── ai/                          # AI operating rules, decisions, and system snapshots
│   ├── instructions.md          # Mandatory AI operating rules and boundaries
│   ├── decisions.md             # Architecture Decision Records (ADRs)
│   ├── current-state.md         # Production system topology snapshot
│   └── known-issues.md          # Catalog of identified technical debt and bugs
│
├── public/                      # Static assets served as-is by Vite
│   ├── sw.js                    # Web Push service worker
│   └── assets/                  # Brand wordmarks, symbol SVGs, icons, and hero illustrations
│
├── src/                         # Application source code
│   ├── main.jsx                 # Application entry point, route definitions, title/scroll managers
│   ├── styles.css               # Monolithic design system stylesheet (25,000+ lines)
│   │
│   ├── components/              # Shared layout, navigation, and feedback components
│   │   ├── DashboardShell.jsx   # Authenticated app shell (desktop sidebar, mobile 64px top bar)
│   │   ├── PublicNav.jsx        # Public navigation header with dynamic account dropdown
│   │   ├── Footer.jsx           # Global public footer with navigation & legal links
│   │   ├── Logo.jsx             # Three-bar Careerlyst/Formant brand SVG mark and wordmark
│   │   ├── Preloader.jsx        # Branded initial application loading animation
│   │   ├── Preloader.css        # Scoped animations for preloader entrance/exit
│   │   ├── Protected.jsx        # Client-side route authentication guard (prevents flash redirects)
│   │   ├── NotificationBell.jsx # Realtime notifications dropdown trigger
│   │   └── ResendLink.jsx       # Email verification resend helper component
│   │
│   ├── lib/                     # Core services, state stores, and utilities
│   │   ├── supabase.js          # Supabase client singleton & session cleanup logic
│   │   ├── store.js             # Local demo store (careerlyst_demo in localStorage)
│   │   ├── theme.js             # Strict light-only theme enforcement (data-theme="light")
│   │   ├── pushNotifications.js # Web Push registration and VAPID subscription helpers
│   │   └── profileCompletion.js # Client profile completion percentage calculator
│   │
│   └── pages/                   # Route page components and module-scoped styles
│       ├── Home.jsx             # Public landing page
│       ├── PublicPages.jsx      # Public subpages (Services, Pricing, About, Contact, Legal)
│       ├── LegalPrivacy.jsx     # Dedicated 16-section Privacy Policy page
│       ├── legal-privacy.css    # Scoped styles for Privacy Policy adhering to DESIGN.md
│       ├── Auth.jsx             # Login, Signup, Forgot, and Password Reset screens
│       ├── LeadAssessment.jsx   # 7-step interactive lead qualification questionnaire
│       ├── Dashboard.jsx        # Client portal (Overview, Profile, Orders, Messages, Files)
│       ├── messages.css         # Scoped messaging styles
│       ├── my-profile.css       # Scoped profile editor styles
│       ├── Admin.jsx            # Core Admin views (Overview, Users, Orders, AdminGate)
│       ├── AdminWorkspace.jsx   # Operational project command center (board, drawers, chat)
│       ├── AdminProjects.jsx    # Projects listing and filter view
│       ├── AdminServices.jsx    # Service pricing, visibility, and catalog manager
│       ├── AdminLeads.jsx       # Qualified lead review pipeline
│       ├── AdminReviews.jsx     # Client testimonials & reviews manager
│       ├── admin-reviews.css    # Scoped styles for reviews management
│       ├── AdminNotifications.jsx # Push notification broadcast console
│       ├── admin-notifications.css # Scoped styles for notification console
│       ├── AdminSettings.jsx    # Administrative platform settings
│       └── admin-settings.css   # Scoped styles for admin settings
│
└── supabase/                    # Backend infrastructure as code
    ├── config.toml              # Local Supabase CLI configuration
    ├── migrations/              # Versioned PostgreSQL database migrations
    └── functions/               # Supabase Edge Functions (Deno runtime)
        └── send-push-notification/ # Web push dispatch function
            └── index.ts
```

---

## 3. Entry Points & Routing Flow

### 3.1 Bootstrap Sequence
1. **`index.html`** loads the viewport meta, font links, and executes `<script type="module" src="/src/main.jsx"></script>`.
2. **`src/main.jsx`** initializes:
   - `TitleManager`: Listens to route changes and updates `document.title` based on a predefined dictionary (`ROUTE_TITLES`).
   - `ScrollManager`: Smoothly handles window scroll on route changes and hash navigation (`/#how-it-works`).
   - `Preloader`: Plays the branded intro animation once on full page load, then unmounts.
   - `BrowserRouter`: Declares all route branches.

### 3.2 Route Hierarchy

| Route Path | Component | Guard / Access | Layout |
| :--- | :--- | :--- | :--- |
| `/` | `Home` | Public | PublicNav + Footer |
| `/services`, `/services/:slug` | `ServicesPage` | Public | PublicNav + Footer |
| `/pricing`, `/about`, `/contact` | `PricingPage`, `AboutPage`, `ContactPage` | Public | PublicNav + Footer |
| `/privacy`, `/privacy-policy` | `LegalPrivacy` | Public | PublicNav + Footer |
| `/terms`, `/refund` | `Legal` | Public | PublicNav + Footer |
| `/login`, `/signup`, `/forgot`, `/reset-password` | `Auth` | Public (redirects if logged in) | Auth split view |
| `/assessment` | `LeadAssessment` | Public / Onboarding | Custom minimal header |
| `/dashboard/*` | `Dashboard` | `Protected` (Requires authenticated user or demo session) | `DashboardShell` (Client mode) |
| `/admin/*` | `Admin`, `AdminWorkspace`, etc. | `Protected` + `AdminGate` (Requires role in `public.user_roles`) | `DashboardShell` (Admin mode) |

---

## 4. Key Subsystems & State Modules

### 4.1 Supabase Integration (`src/lib/supabase.js`)
- Exports the `supabase` client singleton initialized with `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY)`.
- If credentials are not present, exports `null` without throwing an error, allowing components to detect cloud availability (`isSupabaseConfigured`).
- Implements session expiration when the user disables "Remember Me" (`formant_remember_me === 'false'`).

### 4.2 Local Demo Store (`src/lib/store.js`)
- Implements an in-memory/`localStorage` mock database under key `careerlyst_demo`.
- Seeds default dummy data for users, orders, messages, deliverables, and service pricing.
- Dispatches a custom window event (`careerlyst-store`) upon every `patch()` or `save()` invocation, providing instant reactivity across React components without an external state library.

### 4.3 Route Protection (`src/components/Protected.jsx`)
- Prevents the startup race condition where Supabase Auth briefly reports a `null` session while reading tokens from storage.
- Shows `"Checking your account..."` until `supabase.auth.getSession()` completes.
- Seamlessly falls back to `load().user` when operating in demo mode.

### 4.4 Staff Security Gate (`src/pages/Admin.jsx:AdminGate`)
- Authenticated staff routes (`/admin/*`) query `public.user_roles` to verify that the logged-in user possesses one of the designated `STAFF_ROLES` (`['admin', 'expert', 'support', 'finance']`).
- Client-tier users and unauthenticated visitors are prevented from rendering administrative data panels.

### 4.5 Design Tokens & Styling Architecture (`src/styles.css`)
- Pure CSS with root custom properties:
  - `--cream: #fbfaf3` (Canvas background)
  - `--ink: #11120f` (Primary typography and dark buttons)
  - `--muted: #6d7069` (Secondary text and metadata)
  - `--line: #deded5` (Hairline structural borders)
  - `--lime: #c7f72f` (High-visibility action and status accent)
  - `--paper: #ffffff` (Content panel surfaces)
- Strict light-only aesthetic locked in `src/lib/theme.js` (`data-theme="light"`). Dark mode listeners are intentionally disabled per ADR-005.

---

## 5. Deployment Configuration

- **Platform:** Vercel
- **Configuration:** `vercel.json` provides an SPA rewrite rule (`/(.*) -> /index.html`), ensuring deep links and refreshed URLs resolve to the client router without 404 errors.
- **Release Trigger:** Automatic continuous deployment via git push to GitHub `origin/main`.
