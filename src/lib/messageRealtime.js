import { supabase } from './supabase';

// Share one client-message channel between the dashboard shell badge and the
// active Messages page. Listeners are removed independently on route changes.
const clientMessageChannels = new Map();

export function subscribeToClientMessages(userId, listener) {
  if (!supabase || !userId || typeof listener !== 'function') return () => {};
  const key = String(userId);
  let entry = clientMessageChannels.get(key);
  if (!entry) {
    const listeners = new Set();
    entry = { channel: null, listeners, status: null };
    const channel = supabase
      .channel(`shared-client-messages-${key}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        listeners.forEach((callback) => callback.onMessage?.(payload));
      })
      .subscribe((status) => {
        entry.status = status;
        listeners.forEach((callback) => callback.onStatus?.(status));
      });
    entry.channel = channel;
    clientMessageChannels.set(key, entry);
  }
  entry.listeners.add(listener);
  if (entry.status) listener.onStatus?.(entry.status);
  return () => {
    const current = clientMessageChannels.get(key);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      clientMessageChannels.delete(key);
      void supabase.removeChannel(current.channel);
    }
  };
}
