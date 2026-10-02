import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

import './admin-notifications.css';


const TYPES = [
  { value: 'all', label: 'All' },
  { value: 'message', label: 'Messages' },
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'review', label: 'Reviews' },
  { value: 'project', label: 'Projects' },
  { value: 'file', label: 'Files' },
  { value: 'user', label: 'Users' },
  { value: 'system', label: 'System' }
];

const PRIORITIES = [
  { value: 'all', label: 'All priority' },
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Important' },
  { value: 'urgent', label: 'Urgent' }
];

const SEND_TYPES = TYPES.filter((item) => item.value !== 'all');

function formatRelativeTime(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const diff = Math.max(
    0,
    Date.now() - date.getTime()
  );

  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return 'Just now';

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

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
    day: 'numeric',
    year: 'numeric'
  });
}

function getTypeIcon(type) {
  switch (type) {
    case 'message':
      return '✉';

    case 'order':
      return '▣';

    case 'payment':
      return '৳';

    case 'review':
      return '★';

    case 'project':
      return '◆';

    case 'file':
      return '□';

    case 'user':
      return '♙';

    default:
      return '●';
  }
}

function getTypeLabel(type) {
  return (
    TYPES.find((item) => item.value === type)?.label ||
    'System'
  );
}

function getPriorityLabel(priority) {
  if (priority === 'urgent') return 'Urgent';

  if (priority === 'important') {
    return 'Important';
  }

  return 'Normal';
}


function StatCard({
  label,
  value,
  detail,
  icon
}) {
  return (
    <div className="admin-notification-stat">
      <div className="admin-notification-stat-icon">
        {icon}
      </div>

      <div className="admin-notification-stat-copy">
        <span>{label}</span>

        <strong>{value}</strong>

        {detail && (
          <small>{detail}</small>
        )}
      </div>
    </div>
  );
}


