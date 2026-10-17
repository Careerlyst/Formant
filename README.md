# Formant — Career Development & Profile Platform

> **Live Deployment:** [https://careerlyst-three.vercel.app](https://careerlyst-three.vercel.app)  
> **Brand Direction:** Warm editorial cream (`#fbfaf3`), black ink (`#11120f`), lime accent (`#c7f72f`), hairline borders (`#deded5`), DM Sans interface copy, Manrope display typography, and a strict light-only aesthetic.

---

## 1. Project Overview

**Formant** is a production React 19 single-page web application offering tailored career services for ambitious professionals:
- **Resume & CV Revamp:** ATS-optimized, role-targeted resume development.
- **LinkedIn Profile Optimization:** Narrative storytelling, headline strategy, and recruiter positioning.
- **GitHub Developer Profile Curation:** Pinned repository curation, README architecture, and code visibility.
- **Personal Portfolio Strategy:** Project credibility, case-study structure, and presentation design.
- **Targeted Cover Letters:** Opportunity-specific cover letters aligned with target job requirements.
- **Interview Preparation Coaching:** Behavioral preparation, technical delivery, and live feedback.

The platform provides a public marketing website, an interactive 7-step lead qualification funnel (`/assessment`), an authenticated client dashboard for managing deliverables and messaging, and a multi-role administrative workspace for operations staff.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `^19.1.1` | Client UI rendering and reactive component tree |
| **DOM Renderer** | React DOM | `^19.1.1` | React tree DOM binding |
| **Routing** | React Router DOM | `^7.8.2` | Declarative client-side routing (`BrowserRouter`) |
| **Build Tool & Bundler** | Vite | `^7.1.3` | Fast ESM development server and Rollup production bundler |
| **Vite React Plugin** | `@vitejs/plugin-react` | `^5.0.2` | Babel Fast Refresh and JSX transformation |
| **Backend & Database** | Supabase | PostgreSQL 17 | Relational database, GoTrue Auth, and Row-Level Security |
| **Database SDK** | `@supabase/supabase-js` | `^2.116.0` | PostgREST and Auth client singleton (`src/lib/supabase.js`) |
| **Local CLI** | Supabase CLI | `^2.117.0` | Local schema and Edge Function management |
| **Styling** | Native CSS | Custom Properties | Monolithic `src/styles.css` (25k+ lines) and scoped stylesheets |
| **Hosting & CDN** | Vercel | SPA rewrites | Global edge deployment linked via GitHub |

---

## 3. Architecture: The Dual-State Model

Formant operates on a verified **dual-state architecture**:

1. **Cloud Supabase Mode (Production):**
   - Active when valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) are present in environment configuration.
   - All authentication, user profiles, orders, and messages query remote Supabase tables protected by PostgreSQL Row-Level Security (RLS).
2. **Local Demo Mode (Fallback & Offline):**
   - Active when Supabase environment variables are missing or blank.
   - The application seamlessly falls back to an in-browser mock database (`careerlyst_demo` in `localStorage`) managed via [`src/lib/store.js`](src/lib/store.js).
   - Enables instant local development, stakeholder walkthroughs, and offline testing without live database credentials.

---

## 4. Prerequisites

- **Node.js:** LTS version (`v18.x`, `v20.x`, or `v22.x`). Verified compatible on Linux, macOS, and Windows.
- **npm:** `v9.x` or higher (bundled with Node.js LTS).
- **Git:** For version control.

Verify your local environment:
```bash
node -v
npm -v
git --version
```

---

## 5. Local Setup & Startup

### Step 1: Clone or Navigate to the Repository
```bash
cd Careerlyst-Full
```

### Step 2: Configure Environment Variables
Copy the sanitized environment template:
```bash
cp .env.example .env
```
- **To run in Demo Mode:** Leave `.env` with placeholder values or empty keys. The application will initialize with mock data.
- **To connect to Cloud Supabase:** Edit `.env` and provide your project URL and public anonymous key:
  ```env
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY=your-actual-anon-key
  ```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Start the Local Development Server
