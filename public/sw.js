/* Formant Service Worker for Web Push Notifications */

self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all active clients immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'Formant Update',
        body: event.data.text()
      };
    }
  }

  const title = payload.title || 'Formant';
  const body = payload.body || '';
  const icon = payload.icon || '/assets/formant-symbol-192.png';
  const badge = payload.badge || '/assets/formant-symbol-192.png';
  const tag = payload.tag || `formant-push-${Date.now()}`;
  const targetUrl = payload.url || payload.action_url || payload.link || '/dashboard';

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    data: {
      url: targetUrl,
      timestamp: Date.now()
    }
  };

  const showNotificationPromise = self.registration.showNotification(title, options);

  // Broadcast to open clients (foreground tabs) so they can update notifications live
  const broadcastPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload
        });
      }
    })
    .catch(() => {});

  event.waitUntil(Promise.all([showNotificationPromise, broadcastPromise]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetDataUrl = event.notification.data?.url || '/dashboard';

  // Sanitize destination to ensure it is local or relative to avoid unsafe open redirects
  let destination = '/dashboard';
  try {
    const parsed = new URL(targetDataUrl, self.location.origin);
    if (parsed.origin === self.location.origin) {
      destination = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    destination = '/dashboard';
  }

  const fullUrl = new URL(destination, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open with Formant, navigate and focus it
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          if ('navigate' in client) {
            return client.navigate(fullUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});