export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');

  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [composeOpen, setComposeOpen] = useState(false);

  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [form, setForm] = useState({
    recipientMode: 'user',
    userId: '',
    type: 'system',
    priority: 'normal',
    title: '',
    body: '',
    link: ''
  });

  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [sendInApp, setSendInApp] = useState(true);
  const [sendPush, setSendPush] = useState(true);
  const [deliveryReport, setDeliveryReport] = useState(null);

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return users;
    const term = userSearchTerm.toLowerCase();
    return users.filter((u) => (u.name || u.id).toLowerCase().includes(term));
  }, [users, userSearchTerm]);

  const toggleUserSelection = (id) => {
    setSelectedUserIds((current) =>
      current.includes(id) ? current.filter((uid) => uid !== id) : [...current, id]
    );
  };

  const selectAllFilteredUsers = () => {
    const idsToAdd = filteredUsers.map((u) => u.id);
    setSelectedUserIds((current) => Array.from(new Set([...current, ...idsToAdd])));
  };

  const clearSelectedUsers = () => {
    setSelectedUserIds([]);
  };


  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');

    const {
      data,
      error: queryError
    } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', {
        ascending: false
      })
      .limit(500);

    if (queryError) {
      setError(queryError.message);
      setNotifications([]);
    } else {
      setNotifications(data || []);
    }

    setLoading(false);
  }, []);


  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');

    try {
      // 1. Paginate user_roles where role = 'client' to avoid exceeding limits and exclude staff
      const PAGE_SIZE = 1000;
      let from = 0;
      const clientRoleRows = [];

      while (true) {
        const { data, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('role', 'client')
          .range(from, from + PAGE_SIZE - 1);

        if (rolesError) {
          throw rolesError;
        }

        if (!data || data.length === 0) break;
        clientRoleRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      const clientIds = clientRoleRows.map((r) => r.user_id).filter(Boolean);

      if (clientIds.length === 0) {
        setUsers([]);
        setUsersLoading(false);
        return;
      }

      // 2. Fetch profiles for resolved client IDs in chunks of 200 to prevent HTTP 414 URI length errors
      const CHUNK_SIZE = 200;
      const profilesMap = new Map();

      for (let i = 0; i < clientIds.length; i += CHUNK_SIZE) {
        const chunk = clientIds.slice(i, i + CHUNK_SIZE);
        const { data: profs, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', chunk);

        if (profilesError) {
          throw profilesError;
        }

        if (profs) {
          for (const p of profs) {
            profilesMap.set(p.id, p.name || 'Unnamed Client');
          }
        }
      }

      // 3. Assemble and sort client list by display name
      const clientUsers = clientIds.map((id) => ({
        id,
        name: profilesMap.get(id) || `Client (${id.slice(0, 8)})`
      }));

      clientUsers.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );

      setUsers(clientUsers);
    } catch (err) {
      setUsersError(err.message || 'Failed to load clients directory.');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);


  useEffect(() => {
    loadNotifications();
    loadUsers();
  }, [
    loadNotifications,
    loadUsers
  ]);


  useEffect(() => {
    const channel = supabase
      .channel('admin-notifications-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setNotifications((current) => [
              payload.new,
              ...current.filter(
                (item) =>
                  item.id !== payload.new.id
              )
            ]);
          }

          if (payload.eventType === 'UPDATE') {
            setNotifications((current) =>
              current.map((item) =>
                item.id === payload.new.id
                  ? payload.new
                  : item
              )
            );
          }

          if (payload.eventType === 'DELETE') {
            setNotifications((current) =>
              current.filter(
                (item) =>
                  item.id !== payload.old.id
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage('');
    }, 3500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [successMessage]);


  const filteredNotifications = useMemo(() => {
    const term = search
      .trim()
      .toLowerCase();

    return notifications.filter((notification) => {
      if (
        filter !== 'all' &&
        notification.type !== filter
      ) {
        return false;
      }

      if (
        priorityFilter !== 'all' &&
        notification.priority !== priorityFilter
      ) {
        return false;
      }

      const isRead = Boolean(
        notification.read_at
      );

      if (
        statusFilter === 'unread' &&
        isRead
      ) {
        return false;
      }

      if (
        statusFilter === 'read' &&
        !isRead
      ) {
        return false;
      }

      if (!term) {
        return true;
      }

      const searchable = [
        notification.title,
        notification.body,
        notification.type,
        notification.priority
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [
    notifications,
    search,
    filter,
    statusFilter,
    priorityFilter
  ]);


  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (item) => !item.read_at
      ).length,
    [notifications]
  );


  const todayCount = useMemo(() => {
    const today = new Date();

    return notifications.filter((item) => {
      const date = new Date(item.created_at);

      return (
        date.getFullYear() ===
          today.getFullYear() &&
        date.getMonth() ===
          today.getMonth() &&
        date.getDate() ===
          today.getDate()
      );
    }).length;
  }, [notifications]);


  const importantCount = useMemo(
    () =>
      notifications.filter(
        (item) =>
          item.priority === 'important' ||
          item.priority === 'urgent'
      ).length,
    [notifications]
  );


  const markAsRead = async (id) => {
    setBusyId(id);
    setError('');

    const {
      error: updateError
    } = await supabase
      .from('notifications')
      .update({
        read_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
    }

    setBusyId(null);
  };


  const markAsUnread = async (id) => {
    setBusyId(id);
    setError('');

    const {
      error: updateError
    } = await supabase
      .from('notifications')
      .update({
        read_at: null
      })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
    }

    setBusyId(null);
  };


  const markAllAsRead = async () => {
    if (!unreadCount) return;

    setBusyId('all');
    setError('');

    const {
      error: updateError
    } = await supabase
      .from('notifications')
      .update({
        read_at: new Date().toISOString()
      })
      .is('read_at', null);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccessMessage(
        'All notifications marked as read.'
      );
    }

    setBusyId(null);
  };


  const deleteNotification = async (id) => {
    const confirmed = window.confirm(
      'Delete this notification?'
    );

    if (!confirmed) return;

    setBusyId(id);
    setError('');

    const {
      error: deleteError
    } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccessMessage(
        'Notification deleted.'
      );
    }

    setBusyId(null);
  };


  const clearRead = async () => {
    const confirmed = window.confirm(
      'Delete all read notifications?'
    );

    if (!confirmed) return;

    setBusyId('clear');
    setError('');

    const {
      error: deleteError
    } = await supabase
      .from('notifications')
      .delete()
      .not('read_at', 'is', null);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setSuccessMessage(
        'Read notifications cleared.'
      );
    }

    setBusyId(null);
  };


  const openNotification = async (
    notification
  ) => {
    if (!notification.read_at) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      window.location.href =
        notification.action_url;
    }
  };


  const resetForm = () => {
    setForm({
      recipientMode: 'user',
      userId: '',
      type: 'system',
      priority: 'normal',
      title: '',
      body: '',
      link: ''
    });
    setSelectedUserIds([]);
    setUserSearchTerm('');
    setSendInApp(true);
    setSendPush(true);
  };


  const sendNotification = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError('Please enter a notification title.');
      return;
    }

    if (!sendInApp && !sendPush) {
      setError('Please select at least one delivery channel (In-App or Browser Push).');
      return;
    }

    let targetRecipients = [];
    if (form.recipientMode === 'user') {
      if (!form.userId) {
        setError('Please select a recipient.');
        return;
      }
      targetRecipients = [form.userId];
    } else if (form.recipientMode === 'selected') {
      if (!selectedUserIds.length) {
        setError('Please select at least one client.');
        return;
      }
      targetRecipients = selectedUserIds;
    } else if (form.recipientMode === 'all') {
      targetRecipients = users.map((item) => item.id);
      if (!targetRecipients.length) {
        setError('No clients are available in the directory.');
        return;
      }
    }

    setSending(true);
    setError('');

    const {
      data: { user }
    } = await supabase.auth.getUser();

    let inAppCreatedCount = 0;
    let inAppErrorMsg = null;

    // 1. In-App persistence (chunked in batches of 500 to avoid PostgREST payload limits)
    if (sendInApp) {
      const IN_APP_BATCH_SIZE = 500;
      const allRows = targetRecipients.map((recipientId) => ({
        user_id: recipientId,
        recipient_id: recipientId,
        type: form.type,
        priority: form.priority,
        title: form.title.trim(),
        body: form.body.trim() || null,
        action_url: form.link.trim() || null,
        link: form.link.trim() || null,
        created_by: user?.id || null
      }));

      for (let i = 0; i < allRows.length; i += IN_APP_BATCH_SIZE) {
        const batch = allRows.slice(i, i + IN_APP_BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(batch);

        if (insertError) {
          inAppErrorMsg = insertError.message;
          break;
        } else {
          inAppCreatedCount += batch.length;
        }
      }
    }

    // 2. Browser Push via Edge Function
    let pushResult = null;
    let pushErrorMsg = null;

    if (sendPush) {
      try {
        const { data: pushData, error: pushInvokeError } = await supabase.functions.invoke(
          'send-push-notification',
          {
            body: {
              title: form.title.trim(),
              body: form.body.trim(),
              action_url: form.link.trim() || '/dashboard',
              recipientMode: form.recipientMode,
              recipients: form.recipientMode === 'all' ? [] : targetRecipients,
              priority: form.priority
            }
          }
        );

        if (pushInvokeError) {
          pushErrorMsg = pushInvokeError.message;
        } else if (pushData?.error) {
          pushErrorMsg = pushData.error;
        } else {
          pushResult = pushData;
        }
      } catch (pErr) {
        pushErrorMsg = pErr.message || 'Push delivery failed.';
      }
    }

    setSending(false);

    if (inAppErrorMsg && !pushResult) {
      setError(`Failed to create notifications: ${inAppErrorMsg}`);
      return;
    }

    // 3. Assemble and show delivery report
    const report = {
      recipientsSelected: pushResult?.recipientsTargeted ?? targetRecipients.length,
      inAppCreated: inAppCreatedCount,
      subscriptionsFound: pushResult?.subscriptionsFound ?? 0,
      pushAttempted: pushResult?.pushAttempted ?? 0,
      pushAccepted: pushResult?.pushAccepted ?? 0,
      pushFailed: pushResult?.pushFailed ?? 0,
      invalidatedCount: pushResult?.invalidatedCount ?? 0,
      pushError: pushErrorMsg,
      inAppError: inAppErrorMsg,
      timestamp: new Date().toLocaleTimeString()
    };

    setDeliveryReport(report);

    let summaryText = '';
    if (sendInApp && inAppCreatedCount > 0) {
      summaryText += `${inAppCreatedCount} in-app notification${inAppCreatedCount > 1 ? 's' : ''} created. `;
    }
    if (sendPush) {
      if (pushResult && pushResult.pushAccepted > 0) {
        summaryText += `${pushResult.pushAccepted} push notification${pushResult.pushAccepted > 1 ? 's' : ''} accepted by push services.`;
      } else if (pushResult && pushResult.subscriptionsFound === 0) {
        summaryText += 'No active browser push subscriptions registered for selected client(s).';
      } else if (pushErrorMsg) {
        summaryText += `(Push note: ${pushErrorMsg})`;
      }
    }
    if (inAppErrorMsg) {
      summaryText += ` (In-app notice: ${inAppErrorMsg})`;
    }

    setSuccessMessage(summaryText.trim() || 'Notification dispatched.');
    resetForm();
    setComposeOpen(false);
  };


  return (
    <DashboardShell
      admin
      title="Notifications"
      active="notifications"
    >
      <div className="admin-notifications-page">

        <header className="admin-notifications-head">

          <div>
            <p className="admin-notifications-eyebrow">
              ADMIN
            </p>

            <h1 className="admin-notifications-title">
              Notifications
            </h1>
          </div>

          <div className="admin-notifications-head-actions">

            <span className="admin-notifications-live">
              <span className="admin-notifications-live-dot" />
              Live
            </span>

            <button
              type="button"
              className="admin-notifications-btn admin-notifications-btn-primary"
              onClick={() => {
                setComposeOpen(
                  (current) => !current
                );
              }}
            >
              + Send notification
            </button>

          </div>

        </header>


        {error && (
          <div className="admin-notifications-notice error">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="admin-notifications-notice success">
            {successMessage}
          </div>
        )}

        {deliveryReport && (
          <section className="admin-notifications-report-card">
            <div className="admin-notifications-report-head">
              <div>
                <span className="admin-notifications-report-kicker">DISPATCH METRICS</span>
                <h3 className="admin-notifications-report-title">Push & In-App Delivery Summary</h3>
                <p className="admin-notifications-report-time">Recorded at {deliveryReport.timestamp}</p>
              </div>
              <button
                type="button"
                className="admin-notifications-btn"
                onClick={() => setDeliveryReport(null)}
              >
                Dismiss
              </button>
            </div>

            <div className="admin-notifications-report-grid">
              <div className="admin-notifications-report-stat">
                <span className="report-stat-num">{deliveryReport.recipientsSelected}</span>
                <span className="report-stat-label">Clients Targeted</span>
              </div>
              <div className="admin-notifications-report-stat">
                <span className="report-stat-num">{deliveryReport.inAppCreated}</span>
                <span className="report-stat-label">In-App Created</span>
              </div>
              <div className="admin-notifications-report-stat">
                <span className="report-stat-num">{deliveryReport.subscriptionsFound}</span>
                <span className="report-stat-label">Active Subscriptions</span>
              </div>
              <div className="admin-notifications-report-stat">
                <span className="report-stat-num">{deliveryReport.pushAttempted}</span>
                <span className="report-stat-label">Push Attempted</span>
              </div>
              <div className="admin-notifications-report-stat report-success">
                <span className="report-stat-num">{deliveryReport.pushAccepted}</span>
                <span className="report-stat-label">Push Accepted</span>
              </div>
              {deliveryReport.pushFailed > 0 && (
                <div className="admin-notifications-report-stat report-warning">
                  <span className="report-stat-num">{deliveryReport.pushFailed}</span>
                  <span className="report-stat-label">Push Failed</span>
                </div>
              )}
              {deliveryReport.invalidatedCount > 0 && (
                <div className="admin-notifications-report-stat report-warning">
                  <span className="report-stat-num">{deliveryReport.invalidatedCount}</span>
                  <span className="report-stat-label">Expired Pruned</span>
                </div>
              )}
            </div>

            <p className="admin-notifications-report-disclaimer">
              * Push notifications accepted by browser push services. Actual device delivery depends on client connectivity, browser state, and OS notification settings.
            </p>

            {deliveryReport.pushError && (
              <div className="admin-notifications-report-error">
                <strong>Browser Push Note:</strong> {deliveryReport.pushError}
              </div>
            )}

            {deliveryReport.inAppError && (
              <div className="admin-notifications-report-error">
                <strong>In-App Notification Note:</strong> {deliveryReport.inAppError}
              </div>
            )}
          </section>
        )}


        <section className="admin-notifications-stats">

          <StatCard
            label="Total"
            value={notifications.length}
            detail="All notifications"
            icon="●"
          />

          <StatCard
            label="Unread"
            value={unreadCount}
            detail="Needs attention"
            icon="●"
          />

          <StatCard
            label="Today"
            value={todayCount}
            detail="Created today"
            icon="◷"
          />

          <StatCard
            label="Important"
            value={importantCount}
            detail="Important + urgent"
            icon="!"
          />

        </section>


        {composeOpen && (
          <section className="admin-notification-compose">

            <div className="admin-notification-compose-head">
              <div>
                <h2>Send notification</h2>

                <p>
                  Send in-app and browser push notifications to a specific client, selected clients, or everyone.
                </p>
              </div>

              <button
                type="button"
                className="admin-notifications-btn"
                onClick={() => {
                  setComposeOpen(false);
                  resetForm();
                }}
              >
                Close
              </button>
            </div>

            {usersError && (
              <div
                className="admin-notifications-notice error"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem'
                }}
              >
                <span>{usersError}</span>
                <button
                  type="button"
                  className="admin-notifications-btn-mini"
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  {usersLoading ? 'Retrying...' : 'Retry loading clients'}
                </button>
              </div>
            )}


            <form
              className="admin-notification-form"
              onSubmit={sendNotification}
            >

              <div className="admin-notification-form-row">

                <label>
                  Recipient
                  <select
                    value={form.recipientMode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recipientMode: event.target.value,
                        userId: ''
                      }))
                    }
                  >
                    <option value="user">Specific client</option>
                    <option value="selected">Multiple selected clients</option>
                    <option value="all">All eligible clients ({users.length})</option>
                  </select>
                </label>


                {form.recipientMode === 'user' && (
                  <label>
                    Client
                    <select
                      value={form.userId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          userId: event.target.value
                        }))
                      }
                      disabled={usersLoading}
                    >
                      <option value="">
                        {usersLoading ? 'Loading clients...' : 'Select client'}
                      </option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name || user.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

              </div>


              {form.recipientMode === 'selected' && (
                <div className="admin-notification-multiselect">
                  <div className="admin-notification-multiselect-head">
                    <input
                      type="search"
                      className="admin-notification-multiselect-search"
                      placeholder="Filter clients by name..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                    />
                    <div className="admin-notification-multiselect-actions">
                      <button
                        type="button"
                        className="admin-notifications-btn-mini"
                        onClick={selectAllFilteredUsers}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="admin-notifications-btn-mini"
                        onClick={clearSelectedUsers}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="admin-notification-multiselect-summary">
                    {selectedUserIds.length} of {users.length} clients selected
                  </div>
                  <div className="admin-notification-multiselect-list">
                    {filteredUsers.length === 0 ? (
                      <div className="admin-notification-multiselect-empty">
                        No clients match "{userSearchTerm}"
                      </div>
                    ) : (
                      filteredUsers.map((u) => (
                        <label key={u.id} className="admin-notification-multiselect-item">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={() => toggleUserSelection(u.id)}
                          />
                          <span>{u.name || u.id}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}


              <div className="admin-notification-form-row">

                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value
                      }))
                    }
                  >
                    {SEND_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>


                <label>
                  Priority
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value
                      }))
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>

              </div>


              <div className="admin-notification-channels-group">
                <span className="admin-notification-channels-title">Delivery Channels</span>
                <div className="admin-notification-channels-row">
                  <label className="admin-notification-channel-checkbox">
                    <input
                      type="checkbox"
                      checked={sendInApp}
                      onChange={(e) => setSendInApp(e.target.checked)}
                    />
                    <span><strong>In-App Notification</strong> (Database & dashboard bell)</span>
                  </label>
                  <label className="admin-notification-channel-checkbox">
                    <input
                      type="checkbox"
                      checked={sendPush}
                      onChange={(e) => setSendPush(e.target.checked)}
                    />
                    <span><strong>Browser Push Notification</strong> (Web Push via VAPID)</span>
                  </label>
                </div>
              </div>


              <label>
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                  placeholder="Notification title"
                  maxLength={140}
                />
                <small className="admin-notification-char-count">
                  {form.title.length} / 140 characters
                </small>
              </label>


              <label>
                Message
                <textarea
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      body: event.target.value
                    }))
                  }
                  placeholder="Write the notification message..."
                  rows={3}
                  maxLength={1000}
                />
                <small className="admin-notification-char-count">
                  {form.body.length} / 1000 characters
                </small>
              </label>


              <label>
                Action link
                <input
                  type="text"
                  value={form.link}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      link: event.target.value
                    }))
                  }
                  placeholder="/dashboard/orders"
                />
                <small>Optional relative destination. Example: /dashboard/orders</small>
              </label>


              {/* Live Preview Card */}
              <div className="admin-notification-preview-section">
                <span className="admin-notification-preview-label">Live Preview</span>
                <div className="admin-notification-preview-card">
                  <div className="admin-notification-preview-card-head">
                    <img
                      src="/assets/formant-symbol-192.png"
                      alt="Formant"
                      className="admin-notification-preview-app-icon"
                    />
                    <div className="admin-notification-preview-app-info">
                      <span className="admin-notification-preview-app-title">FORMANT</span>
                      <span className="admin-notification-preview-dot">•</span>
                      <span className="admin-notification-preview-app-sub">Just now</span>
                    </div>
                    <span className={`admin-notification-priority ${form.priority}`}>
                      {form.priority}
                    </span>
                  </div>
                  <div className="admin-notification-preview-card-body">
                    <strong>{form.title.trim() || 'Notification title preview'}</strong>
                    <p>{form.body.trim() || 'Notification message will appear here for the recipient.'}</p>
                    {form.link && (
                      <div className="admin-notification-preview-card-link">
                        Destination: <span>{form.link}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>


              <div className="admin-notification-form-footer">

                <button
                  type="button"
                  className="admin-notifications-btn"
                  onClick={() => {
                    resetForm();
                    setComposeOpen(false);
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-notifications-btn admin-notifications-btn-primary"
                  disabled={sending}
                >
                  {sending
                    ? 'Dispatching...'
                    : 'Send notification'}
                </button>

              </div>

            </form>

          </section>
        )}


        <section className="admin-notifications-toolbar">

          <input
            type="search"
            className="admin-notifications-search"
            placeholder="Search notifications..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />


          <div className="admin-notifications-filters">

            {[
              {
                value: 'all',
                label: 'All'
              },
              {
                value: 'unread',
                label: 'Unread'
              },
              {
                value: 'read',
                label: 'Read'
              }
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                className={`admin-notifications-filter ${
                  statusFilter === item.value
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setStatusFilter(item.value)
                }
              >
                {item.label}
              </button>
            ))}


            <select
              className="admin-notifications-filter-select"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
            >
              {TYPES.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>


            <select
              className="admin-notifications-filter-select"
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(
                  event.target.value
                )
              }
            >
              {PRIORITIES.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>


            <button
              type="button"
              className="admin-notifications-btn"
              onClick={markAllAsRead}
              disabled={
                unreadCount === 0 ||
                busyId === 'all'
              }
            >
              Mark all read
            </button>


            <button
              type="button"
              className="admin-notifications-btn"
              onClick={clearRead}
              disabled={busyId === 'clear'}
            >
              Clear read
            </button>

          </div>

        </section>


        <section className="admin-notifications-list">

          {loading ? (
            <div className="admin-notifications-loading">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="admin-notifications-empty">

              <div className="admin-notifications-empty-icon">
                🔔
              </div>

              <h2>
                No notifications found
              </h2>

              <p>
                New orders, messages, payments,
                reviews and system events will
                appear here.
              </p>

            </div>
          ) : (
            filteredNotifications.map(
              (notification) => {

                const unread =
                  !notification.read_at;

                return (
                  <article
                    key={notification.id}
                    className={`admin-notification-card ${
                      unread ? 'unread' : ''
                    } ${
                      notification.priority ===
                      'urgent'
                        ? 'urgent'
                        : ''
                    }`}
                  >

                    <div className="admin-notification-icon">
                      {getTypeIcon(
                        notification.type
                      )}
                    </div>


                    <div className="admin-notification-content">

                      <div className="admin-notification-top">

                        <div>
                          <h3 className="admin-notification-title">
                            {notification.title}
                          </h3>

                          <div className="admin-notification-meta">

                            <span className="admin-notification-type">
                              {getTypeLabel(
                                notification.type
                              )}
                            </span>

                            <span
                              className={`admin-notification-priority ${notification.priority}`}
                            >
                              {getPriorityLabel(
                                notification.priority
                              )}
                            </span>

                            {unread && (
                              <span className="admin-notification-unread">
                                Unread
                              </span>
                            )}

                          </div>
                        </div>


                        <time className="admin-notification-time">
                          {formatRelativeTime(
                            notification.created_at
                          )}
                        </time>

                      </div>


                      {notification.body && (
                        <p className="admin-notification-message">
                          {notification.body}
                        </p>
                      )}


                      <div className="admin-notification-actions">

                        <button
                          type="button"
                          className="admin-notification-action"
                          onClick={() =>
                            openNotification(
                              notification
                            )
                          }
                        >
                          {notification.action_url
                            ? 'Open'
                            : unread
                              ? 'Mark read'
                              : 'View'}
                        </button>


                        {unread ? (
                          <button
                            type="button"
                            className="admin-notification-action"
                            disabled={
                              busyId ===
                              notification.id
                            }
                            onClick={() =>
                              markAsRead(
                                notification.id
                              )
                            }
                          >
                            Mark read
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-notification-action"
                            disabled={
                              busyId ===
                              notification.id
                            }
                            onClick={() =>
                              markAsUnread(
                                notification.id
                              )
                            }
                          >
                            Unread
                          </button>
                        )}


                        <button
                          type="button"
                          className="admin-notification-action danger"
                          disabled={
                            busyId ===
                            notification.id
                          }
                          onClick={() =>
                            deleteNotification(
                              notification.id
                            )
                          }
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </article>
                );
              }
            )
          )}

        </section>


        <footer className="admin-notifications-footer">

          <span className="admin-notifications-count">
            Showing{' '}
            {filteredNotifications.length}
            {' '}
            of{' '}
            {notifications.length}
            {' '}
            notifications
          </span>

          <span className="admin-notifications-count">
            Live updates enabled
          </span>

        </footer>

      </div>
    </DashboardShell>
  );
}