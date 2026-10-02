# Formant — Current State Snapshot

> **Date of Snapshot:** 2026-10-01  
> **Status:** Production-ready Frontend with Connected Supabase Cloud Backend and Demo Fallback.

---

## 1. Project Purpose

Formant is a digital career-services platform designed to help professionals accelerate their job search and improve career positioning through tailored services:
- **Resume & CV Revamp**
- **LinkedIn Profile Optimization**
- **GitHub Developer Profile Curation**
- **Personal Portfolio Strategy**
- **Targeted Cover Letters**
- **Interview Preparation Coaching**

The platform combines a public marketing presence, an interactive 7-question lead qualification funnel, a comprehensive client dashboard for managing deliverables and messaging, and a multi-role administrative workspace for staff operations.

---

## 2. Technology Stack

| Layer | Technologies / Libraries | Version / Details |
| :--- | :--- | :--- |
| **Frontend Framework** | React, React DOM | `^19.1.1` |
| **Routing** | React Router DOM | `^7.8.2` (declarative `BrowserRouter`) |
| **Build & Dev Tool** | Vite, `@vitejs/plugin-react` | `^7.1.3` / `^5.0.2` (ESM module format) |
| **Backend & Database** | Supabase (PostgreSQL 17, GoTrue Auth, PostgREST) | Hosted Supabase project (`bofsshercyihwnsbblzp`) |
| **Database Client** | `@supabase/supabase-js` | `^2.116.0` |
| **Styling** | Native CSS (monolithic `styles.css` + scoped CSS files) | CSS Custom Properties, DM Sans font |
| **Deployment / Hosting** | Vercel | SPA rewrites, linked project `prj_bSvOW2cvpytPQfrJlmeb3ijzBqFA` |

---

## 3. System Architecture

```
[ Visitor / Client Browser ]
             │
             ├──► [ Preloader ] (Smooth bottom-to-top slide transition)
             │
             ├──► [ Public Marketing Site ] (Home, Services, Pricing, About, Contact, Legal)
             │
             ├──► [ Authentication ] (Login, Sign Up, Forgot Password, Reset Password)
             │          │
             │          └──► [ Lead Assessment ] (7 questions -> score -> /dashboard)
             │
             ├──► [ Client Dashboard ] (Protected)
             │          ├── Profile Management
             │          ├── Orders & Queue Tracking
             │          ├── Real-time Messaging
             │          ├── File Exchange
             │          ├── Payments History
             │          ├── Notifications
             │          └── Account Settings (Theme locked to light)
             │
             └──► [ Staff Workspace / Admin ] (Protected + RBAC)
                        ├── Operations Workspace
                        ├── User Directory & Role Assignment
                        ├── Lead Qualification Pipeline
                        ├── Orders & Project Tracking
                        ├── Service Catalog & Visibility Toggles
                        ├── Payment Audits
                        ├── Review Management
                        └── Platform Settings
             │
   ┌─────────┴─────────┐
   ▼                   ▼
[ Supabase Cloud ]   [ Local Demo Store ]
- Postgres 17        - localStorage ('careerlyst_demo')
- GoTrue Auth        - window Event ('careerlyst-store')
- Storage & RLS      - In-browser mock data
```

---

## 4. Directory Structure

