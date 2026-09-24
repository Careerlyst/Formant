import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

import './notification-bell.css';

/* =========================================================
   HELPERS
========================================================= */

function formatRelativeTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function getNotificationIcon(type) {
  switch (type) {
    case 'message':
      return 'message';

    case 'order':
      return 'orders';

    case 'payment':
      return 'payment';

    case 'review':
      return 'star';

    case 'project':
      return 'project';

    case 'file':
      return 'file';

    default:
      return 'bell';
  }
}

/* =========================================================
   ICON
========================================================= */

function NotificationIcon({ type }) {
  const name = getNotificationIcon(type);

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

  switch (name) {
    case 'message':
      return (
        <svg {...common}>
          <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.4-.7L4 20l1.7-4A7.1 7.1 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z" />
        </svg>
      );

    case 'orders':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      );

    case 'payment':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18M7 15h4" />
        </svg>
      );

    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );

    case 'project':
      return (
        <svg {...common}>
          <path d="M3 6h7l2 2h9v10H3z" />
        </svg>
      );

    case 'file':
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h4M10 13h5M10 17h5" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
          <path d="M10 21h4" />
        </svg>
      );
  }
}

/* =========================================================
   BELL ICON
========================================================= */

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" />
      <path d="M10 21h4" />
    </svg>
  );
}

/* =========================================================
   NOTIFICATION BELL
========================================================= */

export default function NotificationBell() {
  const navigate = useNavigate();

  const wrapperRef = useRef(null);
  const channelRef = useRef(null);

  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  /* =======================================================
     LOAD CURRENT USER
  ======================================================= */

  useEffect(() => {
    let mounted = true;

    async function getCurrentUser() {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !user) {
        setUserId(null);
        setLoading(false);
        return;
      }

      setUserId(user.id);
    }

    getCurrentUser();

    return () => {
      mounted = false;
    };
  }, []);

  /* =======================================================
     LOAD NOTIFICATIONS
  ======================================================= */

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        user_id,
        order_id,
        type,
        title,
        body,
        read_at,
        metadata,
        created_at,
        is_read,
        link
      `)
      .eq('user_id', userId)
      .order('created_at', {
        ascending: false
      })
      .limit(30);

    if (error) {
      console.error(
        'Failed to load notifications:',
        error
      );

      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const notification = payload.new;

          setNotifications((current) => {
            const exists = current.some(
              (item) => item.id === notification.id
            );

            if (exists) {
              return current;
            }

            return [
              notification,
              ...current
            ].slice(0, 30);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications((current) =>
            current.map((item) =>
              item.id === payload.new.id
                ? payload.new
                : item
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          setNotifications((current) =>
            current.filter(
              (item) => item.id !== payload.old.id
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  /* =======================================================
     CLOSE WHEN CLICKING OUTSIDE
  ======================================================= */

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      );
    };
  }, []);

  /* =======================================================
     ESCAPE
  ======================================================= */

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, []);

  /* =======================================================
     UNREAD COUNT
  ======================================================= */

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !notification.is_read
      ).length,
    [notifications]
  );

  /* =======================================================
     MARK ONE READ
  ======================================================= */

  async function markAsRead(notification) {
    if (!notification || notification.is_read) {
      return;
    }

    setBusyId(notification.id);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('id', notification.id)
      .eq('user_id', userId);

    if (error) {
      console.error(
        'Failed to mark notification as read:',
        error
      );

      setBusyId(null);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              is_read: true,
              read_at: now
            }
          : item
      )
    );

    setBusyId(null);
  }

  /* =======================================================
     MARK ALL READ
  ======================================================= */

  async function markAllAsRead() {
    if (!userId || unreadCount === 0) {
      return;
    }

    setBusyId('all');

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: now
      })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error(
        'Failed to mark all notifications as read:',
        error
      );

      setBusyId(null);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || now
      }))
    );

    setBusyId(null);
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function deleteNotification(notification) {
    if (!notification) return;

    setBusyId(notification.id);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notification.id)
      .eq('user_id', userId);

    if (error) {
      console.error(
        'Failed to delete notification:',
        error
      );

      setBusyId(null);
      return;
    }

    setNotifications((current) =>
      current.filter(
        (item) => item.id !== notification.id
      )
    );

    setBusyId(null);
  }

  /* =======================================================
     OPEN NOTIFICATION
  ======================================================= */

  async function handleNotificationClick(
    notification
  ) {
    if (!notification) return;

    await markAsRead(notification);

    setOpen(false);

    if (notification.link) {
      navigate(notification.link);
      return;
    }

    if (notification.type === 'order') {
      navigate('/dashboard/orders');
      return;
    }

    if (notification.type === 'message') {
      navigate('/dashboard/messages');
      return;
    }

    if (notification.type === 'payment') {
      navigate('/dashboard/payments');
      return;
    }

    if (notification.type === 'file') {
      navigate('/dashboard/files');
      return;
    }

    if (notification.type === 'review') {
      navigate('/dashboard');
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      className="notification-bell-wrap"
      ref={wrapperRef}
    >
      <button
        type="button"
        className={`notification-bell-button ${
          open ? 'is-open' : ''
        }`}
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon />

        {unreadCount > 0 && (
          <span className="notification-bell-count">
            {unreadCount > 99
              ? '99+'
              : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">

          {/* HEADER */}

          <div className="notification-panel-header">

            <div>
              <h3>Notifications</h3>

              <span>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'All caught up'}
              </span>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-mark-all"
                onClick={markAllAsRead}
                disabled={busyId === 'all'}
              >
                {busyId === 'all'
                  ? 'Updating...'
                  : 'Mark all read'}
              </button>
            )}

          </div>

          {/* CONTENT */}

          <div className="notification-panel-list">

            {loading ? (
              <div className="notification-loading">
                <span className="notification-spinner" />
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">

                <div className="notification-empty-icon">
                  <BellIcon />
                </div>

                <strong>
                  No notifications
                </strong>

                <span>
                  You're all caught up.
                </span>

              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${
                    notification.is_read
                      ? 'is-read'
                      : 'is-unread'
                  }`}
                >

                  <button
                    type="button"
                    className="notification-item-main"
                    onClick={() =>
                      handleNotificationClick(
                        notification
                      )
                    }
                  >

                    <span
                      className={`notification-item-icon notification-type-${notification.type}`}
                    >
                      <NotificationIcon
                        type={notification.type}
                      />
                    </span>

                    <span className="notification-item-copy">

                      <strong>
                        {notification.title}
                      </strong>

                      <span className="notification-item-body">
                        {notification.body}
                      </span>

                      <span className="notification-item-time">
                        {formatRelativeTime(
                          notification.created_at
                        )}
                      </span>

                    </span>

                    {!notification.is_read && (
                      <span className="notification-unread-dot" />
                    )}

                  </button>

                  <button
                    type="button"
                    className="notification-delete"
                    aria-label="Delete notification"
                    title="Delete notification"
                    disabled={
                      busyId === notification.id
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteNotification(
                        notification
                      );
                    }}
                  >
                    ×
                  </button>

                </div>
              ))
            )}

          </div>

          {/* FOOTER */}

          <div className="notification-panel-footer">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/dashboard/notifications');
              }}
            >
              View all notifications
              <span>→</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}