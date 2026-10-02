import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation
} from 'react-router-dom';

import { applyStoredTheme } from './lib/theme';
import './styles.css';
import './pages/messages.css';

import Preloader from './components/Preloader';

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
import LeadAssessment from './pages/LeadAssessment';
import AdminLeads from './pages/AdminLeads';
import AdminSettings from './pages/AdminSettings';

import {
  Dashboard,
  Profile,
  Orders,
  Messages,
  Files,
  Payments,
  Notifications,
  Settings
} from './pages/Dashboard';

import {
  AdminGate,
  AdminUsers,
  AdminOrders,
  AdminProjects,
  AdminPayments,
  AdminMessages,
  AdminFiles,
  AdminServices,
  AdminReviews,
  AdminNotifications,
  AdminSimple,
  AdminWorkspace
} from './pages/Admin';

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
          target.scrollIntoView({
            block: 'start',
            behavior: 'smooth'
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

const ROUTE_TITLES = {
  '/': 'Formant',
  '/services': 'Formant — Services',
  '/pricing': 'Formant — Pricing',
  '/about': 'Formant — About',
  '/contact': 'Formant — Contact',
  '/privacy': 'Formant — Privacy',
  '/terms': 'Formant — Terms',
  '/refund': 'Formant — Refund',
  '/login': 'Formant — Login',
  '/signup': 'Formant — Sign Up',
  '/auth/callback': 'Formant — Verifying...',
  '/forgot-password': 'Formant — Forgot Password',
  '/reset-password': 'Formant — Reset Password',
  '/assessment': 'Formant — Assessment',
  '/dashboard': 'Formant — Dashboard',
  '/dashboard/profile': 'Formant — Profile',
  '/dashboard/orders': 'Formant — Orders',
  '/dashboard/messages': 'Formant — Messages',
  '/dashboard/files': 'Formant — Files',
  '/dashboard/payments': 'Formant — Payments',
  '/dashboard/notifications': 'Formant — Notifications',
  '/dashboard/settings': 'Formant — Settings',
  '/admin': 'Formant — Admin',
  '/admin/workspace': 'Formant — Workspace',
  '/admin/users': 'Formant — Users',
  '/admin/leads': 'Formant — Leads',
  '/admin/orders': 'Formant — Orders',
  '/admin/projects': 'Formant — Projects',
  '/admin/services': 'Formant — Services',
  '/admin/payments': 'Formant — Payments',
  '/admin/messages': 'Formant — Messages',
  '/admin/files': 'Formant — Files',
  '/admin/reviews': 'Formant — Reviews',
  '/admin/coupons': 'Formant — Coupons',
  '/admin/notifications': 'Formant — Notifications',
  '/admin/settings': 'Formant — Settings'
};

function TitleManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const normalizedPath =
      pathname.length > 1 && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname;

    if (ROUTE_TITLES[normalizedPath]) {
      document.title = ROUTE_TITLES[normalizedPath];
    } else if (normalizedPath.startsWith('/services/')) {
      document.title = 'Formant — Services';
    } else {
      document.title = 'Formant';
    }
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
        element={<Legal type="privacy" />}
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
    <Preloader />

    <BrowserRouter>
      <ScrollManager />
      <TitleManager />
      <App />
    </BrowserRouter>
  </>
);