```bash
npm run dev
```
Open the local URL displayed in the terminal (typically `http://localhost:5173`).

---

## 6. Available NPM Scripts

All available scripts are defined in [`package.json`](package.json):

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Starts the local Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | `node node_modules/vite/bin/vite.js build` | Compiles and minifies the application into production assets in `dist/`. |
| `npm run preview` | `vite preview` | Serves the production build from `dist/` locally for pre-deployment testing. |

---

## 7. Production Build & Verification

Before opening a pull request or pushing changes to `main`, verify that the production build completes with zero errors:

```bash
npm run build
```

Expected output:
```text
vite v7.x.x building client environment for production...
✓ 115 modules transformed.
dist/index.html                   ~0.73 kB
dist/assets/index-[hash].css      ~433 kB
dist/assets/index-[hash].js       ~977 kB
✓ built in ~4s
```

To test the compiled bundle locally:
```bash
npm run preview
```

---

## 8. High-Level Project Structure

```text
Careerlyst-Full/
├── index.html                   # HTML entry point for the SPA
├── package.json                 # Dependency definitions and scripts
├── vite.config.js               # Vite bundler configuration
├── vercel.json                  # Vercel SPA routing rewrite rules
├── .env.example                 # Sanitized environment template
├── .gitignore                   # Version control exclusions
├── README.md                    # This document
│
├── docs/                        # Formal architecture & operational documentation
│   └── PROJECT_STRUCTURE.md     # Detailed architectural breakdown & routing flow
│
├── ai/                          # AI operating rules, decisions, and system snapshots
│   ├── instructions.md          # Mandatory operating rules for AI coding assistants
│   ├── decisions.md             # Architectural Decision Records (ADRs)
│   ├── current-state.md         # Production system snapshot
│   └── known-issues.md          # Identified bugs and technical debt
│
├── public/                      # Static assets and Web Push service worker (sw.js)
├── src/                         # Application source code
│   ├── main.jsx                 # Application root, routing, and title/scroll managers
│   ├── styles.css               # Monolithic design system stylesheet (25k+ lines)
│   ├── components/              # Shared UI components (DashboardShell, PublicNav, Logo, etc.)
│   ├── lib/                     # Singletons & utilities (supabase.js, store.js, theme.js)
│   └── pages/                   # Route views (Home, Auth, LeadAssessment, Dashboard, Admin)
│
└── supabase/                    # Supabase backend configuration, migrations, and functions
```

*For complete component descriptions and routing mappings, see [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md).*

---

## 9. Deployment Workflow

- **Hosting Platform:** [Vercel](https://vercel.com)
- **Production Target:** `https://careerlyst-three.vercel.app`
- **Routing Enforcement:** Single-page application rewrites are configured in [`vercel.json`](vercel.json):
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```
- **Deployment Process:**
  - The Vercel project is linked to the GitHub repository `ashik-exe/careerlyst`.
  - Pushing commits to the `main` branch triggers an automated Vercel production build.
  - Vercel executes `npm run build`, outputting artifacts to `dist/` and serving them globally via edge CDN.

---

## 10. Design System & Operating Boundaries

All future development must respect the canonical specifications documented in [`DESIGN.md`](DESIGN.md) and [`ai/instructions.md`](ai/instructions.md):

1. **Strict Light Theme:** The platform is locked to `data-theme="light"`. Do not re-enable dark mode listeners or dark overrides.
2. **Design Tokens:** Always use existing root CSS custom properties (`--cream: #fbfaf3`, `--ink: #11120f`, `--lime: #c7f72f`, `--line: #deded5`).
3. **Dual-State Integrity:** Never remove or bypass the `src/lib/store.js` fallback when adding or modifying data features.
4. **Security Boundaries:** Never expose `service_role` keys. Client-side code must never attempt to write to protected columns (`profiles.email` or `lead_*`). Staff views must always be protected by database-enforced role checks (`AdminGate`).
