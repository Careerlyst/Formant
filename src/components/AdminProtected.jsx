import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { load } from '../lib/store';
import SkeletonState from './SkeletonState';
import { STAFF_ROLES, isStaffRole } from '../lib/roles';

export { STAFF_ROLES, isStaffRole };

export default function AdminProtected({ children }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function checkStaffAuth() {
      // 1. Supabase environment
      if (supabase) {
        try {
          const { data: { session: currentSession }, error: sessionError } =
            await supabase.auth.getSession();

          if (sessionError || !currentSession?.user) {
            if (mounted) {
              setSession(null);
              setAuthorized(false);
              setLoading(false);
            }
            return;
          }

          if (mounted) {
            setSession(currentSession);
          }

          // Query role from user_roles
          const { data: roleRow, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', currentSession.user.id)
            .maybeSingle();

          if (roleError) {
            console.error('Staff authorization check failed:', roleError);
            if (mounted) {
              setAuthorized(false);
              setLoading(false);
            }
            return;
          }

          const userRole = String(roleRow?.role || '').toLowerCase();
          const isStaff = STAFF_ROLES.includes(userRole);

          if (mounted) {
            setAuthorized(isStaff);
            setLoading(false);
          }
        } catch (err) {
          console.error('Admin authorization unexpected error:', err);
          if (mounted) {
            setAuthorized(false);
            setLoading(false);
          }
        }
        return;
      }

      // 2. Demo / local store mode fallback
      const current = load();
      if (!mounted) return;

      const user = current.user;
      if (!user) {
        setSession(null);
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setSession({ user });
      const role = String(user.role || '').toLowerCase();
      setAuthorized(STAFF_ROLES.includes(role));
      setLoading(false);
    }

    checkStaffAuth();

    let authSubscription = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return;
        if (!nextSession?.user) {
          setSession(null);
          setAuthorized(false);
          setLoading(false);
          return;
        }
        checkStaffAuth();
      });
      authSubscription = data?.subscription;
    }

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  if (loading) {
    return (
      <main className="protected-loading" aria-busy="true">
        <SkeletonState label="Verifying staff authorization" variant="profile" />
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!authorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <React.Fragment key={session?.user?.id || 'admin-protected'}>
      {children}
    </React.Fragment>
  );
}
