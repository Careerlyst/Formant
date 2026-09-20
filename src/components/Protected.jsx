import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { load, patch } from '../lib/store';

export default function Protected({ children }) {

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {

    let mounted = true;
    let authResolved = false;

    function syncDashboardStore(nextSession) {
      if (!nextSession?.user) return;

      const user = nextSession.user;
      const name =
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Client';

      patch((current) => ({
        ...current,
        user: {
          email: user.email,
          name
        },
        profile: {
          ...(current.profile || {}),
          email: user.email,
          name
        }
      }));
    }

    /*
      Supabase is the source of truth when configured.
      Keep the route blocked until the initial auth state has
      been resolved. This prevents a transient null session from
      causing an immediate redirect during a page refresh.
    */
    if (supabase) {

      const {
        data: {
          subscription
        }
      } = supabase.auth.onAuthStateChange(
        (event, nextSession) => {

          if (!mounted) return;

          /*
            INITIAL_SESSION is Supabase's first answer about the
            persisted browser session. Do not redirect before it.
          */
          if (!authResolved) {
            /*
              During startup, wait for getSession() to finish. The
              INITIAL_SESSION event can briefly report null while the
              persisted browser session is still being resolved.
            */
            return;
          }

          /*
            After the initial check, normal auth changes are trusted.
            SIGNED_IN / TOKEN_REFRESHED keep the existing user in place;
            SIGNED_OUT clears the session and allows the login redirect.
          */
          setSession(nextSession);
          syncDashboardStore(nextSession);
        }
      );

      /*
        Also explicitly ask Supabase for the current session. This
        covers the case where the persisted session is available before
        the auth listener finishes initializing.
      */
      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (!mounted) return;

          if (error) {
            console.error('Auth session check failed:', error);
          }

          const nextSession = data?.session || null;

          /*
            Prefer the concrete getSession result for the initial route
            decision. A null result is only accepted once this check has
            completed; the app never redirects while it is still pending.
          */
          authResolved = true;
          setSession(nextSession);
          syncDashboardStore(nextSession);
          setLoading(false);
        })
        .catch((error) => {
          if (!mounted) return;

          console.error('Auth session initialization failed:', error);
          authResolved = true;
          setSession(null);
          setLoading(false);
        });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    /*
      Demo/local fallback.
    */
    const current = load();

    if (!mounted) return undefined;

    setSession(
      current.user
        ? { user: current.user }
        : null
    );
    setLoading(false);

    return () => {
      mounted = false;
    };

  }, []);


  /*
    Never redirect until the initial authentication check has finished.
  */
  if (loading) {

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f5f4ee',
          color: '#11120f',
          fontFamily: 'DM Sans, sans-serif'
        }}
      >
        Checking your account...
      </div>
    );
  }


  if (!session) {
    return <Navigate to="/login" replace />;
  }


  return children;
}
