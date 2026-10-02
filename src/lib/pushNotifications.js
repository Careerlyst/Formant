import { supabase } from './supabase';

/**
 * Converts a URL-safe Base64 string to a Uint8Array for PushManager subscription.
 */
export function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== 'string') return new Uint8Array();
  const cleaned = base64String.trim();
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4);
  const base64 = (cleaned + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Converts an ArrayBuffer to a standard Base64 string.
 */
function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Checks whether the browser supports Service Workers, PushManager, and Notifications.
 */
export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets the current Notification permission state.
 * Returns 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registers the Formant service worker.
 */
export async function registerServiceWorker() {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported in this browser environment.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/'
  });

  return registration;
}

/**
 * Retrieves the current push subscription from the service worker registration, if any.
 * Uses getRegistration('/') to avoid hanging if the worker is not yet registered.
 */
export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return null;
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (err) {
    console.warn('Unable to get existing push subscription:', err);
    return null;
  }
}

/**
 * Returns a high-level status object for the client UI.
 */
export async function getPushStatus(userId) {
  const supported = isPushSupported();
  if (!supported) {
    return {
      supported: false,
      permission: 'unsupported',
      isSubscribed: false,
      hasVapidKey: Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)
    };
  }

  const permission = Notification.permission;
  const subscription = await getCurrentSubscription();
  const isSubscribed = Boolean(subscription);

  return {
    supported: true,
    permission,
    isSubscribed,
    subscription,
    hasVapidKey: Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY)
  };
}

/**
 * Subscribes the current browser to push notifications and saves the subscription to Supabase.
 * Must only be invoked in response to a direct user action (e.g. clicking a button).
 */
export async function subscribeUserToPush(userId) {
  if (!isPushSupported()) {
    return {
      success: false,
      error: 'Push notifications are not supported by this browser.'
    };
  }

  if (!userId) {
    return {
      success: false,
      error: 'User must be authenticated to enable push notifications.'
    };
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return {
      success: false,
      error: 'VAPID public key (VITE_VAPID_PUBLIC_KEY) is not configured.'
    };
  }

  try {
    // 1. Request permission if not already granted
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return {
        success: false,
        error:
          permission === 'denied'
            ? 'Notification permission was blocked in browser settings. Please enable notifications for Formant in your browser site permissions.'
            : 'Notification permission was dismissed.'
      };
    }

    // 2. Ensure Service Worker is registered and ready
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;

    // 3. Subscribe or refresh existing subscription
    let subscription = await registration.pushManager.getSubscription();
    const convertedKey = urlBase64ToUint8Array(vapidPublicKey);

    if (subscription) {
      // Verify keys can be extracted; if corrupted, unsubscribe and renew
      const p256dhBuffer = subscription.getKey('p256dh');
      const authBuffer = subscription.getKey('auth');
      if (!p256dhBuffer || !authBuffer) {
        try {
          await subscription.unsubscribe();
        } catch {
          // ignore
        }
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey
      });
    }

    const p256dhBuffer = subscription.getKey('p256dh');
    const authBuffer = subscription.getKey('auth');

    const p256dh = arrayBufferToBase64(p256dhBuffer);
    const auth = arrayBufferToBase64(authBuffer);

    if (!p256dh || !auth) {
      return {
        success: false,
        error: 'Failed to extract push encryption keys from browser.'
      };
    }

    // 4. Save to Supabase push_subscriptions table
    if (supabase) {
      const { error: dbError } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          invalidated_at: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'endpoint' }
      );

      if (dbError) {
        console.error('Failed to persist push subscription to Supabase:', dbError);
        return {
          success: false,
          error: `Failed to save subscription: ${dbError.message}`
        };
      }
    }

    return {
      success: true,
      subscription
    };
  } catch (err) {
    console.error('Push notification subscription error:', err);
    return {
      success: false,
      error: err.message || 'An unexpected error occurred while subscribing.'
    };
  }
}

/**
 * Unsubscribes the current browser from push notifications and removes the record from Supabase.
 */
export async function unsubscribeUserFromPush(userId) {
  if (!isPushSupported()) {
    return { success: true };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      return { success: true };
    }

    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      if (supabase && endpoint) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to unsubscribe from push notifications:', err);
    return {
      success: false,
      error: err.message || 'Failed to unsubscribe.'
    };
  }
}
