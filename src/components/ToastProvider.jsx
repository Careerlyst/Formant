import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import './toast.css';

const ToastContext = createContext(null);
const TOAST_TYPES = new Set(['success', 'error', 'warning', 'info']);
const TOAST_TITLES = {
  success: 'Success',
  error: 'Something went wrong',
  warning: 'Needs attention',
  info: 'Information'
};

function ToastIcon({ type }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };

  if (type === 'success') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16.5 9" /></svg>;
  if (type === 'error') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></svg>;
  if (type === 'warning') return <svg {...common}><path d="M10.3 4.4 2.9 17.2A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.8L13.7 4.4a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastsRef = useRef([]);
  const timersRef = useRef(new Map());
  const nextIdRef = useRef(0);
  const mountedRef = useRef(false);

  const syncToasts = useCallback(() => {
    if (mountedRef.current) setToasts([...toastsRef.current]);
  }, []);

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
    toastsRef.current = toastsRef.current.filter((toast) => toast.id !== id);
    syncToasts();
  }, [syncToasts]);

  const scheduleDismiss = useCallback((id, duration) => {
    const priorTimer = timersRef.current.get(id);
    if (priorTimer) window.clearTimeout(priorTimer);
    timersRef.current.delete(id);
    if (duration > 0) {
      const timer = window.setTimeout(() => dismissToast(id), duration);
      timersRef.current.set(id, timer);
    }
  }, [dismissToast]);

  const showToast = useCallback((message, options = {}) => {
    const text = String(message || '').trim();
    if (!text) return;

    const type = TOAST_TYPES.has(options.type) ? options.type : 'info';
    const title = String(options.title || TOAST_TITLES[type]);
    const action = options.action && typeof options.action.onClick === 'function'
      ? { label: String(options.action.label || 'Open'), onClick: options.action.onClick }
      : null;
    const placement = options.placement === 'bottom-right' ? 'bottom-right' : 'top-right';
    const duration = Number.isFinite(options.duration)
      ? Math.max(0, options.duration)
      : (type === 'error' ? 9000 : 5000);
    const duplicate = toastsRef.current.find((toast) => toast.type === type && toast.message === text && toast.placement === placement);

    if (duplicate) {
      toastsRef.current = toastsRef.current.map((toast) => toast.id === duplicate.id ? { ...toast, title, action } : toast);
      scheduleDismiss(duplicate.id, duration);
      syncToasts();
      return duplicate.id;
    }

    const toast = { id: `formant-toast-${nextIdRef.current++}`, type, title, message: text, action, placement };
    toastsRef.current = [...toastsRef.current, toast];
    while (toastsRef.current.length > 4) {
      const removed = toastsRef.current.shift();
      const timer = timersRef.current.get(removed.id);
      if (timer) window.clearTimeout(timer);
      timersRef.current.delete(removed.id);
    }
    scheduleDismiss(toast.id, duration);
    syncToasts();
    return toast.id;
  }, [scheduleDismiss, syncToasts]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
      toastsRef.current = [];
    };
  }, []);

  function renderToastViewport(placement) {
    const placementToasts = toasts.filter((toast) => toast.placement === placement);
    if (!placementToasts.length) return null;

    return (
      <div
        className={`formant-toast-viewport${placement === 'bottom-right' ? ' is-bottom-right' : ''}`}
        aria-label="Notifications"
      >
        {placementToasts.map((toast) => (
          <div
            key={toast.id}
            className={`formant-toast is-${toast.type}`}
            role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite'}
            aria-atomic="true"
          >
            <span className="formant-toast-icon"><ToastIcon type={toast.type} /></span>
            <span className="formant-toast-copy">
              <strong>{toast.title}</strong>
              <span>{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  className="formant-toast-action"
                  onClick={() => {
                    try {
                      toast.action.onClick();
                    } finally {
                      dismissToast(toast.id);
                    }
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </span>
            <button
              type="button"
              className="formant-toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label={`Dismiss ${toast.title.toLowerCase()} notification`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {renderToastViewport('top-right')}
      {renderToastViewport('bottom-right')}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
