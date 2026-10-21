import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation
} from 'react-router-dom';

import { applyStoredTheme } from './lib/theme';
import { applySeoMetadata, normalizePath } from './lib/seo';
import './styles.css';
import './pages/messages.css';

import { ToastProvider } from './components/ToastProvider';
import { PageNotFound, RouteErrorBoundary } from './components/ErrorExperience';

import Home from './pages/Home';

import {
  Services,
  ServiceDetail,
  Pricing,
  About,
  Contact,
  Legal
} from './pages/PublicPages';

import Auth, {
  Forgot,
  ResetPassword,
  AuthCallback
} from './pages/Auth';

import Protected from './components/Protected';

// Code-split heavy routes for optimal Core Web Vitals (INP / TBT / FCP)
const Showcase = React.lazy(() => import('./pages/Showcase'));
const LegalPrivacy = React.lazy(() => import('./pages/LegalPrivacy'));
const LeadAssessment = React.lazy(() => import('./pages/LeadAssessment'));
const ServiceSelection = React.lazy(() => import('./pages/ServiceSelection'));

const Dashboard = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Profile = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Profile })));
const Orders = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Orders })));
const Messages = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Messages })));
const Files = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Files })));
const Payments = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Payments })));
const Notifications = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Notifications })));
const Settings = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Settings })));

const AdminGate = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminGate })));
const AdminUsers = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminUsers })));
const AdminOrders = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminOrders })));
const AdminProjects = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminProjects })));
const AdminPayments = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminPayments })));
const AdminMessages = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminMessages })));
const AdminFiles = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminFiles })));
const AdminServices = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminServices })));
const AdminReviews = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminReviews })));
const AdminNotifications = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminNotifications })));
const AdminSimple = React.lazy(() => import('./pages/Admin').then((m) => ({ default: m.AdminSimple })));
const AdminWorkspace = React.lazy(() => import('./pages/AdminWorkspace'));
const AdminShowcase = React.lazy(() => import('./pages/AdminShowcase'));
const AdminLeads = React.lazy(() => import('./pages/AdminLeads'));
const AdminSettings = React.lazy(() => import('./pages/AdminSettings'));

import './dashboard-refinement.css';

const DevShadowComparison = import.meta.env.DEV
  ? React.lazy(() => import('./pages/DevShadowComparison'))
  : null;

// Apply the saved preference synchronously as soon as the app entry module executes.
// This keeps startup theme initialization independent of the Settings route.
applyStoredTheme();

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (hash) {
        const targetId = decodeURIComponent(hash.slice(1));
        const target =
          document.getElementById(targetId) ||
          (targetId === 'how-it-works' ? document.getElementById('process') : null) ||
          (targetId === 'process' ? document.getElementById('how-it-works') : null);

        if (target) {
          const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          target.scrollIntoView({
            block: 'start',
            behavior: prefersReducedMotion ? 'auto' : 'smooth'
          });
          return;
        }
      }

      window.scrollTo(0, 0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}

function TitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applySeoMetadata(normalizePath(pathname));
  }, [pathname]);

  return null;
}

