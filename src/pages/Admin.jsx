import React, { useEffect, useState } from 'react';
import {
  Link,
  useNavigate
} from 'react-router-dom';

import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import { load } from '../lib/store';


/* =========================================================
   STAFF ROLES
   ========================================================= */

const STAFF_ROLES = [
  'admin',
  'expert',
  'support',
  'finance'
];


/* =========================================================
   ADMIN OVERVIEW
   ========================================================= */

function AdminOverview() {

  return (
    <DashboardShell admin>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            CONTROL PANEL
          </p>

          <h1>
            Operations overview.
          </h1>

          <p>
            Keep the small team focused on the right work.
          </p>

        </div>

      </div>


      <div className="stats">

        <div className="stat">
          <span>Active projects</span>
          <b>2 / 2</b>
        </div>

        <div className="stat">
          <span>Queue</span>
          <b>3</b>
        </div>

        <div className="stat">
          <span>Users</span>
          <b>12</b>
        </div>

        <div className="stat">
          <span>Unread</span>
          <b>4</b>
        </div>

      </div>


      <section className="admin-capacity panel">

        <div>

          <p className="eyebrow">
            CAPACITY
          </p>

          <h2>
            2 of 2 active slots used
          </h2>

          <p>
            New orders should enter the queue automatically.
          </p>

        </div>

        <div className="capacity-bar">
          <i />
        </div>

      </section>


      <section className="panel">

        <div className="panel-head">

          <h2>
            Active orders
          </h2>

          <Link to="/admin/orders">
            Manage →
          </Link>

        </div>


        <div className="admin-order">

          <b>#1042</b>

          <span>
            Resume + LinkedIn
          </span>

          <span className="status">
            In progress
          </span>

          <span>
            Client: Sarah M.
          </span>

        </div>


        <div className="admin-order">

          <b>#1043</b>

          <span>
            Portfolio
          </span>

          <span className="status">
            In progress
          </span>

          <span>
            Client: Daniel K.
          </span>

        </div>

      </section>

    </DashboardShell>
  );
}


/* =========================================================
   ADMIN LIST
   ========================================================= */

function AdminList({
  title,
  kind
}) {

  const [
    status,
    setStatus
  ] = useState('In progress');

  return (
    <DashboardShell admin>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            ADMIN
          </p>

          <h1>
            {title}
          </h1>

        </div>

      </div>


      <div className="panel table-panel">


        {/* ORDERS */}

        {kind === 'orders' && (
          <>

            <div className="admin-order">

              <b>#1042</b>

              <span>
                Sarah M.
              </span>

              <span>
                Resume + LinkedIn
              </span>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              >

                <option>
                  Queued
                </option>

                <option>
                  In progress
                </option>

                <option>
                  Client review
                </option>

                <option>
                  Revision
                </option>

                <option>
                  Completed
                </option>

              </select>

              <Link
                className="text-button"
                to="/admin/workspace"
              >
                Open workspace →
              </Link>

            </div>


            <div className="admin-order">

              <b>#1043</b>

              <span>
                Daniel K.
              </span>

              <span>
                Portfolio
              </span>

              <select>

                <option>
                  In progress
                </option>

                <option>
                  Client review
                </option>

                <option>
                  Revision
                </option>

                <option>
                  Completed
                </option>

              </select>

              <Link
                className="text-button"
                to="/admin/workspace"
              >
                Open workspace →
              </Link>

            </div>

          </>
        )}


        {/* USERS */}

        {kind === 'users' && (

          [
            'Sarah M.',
            'Daniel K.',
            'Aisha R.',
            'James P.'
          ].map((name, i) => (

            <div
              className="admin-order"
              key={name}
            >

              <b>
                USR-10{i + 1}
              </b>

              <span>
                {name}
              </span>

              <span>
                {i % 2
                  ? 'Portfolio'
                  : 'Resume'}
              </span>

              <span>
                Active
              </span>

              <button
                type="button"
                className="text-button"
              >
                View →
              </button>

            </div>

          ))

        )}


        {/* PROJECTS */}

        {kind === 'projects' && (

          <div className="empty">

            <h3>
              Project workspaces
            </h3>

            <p>
              Each active order can have an internal
              workspace, assigned expert, milestones
              and review notes.
            </p>

            <Link
              className="btn dark"
              to="/admin/workspace"
            >
              Open team workspace →
            </Link>

          </div>

        )}


        {/* PAYMENTS */}

        {kind === 'payments' && (

          <div className="empty">

            <h3>
              Payment ledger
            </h3>

            <p>
              Connect your chosen payment provider
              to populate live transactions here.
            </p>

          </div>

        )}


        {/* MESSAGES */}

        {kind === 'messages' && (

          <div className="empty">

            <h3>
              Team inbox
            </h3>

            <p>
              Customer conversations from all active
              projects appear here.
            </p>

          </div>

        )}


        {/* FILES */}

        {kind === 'files' && (

          <div className="empty">

            <h3>
              Client files
            </h3>

            <p>
              Files are organized by customer and order,
              with secure storage in production.
            </p>

          </div>

        )}

      </div>

    </DashboardShell>
  );
}


