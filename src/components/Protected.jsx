import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { activateUser, load } from '../lib/store';
import SkeletonState from './SkeletonState';

export default function Protected({ children }) {

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {

    let mounted = true;
    let authResolved = false;
    let latestUserId = null;

    async function syncDashboardStore(nextSession) {
      if (!nextSession?.user) return;

      const user = nextSession.user;
      const fallbackName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Client';
      let profile = null;
      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, phone, location, target_role, experience, education, skills, certifications, linkedin, github, portfolio, bio, preferences')
          .eq('id', user.id)
          .maybeSingle();
        if (error) console.error('Profile hydration failed:', error);
        profile = data;
      }
      if (!mounted || latestUserId !== user.id) return;
      const name = profile?.name || fallbackName;
      activateUser(user.id, {
        replaceProfile: true,
        user: {
          id: user.id,
          email: user.email,
          name,
          assessmentCompleted: Boolean(user.user_metadata?.careerlyst_assessment_completed)
        },
        profile: { ...(profile || {}), email: user.email, name }
      });
    }

    /*
      Supabase is the source of truth when configured.
      Keep the route blocked until the initial auth state has
      been resolved. This prevents a transient null session from
      causing an immediate redirect during a page refresh.
    */
    if (supabase) {

      const { data } = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {

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
          const nextUserId = nextSession?.user?.id || null;
          const identityChanged = nextUserId !== latestUserId;
          setSession(nextSession);
          latestUserId = nextUserId;
          if (!nextSession?.user) {
            setLoading(false);
            return;
          }
          if (identityChanged) setLoading(true);
          void syncDashboardStore(nextSession).finally(() => {
            if (mounted && latestUserId === nextUserId) setLoading(false);
          });
        }
      );

      /*
        Also explicitly ask Supabase for the current session. This
        covers the case where the persisted session is available before
        the auth listener finishes initializing.
      */
      supabase.auth.getSession()
        .then(async ({ data: sessionData, error }) => {
          if (!mounted) return;

          if (error) {
            console.error('Auth session check failed:', error);
          }

          const nextSession = sessionData?.session || null;

          /*
            Prefer the concrete getSession result for the initial route
            decision. A null result is only accepted once this check has
            completed; the app never redirects while it is still pending.
          */
          authResolved = true;
          latestUserId = nextSession?.user?.id || null;
          setSession(nextSession);
          await syncDashboardStore(nextSession);
          if (!mounted || latestUserId !== (nextSession?.user?.id || null)) return;
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
        // Safe unsubscribe check
        if (data?.subscription) {
          data.subscription.unsubscribe();
        }
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
      <main className="protected-loading" aria-busy="true">
        <SkeletonState label="Checking your account" variant="profile" />
      </main>
    );
  }


  if (!session) {
    return <Navigate to="/login" replace />;
  }


  // Remount protected page state when the authenticated identity changes so
  // an open conversation or draft from the previous user cannot carry over.
  return (
    <React.Fragment key={session?.user?.id || session?.user?.email || 'protected-session'}>
      {children}
    </React.Fragment>
  );
}
