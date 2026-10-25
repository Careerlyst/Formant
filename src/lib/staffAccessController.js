/**
 * Creates a fail-closed staff authorization lifecycle around the trusted
 * database role checker. It never accepts cached roles or user metadata.
 */
export function createStaffAccessController(client, timers = globalThis) {
  let access = { status: 'checking', session: null, error: '' };
  let active = false;
  let requestVersion = 0;
  let authSubscription;
  let authCheckTimer;
  const listeners = new Set();

  const publish = (nextAccess) => {
    access = nextAccess;
    listeners.forEach((listener) => listener(access));
  };

  const verifySession = async (session) => {
    const version = ++requestVersion;
    if (!active) return;

    publish({ status: 'checking', session: session || null, error: '' });

    if (!client) {
      publish({ status: 'unavailable', session: null, error: 'Staff access verification is unavailable.' });
      return;
    }

    if (!session?.user?.id) {
      publish({ status: 'unauthenticated', session: null, error: '' });
      return;
    }

    try {
      const { data, error } = await client.rpc('is_showcase_staff_v1');
      if (!active || version !== requestVersion) return;
      if (error) throw error;

      publish({ status: data === true ? 'allowed' : 'denied', session, error: '' });
    } catch (error) {
      if (!active || version !== requestVersion) return;
      console.error('Staff authorization check failed:', error);
      publish({
        status: 'error',
        session,
        error: 'Staff access could not be verified. Try again or return to your dashboard.'
      });
    }
  };

  const verifyCurrentSession = async () => {
    const version = ++requestVersion;
    publish({ status: 'checking', session: null, error: '' });

    if (!client) {
      publish({ status: 'unavailable', session: null, error: 'Staff access verification is unavailable.' });
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (!active || version !== requestVersion) return;
      if (error) throw error;
      await verifySession(data?.session || null);
    } catch (error) {
      if (!active || version !== requestVersion) return;
      console.error('Staff session check failed:', error);
      publish({
        status: 'error',
        session: null,
        error: 'Your sign-in could not be verified. Try again or sign in again.'
      });
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(access);
      return () => listeners.delete(listener);
    },
    start() {
      if (active) return;
      active = true;

      if (client) {
        const { data } = client.auth.onAuthStateChange((event, session) => {
          if (!active || event === 'INITIAL_SESSION') return;
          requestVersion += 1;
          timers.clearTimeout(authCheckTimer);
          // Clear the prior decision before scheduling the role lookup.
          publish({ status: 'checking', session: session || null, error: '' });
          authCheckTimer = timers.setTimeout(() => {
            if (active) void verifySession(session || null);
          }, 0);
        });
        authSubscription = data?.subscription;
      }

      void verifyCurrentSession();
    },
    retry: verifyCurrentSession,
    stop() {
      active = false;
      requestVersion += 1;
      timers.clearTimeout(authCheckTimer);
      authSubscription?.unsubscribe();
      authSubscription = null;
    }
  };
}