/* =========================================================
   ADMIN PAGES
   ========================================================= */

export function AdminUsers() {
  return (
    <AdminList
      title="Users"
      kind="users"
    />
  );
}


export function AdminOrders() {
  return (
    <AdminList
      title="Orders & queue"
      kind="orders"
    />
  );
}


export function AdminProjects() {
  return (
    <AdminList
      title="Projects"
      kind="projects"
    />
  );
}


export function AdminPayments() {
  return (
    <AdminList
      title="Payments"
      kind="payments"
    />
  );
}


export function AdminMessages() {
  return (
    <AdminList
      title="Messages"
      kind="messages"
    />
  );
}


export function AdminFiles() {
  return (
    <AdminList
      title="Files"
      kind="files"
    />
  );
}


/* =========================================================
   SIMPLE ADMIN MODULE
   ========================================================= */

export function AdminSimple({
  title
}) {

  return (
    <DashboardShell admin>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            ADMIN
          </p>

          <h1>
            {title}
          </h1>

        </div>

      </div>


      <div className="panel">

        <div className="empty">

          <h3>
            {title}
          </h3>

          <p>
            This module is wired into the admin
            navigation and ready for your production
            database.
          </p>

        </div>

      </div>

    </DashboardShell>
  );
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function AdminLogin() {

  const navigate = useNavigate();

  const [
    email,
    setEmail
  ] = useState('');

  const [
    password,
    setPassword
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    error,
    setError
  ] = useState('');

  const [
    showPassword,
    setShowPassword
  ] = useState(false);


  async function handleLogin(e) {

    e.preventDefault();

    setError('');

    if (!email.trim() || !password) {
      setError(
        'Please enter your email and password.'
      );
      return;
    }


    if (!supabase) {
      setError(
        'Supabase is not configured.'
      );
      return;
    }


    setLoading(true);


    try {

      /* ---------------------------------------------
         STEP 1 — SUPABASE AUTH
      --------------------------------------------- */

      const {
        data,
        error: loginError
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });


      if (loginError) {
        throw loginError;
      }


      const user = data?.user;


      if (!user) {
        throw new Error(
          'Unable to sign in.'
        );
      }


      /* ---------------------------------------------
         STEP 2 — CHECK STAFF ROLE
      --------------------------------------------- */

      const {
        data: roleRow,
        error: roleError
      } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();


      if (roleError) {
        throw roleError;
      }


      const role =
        roleRow?.role;


      /* ---------------------------------------------
         NOT STAFF
      --------------------------------------------- */

      if (!STAFF_ROLES.includes(role)) {

        await supabase.auth.signOut();

        setError(
          'This account does not have admin access.'
        );

        return;
      }


      /* ---------------------------------------------
         SUCCESS
      --------------------------------------------- */

      navigate(
        '/admin/workspace',
        { replace: true }
      );

    } catch (err) {

      console.error(
        'Admin login error:',
        err
      );

      setError(
        err?.message ||
        'Unable to sign in. Please check your credentials.'
      );

    } finally {

      setLoading(false);

    }
  }


  return (

    <div className="auth">

      <div className="auth-card">

        <Logo />


        <div
          style={{
            marginTop: 32
          }}
        >

          <p className="eyebrow">
            STAFF ACCESS
          </p>

          <h1>
            Welcome back.
          </h1>

          <p className="muted">
            Sign in to access the Careerlyst
            operations workspace.
          </p>

        </div>


        <form
          onSubmit={handleLogin}
          style={{
            marginTop: 28
          }}
        >


          {/* EMAIL */}

          <label
            style={{
              display: 'block',
              marginBottom: 18
            }}
          >

            <span
              style={{
                display: 'block',
                marginBottom: 7,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Work email
            </span>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@careerlyst.com"
              autoComplete="email"
              disabled={loading}
              style={{
                width: '100%'
              }}
            />

          </label>


          {/* PASSWORD */}

          <label
            style={{
              display: 'block',
              marginBottom: 18
            }}
          >

            <span
              style={{
                display: 'block',
                marginBottom: 7,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Password
            </span>


            <div
              style={{
                position: 'relative'
              }}
            >

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%',
                  paddingRight: 72
                }}
              />


              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {showPassword
                  ? 'Hide'
                  : 'Show'}
              </button>

            </div>

          </label>


          {/* ERROR */}

          {error && (

            <div
              style={{
                marginBottom: 18,
                padding: '12px 14px',
                border: '1px solid rgba(180, 40, 40, .25)',
                background: 'rgba(180, 40, 40, .06)',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.5
              }}
            >
              {error}
            </div>

          )}


          {/* SUBMIT */}

          <button
            type="submit"
            className="btn dark full"
            disabled={loading}
          >

            {loading
              ? 'Signing in...'
              : 'Sign in to workspace →'}

          </button>


        </form>


        <p
          className="muted"
          style={{
            marginTop: 20,
            fontSize: 12,
            lineHeight: 1.6
          }}
        >
          Staff accounts are managed through
          Careerlyst's secure authentication system.
        </p>

      </div>

    </div>

  );
}


/* =========================================================
   ADMIN GATE
   ========================================================= */

export function AdminGate() {

  const [
    checking,
    setChecking
  ] = useState(true);

  const [
    authorized,
    setAuthorized
  ] = useState(false);


  useEffect(() => {

    let mounted = true;


    async function checkAdmin() {

      /* ---------------------------------------------
         NO SUPABASE
      --------------------------------------------- */

      if (!supabase) {

        if (mounted) {
          setChecking(false);
          setAuthorized(false);
        }

        return;
      }


      try {

        /* -------------------------------------------
           CHECK AUTH SESSION
        ------------------------------------------- */

        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();


        if (!session?.user) {

          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }


        /* -------------------------------------------
           CHECK ROLE
        ------------------------------------------- */

        const {
          data: roleRow,
          error
        } = await supabase
          .from('user_roles')
          .select('role')
          .eq(
            'user_id',
            session.user.id
          )
          .maybeSingle();


        if (error) {
          throw error;
        }


        const role =
          roleRow?.role;


        if (mounted) {

          setAuthorized(
            STAFF_ROLES.includes(role)
          );

          setChecking(false);

        }

      } catch (err) {

        console.error(
          'Admin authorization error:',
          err
        );

        if (mounted) {

          setAuthorized(false);
          setChecking(false);

        }

      }

    }


    checkAdmin();


    return () => {
      mounted = false;
    };

  }, []);


  /* -----------------------------------------------
     LOADING
  ------------------------------------------------ */

  if (checking) {

    return (

      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f5f4ee',
          color: '#11120f',
          fontFamily:
            'DM Sans, sans-serif'
        }}
      >

        Checking staff access...

      </div>

    );

  }


  /* -----------------------------------------------
     NOT AUTHORIZED
  ------------------------------------------------ */

  if (!authorized) {
    return <AdminLogin />;
  }


  /* -----------------------------------------------
     AUTHORIZED
  ------------------------------------------------ */

  return (
    <AdminOverview />
  );

}


/* =========================================================
   LOGO
   ========================================================= */

function Logo() {

  return (

    <a
      className="logo"
      href="/"
    >

      <span className="logo-mark">

        <i />
        <i />
        <i />

      </span>

      <span>
        Careerlyst
      </span>

    </a>

  );
}


/* =========================================================
   PHASE 1H — TEAM WORKSPACE
   ========================================================= */


export {
  default as AdminWorkspace
} from './AdminWorkspace';
