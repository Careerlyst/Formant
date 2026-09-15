import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import './styles.css';

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
  ResetPassword
} from './pages/Auth';

import Protected from './components/Protected';

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
  AdminSimple,
  AdminWorkspace
} from './pages/Admin';


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
            <AdminSimple title="Services" />
          </Protected>
        }
      />

      <Route
        path="/admin/reviews"
        element={
          <Protected>
            <AdminSimple title="Reviews" />
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
            <AdminSimple title="Notifications" />
          </Protected>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <Protected>
            <AdminSimple title="Settings" />
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
      <App />
    </BrowserRouter>
  </>
);