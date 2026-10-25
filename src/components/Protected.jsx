import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { activateUser, load } from '../lib/store';
import { getProfileAvatar, requiresProfileAvatar } from '../lib/profileAvatars';
import SkeletonState from './SkeletonState';

export default function Protected({ children, requireAvatar = true }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [avatarRequired, setAvatarRequired] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    let authResolved = false;
    let latestUserId = null;

    async function syncDashboardStore(nextSession) {
      if (!nextSession?.user) {
        if (mounted) setAvatarRequired(false);
        return;
      }

      const user = nextSession.user;
      const fallbackName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Client';
      let profile = null;
      if (supabase) {
        const { data, error } = await supabase.from('profiles')
          .select('id, name, email, phone, location, target_role, experience, education, skills, certifications, linkedin, github, portfolio, bio, preferences, avatar_id')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          if (mounted && latestUserId === user.id) setProfileError('Your profile could not be verified. Retry before continuing.');
          throw error;
        }
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
      let verifiedStaff = false;
      if (!getProfileAvatar(profile?.avatar_id)) {
        const { data: staffResult, error: staffError } = await supabase.rpc('is_showcase_staff_v1');
        if (staffError) {
          if (mounted && latestUserId === user.id) setProfileError('Your account role could not be verified. Retry before continuing.');
          throw staffError;
        }
        verifiedStaff = staffResult === true;
      }
      setAvatarRequired(requiresProfileAvatar(profile?.avatar_id, verifiedStaff));
      setProfileError('');
    }

    if (supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted || !authResolved) return;
        const nextUserId = nextSession?.user?.id || null;
        const identityChanged = nextUserId !== latestUserId;
        latestUserId = nextUserId;
        setSession(nextSession);
        setProfileError('');
        if (!nextSession?.user) {
          setAvatarRequired(false);
          setLoading(false);
          return;
        }
        if (identityChanged) setLoading(true);
        void syncDashboardStore(nextSession).catch(() => {}).finally(() => {
          if (mounted && latestUserId === nextUserId) setLoading(false);
        });
      });

      supabase.auth.getSession().then(async ({ data, error }) => {
        if (!mounted) return;
        authResolved = true;
        const nextSession = data?.session || null;
        latestUserId = nextSession?.user?.id || null;
        setSession(nextSession);
        setProfileError('');
        if (!nextSession?.user) setAvatarRequired(false);
        try {
          await syncDashboardStore(nextSession);
        } catch {
          // Keep protected content blocked; the retry panel below is actionable.
        }
        if (!mounted || latestUserId !== (nextSession?.user?.id || null)) return;
        if (error) setProfileError('Your sign-in could not be verified. Retry before continuing.');
        setLoading(false);
      }).catch(() => {
        if (!mounted) return;
        authResolved = true;
        setSession(null);
        setLoading(false);
      });

      return () => {
        mounted = false;
        listener?.subscription?.unsubscribe();
      };
    }

    const current = load();
    if (!mounted) return undefined;
    setSession(current.user ? { user: current.user } : null);
    setAvatarRequired(Boolean(current.user && requiresProfileAvatar(current.profile?.avatar_id)));
    setProfileError('');
    setLoading(false);
    return () => { mounted = false; };
  }, [attempt]);

  if (loading) {
    return <main className="protected-loading" aria-busy="true"><SkeletonState label="Checking your account" variant="profile" /></main>;
  }

  if (!session) return <Navigate to="/login" replace />;

  if (profileError) {
    return (
      <main className="protected-loading" role="alert">
        <section className="protected-access-message">
          <h1>We could not verify your profile</h1>
          <p>{profileError}</p>
          <button type="button" className="btn dark" onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Retry</button>
        </section>
      </main>
    );
  }

  if (requireAvatar && avatarRequired) {
    return <Navigate to="/onboarding/avatar" replace state={{ from: location }} />;
  }

  return <React.Fragment key={session.user?.id || session.user?.email || 'protected-session'}>{children}</React.Fragment>;
}
