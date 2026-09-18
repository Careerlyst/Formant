import React, { useEffect, useRef, useState } from 'react';
import {
  Link,
  useNavigate
} from 'react-router-dom';

import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';
import { load } from '../lib/store';


/* =========================================================
   STAFF ROLES
   ========================================================= */

const STAFF_ROLES = [
  'admin',
  'expert',
  'support',
  'finance'
];


/* =========================================================
   ADMIN OVERVIEW
   ========================================================= */

function AdminOverview() {

  return (
    <DashboardShell admin>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            CONTROL PANEL
          </p>

          <h1>
            Operations overview.
          </h1>

          <p>
            Keep the small team focused on the right work.
          </p>

        </div>

      </div>


      <div className="stats">

        <div className="stat">
          <span>Active projects</span>
          <b>2 / 2</b>
        </div>

        <div className="stat">
          <span>Queue</span>
          <b>3</b>
        </div>

        <div className="stat">
          <span>Users</span>
          <b>12</b>
        </div>

        <div className="stat">
          <span>Unread</span>
          <b>4</b>
        </div>

      </div>


      <section className="admin-capacity panel">

        <div>

          <p className="eyebrow">
            CAPACITY
          </p>

          <h2>
            2 of 2 active slots used
          </h2>

          <p>
            New orders should enter the queue automatically.
          </p>

        </div>

        <div className="capacity-bar">
          <i />
        </div>

      </section>


      <section className="panel">

        <div className="panel-head">

          <h2>
            Active orders
          </h2>

          <Link to="/admin/orders">
            Manage →
          </Link>

        </div>


        <div className="admin-order">

          <b>#1042</b>

          <span>
            Resume + LinkedIn
          </span>

          <span className="status">
            In progress
          </span>

          <span>
            Client: Sarah M.
          </span>

        </div>


        <div className="admin-order">

          <b>#1043</b>

          <span>
            Portfolio
          </span>

          <span className="status">
            In progress
          </span>

          <span>
            Client: Daniel K.
          </span>

        </div>

      </section>

    </DashboardShell>
  );
}


/* =========================================================
   ADMIN LIST
   ========================================================= */

function AdminList({
  title,
  kind
}) {

  const [
    status,
    setStatus
  ] = useState('In progress');

  return (
    <DashboardShell admin>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            ADMIN
          </p>

          <h1>
            {title}
          </h1>

        </div>

      </div>


      <div className="panel table-panel">


        {/* ORDERS */}

        {kind === 'orders' && (
          <>

            <div className="admin-order">

              <b>#1042</b>

              <span>
                Sarah M.
              </span>

              <span>
                Resume + LinkedIn
              </span>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              >

                <option>
                  Queued
                </option>

                <option>
                  In progress
                </option>

                <option>
                  Client review
                </option>

                <option>
                  Revision
                </option>

                <option>
                  Completed
                </option>

              </select>

              <Link
                className="text-button"
                to="/admin/workspace"
              >
                Open workspace →
              </Link>

            </div>


            <div className="admin-order">

              <b>#1043</b>

              <span>
                Daniel K.
              </span>

              <span>
                Portfolio
              </span>

              <select>

                <option>
                  In progress
                </option>

                <option>
                  Client review
                </option>

                <option>
                  Revision
                </option>

                <option>
                  Completed
                </option>

              </select>

              <Link
                className="text-button"
                to="/admin/workspace"
              >
                Open workspace →
              </Link>

            </div>

          </>
        )}


        {/* USERS */}

        {kind === 'users' && (

          [
            'Sarah M.',
            'Daniel K.',
            'Aisha R.',
            'James P.'
          ].map((name, i) => (

            <div
              className="admin-order"
              key={name}
            >

              <b>
                USR-10{i + 1}
              </b>

              <span>
                {name}
              </span>

              <span>
                {i % 2
                  ? 'Portfolio'
                  : 'Resume'}
              </span>

              <span>
                Active
              </span>

              <button
                type="button"
                className="text-button"
              >
                View →
              </button>

            </div>

          ))

        )}


        {/* PROJECTS */}

        {kind === 'projects' && (

          <div className="empty">

            <h3>
              Project workspaces
            </h3>

            <p>
              Each active order can have an internal
              workspace, assigned expert, milestones
              and review notes.
            </p>

            <Link
              className="btn dark"
              to="/admin/workspace"
            >
              Open team workspace →
            </Link>

          </div>

        )}


        {/* PAYMENTS */}

        {kind === 'payments' && (

          <div className="empty">

            <h3>
              Payment ledger
            </h3>

            <p>
              Connect your chosen payment provider
              to populate live transactions here.
            </p>

          </div>

        )}


        {/* MESSAGES */}

        {kind === 'messages' && (

          <div className="empty">

            <h3>
              Team inbox
            </h3>

            <p>
              Customer conversations from all active
              projects appear here.
            </p>

          </div>

        )}


        {/* FILES */}

        {kind === 'files' && (

          <div className="empty">

            <h3>
              Client files
            </h3>

            <p>
              Files are organized by customer and order,
              with secure storage in production.
            </p>

          </div>

        )}

      </div>

    </DashboardShell>
  );
}