```
Careerlyst-Full/
├── .env                              # Supabase project URL and anon publishable key
├── .env.local                        # Vercel deployment tokens
├── .gitignore                        # Git ignore patterns
├── index.html                        # Application entry HTML (DM Sans font, meta tags)
├── package.json                      # Dependencies and scripts (dev, build, preview)
├── README.md                         # Project setup and documentation
├── vercel.json                       # Vercel SPA routing configuration
├── vite.config.js                    # Vite bundler configuration with React plugin
├── public/
│   └── assets/                       # Wordmarks, symbols, favicons, illustrations
├── src/
│   ├── main.jsx                      # App root, Preloader mount, Scroll & Title managers, routes
│   ├── styles.css                    # Monolithic design system stylesheet (24,800+ lines)
│   ├── components/
│   │   ├── DashboardShell.jsx        # Common sidebar, header, and layout shell for dashboard & admin
│   │   ├── Footer.jsx                # Responsive footer with mobile accordion disclosure sections
│   │   ├── Logo.jsx                  # Formant wordmark & symbol component
│   │   ├── NotificationBell.jsx      # Header notification counter and dropdown
│   │   ├── Preloader.jsx             # Editorial bottom-to-top viewport loading transition
│   │   ├── Preloader.css             # Preloader animation keyframes and transitions
│   │   ├── Protected.jsx             # Route guard managing authentication and session resolution
│   │   └── ResendLink.jsx            # 30-second cooldown timer for email confirmation resends
│   ├── lib/
│   │   ├── profileCompletion.js      # Single source of truth for 9-field profile completion score
│   │   ├── store.js                  # Demo/local store (load, save, patch, demoLogin)
│   │   ├── supabase.js               # Supabase client singleton and session eviction handler
│   │   └── theme.js                  # Strict light-theme enforcement
│   └── pages/
│       ├── Home.jsx                  # Marketing homepage (hero, services, process, testimonials)
│       ├── PublicPages.jsx           # Services list, detail, Pricing, About, Contact, Legal
│       ├── Auth.jsx                  # Login, Signup, Forgot, ResetPassword, password strength meter
│       ├── LeadAssessment.jsx        # 7-step onboarding assessment with score calculation
│       ├── Dashboard.jsx             # Client dashboard views (Overview, Profile, Orders, etc.)
│       ├── Admin.jsx                 # Staff admin hub, AdminGate, User Directory, Orders
│       ├── AdminWorkspace.jsx        # Staff overview and project cards
│       ├── AdminLeads.jsx            # Lead pipeline and qualification status
│       ├── AdminProjects.jsx         # Project tracking and status transitions
│       ├── AdminServices.jsx         # Service catalog editor and visibility toggles
│       ├── AdminReviews.jsx          # Testimonial and review management
│       ├── AdminNotifications.jsx    # System and staff notifications
│       └── AdminSettings.jsx         # Platform settings and audit logs
├── supabase/
│   ├── config.toml                   # Local Supabase CLI configuration
│   └── migrations/                   # SQL migration scripts
└── ai/                               # Universal AI Brain documentation (this folder)
```

---

## 5. Frontend Navigation & Routing

All routes are declared in `src/main.jsx`:

### Public Routes
- `/`: Home landing page
- `/services`: Overview of all career packages
- `/services/:id`: Detailed view of a specific service package
- `/pricing`: Pricing comparison table
- `/about`: Company philosophy and editorial story
- `/contact`: Direct contact form
- `/privacy`, `/terms`, `/refund`: Legal agreements (`Legal` component)

### Authentication Routes
- `/login`: Client and staff login (supports Remember Me and Password Visibility)
- `/signup`: New user registration with password strength meter and terms checkbox
- `/forgot-password`: Password reset request form
- `/reset-password`: Token-based password update form

### Onboarding Funnel
- `/assessment`: 7-question qualification survey. Calculates score (`0–16`) and status (`hot`, `warm`, `cold`, `exploring`). Directs to `/dashboard` upon completion.

### Client Dashboard (Protected)
- `/dashboard`: Overview with queue status, active orders, and profile completion meter
- `/dashboard/profile`: 9-field career profile editor (name, phone, role, experience, education, links, bio)
- `/dashboard/orders`: Order history, status timeline, deliverable inspection
- `/dashboard/messages`: Two-way messaging thread with operations team
- `/dashboard/files`: Uploaded resume and deliverable file browser
- `/dashboard/payments`: Invoices, receipts, and payment status
- `/dashboard/notifications`: Activity alerts
- `/dashboard/settings`: Account preferences (password reset, theme status locked to light)

### Staff Administration (Protected + RBAC)
- `/admin`: Staff gateway (`AdminGate`)
- `/admin/workspace`: Operations overview
- `/admin/users`: User directory, role assignment, join dates
- `/admin/leads`: Qualified lead pipeline
- `/admin/orders`: Order management, queue assignments, status transitions
- `/admin/projects`: Active project deliverables
- `/admin/services`: Service catalog pricing, descriptions, and visibility toggles
- `/admin/payments`: Transaction audits
- `/admin/messages`: Staff-side messaging console
- `/admin/files`: File repository
- `/admin/reviews`: Review approval workflow
- `/admin/coupons`: Promotional discount management (`AdminSimple`)
- `/admin/notifications`: Staff broadcast notifications
- `/admin/settings`: Platform configuration and audit logging

---

## 6. Authentication & Session Architecture

1. **Supabase Auth Integration:**
   - Managed via `supabase.auth.signInWithPassword`, `supabase.auth.signUp`, and `supabase.auth.signOut`.
   - `Protected.jsx` uses `supabase.auth.getSession()` and `onAuthStateChange` to eliminate flash-of-unauthenticated-state during page refresh.
2. **Remember Me Behavior:**
   - When enabled: Supabase session persists in `localStorage`.
   - When disabled: `src/lib/supabase.js` evicts session on initial page startup if no active session is detected in `sessionStorage`.
