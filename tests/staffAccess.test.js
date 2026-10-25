import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createStaffAccessController } from '../src/lib/staffAccessController.js';
import { STAFF_ROLES } from '../src/lib/roles.js';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  assert.fail(message);
}

function createMockClient(session, rpc) {
  let authListener;
  let unsubscribed = false;
  let currentSession = session;
  return {
    auth: {
      getSession: async () => ({ data: { session: currentSession }, error: null }),
      onAuthStateChange(listener) {
        authListener = listener;
        return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
      }
    },
    rpc: (...args) => rpc(...args, currentSession),
    emitAuth(event, nextSession) {
      currentSession = nextSession;
      authListener?.(event, nextSession);
    },
    get unsubscribed() { return unsubscribed; }
  };
}

function track(controller) {
  let current;
  const unsubscribe = controller.subscribe((next) => { current = next; });
  return { get: () => current, unsubscribe };
}

describe('trusted staff authorization lifecycle', () => {
  it('denies logged-out visitors and normal clients', async () => {
    const loggedOut = createStaffAccessController(createMockClient(null, async () => ({ data: false, error: null })));
    const loggedOutState = track(loggedOut);
    loggedOut.start();
    await waitFor(() => loggedOutState.get().status === 'unauthenticated', 'logged-out access should resolve unauthenticated');
    loggedOut.stop();

    const client = createStaffAccessController(createMockClient({ user: { id: 'client-id' } }, async () => ({ data: false, error: null })));
    const clientState = track(client);
    client.start();
    await waitFor(() => clientState.get().status === 'denied', 'normal client should be denied');
    client.stop();
  });

  it('allows a verified staff session but keeps pending verification inaccessible', async () => {
    let resolveRpc;
    const rpcPromise = new Promise((resolve) => { resolveRpc = resolve; });
    const controller = createStaffAccessController(createMockClient(
      { user: { id: 'staff-id' } },
      () => rpcPromise
    ));
    const state = track(controller);
    controller.start();

    await waitFor(() => state.get().status === 'checking', 'authorization should be pending');
    assert.notEqual(state.get().status, 'allowed');
    resolveRpc({ data: true, error: null });
    await waitFor(() => state.get().status === 'allowed', 'verified staff should be allowed');
    controller.stop();
  });

  it('allows each role recognized by the database checker', async () => {
    for (const role of STAFF_ROLES) {
      const controller = createStaffAccessController(createMockClient(
        { user: { id: `${role}-id`, role } },
        async () => ({ data: true, error: null })
      ));
      const state = track(controller);
      controller.start();
      await waitFor(() => state.get().status === 'allowed', `${role} should be allowed when the trusted checker confirms staff access`);
      controller.stop();
    }
  });

  it('fails closed on RPC errors and retry can recover', async (t) => {
    const originalConsoleError = console.error;
    console.error = () => {};
    t.after(() => { console.error = originalConsoleError; });
    let attempts = 0;
    const controller = createStaffAccessController(createMockClient(
      { user: { id: 'staff-id' } },
      async () => {
        attempts += 1;
        return attempts === 1
          ? { data: null, error: new Error('temporary') }
          : { data: true, error: null };
      }
    ));
    const state = track(controller);
    controller.start();
    await waitFor(() => state.get().status === 'error', 'RPC error should not grant access');
    assert.notEqual(state.get().status, 'allowed');

    await controller.retry();
    await waitFor(() => state.get().status === 'allowed', 'retry should recover after transient failure');
    controller.stop();
  });

  it('clears prior access on sign-out and account changes', async () => {
    const client = createMockClient(
      { user: { id: 'staff-id' } },
      async (_functionName, currentSession) => ({ data: currentSession?.user?.id === 'staff-id', error: null })
    );
    const controller = createStaffAccessController(client);
    const state = track(controller);
    controller.start();
    await waitFor(() => state.get().status === 'allowed', 'staff should initially be allowed');

    client.emitAuth('SIGNED_OUT', null);
    assert.equal(state.get().status, 'checking', 'old access must be cleared synchronously');
    await waitFor(() => state.get().status === 'unauthenticated', 'signed-out user should be unauthenticated');

    client.emitAuth('SIGNED_IN', { user: { id: 'client-id' } });
    assert.equal(state.get().status, 'checking');
    await waitFor(() => state.get().status === 'denied', 'new client account should be denied');
    controller.stop();
    assert.equal(client.unsubscribed, true);
  });

  it('ignores a stale staff RPC response after switching accounts', async () => {
    let resolveStaffRpc;
    let callCount = 0;
    const client = createMockClient(
      { user: { id: 'staff-id' } },
      () => {
        callCount += 1;
        if (callCount === 1) return new Promise((resolve) => { resolveStaffRpc = resolve; });
        return Promise.resolve({ data: false, error: null });
      }
    );
    const controller = createStaffAccessController(client);
    const state = track(controller);
    controller.start();
    await waitFor(() => callCount === 1, 'first role lookup should start');

    client.emitAuth('SIGNED_IN', { user: { id: 'client-id' } });
    await waitFor(() => state.get().status === 'denied', 'new client account should be denied');
    resolveStaffRpc({ data: true, error: null });
    await tick();
    assert.equal(state.get().status, 'denied', 'stale staff result must not grant the new account access');
    assert.equal(state.get().session?.user?.id, 'client-id');
    controller.stop();
  });

  it('does not grant access when Supabase verification is unavailable', async () => {
    const controller = createStaffAccessController(null);
    const state = track(controller);
    controller.start();
    await waitFor(() => state.get().status === 'unavailable', 'missing verifier should fail closed');
    controller.stop();
  });
});