/* =========================================================
   ADMIN PAGES
   ========================================================= */

export function AdminUsers() {
  return (
    <AdminList
      title="Users"
      kind="users"
    />
  );
}


export function AdminOrders() {
  return (
    <AdminList
      title="Orders & queue"
      kind="orders"
    />
  );
}


export function AdminProjects() {
  return (
    <AdminList
      title="Projects"
      kind="projects"
    />
  );
}


export function AdminPayments() {
  return (
    <AdminList
      title="Payments"
      kind="payments"
    />
  );
}


function AdminMessagesPage() {
  const [staffUserId, setStaffUserId] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [messageMap, setMessageMap] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messageToast, setMessageToast] = useState(null);
  const seenRealtimeMessageIdsRef = useRef(new Set());

  const selectedOrder = orders.find(
    (order) => String(order.id) === String(selectedOrderId)
  ) || null;

  const selectedMessages = selectedOrder
    ? (messageMap[selectedOrder.id] || [])
    : [];

  const groupedClients = (() => {
    const query = search.trim().toLowerCase();
    const groups = [];

    orders.forEach((order) => {
      const clientName = profiles[order.user_id]?.name || 'Client';
      const service = String(order.service_name || 'Careerlyst service');
      const packageName = String(order.package_name || '');
      const thread = messageMap[String(order.id)] || [];
      const last = thread[thread.length - 1];
      const unread = thread.filter(
        (message) =>
          String(message.sender_id) === String(order.user_id) &&
          !message.read_at
      ).length;

      const searchable = [
        clientName,
        service,
        packageName,
        String(order.id)
      ].join(' ').toLowerCase();

      if (query && !searchable.includes(query)) return;

      let group = groups.find(
        (item) => String(item.userId) === String(order.user_id)
      );

      if (!group) {
        group = {
          userId: order.user_id,
          clientName,
          orders: [],
          unread: 0,
          latestAt: last?.created_at || order.updated_at || order.created_at
        };
        groups.push(group);
      }

      group.orders.push({
        order,
        thread,
        last,
        unread
      });
      group.unread += unread;

      const currentLatest = new Date(group.latestAt || 0).getTime();
      const nextLatest = new Date(
        last?.created_at || order.updated_at || order.created_at || 0
      ).getTime();
      if (nextLatest > currentLatest) {
        group.latestAt = last?.created_at || order.updated_at || order.created_at;
      }
    });

    groups.forEach((group) => {
      group.orders.sort((a, b) => {
        const aTime = new Date(
          a.last?.created_at || a.order.updated_at || a.order.created_at || 0
        ).getTime();
        const bTime = new Date(
          b.last?.created_at || b.order.updated_at || b.order.created_at || 0
        ).getTime();
        return bTime - aTime;
      });
    });

    groups.sort(
      (a, b) =>
        new Date(b.latestAt || 0).getTime() -
        new Date(a.latestAt || 0).getTime()
    );

    return groups;
  })();

  const visibleOrderCount = groupedClients.reduce(
    (total, group) => total + group.orders.length,
    0
  );

  const notifications = orders
    .map((order) => {
      const thread = messageMap[String(order.id)] || [];
      const unreadMessages = thread.filter(
        (message) =>
          String(message.sender_id) === String(order.user_id) &&
          !message.read_at
      );
      const latest = unreadMessages[unreadMessages.length - 1];

      return latest
        ? {
            order,
            clientName: profiles[order.user_id]?.name || 'Client',
            latest,
            unread: unreadMessages.length
          }
        : null;
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date(b.latest.created_at || 0).getTime() -
        new Date(a.latest.created_at || 0).getTime()
    );

  const unreadTotal = notifications.reduce(
    (total, item) => total + item.unread,
    0
  );

  useEffect(() => {
    let mounted = true;
    let channel = null;

    async function loadInbox() {
      if (!supabase) {
        if (mounted) {
          setError('Supabase is not configured.');
          setConnection('offline');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');

      try {
        const {
          data: sessionData,
          error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData?.session?.user;
        if (!user) {
          throw new Error(
            'Your staff session could not be verified. Please sign in again.'
          );
        }

        const {
          data: roleRow,
          error: roleError
        } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (roleError) throw roleError;

        if (!STAFF_ROLES.includes(roleRow?.role)) {
          throw new Error('This account does not have staff access.');
        }

        if (!mounted) return;
        setStaffUserId(user.id);
        setStaffRole(roleRow.role);

        const {
          data: orderData,
          error: orderError
        } = await supabase
          .from('orders')
          .select(
            'id, user_id, service_name, package_name, status, payment_status, created_at, updated_at'
          )
          .order('created_at', { ascending: false });

        if (orderError) throw orderError;

        const nextOrders = orderData || [];
        if (!mounted) return;
        setOrders(nextOrders);

        const userIds = [
          ...new Set(
            nextOrders
              .map((order) => order.user_id)
              .filter(Boolean)
          )
        ];

        let nextProfiles = {};

        if (userIds.length) {
          const {
            data: profileData,
            error: profileError
          } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          if (profileError) throw profileError;
          if (!mounted) return;

          nextProfiles = Object.fromEntries(
            (profileData || []).map((profile) => [
              profile.id,
              profile
            ])
          );
          setProfiles(nextProfiles);
        } else {
          setProfiles({});
        }

        const orderIds = nextOrders
          .map((order) => order.id)
          .filter(Boolean);

        if (orderIds.length) {
          const {
            data: messageData,
            error: messageError
          } = await supabase
            .from('messages')
            .select(
              'id, order_id, sender_id, body, created_at, read_at'
            )
            .in('order_id', orderIds)
            .order('created_at', { ascending: true });

          if (messageError) throw messageError;

          const grouped = {};

          (messageData || []).forEach((message) => {
            const key = String(message.order_id);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(message);
          });

          (messageData || []).forEach((message) => {
            if (message?.id != null) {
              seenRealtimeMessageIdsRef.current.add(String(message.id));
            }
          });

          if (!mounted) return;
          setMessageMap(grouped);

          const firstThread = nextOrders.find(
            (order) => grouped[String(order.id)]?.length
          ) || nextOrders[0];

          setSelectedOrderId(
            (current) => current || firstThread?.id || null
          );
        } else {
          setMessageMap({});
          setSelectedOrderId(null);
        }

        setConnection('connecting');

        channel = supabase
          .channel(`careerlyst-admin-messages-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages'
            },
            (payload) => {
              if (!mounted || (!payload?.new && !payload?.old)) {
                return;
              }

              const next = payload.new || payload.old;
              const orderId = next?.order_id;
              if (!orderId) return;

              if (payload.eventType === 'INSERT') {
                const inserted = payload.new;
                const messageId = inserted?.id != null ? String(inserted.id) : '';

                // Realtime can deliver the same INSERT more than once.
                // The first delivery updates the inbox and creates one notification;
                // later deliveries are ignored completely.
                if (messageId && seenRealtimeMessageIdsRef.current.has(messageId)) {
                  return;
                }
                if (messageId) {
                  seenRealtimeMessageIdsRef.current.add(messageId);
                }

                const order = nextOrders.find(
                  (item) => String(item.id) === String(inserted?.order_id)
                );
                const isClientMessage =
                  Boolean(order) &&
                  String(inserted?.sender_id) === String(order.user_id);

                if (isClientMessage) {
                  setMessageToast({
                    id: inserted.id,
                    orderId: order.id,
                    clientName: nextProfiles[order.user_id]?.name || 'Client',
                    preview: String(inserted.body || '').trim() || 'Sent a new message.'
                  });
                }
              }

              setMessageMap((current) => {
                const key = String(orderId);
                const thread = Array.isArray(current[key])
                  ? [...current[key]]
                  : [];

                if (payload.eventType === 'INSERT') {
                  if (
                    !thread.some(
                      (item) =>
                        String(item.id) ===
                        String(payload.new.id)
                    )
                  ) {
                    thread.push(payload.new);
                  }
                } else if (payload.eventType === 'UPDATE') {
                  const index = thread.findIndex(
                    (item) =>
                      String(item.id) ===
                      String(payload.new.id)
                  );

                  if (index >= 0) {
                    thread[index] = payload.new;
                  } else {
                    thread.push(payload.new);
                  }
                } else if (payload.eventType === 'DELETE') {
                  return {
                    ...current,
                    [key]: thread.filter(
                      (item) =>
                        String(item.id) !==
                        String(payload.old.id)
                    )
                  };
                }

                thread.sort(
                  (a, b) =>
                    new Date(a.created_at || 0) -
                    new Date(b.created_at || 0)
                );

                return {
                  ...current,
                  [key]: thread
                };
              });
            }
          )
          .subscribe((status) => {
            if (!mounted) return;

            if (status === 'SUBSCRIBED') {
              setConnection('online');
            } else if (
              status === 'CHANNEL_ERROR' ||
              status === 'TIMED_OUT' ||
              status === 'CLOSED'
            ) {
              setConnection('offline');
            }
          });
      } catch (loadError) {
        console.error(
          'Admin messages load error:',
          loadError
        );

        if (mounted) {
          setError(
            loadError?.message ||
            'Could not load client conversations.'
          );
          setConnection('offline');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInbox();

    return () => {
      mounted = false;
      if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!messageToast) return undefined;
    const timer = window.setTimeout(() => setMessageToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [messageToast]);

  useEffect(() => {
    const node = document.querySelector(
      '.admin-messages-thread-body'
    );

    if (!node) return;

    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [selectedOrderId, selectedMessages.length]);

  function formatMessageTime(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function formatOrderDate(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function handleComposerKeyDown(event) {
    if (
      event.nativeEvent?.isComposing ||
      event.isComposing
    ) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  async function sendMessage() {
    const body = text.trim();

    if (
      !body ||
      !selectedOrder ||
      !staffUserId ||
      staffRole === 'finance' ||
      sending ||
      !supabase
    ) {
      return;
    }

    setSending(true);
    setError('');

    try {
      const {
        data,
        error: sendError
      } = await supabase
        .from('messages')
        .insert({
          order_id: selectedOrder.id,
          sender_id: staffUserId,
          body
        })
        .select(
          'id, order_id, sender_id, body, created_at, read_at'
        )
        .single();

      if (sendError) throw sendError;

      if (data) {
        setMessageMap((current) => {
          const key = String(selectedOrder.id);
          const currentThread = current[key] || [];

          if (
            currentThread.some(
              (item) =>
                String(item.id) ===
                String(data.id)
            )
          ) {
            return current;
          }

          return {
            ...current,
            [key]: [...currentThread, data]
          };
        });
      }

      setText('');
    } catch (sendError) {
      console.error(
        'Admin message send error:',
        sendError
      );

      setError(
        sendError?.message ||
        'Message could not be sent.'
      );
    } finally {
      setSending(false);
    }
  }

  function selectOrder(orderId) {
    setSelectedOrderId(orderId);
    setText('');
    setError('');
  }

  function getOrderLabel(order) {
    const service = order.service_name || 'Careerlyst service';
    const packageName = order.package_name
      ? ` · ${order.package_name}`
      : '';

    return `${service}${packageName}`;
  }

  return (
    <DashboardShell admin>
      <main className="admin-messages-page">
        <header className="admin-messages-head">
          <div>
            <p className="eyebrow">ADMIN</p>
            <h1>Messages</h1>
            <p>
              Conversations organized by client and project.
            </p>
          </div>

          <div className="admin-messages-head-actions">
            <div className="admin-messages-notification-wrap">
              <button
                type="button"
                className="admin-messages-notification-button"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-label={`Notifications${unreadTotal ? `, ${unreadTotal} unread` : ''}`}
                aria-expanded={notificationsOpen}
              >
                <span className="admin-messages-notification-icon" aria-hidden="true">🔔</span>
                {unreadTotal > 0 && <b>{unreadTotal > 99 ? '99+' : unreadTotal}</b>}
              </button>
              {notificationsOpen && (
                <div className="admin-messages-notification-panel">
                  <div className="admin-messages-notification-head">
                    <strong>Notifications</strong>
                    <span>{unreadTotal} unread</span>
                  </div>
                  {!notifications.length ? (
                    <div className="admin-messages-notification-empty">No unread client messages.</div>
                  ) : notifications.map((notification) => (
                    <button
                      type="button"
                      className="admin-messages-notification-item"
                      key={`${notification.order.id}-${notification.latest.id}`}
                      onClick={() => {
                        selectOrder(notification.order.id);
                        setNotificationsOpen(false);
                      }}
                    >
                      <span className="admin-messages-notification-dot" />
                      <span>
                        <strong>{notification.clientName}</strong>
                        <small>Order #{notification.order.id} · {notification.latest.body || 'New message'}</small>
                      </span>
                      <b>{notification.unread}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className={`admin-messages-live ${connection}`}>
              <i />
              {connection === 'online' ? 'LIVE' : connection === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
            </span>
          </div>
        </header>

        {error && (
          <div
            className="admin-messages-error"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {messageToast && (
          <button
            type="button"
            className="admin-messages-toast"
            onClick={() => {
              selectOrder(messageToast.orderId);
              setNotificationsOpen(false);
              setMessageToast(null);
            }}
          >
            <span className="admin-messages-toast-icon">●</span>
            <span className="admin-messages-toast-copy">
              <strong>New message from {messageToast.clientName}</strong>
              <small>Order #{messageToast.orderId} · {messageToast.preview}</small>
            </span>
            <span className="admin-messages-toast-close" aria-hidden="true">×</span>
          </button>
        )}

        <section className="admin-messages-shell panel">
          <aside className="admin-messages-inbox">
            <div className="admin-messages-inbox-head">
              <div>
                <span>CLIENTS</span>
                <strong>{groupedClients.length}</strong>
              </div>

              <small>
                {visibleOrderCount} project
                {visibleOrderCount === 1 ? '' : 's'}
              </small>
            </div>

            <label className="admin-messages-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search clients or projects…"
              />
            </label>

            <div className="admin-messages-client-list">
              {loading ? (
                <div className="admin-messages-empty-list">
                  Loading clients…
                </div>
              ) : !groupedClients.length ? (
                <div className="admin-messages-empty-list">
                  No matching clients.
                </div>
              ) : (
                groupedClients.map((group) => (
                  <section
                    className="admin-client-group"
                    key={String(group.userId)}
                  >
                    <div className="admin-client-group-head">
                      <div className="admin-client-group-identity">
                        <span className="admin-client-group-avatar">
                          {group.clientName
                            .charAt(0)
                            .toUpperCase()}
                        </span>

                        <div>
                          <strong>{group.clientName}</strong>
                          <small>
                            {group.orders.length} project
                            {group.orders.length === 1
                              ? ''
                              : 's'}
                          </small>
                        </div>
                      </div>

                      {group.unread > 0 && (
                        <span className="admin-client-group-unread">
                          {group.unread}
                        </span>
                      )}
                    </div>

                    <div className="admin-client-projects">
                      {group.orders.map(({ order, last, unread }) => {
                        const active =
                          String(order.id) ===
                          String(selectedOrderId);

                        return (
                          <button
                            className={`admin-client-project ${active ? 'is-active' : ''}`}
                            type="button"
                            key={order.id}
                            onClick={() =>
                              selectOrder(order.id)
                            }
                          >
                            <span className="admin-client-project-copy">
                              <span className="admin-client-project-top">
                                <small>
                                  ORDER #{order.id}
                                </small>
                                <small>
                                  {last
                                    ? formatMessageTime(
                                        last.created_at
                                      )
                                    : formatOrderDate(
                                        order.created_at
                                      )}
                                </small>
                              </span>

                              <strong>
                                {getOrderLabel(order)}
                              </strong>

                              <span>
                                {last?.body ||
                                  'No messages yet — start the conversation.'}
                              </span>
                            </span>

                            {unread > 0 && (
                              <b>{unread}</b>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </aside>

          <section className="admin-messages-conversation">
            {!selectedOrder ? (
              <div className="admin-messages-no-selection">
                <span className="admin-messages-no-selection-number">
                  01
                </span>
                <h2>Select a project.</h2>
                <p>
                  Choose a project under a client to open
                  the conversation.
                </p>
              </div>
            ) : (
              <>
                <header className="admin-messages-conversation-head">
                  <div className="admin-messages-client">
                    <span className="admin-messages-client-avatar">
                      {(profiles[selectedOrder.user_id]?.name ||
                        'Client')
                        .charAt(0)
                        .toUpperCase()}
                    </span>

                    <div>
                      <strong>
                        {profiles[selectedOrder.user_id]?.name ||
                          'Client'}
                      </strong>
                      <span>
                        Order #{selectedOrder.id} ·{' '}
                        {getOrderLabel(selectedOrder)}
                      </span>
                    </div>
                  </div>

                  <div className="admin-messages-conversation-meta">
                    <span>
                      {String(
                        selectedOrder.status || 'pending'
                      ).replace(/_/g, ' ')}
                    </span>
                    <Link to="/admin/workspace">
                      Open workspace →
                    </Link>
                  </div>
                </header>

                <div className="admin-messages-thread-body">
                  <div className="admin-messages-system-note">
                    This conversation is shared with the client
                    in their Careerlyst dashboard.
                  </div>

                  {!selectedMessages.length ? (
                    <div className="admin-messages-empty-thread">
                      <span>NO MESSAGES YET</span>
                      <h2>Start the project conversation.</h2>
                      <p>
                        Send the first update, question or
                        next-step instruction to the client.
                      </p>
                    </div>
                  ) : (
                    selectedMessages.map((message) => {
                      const isTeam =
                        String(message.sender_id) ===
                        String(staffUserId);

                      return (
                        <div
                          className={`admin-message-row ${isTeam ? 'is-team' : 'is-client'}`}
                          key={message.id}
                        >
                          <div className="admin-message-bubble">
                            <p>{message.body}</p>
                            <small>
                              {isTeam
                                ? 'Careerlyst Team'
                                : profiles[
                                    selectedOrder.user_id
                                  ]?.name || 'Client'}
                              {' · '}
                              {formatMessageTime(
                                message.created_at
                              )}
                            </small>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {staffRole === 'finance' && (
                  <div className="admin-messages-read-only" role="status">
                    Finance has read-only access to client conversations.
                  </div>
                )}

                <form
                  className="admin-messages-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    sendMessage();
                  }}
                >
                  <textarea
                    value={text}
                    onChange={(event) =>
                      setText(event.target.value)
                    }
                    onKeyDown={handleComposerKeyDown}
                    placeholder={`Write to ${profiles[selectedOrder.user_id]?.name || 'your client'}…`}
                    maxLength={2000}
                    rows="2"
                    disabled={sending || staffRole === 'finance'}
                  />

                  <div className="admin-messages-composer-bottom">
                    <span>
                      Enter to send · Shift + Enter for a new
                      line · {text.length}/2000
                    </span>

                    <button
                      className="btn dark"
                      type="submit"
                      disabled={
                        sending || staffRole === 'finance' || !text.trim()
                      }
                    >
                      {sending ? 'Sending…' : 'Send ↗'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </section>
      </main>
    </DashboardShell>
  );
}

export function AdminMessages() {
  return <AdminMessagesPage />;
}


export function AdminFiles() {
  return (
    <AdminList
      title="Files"
      kind="files"
    />
  );
}


/* =========================================================
   SIMPLE ADMIN MODULE
   ========================================================= */

export function AdminSimple({
  title
}) {

  return (
    <DashboardShell admin>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            ADMIN
          </p>

          <h1>
            {title}
          </h1>

        </div>

      </div>


      <div className="panel">

        <div className="empty">

          <h3>
            {title}
          </h3>

          <p>
            This module is wired into the admin
            navigation and ready for your production
            database.
          </p>

        </div>

      </div>

    </DashboardShell>
  );
}


/* =========================================================
   ADMIN LOGIN
   ========================================================= */

function AdminLogin() {

  const navigate = useNavigate();

  const [
    email,
    setEmail
  ] = useState('');

  const [
    password,
    setPassword
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    error,
    setError
  ] = useState('');

  const [
    showPassword,
    setShowPassword
  ] = useState(false);


  async function handleLogin(e) {

    e.preventDefault();

    setError('');

    if (!email.trim() || !password) {
      setError(
        'Please enter your email and password.'
      );
      return;
    }


    if (!supabase) {
      setError(
        'Supabase is not configured.'
      );
      return;
    }


    setLoading(true);


    try {

      /* ---------------------------------------------
         STEP 1 — SUPABASE AUTH
      --------------------------------------------- */

      const {
        data,
        error: loginError
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });


      if (loginError) {
        throw loginError;
      }


      const user = data?.user;


      if (!user) {
        throw new Error(
          'Unable to sign in.'
        );
      }


      /* ---------------------------------------------
         STEP 2 — CHECK STAFF ROLE
      --------------------------------------------- */

      const {
        data: roleRow,
        error: roleError
      } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();


      if (roleError) {
        throw roleError;
      }


      const role =
        roleRow?.role;


      /* ---------------------------------------------
         NOT STAFF
      --------------------------------------------- */

      if (!STAFF_ROLES.includes(role)) {

        await supabase.auth.signOut();

        setError(
          'This account does not have admin access.'
        );

        return;
      }


      /* ---------------------------------------------
         SUCCESS
      --------------------------------------------- */

      navigate(
        '/admin/workspace',
        { replace: true }
      );

    } catch (err) {

      console.error(
        'Admin login error:',
        err
      );

      setError(
        err?.message ||
        'Unable to sign in. Please check your credentials.'
      );

    } finally {

      setLoading(false);

    }
  }


  return (

    <div className="auth">

      <div className="auth-card">

        <Logo />


        <div
          style={{
            marginTop: 32
          }}
        >

          <p className="eyebrow">
            STAFF ACCESS
          </p>

          <h1>
            Welcome back.
          </h1>

          <p className="muted">
            Sign in to access the Careerlyst
            operations workspace.
          </p>

        </div>


        <form
          onSubmit={handleLogin}
          style={{
            marginTop: 28
          }}
        >


          {/* EMAIL */}

          <label
            style={{
              display: 'block',
              marginBottom: 18
            }}
          >

            <span
              style={{
                display: 'block',
                marginBottom: 7,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Work email
            </span>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@careerlyst.com"
              autoComplete="email"
              disabled={loading}
              style={{
                width: '100%'
              }}
            />

          </label>


          {/* PASSWORD */}

          <label
            style={{
              display: 'block',
              marginBottom: 18
            }}
          >

            <span
              style={{
                display: 'block',
                marginBottom: 7,
                fontSize: 13,
                fontWeight: 600
              }}
            >
              Password
            </span>


            <div
              style={{
                position: 'relative'
              }}
            >

              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: '100%',
                  paddingRight: 72
                }}
              />


              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                {showPassword
                  ? 'Hide'
                  : 'Show'}
              </button>

            </div>

          </label>


          {/* ERROR */}

          {error && (

            <div
              style={{
                marginBottom: 18,
                padding: '12px 14px',
                border: '1px solid rgba(180, 40, 40, .25)',
                background: 'rgba(180, 40, 40, .06)',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.5
              }}
            >
              {error}
            </div>

          )}


          {/* SUBMIT */}

          <button
            type="submit"
            className="btn dark full"
            disabled={loading}
          >

            {loading
              ? 'Signing in...'
              : 'Sign in to workspace →'}

          </button>


        </form>


        <p
          className="muted"
          style={{
            marginTop: 20,
            fontSize: 12,
            lineHeight: 1.6
          }}
        >
          Staff accounts are managed through
          Careerlyst's secure authentication system.
        </p>

      </div>

    </div>

  );
}


/* =========================================================
   ADMIN GATE
   ========================================================= */

export function AdminGate() {

  const [
    checking,
    setChecking
  ] = useState(true);

  const [
    authorized,
    setAuthorized
  ] = useState(false);


  useEffect(() => {

    let mounted = true;


    async function checkAdmin() {

      /* ---------------------------------------------
         NO SUPABASE
      --------------------------------------------- */

      if (!supabase) {

        if (mounted) {
          setChecking(false);
          setAuthorized(false);
        }

        return;
      }


      try {

        /* -------------------------------------------
           CHECK AUTH SESSION
        ------------------------------------------- */

        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();


        if (!session?.user) {

          if (mounted) {
            setAuthorized(false);
            setChecking(false);
          }

          return;
        }


        /* -------------------------------------------
           CHECK ROLE
        ------------------------------------------- */

        const {
          data: roleRow,
          error
        } = await supabase
          .from('user_roles')
          .select('role')
          .eq(
            'user_id',
            session.user.id
          )
          .maybeSingle();


        if (error) {
          throw error;
        }


        const role =
          roleRow?.role;


        if (mounted) {

          setAuthorized(
            STAFF_ROLES.includes(role)
          );

          setChecking(false);

        }

      } catch (err) {

        console.error(
          'Admin authorization error:',
          err
        );

        if (mounted) {

          setAuthorized(false);
          setChecking(false);

        }

      }

    }


    checkAdmin();


    return () => {
      mounted = false;
    };

  }, []);


  /* -----------------------------------------------
     LOADING
  ------------------------------------------------ */

  if (checking) {

    return (

      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f5f4ee',
          color: '#11120f',
          fontFamily:
            'DM Sans, sans-serif'
        }}
      >

        Checking staff access...

      </div>

    );

  }


  /* -----------------------------------------------
     NOT AUTHORIZED
  ------------------------------------------------ */

  if (!authorized) {
    return <AdminLogin />;
  }


  /* -----------------------------------------------
     AUTHORIZED
  ------------------------------------------------ */

  return (
    <AdminOverview />
  );

}


/* =========================================================
   LOGO
   ========================================================= */

function Logo() {

  return (

    <a
      className="logo"
      href="/"
    >

      <span className="logo-mark">

        <i />
        <i />
        <i />

      </span>

      <span>
        Careerlyst
      </span>

    </a>

  );
}


/* =========================================================
   PHASE 1H — TEAM WORKSPACE
   ========================================================= */


export {
  default as AdminWorkspace
} from './AdminWorkspace';