function App() {
  return (
    <Routes>

      {/* =====================================================
          PUBLIC
      ===================================================== */}

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/services"
        element={<Services />}
      />

      <Route
        path="/showcase"
        element={<Showcase />}
      />

      <Route
        path="/services/:id"
        element={<ServiceDetail />}
      />

      <Route
        path="/pricing"
        element={<Pricing />}
      />

      <Route
        path="/about"
        element={<About />}
      />

      <Route
        path="/contact"
        element={<Contact />}
      />

      <Route
        path="/privacy"
        element={<LegalPrivacy />}
      />

      <Route
        path="/privacy-policy"
        element={<LegalPrivacy />}
      />

      <Route
        path="/terms"
        element={<Legal type="terms" />}
      />

      <Route
        path="/refund"
        element={<Legal type="refund" />}
      />


      {/* =====================================================
          AUTH
      ===================================================== */}

      <Route
        path="/login"
        element={<Auth />}
      />

      <Route
        path="/signup"
        element={<Auth signup />}
      />

      <Route
        path="/forgot-password"
        element={<Forgot />}
      />

      <Route
        path="/reset-password"
        element={<ResetPassword />}
      />

      <Route
        path="/auth/callback"
        element={<AuthCallback />}
      />


      {/* =====================================================
          LEAD ASSESSMENT
      ===================================================== */}

      <Route
        path="/assessment"
        element={
          <Protected>
            <LeadAssessment />
          </Protected>
        }
      />

      {/* =====================================================
          SERVICE SELECTION (POST-ASSESSMENT DECISION)
      ===================================================== */}

      <Route
        path="/service-selection"
        element={
          <Protected>
            <ServiceSelection />
          </Protected>
        }
      />


      {/* =====================================================
          CLIENT DASHBOARD
      ===================================================== */}

      <Route
        path="/dashboard"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />

      <Route
        path="/dashboard/profile"
        element={
          <Protected>
            <Profile />
          </Protected>
        }
      />

      <Route
        path="/dashboard/orders"
        element={
          <Protected>
            <Orders />
          </Protected>
        }
      />

      <Route
        path="/dashboard/messages"
        element={
          <Protected>
            <Messages />
          </Protected>
        }
      />

      <Route
        path="/dashboard/files"
        element={
          <Protected>
            <Files />
          </Protected>
        }
      />

      <Route
        path="/dashboard/payments"
        element={
          <Protected>
            <Payments />
          </Protected>
        }
      />

      <Route
        path="/dashboard/notifications"
        element={
          <Protected>
            <Notifications />
          </Protected>
        }
      />

      <Route
        path="/dashboard/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />


      {/* =====================================================
          ADMIN
      ===================================================== */}

      <Route
        path="/admin"
        element={
          <Protected>
            <AdminGate />
          </Protected>
        }
      />

      <Route
        path="/admin/workspace"
        element={
          <Protected>
            <AdminWorkspace />
          </Protected>
        }
      />

      <Route
        path="/admin/users"
        element={
          <Protected>
            <AdminUsers />
          </Protected>
        }
      />

      <Route
        path="/admin/leads"
        element={
          <Protected>
            <AdminLeads />
          </Protected>
        }
      />

      <Route
        path="/admin/orders"
        element={
          <Protected>
            <AdminOrders />
          </Protected>
        }
      />

      <Route
        path="/admin/projects"
        element={
          <Protected>
            <AdminProjects />
          </Protected>
        }
      />

      <Route
        path="/admin/payments"
        element={
          <Protected>
            <AdminPayments />
          </Protected>
        }
      />

      <Route
        path="/admin/messages"
        element={
          <Protected>
            <AdminMessages />
          </Protected>
        }
      />

      <Route
        path="/admin/files"
        element={
          <Protected>
            <AdminFiles />
          </Protected>
        }
      />

      <Route
        path="/admin/services"
        element={
          <Protected>
            <AdminServices />
          </Protected>
        }
      />

      <Route
        path="/admin/showcase"
        element={
          <Protected>
            <AdminShowcase />
          </Protected>
        }
      />

      <Route
        path="/admin/reviews"
        element={
          <Protected>
            <AdminReviews />
          </Protected>
        }
      />

      <Route
        path="/admin/coupons"
        element={
          <Protected>
            <AdminSimple title="Coupons" />
          </Protected>
        }
      />

      <Route
        path="/admin/notifications"
        element={
          <Protected>
            <AdminNotifications />
          </Protected>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <Protected>
            <AdminSettings />
          </Protected>
        }
      />

      {import.meta.env.DEV && DevShadowComparison && (
        <Route
          path="/dev/shadow-comparison"
          element={
            <React.Suspense fallback={<div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading Comparison...</div>}>
              <DevShadowComparison />
            </React.Suspense>
          }
        />
      )}

      <Route
        path="*"
        element={<PageNotFound />}
      />

    </Routes>
  );
}


/* =========================================================
   APP ENTRY
   PRELOADER + ROUTER
   ========================================================= */

createRoot(
  document.getElementById('root')
).render(
  <>
    <BrowserRouter>
      <ToastProvider>
        <ScrollManager />
        <TitleManager />
        <RouteErrorBoundary>
          <React.Suspense fallback={<div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', color: 'var(--muted, #6d7069)', fontFamily: 'sans-serif', fontSize: '14px' }}>Loading…</div>}>
            <App />
          </React.Suspense>
        </RouteErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  </>
);
