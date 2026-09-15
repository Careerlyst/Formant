import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { load, patch } from '../lib/store';

export default function Protected({ children }) {

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {

    let mounted = true;

    async function checkSession() {

      /*
        If Supabase is configured,
        Supabase becomes the source of truth.
      */

      if (supabase) {

        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(session);

        /*
          Keep the existing dashboard store
          temporarily synchronized.
        */

        if (session?.user) {

          const user =
            session.user;

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

        setLoading(false);

        return;
      }


      /*
        Demo fallback
      */

      const current = load();

      if (!mounted) return;

      setSession(
        current.user
          ? { user: current.user }
          : null
      );

      setLoading(false);
    }


    checkSession();


    /*
      Listen for login/logout/session changes.
    */

    if (supabase) {

      const {
        data: {
          subscription
        }
      } = supabase.auth.onAuthStateChange(
        (_event, newSession) => {

          if (!mounted) return;

          setSession(newSession);

        }
      );


      return () => {

        mounted = false;

        subscription.unsubscribe();

      };
    }


    return () => {
      mounted = false;
    };

  }, []);


  /*
    Don't render protected content
    while authentication is being checked.
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


  /*
    Not authenticated
    → go to login.
  */

  if (!session) {
    return <Navigate to="/login" replace />;
  }


  return children;
}