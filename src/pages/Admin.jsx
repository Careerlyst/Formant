import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Link,
  useNavigate
} from 'react-router-dom';

import AdminProjectsPage from './AdminProjects';
import AdminServicesPage from './AdminServices';

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
    const ACTIVE_STATUSES = [
      'pending',
      'information_required',
      'queued',
      'in_progress',
      'internal_review',
      'client_review',
      'revision'
    ];

    const COMPLETED_STATUSES = ['completed', 'cancelled', 'canceled'];
    const ACTIVE_CAPACITY = 2;

    const [orders, setOrders] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [unreadMessages, setUnreadMessages] = useState([]);
    const [userCount, setUserCount] = useState(0);
    const [loading, setLoading] = useState(Boolean(supabase));
    const [error, setError] = useState('');

    useEffect(() => {
      let mounted = true;

      async function loadOverview() {
        if (!supabase) {
          if (mounted) {
            setLoading(false);
            setError('Supabase is not configured.');
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

          const [
            ordersResult,
            usersResult
          ] = await Promise.all([
            supabase
              .from('orders')
              .select(
                'id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, created_at, updated_at'
              )
              .order('updated_at', { ascending: false }),
            supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
          ]);

          if (ordersResult.error) throw ordersResult.error;

          const nextOrders = ordersResult.data || [];

          if (usersResult.error) {
            console.warn('Admin user count error:', usersResult.error);
          }

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

            nextProfiles = Object.fromEntries(
              (profileData || []).map((profile) => [
                profile.id,
                profile
              ])
            );
          }

          let nextUnreadMessages = [];

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
              .order('created_at', { ascending: false });

            if (messageError) throw messageError;

            const orderById = Object.fromEntries(
              nextOrders.map((order) => [
                String(order.id),
                order
              ])
            );

            nextUnreadMessages = (messageData || [])
              .filter((message) => {
                const order =
                  orderById[String(message.order_id)];

                return (
                  order &&
                  String(message.sender_id) ===
                    String(order.user_id) &&
                  !message.read_at
                );
              })
              .map((message) => ({
                ...message,
                clientName:
                  nextProfiles[orderById[String(message.order_id)]?.user_id]
                    ?.name || 'Client',
                order:
                  orderById[String(message.order_id)]
              }))
              .sort(
                (a, b) =>
                  new Date(b.created_at || 0).getTime() -
                  new Date(a.created_at || 0).getTime()
              );
          }

          if (!mounted) return;

          setOrders(nextOrders);
          setProfiles(nextProfiles);
          setUnreadMessages(nextUnreadMessages);
          setUserCount(usersResult.count || 0);
        } catch (loadError) {
          console.error(
            'Admin overview load error:',
            loadError
          );

          if (mounted) {
            setError(
              loadError?.message ||
                'Could not load the operations overview.'
            );
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }

      loadOverview();

      return () => {
        mounted = false;
      };
    }, []);

    const activeOrders = orders.filter((order) =>
      ACTIVE_STATUSES.includes(
        String(order.status || 'pending').toLowerCase()
      )
    );

    const queuedOrders = orders.filter(
      (order) =>
        String(order.status || '').toLowerCase() === 'queued'
    );

    const attentionOrders = orders.filter((order) => {
      const status = String(
        order.status || 'pending'
      ).toLowerCase();

      return (
        !COMPLETED_STATUSES.includes(status) &&
        (
          status === 'information_required' ||
          status === 'pending' ||
          String(order.payment_status || '').toLowerCase() !== 'paid'
        )
      );
    });

    const activeCount = activeOrders.length;
    const capacityUsed = Math.min(
      activeCount,
      ACTIVE_CAPACITY
    );
    const capacityPercent = Math.min(
      100,
      Math.round(
        (activeCount / ACTIVE_CAPACITY) * 100
      )
    );

    const recentOrders = [...orders]
      .sort((a, b) => {
        const aTime = new Date(
          a.updated_at ||
            a.created_at ||
            0
        ).getTime();

        const bTime = new Date(
          b.updated_at ||
            b.created_at ||
            0
        ).getTime();

        return bTime - aTime;
      })
      .slice(0, 5);

    const messageSnapshot = unreadMessages.slice(0, 4);

    const paidOrders = orders.filter(
      (order) =>
        String(order.payment_status || '').toLowerCase() ===
        'paid'
    );

    const pendingPaymentOrders = orders.filter(
      (order) =>
        !COMPLETED_STATUSES.includes(
          String(order.status || '').toLowerCase()
        ) &&
        String(order.payment_status || '').toLowerCase() !==
          'paid'
    );

    const revenue = paidOrders.reduce(
      (sum, order) =>
        sum +
        (Number.isFinite(Number(order.total))
          ? Number(order.total)
          : 0),
      0
    );

    const pendingRevenue = pendingPaymentOrders.reduce(
      (sum, order) =>
        sum +
        (Number.isFinite(Number(order.total))
          ? Number(order.total)
          : 0),
      0
    );

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const ordersLast7Days = orders.filter(
      (order) =>
        now -
          new Date(
            order.created_at || 0
          ).getTime() <=
        7 * dayMs
    ).length;

    const ordersLast30Days = orders.filter(
      (order) =>
        now -
          new Date(
            order.created_at || 0
          ).getTime() <=
        30 * dayMs
    ).length;

    const completedLast30Days = orders.filter(
      (order) =>
        String(order.status || '').toLowerCase() ===
          'completed' &&
        now -
          new Date(
            order.updated_at ||
              order.created_at ||
              0
          ).getTime() <=
          30 * dayMs
    ).length;

    function formatStatus(status) {
      return String(status || 'pending')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
    }

    function formatTime(value) {
      if (!value) return 'Recently';

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return 'Recently';
      }

      const diff = Date.now() - date.getTime();
      const minutes = Math.floor(
        diff / 60000
      );
      const hours = Math.floor(
        minutes / 60
      );
      const days = Math.floor(
        hours / 24
      );

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;

      return new Intl.DateTimeFormat(
        'en-US',
        {
          month: 'short',
          day: 'numeric'
        }
      ).format(date);
    }

    function formatMoney(value, currency = 'USD') {
      const amount = Number(value);

      if (!Number.isFinite(amount)) {
        return '—';
      }

      try {
        return new Intl.NumberFormat(
          'en-US',
          {
            style: 'currency',
            currency: currency || 'USD',
            maximumFractionDigits: 2
          }
        ).format(amount);
      } catch {
        return `${amount} ${currency || 'USD'}`;
      }
    }

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

        {error && (
          <div
            className="team-error"
            role="alert"
          >
            <strong>Overview error</strong>
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Dismiss overview error"
            >
              ×
            </button>
          </div>
        )}

        {/* =====================================================
            CORE STATS
        ===================================================== */}

        <div className="stats">

          <div className="stat">
            <span>Active projects</span>
            <b>
              {loading
                ? '—'
                : `${capacityUsed} / ${ACTIVE_CAPACITY}`}
            </b>
          </div>

          <div className="stat">
            <span>Queue</span>
            <b>
              {loading
                ? '—'
                : queuedOrders.length}
            </b>
          </div>

          <div className="stat">
            <span>Users</span>
            <b>
              {loading
                ? '—'
                : userCount}
            </b>
          </div>

          <div className="stat">
            <span>Unread messages</span>
            <b>
              {loading
                ? '—'
                : unreadMessages.length}
            </b>
          </div>

        </div>

        {/* =====================================================
            CAPACITY
        ===================================================== */}

        <section className="admin-capacity panel">

          <div>

            <p className="eyebrow">
              CAPACITY
            </p>

            <h2>
              {loading
                ? 'Loading capacity…'
                : `${capacityUsed} of ${ACTIVE_CAPACITY} active slots used`}
            </h2>

            <p>
              {loading
                ? 'Checking the current project queue.'
                : queuedOrders.length
                  ? `${queuedOrders.length} order${queuedOrders.length === 1 ? '' : 's'} waiting in the queue.`
                  : 'No orders are currently waiting for capacity.'}
            </p>

          </div>

          <div
            className="capacity-bar"
            aria-label={`${capacityPercent}% capacity used`}
          >
            <i
              style={{
                width: `${
                  loading
                    ? 0
                    : capacityPercent
                }%`
              }}
            />
          </div>

        </section>

        {/* =====================================================
            NEEDS ATTENTION
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Needs attention
            </h2>

            <Link to="/admin/orders">
              View orders →
            </Link>

          </div>

          {loading ? (
            <div className="empty">
              <h3>Checking attention items…</h3>
              <p>Reviewing active orders and payment status.</p>
            </div>
          ) : (
            <>
              {unreadMessages.length > 0 && (
                <div className="admin-order">
                  <b>
                    {unreadMessages.length}
                  </b>

                  <span>
                    Unread client message
                    {unreadMessages.length === 1
                      ? ''
                      : 's'}
                  </span>

                  <span className="status">
                    Needs reply
                  </span>

                  <Link
                    className="text-button"
                    to="/admin/messages"
                  >
                    Open messages →
                  </Link>
                </div>
              )}

              {queuedOrders.length > 0 && (
                <div className="admin-order">
                  <b>
                    {queuedOrders.length}
                  </b>

                  <span>
                    Order
                    {queuedOrders.length === 1
                      ? ''
                      : 's'} waiting for capacity
                  </span>

                  <span className="status">
                    Queued
                  </span>

                  <Link
                    className="text-button"
                    to="/admin/orders"
                  >
                    Review queue →
                  </Link>
                </div>
              )}

              {attentionOrders
                .filter(
                  (order) =>
                    String(
                      order.status || ''
                    ).toLowerCase() ===
                    'information_required'
                )
                .slice(0, 3)
                .map((order) => (
                  <div
                    className="admin-order"
                    key={`brief-${order.id}`}
                  >
                    <b>
                      #{order.id}
                    </b>

                    <span>
                      Information required
                    </span>

                    <span className="status">
                      Waiting
                    </span>

                    <span>
                      {profiles[
                        order.user_id
                      ]?.name || 'Client'}
                    </span>
                  </div>
                ))}

              {pendingPaymentOrders
                .slice(0, 3)
                .map((order) => (
                  <div
                    className="admin-order"
                    key={`payment-${order.id}`}
                  >
                    <b>
                      #{order.id}
                    </b>

                    <span>
                      Payment pending
                    </span>

                    <span className="status">
                      {formatMoney(
                        order.total,
                        order.currency
                      )}
                    </span>

                    <span>
                      {profiles[
                        order.user_id
                      ]?.name || 'Client'}
                    </span>
                  </div>
                ))}

              {!unreadMessages.length &&
                !queuedOrders.length &&
                !attentionOrders.length && (
                  <div className="empty">
                    <h3>
                      Nothing needs attention.
                    </h3>

                    <p>
                      Your current operations queue looks clear.
                    </p>
                  </div>
                )}
            </>
          )}

        </section>

        {/* =====================================================
            ACTIVE ORDERS
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Active orders
            </h2>

            <Link to="/admin/orders">
              Manage →
            </Link>

          </div>

          {loading ? (
            <div className="empty">
              <h3>
                Loading active orders…
              </h3>

              <p>
                Fetching the latest orders from Supabase.
              </p>
            </div>
          ) : !activeOrders.length ? (
            <div className="empty">
              <h3>
                No active orders.
              </h3>

              <p>
                New orders will appear here when work enters the active queue.
              </p>
            </div>
          ) : (
            activeOrders
              .slice(0, 5)
              .map((order) => (
                <div
                  className="admin-order"
                  key={order.id}
                >

                  <b>
                    #{order.id}
                  </b>

                  <span>
                    {order.service_name ||
                      'Careerlyst service'}
                    {order.package_name
                      ? ` · ${order.package_name}`
                      : ''}
                  </span>

                  <span className="status">
                    {formatStatus(
                      order.status
                    )}
                  </span>

                  <span>
                    Client:{' '}
                    {profiles[
                      order.user_id
                    ]?.name || 'Client'}
                  </span>

                </div>
              ))
          )}

        </section>

        {/* =====================================================
            RECENT ACTIVITY
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Recent activity
            </h2>

            <Link to="/admin/orders">
              View orders →
            </Link>

          </div>

          {loading ? (
            <div className="empty">
              <h3>
                Loading activity…
              </h3>
            </div>
          ) : !recentOrders.length ? (
            <div className="empty">
              <h3>
                No recent activity.
              </h3>

              <p>
                Order activity will appear here as new work arrives.
              </p>
            </div>
          ) : (
            recentOrders.map((order) => (
              <div
                className="admin-order"
                key={`activity-${order.id}`}
              >

                <b>
                  #{order.id}
                </b>

                <span>
                  {order.service_name ||
                    'Careerlyst service'}
                </span>

                <span className="status">
                  {formatStatus(
                    order.status
                  )}
                </span>

                <span>
                  {profiles[
                    order.user_id
                  ]?.name || 'Client'}{' '}
                  ·{' '}
                  {formatTime(
                    order.updated_at ||
                      order.created_at
                  )}
                </span>

              </div>
            ))
          )}

        </section>

        {/* =====================================================
            MESSAGE SNAPSHOT
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Messages
            </h2>

            <Link to="/admin/messages">
              View all →
            </Link>

          </div>

          {loading ? (
            <div className="empty">
              <h3>
                Loading messages…
              </h3>
            </div>
          ) : !messageSnapshot.length ? (
            <div className="empty">
              <h3>
                No unread client messages.
              </h3>

              <p>
                The team inbox is clear.
              </p>
            </div>
          ) : (
            messageSnapshot.map((message) => (
              <div
                className="admin-order"
                key={`message-${message.id}`}
              >

                <b>
                  #{message.order_id}
                </b>

                <span>
                  {message.clientName}
                </span>

                <span>
                  {String(
                    message.body || ''
                  ).slice(0, 80) ||
                    'New message'}
                </span>

                <span className="status">
                  {formatTime(
                    message.created_at
                  )}
                </span>

              </div>
            ))
          )}

        </section>

        {/* =====================================================
            PAYMENT SNAPSHOT
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Payments
            </h2>

            <Link to="/admin/payments">
              View payments →
            </Link>

          </div>

          <div className="stats">

            <div className="stat">
              <span>Paid orders</span>
              <b>
                {loading
                  ? '—'
                  : paidOrders.length}
              </b>
            </div>

            <div className="stat">
              <span>Paid value</span>
              <b>
                {loading
                  ? '—'
                  : formatMoney(
                      revenue,
                      paidOrders[0]?.currency ||
                        'USD'
                    )}
              </b>
            </div>

            <div className="stat">
              <span>Pending</span>
              <b>
                {loading
                  ? '—'
                  : pendingPaymentOrders.length}
              </b>
            </div>

            <div className="stat">
              <span>Pending value</span>
              <b>
                {loading
                  ? '—'
                  : formatMoney(
                      pendingRevenue,
                      pendingPaymentOrders[0]
                        ?.currency || 'USD'
                    )}
              </b>
            </div>

          </div>

          <div className="empty">
            <p>
              Payment totals are calculated from the current order payment status.
              Gateway transaction details remain in the Payments module.
            </p>
          </div>

        </section>

        {/* =====================================================
            USER SNAPSHOT
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Users
            </h2>

            <Link to="/admin/users">
              Manage users →
            </Link>

          </div>

          <div className="admin-order">

            <b>
              {loading
                ? '—'
                : userCount}
            </b>

            <span>
              Total registered users
            </span>

            <span className="status">
              Accounts
            </span>

            <span>
              Profile records currently available
            </span>

          </div>

        </section>

        {/* =====================================================
            PERFORMANCE SNAPSHOT
        ===================================================== */}

        <section className="panel">

          <div className="panel-head">

            <h2>
              Performance snapshot
            </h2>

            <Link to="/admin/orders">
              View orders →
            </Link>

          </div>

          <div className="stats">

            <div className="stat">
              <span>Orders · 7 days</span>
              <b>
                {loading
                  ? '—'
                  : ordersLast7Days}
              </b>
            </div>

            <div className="stat">
              <span>Orders · 30 days</span>
              <b>
                {loading
                  ? '—'
                  : ordersLast30Days}
              </b>
            </div>

            <div className="stat">
              <span>Completed · 30 days</span>
              <b>
                {loading
                  ? '—'
                  : completedLast30Days}
              </b>
            </div>

            <div className="stat">
              <span>Completion rate</span>
              <b>
                {loading
                  ? '—'
                  : ordersLast30Days
                    ? `${Math.round(
                        (completedLast30Days /
                          ordersLast30Days) *
                          100
                      )}%`
                    : '0%'}
              </b>
            </div>

          </div>

          <div className="empty">
            <p>
              The snapshot uses real order timestamps and status data.
              A visual historical chart can be added later without changing the order workflow.
            </p>
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
    const isOrders = kind === 'orders';
    const [orders, setOrders] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [loading, setLoading] = useState(isOrders);
    const [error, setError] = useState('');
    const [savingId, setSavingId] = useState(null);
    const [connection, setConnection] = useState('connecting');

    async function loadOrders() {
      if (!isOrders) return;
      setLoading(true);
      setError('');

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const staffUserId = sessionData?.session?.user?.id;
        if (!staffUserId) throw new Error('You must be signed in to view admin orders.');

        const { data: roleRows, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', staffUserId);
        if (roleError) throw roleError;
        const allowed = (roleRows || []).some((row) =>
          ['admin', 'expert', 'support', 'finance'].includes(String(row.role).toLowerCase())
        );
        if (!allowed) throw new Error('You do not have permission to view admin orders.');

        const { data: orderRows, error: ordersError } = await supabase
          .from('orders')
          .select('id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, client_notes, created_at, updated_at')
          .order('created_at', { ascending: false });
        if (ordersError) throw ordersError;

        const rows = orderRows || [];
        const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
        let profileMap = {};

        if (userIds.length) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email')
            .in('id', userIds);
          if (profileError) throw profileError;
          profileMap = Object.fromEntries((profileRows || []).map((row) => [row.id, row]));
        }

        setOrders(rows);
        setProfiles(profileMap);
        setSelectedOrder((current) => {
          if (!current) return null;
          return rows.find((row) => String(row.id) === String(current.id)) || null;
        });
      } catch (err) {
        setError(err?.message || 'Unable to load orders.');
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      if (!isOrders) return undefined;
      loadOrders();

      const channel = supabase
        .channel('admin-orders-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          setOrders((current) => {
            if (payload.eventType === 'INSERT') {
              if (current.some((row) => String(row.id) === String(payload.new.id))) return current;
              return [payload.new, ...current];
            }
            if (payload.eventType === 'UPDATE') {
              return current.map((row) =>
                String(row.id) === String(payload.new.id) ? { ...row, ...payload.new } : row
              );
            }
            if (payload.eventType === 'DELETE') {
              return current.filter((row) => String(row.id) !== String(payload.old.id));
            }
            return current;
          });
          setSelectedOrder((current) => {
            if (!current) return null;
            if (payload.eventType === 'DELETE' && String(current.id) === String(payload.old.id)) return null;
            if (String(current.id) === String(payload.new?.id)) return { ...current, ...payload.new };
            return current;
          });
        })
        .subscribe((status) => setConnection(status));

      return () => {
        supabase.removeChannel(channel);
      };
    }, [isOrders]);

    async function updateOrderStatus(orderId, nextStatus) {
      if (!isOrders || !orderId || !nextStatus) return;
      setSavingId(orderId);
      setError('');
      try {
        const { data, error: updateError } = await supabase
          .from('orders')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', orderId)
          .select('id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, client_notes, created_at, updated_at')
          .single();
        if (updateError) throw updateError;
        setOrders((current) => current.map((row) => String(row.id) === String(orderId) ? { ...row, ...data } : row));
        setSelectedOrder((current) => current && String(current.id) === String(orderId) ? { ...current, ...data } : current);
      } catch (err) {
        setError(err?.message || 'Unable to update order status.');
        await loadOrders();
      } finally {
        setSavingId(null);
      }
    }

    const filteredOrders = orders.filter((order) => {
      const q = search.trim().toLowerCase();
      const client = profiles[order.user_id] || {};
      const haystack = [
        order.id,
        order.service_name,
        order.package_name,
        order.status,
        order.payment_status,
        client.name,
        client.email,
      ].filter(Boolean).join(' ').toLowerCase();

      return (!q || haystack.includes(q))
        && (statusFilter === 'all' || String(order.status || '').toLowerCase() === statusFilter)
        && (paymentFilter === 'all' || String(order.payment_status || '').toLowerCase() === paymentFilter);
    });

    const activeCount = orders.filter((order) => !['completed', 'cancelled'].includes(String(order.status || '').toLowerCase())).length;
    const queuedCount = orders.filter((order) => String(order.status || '').toLowerCase() === 'queued').length;
    const paidCount = orders.filter((order) => String(order.payment_status || '').toLowerCase() === 'paid').length;
    const pendingPaymentCount = orders.length - paidCount;

    if (!isOrders) {
      return (
        <DashboardShell admin>
          <div className="dash-head"><div><p className="eyebrow">ADMIN</p><h1>{title}</h1></div></div>
          <div className="panel table-panel">
            {kind === 'projects' && <div className="empty"><h3>Project workspaces</h3><p>Each active order can have an internal workspace, assigned expert, milestones and review notes.</p><Link className="btn dark" to="/admin/workspace">Open team workspace →</Link></div>}
            {kind === 'payments' && <div className="empty"><h3>Payment ledger</h3><p>Payment status is available from live orders. Connect a payment provider transaction ledger when you are ready to expose gateway-level records.</p><Link className="btn dark" to="/admin/orders">Review orders →</Link></div>}
            {kind === 'messages' && <div className="empty"><h3>Team inbox</h3><p>Customer conversations from all active projects appear here.</p><Link className="btn dark" to="/admin/messages">Open messages →</Link></div>}
            {kind === 'files' && <div className="empty"><h3>Client files</h3><p>Files are organized by customer and order.</p><Link className="btn dark" to="/admin/workspace">Open team workspace →</Link></div>}
          </div>
        </DashboardShell>
      );
    }

    return (
      <DashboardShell admin>
        <div className="dash-head admin-orders-head">
          <div>
            <p className="eyebrow">ADMIN · ORDERS</p>
            <h1>Orders & queue.</h1>
            <p>Manage live client orders, queue position, payment state and project status.</p>
          </div>
          <div className="admin-orders-connection">● {connection === 'SUBSCRIBED' ? 'Live' : connection === 'CHANNEL_ERROR' ? 'Connection error' : 'Connecting…'}</div>
        </div>

        <div className="admin-orders-stats">
          <div className="stat"><span>Total orders</span><b>{orders.length}</b></div>
          <div className="stat"><span>Active</span><b>{activeCount}</b></div>
          <div className="stat"><span>Queued</span><b>{queuedCount}</b></div>
          <div className="stat"><span>Paid</span><b>{paidCount}</b></div>
          <div className="stat"><span>Payment pending</span><b>{pendingPaymentCount}</b></div>
        </div>

        <div className="panel admin-orders-toolbar">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, client, service…" aria-label="Search orders" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter order status">
            <option value="all">All statuses</option>
            <option value="queued">Queued</option>
            <option value="in_progress">In progress</option>
            <option value="information_required">Information required</option>
            <option value="client_review">Client review</option>
            <option value="revision">Revision</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} aria-label="Filter payment status">
            <option value="all">All payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <button className="btn light" type="button" onClick={loadOrders} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {error && <div className="admin-orders-error" role="alert">{error}<button type="button" onClick={loadOrders}>Try again</button></div>}

        <div className="panel admin-orders-panel">
          <div className="panel-head"><div><p className="eyebrow">LIVE DIRECTORY</p><h2>{filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}</h2></div><Link to="/admin/workspace">Open workspace →</Link></div>

          {loading ? <div className="admin-orders-empty"><strong>Loading orders…</strong><span>Fetching the current Supabase order queue.</span></div> : !filteredOrders.length ? <div className="admin-orders-empty"><strong>No matching orders.</strong><span>Try changing the search or filters.</span></div> : (
            <div className="admin-orders-list">
              {filteredOrders.map((order) => {
                const client = profiles[order.user_id] || {};
                const status = String(order.status || 'pending');
                const payment = String(order.payment_status || 'pending');
                return (
                  <article className={`admin-order-live ${selectedOrder && String(selectedOrder.id) === String(order.id) ? 'is-selected' : ''}`} key={order.id}>
                    <button className="admin-order-live-main" type="button" onClick={() => setSelectedOrder(order)}>
                      <span className="admin-order-live-id">#{order.id}</span>
                      <span className="admin-order-live-client">{client.name || 'Client'}<small>{client.email || order.user_id || 'No profile email'}</small></span>
                      <span className="admin-order-live-service">{order.service_name || 'Careerlyst service'}<small>{order.package_name || 'Standard package'}</small></span>
                      <span className="admin-order-live-status">{status.replace(/_/g, ' ')}</span>
                      <span className={`admin-order-live-payment ${payment}`}>{payment}</span>
                      <span className="admin-order-live-total">{order.total != null ? new Intl.NumberFormat(undefined, { style: 'currency', currency: order.currency || 'USD' }).format(Number(order.total) || 0) : '—'}</span>
                    </button>
                    <div className="admin-order-live-actions">
                      <select value={status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} disabled={savingId === order.id} aria-label={`Status for order ${order.id}`}>
                        <option value="queued">Queued</option><option value="in_progress">In progress</option><option value="information_required">Information required</option><option value="client_review">Client review</option><option value="revision">Revision</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                      </select>
                      <Link className="text-button" to={`/admin/workspace?order=${encodeURIComponent(order.id)}`}>Workspace →</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="admin-order-drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedOrder(null); }}>
            <aside className="admin-order-drawer" aria-label={`Order ${selectedOrder.id} details`}>
              <div className="admin-order-drawer-head"><div><p className="eyebrow">ORDER #{selectedOrder.id}</p><h2>{selectedOrder.service_name || 'Careerlyst service'}</h2></div><button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details">×</button></div>
              <div className="admin-order-drawer-grid">
                <div><span>Client</span><strong>{profiles[selectedOrder.user_id]?.name || 'Client'}</strong></div>
                <div><span>Package</span><strong>{selectedOrder.package_name || '—'}</strong></div>
                <div><span>Status</span><strong>{String(selectedOrder.status || 'pending').replace(/_/g, ' ')}</strong></div>
                <div><span>Payment</span><strong>{String(selectedOrder.payment_status || 'pending')}</strong></div>
                <div><span>Queue position</span><strong>{selectedOrder.queue_position ?? '—'}</strong></div>
                <div><span>Total</span><strong>{selectedOrder.total != null ? new Intl.NumberFormat(undefined, { style: 'currency', currency: selectedOrder.currency || 'USD' }).format(Number(selectedOrder.total) || 0) : '—'}</strong></div>
                <div><span>Created</span><strong>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString() : '—'}</strong></div>
                <div><span>Updated</span><strong>{selectedOrder.updated_at ? new Date(selectedOrder.updated_at).toLocaleString() : '—'}</strong></div>
              </div>
              <div className="admin-order-drawer-notes"><span>Order notes</span><p>{selectedOrder.client_notes || 'No client notes are available.'}</p></div>
              <div className="admin-order-drawer-actions"><Link className="btn dark" to={`/admin/workspace?order=${encodeURIComponent(selectedOrder.id)}`}>Open workspace →</Link><Link className="btn light" to={`/admin/messages?order=${encodeURIComponent(selectedOrder.id)}`}>Open conversation →</Link></div>
            </aside>
          </div>
        )}
      </DashboardShell>
    );
  }


  /* =========================================================
    ADMIN PAGES
    ========================================================= */

  function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [roles, setRoles] = useState({});
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    async function loadUsers(silent = false) {
      if (!supabase) {
        setError('Supabase is not configured.');
        setLoading(false);
        return;
      }

      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const currentUser = sessionData?.session?.user;
        if (!currentUser) throw new Error('Your session could not be verified. Please sign in again.');

        const { data: currentRole, error: currentRoleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (currentRoleError) throw currentRoleError;
        if (!STAFF_ROLES.includes(currentRole?.role)) {
          throw new Error('This account does not have staff access.');
        }

        // profiles is the application-side user directory. We intentionally
        // do not query auth.users from the browser.
        const [profilesResult, ordersResult, rolesResult] = await Promise.all([
          supabase.from('profiles').select('id, name'),
          supabase
            .from('orders')
            .select('id, user_id, service_name, package_name, status, payment_status, created_at, updated_at')
            .order('created_at', { ascending: false }),
          supabase.from('user_roles').select('user_id, role')
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (rolesResult.error) throw rolesResult.error;

        const nextOrders = ordersResult.data || [];
        const nextUsers = profilesResult.data || [];
        const nextRoles = Object.fromEntries(
          (rolesResult.data || []).map((row) => [row.user_id, row.role])
        );

        // Keep users that appear in orders even if a profile row is missing.
        const profileMap = new Map(nextUsers.map((user) => [String(user.id), user]));
        nextOrders.forEach((order) => {
          const id = String(order.user_id || '');
          if (id && !profileMap.has(id)) {
            profileMap.set(id, { id: order.user_id, name: 'Client' });
          }
        });

        setUsers(Array.from(profileMap.values()));
        setOrders(nextOrders);
        setRoles(nextRoles);
      } catch (err) {
        console.error('Admin users load error:', err);
        setError(err?.message || 'Could not load users.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }

    useEffect(() => {
      let mounted = true;
      loadUsers().catch(() => {});
      return () => { mounted = false; };
    }, []);

    const userRows = users
      .map((user) => {
        const userOrders = orders.filter(
          (order) => String(order.user_id) === String(user.id)
        );
        const activeOrders = userOrders.filter((order) => {
          const status = String(order.status || '').toLowerCase();
          return !['completed', 'cancelled', 'canceled'].includes(status);
        });
        const paidOrders = userOrders.filter(
          (order) => String(order.payment_status || '').toLowerCase() === 'paid'
        );
        const role = roles[user.id] || 'client';
        const isStaff = STAFF_ROLES.includes(role);

        return {
          ...user,
          name: String(user.name || 'Client').trim() || 'Client',
          role,
          isStaff,
          orders: userOrders,
          orderCount: userOrders.length,
          activeCount: activeOrders.length,
          paidCount: paidOrders.length
        };
      })
      .filter((user) => {
        const q = search.trim().toLowerCase();
        if (q) {
          const haystack = [user.name, user.id, user.role].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (filter === 'clients' && user.isStaff) return false;
        if (filter === 'staff' && !user.isStaff) return false;
        if (filter === 'active' && user.activeCount === 0) return false;
        if (filter === 'orders' && user.orderCount === 0) return false;
        return true;
      })
      .sort((a, b) => {
        if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
        if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
        return a.name.localeCompare(b.name);
      });

    const totalUsers = users.length;
    const clientCount = users.filter((user) => !STAFF_ROLES.includes(roles[user.id])).length;
    const staffCount = totalUsers - clientCount;
    const activeUserCount = users.filter((user) =>
      orders.some((order) => {
        if (String(order.user_id) !== String(user.id)) return false;
        return !['completed', 'cancelled', 'canceled'].includes(String(order.status || '').toLowerCase());
      })
    ).length;

    return (
      <DashboardShell admin>
        <main className="admin-users-page">
          <div className="dash-head admin-users-head">
            <div>
              <p className="eyebrow">ADMIN · USERS</p>
              <h1>Users.</h1>
              <p>Manage the people connected to Careerlyst projects.</p>
            </div>
            <button
              type="button"
              className="btn dark"
              onClick={() => loadUsers(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh ↻'}
            </button>
          </div>

          <section className="admin-users-stats">
            <div className="stat"><span>Total users</span><b>{loading ? '—' : totalUsers}</b><small>Profiles in the directory</small></div>
            <div className="stat"><span>Clients</span><b>{loading ? '—' : clientCount}</b><small>Non-staff accounts</small></div>
            <div className="stat"><span>Staff</span><b>{loading ? '—' : staffCount}</b><small>Admin / expert / support / finance</small></div>
            <div className="stat"><span>Active clients</span><b>{loading ? '—' : activeUserCount}</b><small>Users with open work</small></div>
          </section>

          <section className="panel admin-users-toolbar">
            <label className="admin-users-search">
              <span>⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, user ID or role…"
                aria-label="Search users"
              />
            </label>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter users">
              <option value="all">All users</option>
              <option value="clients">Clients</option>
              <option value="staff">Staff</option>
              <option value="active">Active clients</option>
              <option value="orders">Users with orders</option>
            </select>
          </section>

          {error && (
            <div className="admin-users-error">
              <strong>Users could not be loaded.</strong>
              <span>{error}</span>
              <button type="button" onClick={() => loadUsers(false)}>Try again</button>
            </div>
          )}

          <section className="panel admin-users-panel">
            <div className="admin-users-panel-head">
              <div>
                <p className="eyebrow">USER DIRECTORY</p>
                <h2>{loading ? 'Loading users…' : `${userRows.length} user${userRows.length === 1 ? '' : 's'} shown`}</h2>
              </div>
              <span>Live from Supabase</span>
            </div>

            {loading ? (
              <div className="admin-users-empty">
                <h3>Loading users…</h3>
                <p>Fetching profiles, roles and project activity.</p>
              </div>
            ) : !userRows.length ? (
              <div className="admin-users-empty">
                <h3>No users found.</h3>
                <p>Try another search or filter.</p>
              </div>
            ) : (
              <div className="admin-users-list">
                {userRows.map((user) => {
                  const latestOrder = user.orders[0];
                  return (
                    <article className="admin-user-row" key={user.id}>
                      <div className="admin-user-avatar">
                        {user.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="admin-user-main">
                        <div className="admin-user-title">
                          <strong>{user.name}</strong>
                          <span className={user.isStaff ? 'admin-user-role is-staff' : 'admin-user-role'}>
                            {user.role}
                          </span>
                        </div>
                        <small className="admin-user-id">ID · {user.id}</small>
                        {latestOrder && (
                          <small className="admin-user-latest">
                            Latest: {latestOrder.service_name || 'Careerlyst service'}{latestOrder.package_name ? ` · ${latestOrder.package_name}` : ''}
                          </small>
                        )}
                      </div>
                      <div className="admin-user-metrics">
                        <span><b>{user.orderCount}</b> orders</span>
                        <span><b>{user.activeCount}</b> active</span>
                        <span><b>{user.paidCount}</b> paid</span>
                      </div>
                      <Link className="text-button" to="/admin/workspace">
                        Open workspace →
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </DashboardShell>
    );
  }

  export function AdminUsers() {
    return <AdminUsersPage />;
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
    return <AdminProjectsPage />;
  }


  export function AdminServices() {
  return <AdminServicesPage />;
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


const ATTACHMENT_BUCKET = 'message-attachments';
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'image/jpeg',
  'image/png',
  'image/webp'
];

function formatFileSize(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '—';

  const value = Number(bytes);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function getFileExtension(name = '') {
  const cleanName = String(name).split('?')[0];
  const index = cleanName.lastIndexOf('.');

  return index >= 0
    ? cleanName.slice(index + 1).toLowerCase()
    : '';
}

function getFileType(file) {
  const type = String(file?.type || '').toLowerCase();
  const extension = getFileExtension(file?.name);

  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension)) {
    return 'image';
  }

  if (type === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  if (
    type.includes('word') ||
    type.includes('document') ||
    ['doc', 'docx', 'txt'].includes(extension)
  ) {
    return 'document';
  }

  if (
    type.includes('sheet') ||
    type.includes('excel') ||
    ['xls', 'xlsx', 'csv'].includes(extension)
  ) {
    return 'spreadsheet';
  }

  if (
    type.includes('presentation') ||
    ['ppt', 'pptx'].includes(extension)
  ) {
    return 'presentation';
  }

  if (
    type.includes('zip') ||
    type.includes('archive') ||
    extension === 'zip'
  ) {
    return 'archive';
  }

  return 'other';
}

function getFileIcon(file) {
  const type = getFileType(file);

  if (type === 'image') return '🖼️';
  if (type === 'pdf') return '📕';
  if (type === 'document') return '📄';
  if (type === 'spreadsheet') return '📊';
  if (type === 'presentation') return '📽️';
  if (type === 'archive') return '🗜️';

  return '📎';
}

function getDisplayName(user, fallback = 'Unknown client') {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    fallback
  );
}

function getInitials(name = '') {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return '?';

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function parseAttachmentMessage(body) {
  const prefix = '__CAREERLYST_ATTACHMENT__:';

  if (typeof body !== 'string' || !body.startsWith(prefix)) {
    return null;
  }

  try {
    const payload = JSON.parse(body.slice(prefix.length));

    if (!payload?.attachment?.path) {
      return null;
    }

    return {
      text: payload.text || '',
      attachment: payload.attachment
    };
  } catch {
    return null;
  }
}

function buildAttachmentBody(attachment, text = '') {
  return `__CAREERLYST_ATTACHMENT__:${JSON.stringify({
    text: text || '',
    attachment
  })}`;
}

function StatCard({ label, value, detail }) {
  return (
    <div className="admin-files-stat">
      <span className="admin-files-stat-label">{label}</span>
      <strong className="admin-files-stat-value">{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function FilePreview({ file, url, onClose }) {
  if (!file) return null;

  const type = getFileType(file);

  return (
    <div
      className="admin-files-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="admin-files-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-file-preview-title"
      >
        <header className="admin-files-modal-header">
          <div>
            <span className="admin-files-modal-kicker">FILE PREVIEW</span>
            <h2 id="admin-file-preview-title">{file.name || 'Untitled file'}</h2>
          </div>

          <button
            type="button"
            className="admin-files-modal-close"
            onClick={onClose}
            aria-label="Close preview"
          >
            ×
          </button>
        </header>

        <div className="admin-files-modal-body">
          {url && type === 'image' && (
            <div className="admin-files-preview-image-wrap">
              <img
                src={url}
                alt={file.name || 'File preview'}
                className="admin-files-preview-image"
              />
            </div>
          )}

          {url && type === 'pdf' && (
            <iframe
              title={file.name || 'PDF preview'}
              src={url}
              className="admin-files-preview-frame"
            />
          )}

          {(!url || (type !== 'image' && type !== 'pdf')) && (
            <div className="admin-files-preview-placeholder">
              <span>{getFileIcon(file)}</span>
              <strong>
                {type === 'image' || type === 'pdf'
                  ? 'Preview unavailable'
                  : 'This file type cannot be previewed here.'}
              </strong>
              <p>
                Use the open or download action to access the original file.
              </p>
            </div>
          )}

          <div className="admin-files-preview-meta">
            <div>
              <span>Type</span>
              <strong>{file.mimeType || file.type || getFileExtension(file.name) || 'Unknown'}</strong>
            </div>
            <div>
              <span>Size</span>
              <strong>{formatFileSize(file.size)}</strong>
            </div>
            <div>
              <span>Uploaded</span>
              <strong>{formatDate(file.createdAt)}</strong>
            </div>
            <div>
              <span>Order</span>
              <strong>#{file.orderId || '—'}</strong>
            </div>
          </div>
        </div>

        <footer className="admin-files-modal-footer">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="admin-files-btn primary"
              download={file.name}
            >
              Open / Download ↗
            </a>
          ) : (
            <span className="admin-files-muted">
              A secure file URL could not be prepared.
            </span>
          )}
        </footer>
      </section>
    </div>
  );
}

function UploadPanel({
  orders,
  selectedOrderId,
  setSelectedOrderId,
  onUploaded
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;

    event.target.value = '';
    setError('');
    setSuccess('');

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (nextFile.size > MAX_ATTACHMENT_SIZE) {
      setFile(null);
      setError('File is too large. Maximum size is 10 MB.');
      return;
    }

    if (nextFile.type && !ALLOWED_TYPES.includes(nextFile.type)) {
      setFile(null);
      setError('This file type is not supported.');
      return;
    }

    setFile(nextFile);
  }

  async function handleUpload(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    if (!selectedOrderId) {
      setError('Select an order before uploading a file.');
      return;
    }

    if (!file) {
      setError('Choose a file first.');
      return;
    }

    setUploading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const adminUser = sessionData?.session?.user;

      if (!adminUser) {
        throw new Error('Your session could not be verified. Please sign in again.');
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `orders/${selectedOrderId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined
        });

      if (uploadError) throw uploadError;

      const attachment = {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        mimeType: file.type || 'application/octet-stream',
        path
      };

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          order_id: selectedOrderId,
          sender_id: adminUser.id,
          body: buildAttachmentBody(attachment)
        });

      if (messageError) {
        await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove([path]);

        throw messageError;
      }

      setFile(null);
      setSuccess('File uploaded and shared with the selected client.');
      onUploaded?.();

    } catch (uploadError) {
      console.error('Admin file upload error:', uploadError);
      setError(uploadError?.message || 'The file could not be uploaded.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="admin-files-panel admin-files-upload-panel">
      <div className="admin-files-panel-header">
        <div>
          <span className="admin-files-kicker">UPLOAD</span>
          <h2>Share a file with a client</h2>
          <p>
            Files are stored in the existing message attachment bucket and
            linked to the selected order.
          </p>
        </div>
      </div>

      <form className="admin-files-upload-form" onSubmit={handleUpload}>
        <div className="admin-files-form-field">
          <label htmlFor="admin-file-order">Client order</label>
          <select
            id="admin-file-order"
            value={selectedOrderId}
            onChange={(event) => setSelectedOrderId(event.target.value)}
            disabled={uploading}
          >
            <option value="">Select an order…</option>

            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                #{order.id} · {order.clientName} · {order.serviceName}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-files-upload-dropzone">
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            accept={ALLOWED_TYPES.join(',')}
          />

          <button
            type="button"
            className="admin-files-btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            Choose file
          </button>

          <div>
            <strong>
              {file ? file.name : 'No file selected'}
            </strong>
            <span>
              {file
                ? formatFileSize(file.size)
                : 'PDF, images, documents and common office files · max 10 MB'}
            </span>
          </div>
        </div>

        {error && (
          <div className="admin-files-notice error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="admin-files-notice success" role="status">
            {success}
          </div>
        )}

        <div className="admin-files-upload-actions">
          <button
            type="submit"
            className="admin-files-btn primary"
            disabled={uploading || !file || !selectedOrderId}
          >
            {uploading ? 'Uploading…' : 'Upload & Share'}
          </button>
        </div>
      </form>
    </section>
  );
}

function AdminFilesManager() {
  const [files, setFiles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  const [selectedIds, setSelectedIds] = useState([]);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [activeTab, setActiveTab] = useState('library');

  const [actionBusy, setActionBusy] = useState('');
  const [notice, setNotice] = useState('');

  async function loadFiles() {
    if (!supabase) {
      setFiles([]);
      setOrders([]);
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!sessionData?.session?.user) {
        throw new Error('Your admin session could not be verified.');
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id, service_name, package_name, created_at, status')
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      const orderRows = orderData || [];
      const orderIds = orderRows.map((order) => order.id);

      if (!orderIds.length) {
        setOrders([]);
        setFiles([]);
        return;
      }

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('id, order_id, sender_id, body, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (messageError) throw messageError;

      const userIds = [...new Set(
        orderRows
          .map((order) => order.user_id)
          .filter(Boolean)
      )];

      const userMap = {};

      /*
       * Supabase auth.users is normally not directly selectable from the
       * browser. If the project has a public profiles table, use it here.
       * Failure is intentionally non-fatal because the file library can
       * still operate using order IDs.
       */
      if (userIds.length) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, name, email')
            .in('id', userIds);

          (profiles || []).forEach((profile) => {
            userMap[String(profile.id)] = profile;
          });
        } catch {
          // Profiles are optional for this admin library.
        }
      }

      const orderMap = Object.fromEntries(
        orderRows.map((order) => [String(order.id), order])
      );

      const extracted = (messageData || [])
        .map((message) => {
          const parsed = parseAttachmentMessage(message.body);

          if (!parsed?.attachment?.path) {
            return null;
          }

          const order = orderMap[String(message.order_id)] || null;
          const profile = order?.user_id
            ? userMap[String(order.user_id)]
            : null;

          const clientName =
            profile?.full_name ||
            profile?.name ||
            profile?.email ||
            `Client #${String(order?.user_id || '').slice(0, 8) || 'unknown'}`;

          return {
            id: `${message.id}:${parsed.attachment.path}`,
            messageId: message.id,
            orderId: message.order_id,
            senderId: message.sender_id,
            name: parsed.attachment.name || 'Untitled file',
            size: Number(parsed.attachment.size) || 0,
            type: parsed.attachment.type || parsed.attachment.mimeType || '',
            mimeType: parsed.attachment.mimeType || parsed.attachment.type || '',
            path: parsed.attachment.path,
            text: parsed.text || '',
            createdAt: message.created_at,
            clientId: order?.user_id || '',
            clientName,
            serviceName: order?.service_name || 'Careerlyst service',
            packageName: order?.package_name || '',
            status: order?.status || ''
          };
        })
        .filter(Boolean);

      const normalizedOrders = orderRows.map((order) => {
        const profile = userMap[String(order.user_id)];

        return {
          id: order.id,
          clientName:
            profile?.full_name ||
            profile?.name ||
            profile?.email ||
            `Client #${String(order.user_id || '').slice(0, 8) || 'unknown'}`,
          serviceName: order.service_name || 'Careerlyst service',
          packageName: order.package_name || '',
          status: order.status || '',
          createdAt: order.created_at
        };
      });

      setOrders(normalizedOrders);
      setFiles(extracted);

    } catch (loadError) {
      console.error('Admin files load error:', loadError);
      setError(loadError?.message || 'Files could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return files.filter((file) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          file.name,
          file.clientName,
          file.serviceName,
          file.orderId,
          file.packageName
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const matchesType =
        typeFilter === 'all' ||
        getFileType(file) === typeFilter;

      /*
       * Existing Careerlyst attachment files are private message attachments.
       * "public" is retained as a UI-compatible filter value but will not
       * incorrectly claim that message attachments are public.
       */
      const isPrivate = true;

      const matchesVisibility =
        visibilityFilter === 'all' ||
        (visibilityFilter === 'private' && isPrivate);

      const matchesClient =
        clientFilter === 'all' ||
        String(file.clientId) === String(clientFilter);

      return (
        matchesQuery &&
        matchesType &&
        matchesVisibility &&
        matchesClient
      );
    });
  }, [
    files,
    query,
    typeFilter,
    visibilityFilter,
    clientFilter
  ]);

  const clients = useMemo(() => {
    const map = new Map();

    files.forEach((file) => {
      const key = String(file.clientId || file.clientName);

      if (!map.has(key)) {
        map.set(key, {
          id: file.clientId || key,
          name: file.clientName,
          count: 0
        });
      }

      map.get(key).count += 1;
    });

    return [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [files]);

  const stats = useMemo(() => {
    const totalSize = files.reduce(
      (sum, file) => sum + (Number(file.size) || 0),
      0
    );

    const images = files.filter((file) => getFileType(file) === 'image').length;
    const documents = files.filter((file) =>
      ['pdf', 'document', 'spreadsheet', 'presentation'].includes(getFileType(file))
    ).length;

    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).getTime();

    const todayCount = files.filter((file) => {
      const time = new Date(file.createdAt || 0).getTime();
      return Number.isFinite(time) && time >= todayStart;
    }).length;

    return {
      total: files.length,
      totalSize,
      images,
      documents,
      today: todayCount,
      clients: clients.length
    };
  }, [files, clients.length]);

  const groupedFiles = useMemo(() => {
    const groups = new Map();

    filteredFiles.forEach((file) => {
      const key = String(file.clientId || file.clientName);

      if (!groups.has(key)) {
        groups.set(key, {
          id: file.clientId || key,
          name: file.clientName,
          files: []
        });
      }

      groups.get(key).files.push(file);
    });

    return [...groups.values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [filteredFiles]);

  function toggleSelected(fileId) {
    setSelectedIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId]
    );
  }

  function toggleAllVisible() {
    const visibleIds = filteredFiles.map((file) => file.id);

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (allSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  }

  async function createFileUrl(file) {
    if (!supabase || !file?.path) {
      return '';
    }

    const { data, error: urlError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(file.path, 60 * 60);

    if (urlError) {
      throw urlError;
    }

    return data?.signedUrl || '';
  }

  async function openPreview(file) {
    setPreviewFile(file);
    setPreviewUrl('');
    setPreviewLoading(true);
    setNotice('');

    try {
      const url = await createFileUrl(file);
      setPreviewUrl(url);
    } catch (previewError) {
      console.error('Admin file preview error:', previewError);
      setNotice('The secure preview link could not be created.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleOpen(file) {
    setActionBusy(`open:${file.id}`);
    setNotice('');

    try {
      const url = await createFileUrl(file);

      if (!url) {
        throw new Error('The secure file link could not be created.');
      }

      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (openError) {
      console.error('Admin file open error:', openError);
      setNotice(openError?.message || 'The file could not be opened.');
    } finally {
      setActionBusy('');
    }
  }

  async function copyFileUrl(file) {
    setActionBusy(`copy:${file.id}`);
    setNotice('');

    try {
      const url = await createFileUrl(file);

      if (!url) {
        throw new Error('The secure file link could not be created.');
      }

      await navigator.clipboard.writeText(url);
      setNotice('Secure file link copied.');
    } catch (copyError) {
      console.error('Admin file copy error:', copyError);
      setNotice('The file link could not be copied.');
    } finally {
      setActionBusy('');
    }
  }

  async function removeFile(file) {
    const confirmed = window.confirm(
      `Remove "${file.name}" from this conversation?`
    );

    if (!confirmed) return;

    setActionBusy(`delete:${file.id}`);
    setNotice('');

    try {
      const parsedBody = await supabase
        .from('messages')
        .select('id, body')
        .eq('id', file.messageId)
        .maybeSingle();

      if (parsedBody.error) throw parsedBody.error;

      const currentBody = parsedBody.data?.body;
      const parsed = parseAttachmentMessage(currentBody);

      const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([file.path]);

      if (storageError) throw storageError;

      /*
       * Preserve normal message text when an attachment was sent together
       * with text. If the message only contained the attachment, remove the
       * message row so the client does not see a dead file message.
       */
      if (parsed?.text) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ body: parsed.text })
          .eq('id', file.messageId);

        if (updateError) throw updateError;
      } else {
        const { error: deleteError } = await supabase
          .from('messages')
          .delete()
          .eq('id', file.messageId);

        if (deleteError) throw deleteError;
      }

      setFiles((current) =>
        current.filter((item) => item.id !== file.id)
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== file.id)
      );

      setNotice('File removed.');

    } catch (deleteError) {
      console.error('Admin file delete error:', deleteError);
      setNotice(deleteError?.message || 'The file could not be removed.');
    } finally {
      setActionBusy('');
    }
  }

  async function removeSelected() {
    if (!selectedIds.length) return;

    const selectedFiles = files.filter((file) =>
      selectedIds.includes(file.id)
    );

    const confirmed = window.confirm(
      `Remove ${selectedFiles.length} selected file${selectedFiles.length === 1 ? '' : 's'}?`
    );

    if (!confirmed) return;

    setActionBusy('bulk-delete');
    setNotice('');

    let removed = 0;
    let failed = 0;

    try {
      for (const file of selectedFiles) {
        try {
          const parsedBody = await supabase
            .from('messages')
            .select('id, body')
            .eq('id', file.messageId)
            .maybeSingle();

          if (parsedBody.error) throw parsedBody.error;

          const parsed = parseAttachmentMessage(parsedBody.data?.body);

          const { error: storageError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .remove([file.path]);

          if (storageError) throw storageError;

          if (parsed?.text) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({ body: parsed.text })
              .eq('id', file.messageId);

            if (updateError) throw updateError;
          } else {
            const { error: deleteError } = await supabase
              .from('messages')
              .delete()
              .eq('id', file.messageId);

            if (deleteError) throw deleteError;
          }

          removed += 1;
        } catch (itemError) {
          console.error('Bulk file delete item error:', itemError);
          failed += 1;
        }
      }

      await loadFiles();
      setSelectedIds([]);

      setNotice(
        failed
          ? `${removed} file${removed === 1 ? '' : 's'} removed. ${failed} could not be removed.`
          : `${removed} file${removed === 1 ? '' : 's'} removed.`
      );

    } finally {
      setActionBusy('');
    }
  }

  function clearFilters() {
    setQuery('');
    setTypeFilter('all');
    setVisibilityFilter('all');
    setClientFilter('all');
  }

  return (
    <DashboardShell>
      <main className="admin-files-page">
        <div className="dash-head admin-files-head">
          <div>
            <p className="eyebrow">ADMIN / FILES</p>
            <h1>File management.</h1>
            <p>
              Manage files shared through Careerlyst client conversations,
              inspect storage usage, and send new files to orders.
            </p>
          </div>

          <div className="admin-files-header-actions">
            <button
              type="button"
              className={`admin-files-btn ${activeTab === 'library' ? 'primary' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              Library
            </button>

            <button
              type="button"
              className={`admin-files-btn ${activeTab === 'upload' ? 'primary' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload
            </button>

            <button
              type="button"
              className="admin-files-btn"
              onClick={() => void loadFiles()}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-files-notice error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="admin-files-notice" role="status">
            {notice}
          </div>
        )}

        <section className="admin-files-overview">
          <StatCard
            label="Total files"
            value={stats.total}
            detail={`${stats.today} uploaded today`}
          />

          <StatCard
            label="Storage represented"
            value={formatFileSize(stats.totalSize)}
            detail="Across visible attachment records"
          />

          <StatCard
            label="Images"
            value={stats.images}
            detail="Image attachments"
          />

          <StatCard
            label="Documents"
            value={stats.documents}
            detail="PDF and office files"
          />

          <StatCard
            label="Clients"
            value={stats.clients}
            detail="Clients with files"
          />
        </section>

        {activeTab === 'upload' && (
          <UploadPanel
            orders={orders}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            onUploaded={() => {
              void loadFiles();
            }}
          />
        )}

        {activeTab === 'library' && (
          <>
            <section className="admin-files-panel">
              <div className="admin-files-toolbar">
                <div className="admin-files-search">
                  <label htmlFor="admin-files-search">Search</label>
                  <input
                    id="admin-files-search"
                    type="search"
                    placeholder="Search filename, client, service, order…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                <div className="admin-files-filter">
                  <label htmlFor="admin-files-type">Type</label>
                  <select
                    id="admin-files-type"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="image">Images</option>
                    <option value="pdf">PDF</option>
                    <option value="document">Documents</option>
                    <option value="spreadsheet">Spreadsheets</option>
                    <option value="presentation">Presentations</option>
                    <option value="archive">Archives</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="admin-files-filter">
                  <label htmlFor="admin-files-visibility">Visibility</label>
                  <select
                    id="admin-files-visibility"
                    value={visibilityFilter}
                    onChange={(event) => setVisibilityFilter(event.target.value)}
                  >
                    <option value="all">All visibility</option>
                    <option value="private">Private</option>
                  </select>
                </div>

                <div className="admin-files-filter">
                  <label htmlFor="admin-files-client">Client</label>
                  <select
                    id="admin-files-client"
                    value={clientFilter}
                    onChange={(event) => setClientFilter(event.target.value)}
                  >
                    <option value="all">All clients</option>

                    {clients.map((client) => (
                      <option
                        key={String(client.id)}
                        value={client.id}
                      >
                        {client.name} ({client.count})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="admin-files-btn"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              </div>

              <div className="admin-files-bulkbar">
                <label className="admin-files-select-all">
                  <input
                    type="checkbox"
                    checked={
                      filteredFiles.length > 0 &&
                      filteredFiles.every((file) =>
                        selectedIds.includes(file.id)
                      )
                    }
                    onChange={toggleAllVisible}
                  />
                  <span>Select visible</span>
                </label>

                <span>
                  {selectedIds.length} selected · {filteredFiles.length} shown
                </span>

                <button
                  type="button"
                  className="admin-files-btn danger"
                  onClick={() => void removeSelected()}
                  disabled={
                    !selectedIds.length ||
                    Boolean(actionBusy)
                  }
                >
                  {actionBusy === 'bulk-delete'
                    ? 'Removing…'
                    : 'Remove selected'}
                </button>
              </div>
            </section>

            {loading ? (
              <section className="admin-files-panel">
                <div className="admin-files-empty">
                  <strong>Loading file library…</strong>
                  <span>Reading attachment records from Supabase.</span>
                </div>
              </section>
            ) : !filteredFiles.length ? (
              <section className="admin-files-panel">
                <div className="admin-files-empty">
                  <strong>No files found.</strong>
                  <span>
                    Try clearing your filters or upload a new file to an order.
                  </span>

                  <button
                    type="button"
                    className="admin-files-btn primary"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                </div>
              </section>
            ) : (
              <div className="admin-files-groups">
                {groupedFiles.map((group) => (
                  <section
                    className="admin-files-client"
                    key={String(group.id)}
                  >
                    <header className="admin-files-client-head">
                      <div className="admin-files-client-title">
                        <div className="admin-files-client-avatar">
                          {getInitials(group.name)}
                        </div>

                        <div>
                          <h2>{group.name}</h2>
                          <span>
                            {group.files.length} file
                            {group.files.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </header>

                    <div className="admin-files-client-list">
                      {group.files.map((file) => (
                        <article
                          className="admin-files-card"
                          key={file.id}
                        >
                          <label
                            className="admin-files-card-check"
                            aria-label={`Select ${file.name}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(file.id)}
                              onChange={() => toggleSelected(file.id)}
                            />
                          </label>

                          <div className="admin-files-card-icon">
                            {getFileIcon(file)}
                          </div>

                          <div className="admin-files-card-main">
                            <div className="admin-files-card-top">
                              <strong title={file.name}>
                                {file.name}
                              </strong>

                              <span className="admin-files-source">
                                {getFileType(file)}
                              </span>
                            </div>

                            <div className="admin-files-card-meta">
                              <span>
                                Order #{file.orderId}
                              </span>
                              <span>
                                {file.serviceName}
                              </span>
                              <span>
                                {formatFileSize(file.size)}
                              </span>
                              <span>
                                {formatDate(file.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="admin-files-actions">
                            <button
                              type="button"
                              className="admin-files-action-btn"
                              onClick={() => void openPreview(file)}
                            >
                              Preview
                            </button>

                            <button
                              type="button"
                              className="admin-files-action-btn"
                              onClick={() => void handleOpen(file)}
                              disabled={actionBusy === `open:${file.id}`}
                            >
                              {actionBusy === `open:${file.id}`
                                ? 'Opening…'
                                : 'Open ↗'}
                            </button>

                            <button
                              type="button"
                              className="admin-files-action-btn"
                              onClick={() => void copyFileUrl(file)}
                              disabled={actionBusy === `copy:${file.id}`}
                            >
                              {actionBusy === `copy:${file.id}`
                                ? 'Copying…'
                                : 'Copy link'}
                            </button>

                            <button
                              type="button"
                              className="admin-files-action-btn danger"
                              onClick={() => void removeFile(file)}
                              disabled={Boolean(actionBusy)}
                            >
                              {actionBusy === `delete:${file.id}`
                                ? 'Removing…'
                                : 'Remove'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {previewFile && (
          <FilePreview
            file={previewFile}
            url={previewLoading ? '' : previewUrl}
            onClose={() => {
              setPreviewFile(null);
              setPreviewUrl('');
            }}
          />
        )}
      </main>
    </DashboardShell>
  );
}


  export function AdminFiles() {
    return <AdminFilesManager />;
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