3. **Role-Based Access Control (RBAC):**
   - Roles: `client` (default), `admin`, `expert`, `support`, `finance`.
   - Stored in `public.user_roles`.
   - Staff routes check role membership using `['admin', 'expert', 'support', 'finance'].includes(role)`.

---

## 7. Database Structure & Security (Supabase / Postgres 17)

### Verified Public Schema Tables
- `public.profiles`: User identity details (`id` -> `auth.users(id)`, `name`, `email`, `phone`, `target_role`, `experience`, `education`, `linkedin`, `github`, `portfolio`, `bio`, `lead_assessment`, `lead_score`, `lead_status`, `lead_assessment_completed_at`, `created_at`).
- `public.services`: Career services (`id`, `slug`, `name`, `description`, `starting_price`, `active`, `show_on_services_page`, `accept_orders`, `created_at`).
- `public.service_packages`: Sub-tiers for services (`id`, `service_id`, `name`, `price`, `currency`, `active`).
- `public.orders`: Client orders (`id`, `user_id`, `status`, `total`, `queue_position`, `service_name`, `package_name`, `payment_status`, `created_at`, `updated_at`).
- `public.order_items`: Order line items (`id`, `order_id`, `service_id`, `price`).
- `public.messages`: Order-specific messages (`id`, `order_id`, `sender_id`, `body`, `created_at`, `read_at`).
- `public.files`: Attached client documents (`id`, `order_id`, `user_id`, `storage_path`, `original_name`, `created_at`).
- `public.payments`: Payment logs (`id`, `order_id`, `user_id`, `provider`, `provider_payment_id`, `amount`, `status`, `created_at`).
- `public.user_roles`: Role mapping (`user_id`, `role`).
- `public.reviews`: Client reviews and ratings (`id`, `user_id`, `service_id`, `rating`, `comment`).
- `public.platform_settings`: Key/value platform configuration.
- `public.admin_audit_logs`: Operations audit log.

### Row Level Security (RLS) & Column Security
- RLS is enabled across all tables in `supabase-schema.sql`.
- Column permissions: `authenticated` role is **revoked** from `INSERT` and `UPDATE` on `profiles.email` and `profiles.lead_*`.
- Service visibility policy: Staff can select and update all services; public can select only active services.

### Stored Procedures / RPCs
- `admin_list_directory_join_dates_v1()`: Security definer RPC allowing staff to fetch registration dates from `auth.users`.
- `admin_list_directory_user_roles_v1()`: RPC to fetch directory roles.
- `create_careerlyst_order()`: Server-side order creation function (currently fails closed until payment provider is integrated).

---

## 8. Build & Run Process

1. **Development Server:**
   ```bash
   cd Careerlyst-Full
   npm run dev
   ```
   Runs Vite dev server locally (default: `http://localhost:5173`).
2. **Production Build:**
   ```bash
   npm run build
   ```
   Executes `node node_modules/vite/bin/vite.js build`. Outputs static assets to `dist/`.
3. **Preview Production Build:**
   ```bash
   npm run preview
   ```

---

## 9. Current Feature Status Summary

| Area | Feature | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Marketing** | Landing Page | Operational | High visual polish, responsive active nav indicator. |
| **Marketing** | Service Detail & Pricing | Operational | Connects to services table / static fallback. |
| **Marketing** | Footer Navigation | Operational | Responsive mobile accordion layout. |
| **Auth** | Login / Signup | Operational | Remember Me, Show Password, Strength indicator working. |
| **Auth** | Password Recovery | Operational | Reset password flow with token handling. |
| **Onboarding** | Lead Assessment | Operational (Partial) | Writes to auth metadata; needs sync to `profiles`. |
| **Dashboard** | Profile Editor | Operational | 9 fields + completion meter. Excludes `email`. |
| **Dashboard** | Orders & Queue | Demo-Ready | Displays mock queue and order progress. |
| **Dashboard** | Messages & Files | Operational | Working UI; supports Supabase PostgREST. |
| **Admin** | Staff Workspace & Directory | Operational | Requires staff role in `user_roles`. |
| **Admin** | Service Management | Operational | Staff can toggle visibility and active states. |
| **Admin** | Leads Pipeline | Blocked by Issue #2 | Returns 0 rows due to metadata/profile disconnect. |
| **Checkout** | Order Creation | Blocked by Issue #5 | Fails closed on Supabase backend; works in demo store. |
| **Payments** | Payment Gateway | Incomplete | Stripe/PayPal webhooks not yet integrated. |
