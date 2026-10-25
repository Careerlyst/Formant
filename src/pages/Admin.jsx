import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Link,
  useNavigate,
  useLocation
} from 'react-router-dom';
import AdminNotificationsPage from './AdminNotifications';
import AdminProjectsPage from './AdminProjects';
import AdminServicesPage from './AdminServices';
import { AdminReviewsPage } from './AdminReviews';
import DashboardShell from '../components/DashboardShell';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import ProfileAvatar from '../components/ProfileAvatar';
import { load } from '../lib/store';
import MessageActions from '../components/MessageActions';
import { useMessageViewport } from '../lib/messageViewport';
import AdminProfileContext from '../components/AdminProfileContext';
import { useToast } from '../components/ToastProvider';
import SkeletonState from '../components/SkeletonState';

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
              .select('id, name, avatar_id')
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
            } = await supabase.rpc('list_message_summaries_v1', {
              p_order_ids: orderIds
            });

            if (messageError) throw messageError;

            const orderById = Object.fromEntries(
              nextOrders.map((order) => [
                String(order.id),
                order
              ])
            );

            nextUnreadMessages = (messageData || [])
              .filter((summary) => Number(summary.unread_count || 0) > 0 && summary.latest_unread_message_id)
              .map((summary) => ({
                id: summary.latest_unread_message_id,
                order_id: summary.order_id,
                body: summary.latest_unread_body,
                created_at: summary.latest_unread_created_at,
                unread_count: summary.unread_count,
                clientName:
                  nextProfiles[orderById[String(summary.order_id)]?.user_id]
                    ?.name || 'Client',
                order:
                  orderById[String(summary.order_id)]
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

            <h1>Operations overview</h1>

            <p>Review current orders, client activity and work needing attention.</p>

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
            <SkeletonState label="Loading items that need attention" variant="rows" count={3} />
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
            <SkeletonState label="Loading active orders" variant="rows" count={4} />
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
                      'Formant service'}
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
            <SkeletonState label="Loading recent activity" variant="rows" count={3} />
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
                    'Formant service'}
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
            <SkeletonState label="Loading unread messages" variant="messages" count={3} />
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
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [savingId, setSavingId] = useState(null);
    const [connection, setConnection] = useState('connecting');
    const hasLoadedOrdersRef = useRef(false);
    const loadOrdersRequestRef = useRef(0);

    async function loadOrders() {
      if (!isOrders) return;
      const requestId = ++loadOrdersRequestRef.current;
      if (hasLoadedOrdersRef.current) setRefreshing(true);
      else setLoading(true);
      setError('');
      let staffVerified = false;

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
        staffVerified = true;

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
            .select('id, name, email, phone, location, target_role, experience, education, skills, certifications, linkedin, github, portfolio, bio, preferences, avatar_id, lead_assessment, lead_score, lead_status, lead_assessment_completed_at')
            .in('id', userIds);
          if (profileError) throw profileError;
          profileMap = Object.fromEntries((profileRows || []).map((row) => [row.id, row]));
        }

        if (requestId !== loadOrdersRequestRef.current) return;
        setOrders(rows);
        setProfiles(profileMap);
        hasLoadedOrdersRef.current = true;
        setSelectedOrder((current) => {
          if (!current) return null;
          return rows.find((row) => String(row.id) === String(current.id)) || null;
        });
      } catch (err) {
        if (requestId === loadOrdersRequestRef.current) {
          if (!staffVerified) {
            setOrders([]);
            setProfiles({});
            setSelectedOrder(null);
            hasLoadedOrdersRef.current = false;
          }
          setError(err?.message || 'Unable to load orders.');
        }
      } finally {
        if (requestId === loadOrdersRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
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
        loadOrdersRequestRef.current += 1;
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
            <h1>Orders and queue</h1>
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
          <button className="btn light" type="button" onClick={loadOrders} disabled={loading || refreshing}>{loading || refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>

        {error && <div className="admin-orders-error" role="alert">{error}<button type="button" onClick={loadOrders}>Try again</button></div>}

        <div className="panel admin-orders-panel">
          <div className="panel-head"><div><p className="eyebrow">LIVE DIRECTORY</p><h2>{filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}</h2></div><Link to="/admin/workspace">Open workspace →</Link></div>

          {loading ? <div className="admin-orders-empty"><SkeletonState label="Loading orders" variant="table" count={5} /></div> : !filteredOrders.length ? <div className="admin-orders-empty"><strong>No matching orders.</strong><span>Try changing the search or filters.</span></div> : (
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
                      <span className="admin-order-live-service">{order.service_name || 'Formant service'}<small>{order.package_name || 'Standard package'}</small></span>
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
              <div className="admin-order-drawer-head"><div><p className="eyebrow">ORDER #{selectedOrder.id}</p><h2>{selectedOrder.service_name || 'Formant service'}</h2></div><button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details">×</button></div>
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
              <AdminProfileContext profile={profiles[selectedOrder.user_id]} />
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
    const [joinDates, setJoinDates] = useState({});
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
        const [profilesResult, ordersResult, rolesResult, joinDatesResult] = await Promise.all([
          supabase.from('profiles').select('id, name, avatar_id'),
          supabase
            .from('orders')
            .select('id, user_id, service_name, package_name, status, payment_status, created_at, updated_at')
            .order('created_at', { ascending: false }),
          supabase.rpc('admin_list_directory_user_roles_v1'),
          supabase.rpc('admin_list_directory_join_dates_v1')
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (ordersResult.error) throw ordersResult.error;
        if (rolesResult.error) throw rolesResult.error;
        if (joinDatesResult.error) throw joinDatesResult.error;

        const nextOrders = ordersResult.data || [];
        const nextUsers = profilesResult.data || [];
        const nextRoles = Object.fromEntries(
          (rolesResult.data || []).map((row) => {
            const role = String(row.role || '').trim().toLowerCase();
            const knownRole = role === 'client' || STAFF_ROLES.includes(role)
              ? role
              : 'unknown';
            return [String(row.user_id), knownRole];
          })
        );
        const nextJoinDates = Object.fromEntries(
          (joinDatesResult.data || []).map((row) => [
            String(row.user_id),
            row.created_at || null
          ])
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
        setJoinDates(nextJoinDates);
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
        const role = roles[String(user.id)] || 'unknown';
        const isStaff = STAFF_ROLES.includes(role);

        return {
          ...user,
          name: String(user.name || 'Client').trim() || 'Client',
          created_at: joinDates[String(user.id)] || null,
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
        if (filter === 'clients' && user.role !== 'client') return false;
        if (filter === 'staff' && !user.isStaff) return false;
        if (filter === 'active' && (user.role !== 'client' || user.activeCount === 0)) return false;
        if (filter === 'orders' && user.orderCount === 0) return false;
        return true;
      })
      .sort((a, b) => {
        const aJoinTime = Date.parse(a.created_at || '');
        const bJoinTime = Date.parse(b.created_at || '');
        const aSortTime = Number.isFinite(aJoinTime) ? aJoinTime : 0;
        const bSortTime = Number.isFinite(bJoinTime) ? bJoinTime : 0;
        if (aSortTime !== bSortTime) return bSortTime - aSortTime;
        return a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id));
      });

    const totalUsers = users.length;
    const clientCount = users.filter(
      (user) => roles[String(user.id)] === 'client'
    ).length;
    const staffCount = users.filter(
      (user) => STAFF_ROLES.includes(roles[String(user.id)])
    ).length;
    const activeUserCount = users.filter((user) =>
      roles[String(user.id)] === 'client' && orders.some((order) => {
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
              <h1>Users</h1>
              <p>Manage the people connected to Formant projects.</p>
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
            <div className="stat"><span>Clients</span><b>{loading ? '—' : clientCount}</b><small>Accounts with client role</small></div>
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
              <SkeletonState label="Loading users" variant="rows" count={5} />
            ) : !userRows.length ? (
              <div className="admin-users-empty">
                <h3>No users found.</h3>
                <p>Try another search or filter.</p>
              </div>
            ) : (
              <div className="admin-users-list">
                {userRows.map((user) => {
                  const latestOrder = user.orders[0];
                  const workspaceOrder = user.orders.find((order) =>
                    !['completed', 'cancelled', 'canceled'].includes(
                      String(order.status || '').toLowerCase()
                    )
                  ) || latestOrder;
                  const workspacePath = `/admin/workspace?client=${encodeURIComponent(user.id)}${workspaceOrder ? `&order=${encodeURIComponent(workspaceOrder.id)}` : ''}`;
                  const parsedJoinDate = user.created_at ? new Date(user.created_at) : null;
                  const joinedDate = parsedJoinDate && !Number.isNaN(parsedJoinDate.getTime())
                    ? parsedJoinDate.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'Unknown';
                  return (
                    <article className="admin-user-row" key={user.id}>
                      <ProfileAvatar className="admin-user-avatar" avatarId={user.avatar_id} decorative initials={user.name.slice(0, 1).toUpperCase()} />
                      <div className="admin-user-main">
                        <div className="admin-user-title">
                          <strong>{user.name}</strong>
                          <span className={user.isStaff ? 'admin-user-role is-staff' : 'admin-user-role'}>
                            {user.role}
                          </span>
                        </div>
                        <small className="admin-user-id">ID · {user.id}</small>
                        <small className="admin-user-id">Joined: {joinedDate}</small>
                        {latestOrder && (
                          <small className="admin-user-latest">
                            Latest: {latestOrder.service_name || 'Formant service'}{latestOrder.package_name ? ` · ${latestOrder.package_name}` : ''}
                          </small>
                        )}
                      </div>
                      <div className="admin-user-metrics">
                        <span><b>{user.orderCount}</b> orders</span>
                        <span><b>{user.activeCount}</b> active</span>
                        <span><b>{user.paidCount}</b> paid</span>
                      </div>
                      <Link className="text-button" to={workspacePath}>
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
export function AdminReviews() {
  return <AdminReviewsPage />;
}

  function parseMessageBody(body) {
    const prefix = '__CAREERLYST_ATTACHMENT__:';
    if (typeof body !== 'string' || !body.startsWith(prefix)) {
      return { text: body || '', attachment: null };
    }

    try {
      const payload = JSON.parse(body.slice(prefix.length));
      return {
        text: payload.text || '',
        attachment: payload.attachment || null
      };
    } catch {
      return { text: body, attachment: null };
    }
  }

  function AdminMessageAttachmentLink({ attachment, isTeam = false }) {
    const [url, setUrl] = useState(attachment?.url || '');
    const [loading, setLoading] = useState(Boolean(attachment?.path && !attachment?.url));

    useEffect(() => {
      let active = true;

      async function createUrl() {
        if (!attachment?.path || attachment?.url || !supabase) {
          if (active) setLoading(false);
          return;
        }

        const { data, error } = await supabase.storage
          .from('message-attachments')
          .createSignedUrl(attachment.path, 60 * 60);

        if (active) {
          setUrl(error ? '' : data?.signedUrl || '');
          setLoading(false);
        }
      }

      void createUrl();
      return () => { active = false; };
    }, [attachment?.path, attachment?.url]);

    if (loading) {
      return <div className={`message-attachment ${isTeam ? 'is-mine' : ''}`}>Loading attachment…</div>;
    }

    if (!url) return null;

    return (
      <a
        className={`message-attachment ${isTeam ? 'is-mine' : ''}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        download={attachment.name}
      >
        <span className="message-attachment-icon">↗</span>
        <span className="message-attachment-copy">
          <strong>{attachment.name}</strong>
          <small>{attachment.size >= 1024 * 1024 ? `${(attachment.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(attachment.size / 1024)} KB`}</small>
        </span>
      </a>
    );
  }

  function AdminMessagesPage() {
    const { showToast } = useToast();
    const location = useLocation();
    const [staffUserId, setStaffUserId] = useState('');
    const [staffRole, setStaffRole] = useState('');
    const [orders, setOrders] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [messageMap, setMessageMap] = useState({});
    const [messageSummaries, setMessageSummaries] = useState({});
    const [threadError, setThreadError] = useState('');
    const [loadingThread, setLoadingThread] = useState(false);
    const [hasOlderMessages, setHasOlderMessages] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [expandedClientIds, setExpandedClientIds] = useState(() => new Set());
    const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unread' | 'needs_reply'
    const [mobileView, setMobileView] = useState('list');
    const [text, setText] = useState('');
    const [drafts, setDrafts] = useState({});
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [connection, setConnection] = useState('connecting');
    const [error, setError] = useState('');
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [attachmentError, setAttachmentError] = useState('');
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [activeActionMessageId, setActiveActionMessageId] = useState(null);
    const seenRealtimeMessageIdsRef = useRef(new Set());
    const chatBodyRef = useRef(null);
    const messagesRootRef = useRef(null);
    const handleMessageComposerFocus = useMessageViewport(messagesRootRef, mobileView === 'chat');
    const selectedOrderIdRef = useRef(selectedOrderId);
    const mobileViewRef = useRef(mobileView);
    const staffUserIdRef = useRef(staffUserId);
    const messageMapRef = useRef(messageMap);
    const ordersRef = useRef(orders);
    const profilesRef = useRef(profiles);
    const markAdminConversationReadRef = useRef(null);
    const threadRequestRef = useRef(0);
    const actionScrollProgrammaticRef = useRef(false);
    const actionScrollTimerRef = useRef(0);


    const selectedOrder = orders.find(
      (order) => String(order.id) === String(selectedOrderId)
    ) || null;

    const selectedMessages = selectedOrder
      ? (messageMap[selectedOrder.id] || [])
      : [];

    useEffect(() => {
      setActiveActionMessageId(null);
    }, [selectedOrderId]);

    useEffect(() => {
      if (activeActionMessageId == null) return undefined;
      const onOutsidePointer = (event) => {
        if (event.target.closest?.('.messages-row, .message-actions-menu-portal')) return;
        setActiveActionMessageId(null);
      };
      document.addEventListener('pointerdown', onOutsidePointer);
      return () => document.removeEventListener('pointerdown', onOutsidePointer);
    }, [activeActionMessageId]);

    useEffect(() => {
      const body = chatBodyRef.current;
      if (!body || activeActionMessageId == null) return undefined;
      let previousTop = body.scrollTop;
      let userScrollIntent = false;
      const onScroll = () => {
        const actionHasFocus = document.activeElement?.closest?.('.message-actions, .message-actions-menu-portal');
        const moved = Math.abs(body.scrollTop - previousTop) > 18;
        if (moved && (userScrollIntent || (!actionScrollProgrammaticRef.current && !actionHasFocus))) setActiveActionMessageId(null);
        previousTop = body.scrollTop;
        userScrollIntent = false;
      };
      const onUserScrollIntent = () => {
        userScrollIntent = true;
        actionScrollProgrammaticRef.current = false;
        window.clearTimeout(actionScrollTimerRef.current);
      };
      body.addEventListener('scroll', onScroll, { passive: true });
      body.addEventListener('wheel', onUserScrollIntent, { passive: true });
      body.addEventListener('touchmove', onUserScrollIntent, { passive: true });
      return () => {
        body.removeEventListener('scroll', onScroll);
        body.removeEventListener('wheel', onUserScrollIntent);
        body.removeEventListener('touchmove', onUserScrollIntent);
      };
    }, [activeActionMessageId, selectedOrderId]);

    const groupedClients = (() => {
      const query = search.trim().toLowerCase();
      const groups = [];

      orders.forEach((order) => {
        const clientName = profiles[order.user_id]?.name || 'Client';
        const service = String(order.service_name || 'Formant service');
        const packageName = String(order.package_name || '');
        const thread = messageMap[String(order.id)] || [];
        const summary = messageSummaries[String(order.id)];
        const last = thread[thread.length - 1] || (summary?.latest_message_id ? {
          id: summary.latest_message_id,
          sender_id: summary.latest_sender_id,
          body: summary.latest_body,
          created_at: summary.latest_created_at
        } : null);
        const unread = Number(summary?.unread_count ?? thread.filter(
          (message) =>
            String(message.sender_id) === String(order.user_id) &&
            !message.read_at
        ).length);
        const isNeedsReply = Boolean(
          last && String(last.sender_id) === String(order.user_id)
        );

        let matchesFilter = true;
        if (filterMode === 'unread') {
          matchesFilter = unread > 0;
        } else if (filterMode === 'needs_reply') {
          matchesFilter = isNeedsReply;
        }

        if (!matchesFilter) return;

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
            avatarId: profiles[order.user_id]?.avatar_id ?? null,
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

    const totalUnreadOrders = orders.filter((o) => {
      return Number(messageSummaries[String(o.id)]?.unread_count || 0) > 0;
    }).length;

    const totalNeedsReplyOrders = orders.filter((o) => {
      const summary = messageSummaries[String(o.id)];
      return Boolean(summary?.latest_message_id && String(summary.latest_sender_id) === String(o.user_id));
    }).length;

    const notifications = orders
      .map((order) => {
        const summary = messageSummaries[String(order.id)];
        const unreadCount = Number(summary?.unread_count || 0);
        const latest = summary?.latest_unread_message_id ? {
          id: summary.latest_unread_message_id,
          body: summary.latest_unread_body,
          created_at: summary.latest_unread_created_at
        } : null;

        return latest && unreadCount
          ? {
              order,
              clientName: profiles[order.user_id]?.name || 'Client',
              latest,
              unread: unreadCount
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

    async function loadAdminThread(orderId, before = null, appendOlder = false) {
      if (!supabase || !orderId) return;
      const requestId = ++threadRequestRef.current;
      setThreadError('');
      if (!appendOlder) setLoadingThread(true);
      try {
        const { data, error: pageError } = await supabase.rpc(
          'list_message_thread_actions_v1',
          {
            p_order_id: Number(orderId),
            p_before_created_at: before?.created_at || null,
            p_before_id: before?.id || null,
            p_limit: 50
          }
        );
        if (pageError) throw pageError;
        if (requestId !== threadRequestRef.current) return;
        const page = [...(data || [])].reverse();
        const clientId = ordersRef.current.find((order) => String(order.id) === String(orderId))?.user_id;
        const senderIds = [...new Set(page
          .map((message) => message.sender_id)
          .filter((senderId) => senderId && String(senderId) !== String(clientId)))];
        if (senderIds.length) {
          const { data: senderProfiles, error: senderProfileError } = await supabase
            .from('profiles')
            .select('id, name, avatar_id')
            .in('id', senderIds);
          if (senderProfileError) throw senderProfileError;
          setProfiles((current) => ({
            ...current,
            ...Object.fromEntries((senderProfiles || []).map((profile) => [profile.id, profile]))
          }));
        }
        setHasOlderMessages((data || []).length === 50);
        setMessageMap((current) => {
          const key = String(orderId);
          if (!appendOlder) return { ...current, [key]: page };
          const old = current[key] || [];
          const ids = new Set(old.map((message) => String(message.id)));
          return { ...current, [key]: [...page.filter((message) => !ids.has(String(message.id))), ...old] };
        });
      } catch (pageError) {
        if (requestId === threadRequestRef.current) {
          setThreadError(pageError?.message || 'Could not load this conversation.');
        }
      } finally {
        if (requestId === threadRequestRef.current) setLoadingThread(false);
      }
    }

    async function refreshAdminSummaries(orderIds = null) {
      if (!supabase) return;
      const { data, error: summaryError } = await supabase.rpc(
        'list_message_summaries_v1',
        { p_order_ids: orderIds }
      );
      if (summaryError) throw summaryError;
      const nextSummaries = {};
      const previews = {};
      (data || []).forEach((summary) => {
        const key = String(summary.order_id);
        nextSummaries[key] = summary;
        previews[key] = summary.latest_message_id ? [{
          id: summary.latest_message_id,
          order_id: summary.order_id,
          sender_id: summary.latest_sender_id,
          body: summary.latest_body,
          created_at: summary.latest_created_at,
          read_at: null
        }] : [];
      });
      setMessageSummaries(nextSummaries);
      setMessageMap((current) => {
        const next = { ...previews };
        const activeKey = String(selectedOrderIdRef.current || '');
        if (activeKey && (current[activeKey]?.length || 0) > 1) next[activeKey] = current[activeKey];
        return next;
      });
    }

    useEffect(() => {
      let mounted = true;
      let channel = null;
      let removeRecoveryListeners = null;

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
              .select('id, name, avatar_id')
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

          const orderIds = nextOrders.map((order) => order.id).filter(Boolean);
          if (orderIds.length) {
            const { data: summaryData, error: summaryError } = await supabase.rpc(
              'list_message_summaries_v1',
              { p_order_ids: orderIds }
            );
            if (summaryError) throw summaryError;
            const summaries = {};
            const previews = {};
            (summaryData || []).forEach((summary) => {
              const key = String(summary.order_id);
              summaries[key] = summary;
              previews[key] = summary.latest_message_id ? [{
                id: summary.latest_message_id,
                order_id: summary.order_id,
                sender_id: summary.latest_sender_id,
                body: summary.latest_body,
                created_at: summary.latest_created_at,
                read_at: null
              }] : [];
            });
            if (!mounted) return;
            setMessageSummaries(summaries);
            setMessageMap(previews);
            const requestedId = new URLSearchParams(location.search).get('order');
            const latestActiveSummary = (summaryData || []).find((summary) => summary.latest_message_id);
            const firstThread = nextOrders.find((order) => String(order.id) === String(requestedId))
              || nextOrders.find((order) => String(order.id) === String(latestActiveSummary?.order_id))
              || nextOrders[0];
            selectedOrderIdRef.current = firstThread?.id || null;
            setSelectedOrderId(firstThread?.id || null);
            if (firstThread?.user_id) {
              setExpandedClientIds((prev) => new Set([...prev, String(firstThread.user_id)]));
              void loadAdminThread(firstThread.id);
            }
          } else {
            setMessageMap({});
            setMessageSummaries({});
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
                table: 'orders'
              },
              async (payload) => {
                if (!mounted || (!payload?.new && !payload?.old)) return;

                if (payload.eventType === 'INSERT') {
                  const newOrder = payload.new;
                  if (!newOrder?.id) return;

                  if (newOrder.user_id && !profilesRef.current[newOrder.user_id]) {
                    try {
                      const { data: prof } = await supabase
                        .from('profiles')
                        .select('id, name, avatar_id')
                        .eq('id', newOrder.user_id)
                        .maybeSingle();
                      if (prof && mounted) {
                        setProfiles((prev) => ({ ...prev, [prof.id]: prof }));
                      }
                    } catch (_) {}
                  }

                  setOrders((prev) => {
                    if (prev.some((o) => String(o.id) === String(newOrder.id))) {
                      return prev;
                    }
                    return [newOrder, ...prev].sort(
                      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
                    );
                  });
                } else if (payload.eventType === 'UPDATE') {
                  setOrders((prev) =>
                    prev.map((o) => (String(o.id) === String(payload.new.id) ? { ...o, ...payload.new } : o))
                  );
                } else if (payload.eventType === 'DELETE') {
                  setOrders((prev) =>
                    prev.filter((o) => String(o.id) !== String(payload.old.id))
                  );
                }
              }
            )
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

                const order = ordersRef.current.find(
                  (item) => String(item.id) === String(orderId)
                );
                // Scoped check: discard any message event not belonging to orders visible to this staff session
                if (!order) return;

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

                  const isClientMessage =
                    String(inserted?.sender_id) === String(order.user_id);

                  const isCurrentOrderOpen =
                    String(inserted?.order_id) === String(selectedOrderIdRef.current) &&
                    (mobileViewRef.current === 'chat' || (typeof window !== 'undefined' && window.innerWidth > 768));

                  if (isClientMessage) {
                    if (isCurrentOrderOpen) {
                      markAdminConversationReadRef.current?.(inserted.order_id);
                  const parsedText = parseMessageBody(inserted.body).text || (parseMessageBody(inserted.body).attachment ? `Attachment: ${parseMessageBody(inserted.body).attachment.name}` : 'New message');
                      setLiveAnnouncement(`New message from ${profilesRef.current[order.user_id]?.name || 'Client'}: ${parsedText}`);
                    } else {
                      const parsedInsert = parseMessageBody(inserted.body);
                      const toastPreview =
                        parsedInsert.text ||
                        (parsedInsert.attachment
                          ? `Attachment: ${parsedInsert.attachment.name}`
                          : 'Sent a new message.');
                      const clientName = profilesRef.current[order.user_id]?.name || 'Client';
                      showToast(`Order #${order.id} · ${toastPreview}`, {
                        type: 'info',
                        title: `New message from ${clientName}`,
                        duration: 6000,
                        action: {
                          label: 'Open conversation',
                          onClick: () => {
                            selectOrder(order.id);
                            setNotificationsOpen(false);
                          }
                        }
                      });
                    }
                  }
                  void refreshAdminSummaries(orderIds).catch((refreshError) => {
                    setThreadError(refreshError?.message || 'Could not refresh unread counts.');
                  });
                  if (isCurrentOrderOpen) void loadAdminThread(orderId);
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
                void refreshAdminSummaries(orderIds).then(() => {
                  if (selectedOrderIdRef.current) return loadAdminThread(selectedOrderIdRef.current);
                }).catch((refreshError) => setThreadError(refreshError?.message || 'Could not refresh conversations.'));
              } else if (
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT' ||
                status === 'CLOSED'
              ) {
                setConnection('offline');
              }
            });
          const reconcileAdminInbox = () => {
            void refreshAdminSummaries(orderIds).then(() => {
              if (selectedOrderIdRef.current) return loadAdminThread(selectedOrderIdRef.current);
            }).catch((refreshError) => {
              setThreadError(refreshError?.message || 'Could not refresh conversations.');
            });
          };
          const handleVisibility = () => {
            if (document.visibilityState === 'visible') reconcileAdminInbox();
          };
          const handleOnline = () => {
            setConnection('connecting');
            reconcileAdminInbox();
          };
          const handleOffline = () => setConnection('offline');
          document.addEventListener('visibilitychange', handleVisibility);
          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);
          removeRecoveryListeners = () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
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
        removeRecoveryListeners?.();
        if (channel) supabase?.removeChannel(channel);
      };
    }, [location.search, showToast]);

    useEffect(() => {
      const node = chatBodyRef.current || document.querySelector('.messages-chat-body') || document.querySelector('.admin-messages-thread-body');

      if (!node) return;

      requestAnimationFrame(() => {
        node.scrollTop = node.scrollHeight;
      });
    }, [selectedOrderId, selectedMessages.length]);

    useEffect(() => {
      if (!selectedOrderId) return;
      const timer = window.setTimeout(() => {
        const activeBtn = document.querySelector('.messages-admin-project-item.is-active');
        if (activeBtn) {
          activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 50);
      return () => window.clearTimeout(timer);
    }, [selectedOrderId]);

    useEffect(() => {
      if (search.trim() && groupedClients.length === 1) {
        setExpandedClientIds((prev) => new Set([...prev, String(groupedClients[0].userId)]));
      }
    }, [search, groupedClients]);

    useEffect(() => {
      selectedOrderIdRef.current = selectedOrderId;
    }, [selectedOrderId]);

    useEffect(() => {
      mobileViewRef.current = mobileView;
    }, [mobileView]);

    useEffect(() => {
      staffUserIdRef.current = staffUserId;
    }, [staffUserId]);

    useEffect(() => {
      messageMapRef.current = messageMap;
    }, [messageMap]);

    useEffect(() => {
      if (!selectedOrderId || !staffUserId) return;
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      if (isMobile && mobileView !== 'chat') return;

      markAdminConversationRead(selectedOrderId);
    }, [selectedOrderId, mobileView, staffUserId]);

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

    useEffect(() => {
      ordersRef.current = orders;
    }, [orders]);

    useEffect(() => {
      profilesRef.current = profiles;
    }, [profiles]);

    const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
    const ATTACHMENT_BUCKET = 'message-attachments';

    function handleAttachmentChange(event) {
      const file = event.target.files?.[0] || null;
      event.target.value = '';
      setAttachmentError('');

      if (!file) {
        setAttachment(null);
        return;
      }

      if (file.size > MAX_ATTACHMENT_SIZE) {
        setAttachment(null);
        setAttachmentError('File is too large. Maximum size is 10 MB.');
        return;
      }

      const allowedTypes = [
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

      if (file.type && !allowedTypes.includes(file.type)) {
        setAttachment(null);
        setAttachmentError('This file type is not supported.');
        return;
      }

      setAttachment(file);
    }

    function removeAttachment() {
      setAttachment(null);
      setAttachmentError('');
    }

    function handleComposerKeyDown(event) {
      if (event.key === 'Escape' && (editingMessage || replyTo)) {
        event.preventDefault();
        if (editingMessage) cancelEdit();
        else setReplyTo(null);
        return;
      }
      if (
        event.nativeEvent?.isComposing ||
        event.isComposing
      ) {
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!sending && (text.trim() || attachment)) {
          sendMessage();
        }
      }
    }

    function updateMessageEverywhere(updated) {
      setMessageMap((current) => {
        const key = String(updated.order_id);
        return { ...current, [key]: (current[key] || []).map((row) => String(row.id) === String(updated.id) ? { ...row, ...updated } : row) };
      });
      if (updated.order_id) void refreshAdminSummaries([updated.order_id]).catch((summaryError) => setError(summaryError?.message || 'Could not refresh conversation summary.'));
    }

    function beginReply(message) {
      if (staffRole === 'finance') return;
      setEditingMessage(null);
      setReplyTo(message);
      requestAnimationFrame(() => document.querySelector('.messages-unified-container.mobile-chat-active .messages-composer-textarea')?.focus());
    }

    function beginEdit(message) {
      if (message.deleted_at) return;
      const originalText = parseMessageBody(message.body).text;
      setEditingMessage({ id: message.id, orderId: String(message.order_id), originalText, draft: text, draftAttachment: attachment });
      setReplyTo(null);
      setAttachment(null);
      setText(originalText);
      requestAnimationFrame(() => document.querySelector('.messages-unified-container.mobile-chat-active .messages-composer-textarea')?.focus());
    }

    function cancelEdit() {
      if (!editingMessage) return;
      setText(editingMessage.draft);
      setAttachment(editingMessage.draftAttachment || null);
      setEditingMessage(null);
    }

    async function saveEditedMessage() {
      if (!editingMessage || editingMessage.orderId !== String(selectedOrderId)) return;
      const nextBody = text.trim();
      if (!nextBody || nextBody === editingMessage.originalText) {
        if (nextBody === editingMessage.originalText) cancelEdit();
        return;
      }
      setSending(true);
      setError('');
      try {
        const { data, error: editError } = await supabase.rpc('edit_message_v1', { p_message_id: Number(editingMessage.id), p_body: nextBody });
        if (editError) throw editError;
        const updated = Array.isArray(data) ? data[0] : data;
        if (!updated) throw new Error('The edited message was not returned.');
        updateMessageEverywhere(updated);
        setText(editingMessage.draft);
        setAttachment(editingMessage.draftAttachment || null);
        setEditingMessage(null);
        setLiveAnnouncement('Message edited');
      } catch (editError) {
        setError(editError?.message || 'Could not edit this message.');
      } finally { setSending(false); }
    }

    async function deleteOwnMessage(message) {
      if (String(message.sender_id) !== String(staffUserId) || staffRole === 'finance' || !window.confirm('Delete this message? Its text will no longer be visible.')) return;
      setError('');
      try {
        const { data, error: deleteError } = await supabase.rpc('delete_message_v1', { p_message_id: Number(message.id) });
        if (deleteError) throw deleteError;
        const deleted = Array.isArray(data) ? data[0] : data;
        if (!deleted) throw new Error('The deleted message was not returned.');
        updateMessageEverywhere(deleted);
        if (deleted.storage_path) {
          const { error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([deleted.storage_path]);
          if (storageError) setError('Message deleted, but its attachment could not be removed. Contact support to clean up the stored file.');
        }
        setLiveAnnouncement('Message deleted');
      } catch (deleteError) {
        setError(deleteError?.message || 'Could not delete this message.');
      }
    }

    async function scrollToReferencedMessage(messageId) {
      let target = selectedMessages.find((item) => String(item.id) === String(messageId));
      if (!target) {
        const { data, error: contextError } = await supabase.rpc('get_message_reply_context_v1', { p_message_id: Number(messageId) });
        if (contextError) { setError(contextError.message || 'Could not load the referenced message.'); return; }
        target = Array.isArray(data) ? data[0] : data;
        if (target && String(target.order_id) === String(selectedOrderId)) {
          setMessageMap((current) => {
            const key = String(target.order_id); const rows = current[key] || [];
            return { ...current, [key]: rows.some((item) => String(item.id) === String(target.id)) ? rows : [...rows, target].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) };
          });
        }
      }
      if (!target) return;
      setHighlightedMessageId(String(messageId));
      requestAnimationFrame(() => {
        document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.setTimeout(() => setHighlightedMessageId(null), 1600);
      });
    }

    async function sendMessage() {
      if (editingMessage) { await saveEditedMessage(); return; }
      const body = text.trim();

      if (
        (!body && !attachment) ||
        !selectedOrder ||
        !staffUserId ||
        staffRole === 'finance' ||
        sending ||
        !supabase
      ) {
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setError('You appear to be offline. Please check your internet connection and try again.');
        return;
      }

      setSending(true);
      setError('');
      setAttachmentError('');
      let uploadedPath = '';

      try {
        let attachmentData = null;

        if (attachment) {
          const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          const path = `${staffUserId}/${selectedOrder.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
          uploadedPath = path;

          const { error: uploadError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .upload(path, attachment, {
              cacheControl: '3600',
              upsert: false,
              contentType: attachment.type || 'application/octet-stream'
            });

          if (uploadError) {
            throw new Error(
              uploadError.message ||
              `Could not upload attachment to '${ATTACHMENT_BUCKET}'.`
            );
          }

          attachmentData = {
            name: attachment.name,
            size: attachment.size,
            type: attachment.type || 'application/octet-stream',
            path
          };
        }

        const storedBody = attachmentData
          ? `__CAREERLYST_ATTACHMENT__:${JSON.stringify({ text: body, attachment: attachmentData })}`
          : body;

        const {
          data,
          error: sendError
        } = await supabase
          .from('messages')
          .insert({
            order_id: selectedOrder.id,
            sender_id: staffUserId,
            body: storedBody,
            reply_to_message_id: replyTo?.id || null
          })
          .select(
            'id, order_id, sender_id, body, created_at, read_at, reply_to_message_id, edited_at, deleted_at'
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
        setReplyTo(null);
        setAttachment(null);
        setDrafts((current) => ({ ...current, [String(selectedOrder.id)]: { text: '', attachment: null } }));
        setLiveAnnouncement('Message sent');
      } catch (sendError) {
        console.error(
          'Admin message send error:',
          sendError
        );

        if (uploadedPath && supabase) {
          const { error: cleanupError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .remove([uploadedPath]);
          if (cleanupError) {
            sendError.message = `${sendError.message || 'Message could not be sent.'} The uploaded file could not be cleaned up; contact support with path ${uploadedPath}.`;
          }
        }

        const errMsg =
          sendError?.message && typeof sendError.message === 'string'
            ? sendError.message
            : 'Message could not be sent. Please check your network connection and try again.';

        setError(errMsg);
        if (attachment) {
          setAttachmentError(errMsg);
        }
      } finally {
        setSending(false);
      }
    }

    async function markAdminConversationRead(orderId) {
      if (!orderId) return;
      if (!supabase || Number.isNaN(Number(orderId))) return;

      try {
        const { error: readError } = await supabase.rpc(
          'mark_order_messages_read_v1',
          { p_order_id: Number(orderId) }
        );
        if (readError) throw readError;
        await refreshAdminSummaries(ordersRef.current.map((order) => order.id));
        await loadAdminThread(orderId);
      } catch (err) {
        console.error('Admin markConversationRead error:', err);
        setThreadError(err?.message || 'Could not mark this conversation as read.');
      }
    }
    markAdminConversationReadRef.current = markAdminConversationRead;

    function selectOrder(orderId) {
      if (sending) return;
      if (selectedOrderId) {
        setDrafts((current) => ({
          ...current,
          [String(selectedOrderId)]: { text: editingMessage?.draft ?? text, attachment: editingMessage?.draftAttachment ?? attachment }
        }));
      }
      setEditingMessage(null);
      setReplyTo(null);
      const nextDraft = drafts[String(orderId)] || { text: '', attachment: null };
      selectedOrderIdRef.current = orderId;
      setSelectedOrderId(orderId);
      setMobileView('chat');
      setText(nextDraft.text);
      setError('');
      setAttachment(nextDraft.attachment);
      setAttachmentError('');
      void loadAdminThread(orderId);

      const targetOrder = orders.find(
        (order) => String(order.id) === String(orderId)
      );
      if (targetOrder?.user_id) {
        setExpandedClientIds((prev) => new Set([...prev, String(targetOrder.user_id)]));
      }

      markAdminConversationRead(orderId);
    }

    function selectMessageForActions(messageId) {
      const key = String(messageId);
      if (activeActionMessageId === key) {
        setActiveActionMessageId(null);
        return;
      }
      setActiveActionMessageId(key);
      requestAnimationFrame(() => {
        const body = chatBodyRef.current;
        const actions = document.getElementById(`message-${key}`)?.querySelector('.message-actions.is-contextual');
        if (!body || !actions) return;
        const bodyRect = body.getBoundingClientRect();
        const actionsRect = actions.getBoundingClientRect();
        const delta = actionsRect.bottom > bodyRect.bottom - 8
          ? actionsRect.bottom - bodyRect.bottom + 8
          : actionsRect.top < bodyRect.top + 8
            ? actionsRect.top - bodyRect.top - 8
            : 0;
        if (delta) {
          actionScrollProgrammaticRef.current = true;
          body.scrollBy({ top: delta, behavior: 'smooth' });
          window.clearTimeout(actionScrollTimerRef.current);
          actionScrollTimerRef.current = window.setTimeout(() => { actionScrollProgrammaticRef.current = false; }, 450);
        }
      });
    }

    function toggleClient(userId) {
      setExpandedClientIds((prev) => {
        const next = new Set(prev);
        const key = String(userId);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    }

    function getOrderLabel(order) {
      const service = order.service_name || 'Formant service';
      const packageName = order.package_name
        ? ` · ${order.package_name}`
        : '';

      return `${service}${packageName}`;
    }

    return (
      <DashboardShell admin>
        <div ref={messagesRootRef} className={`messages-unified-container admin-messages-view ${mobileView === 'chat' ? 'mobile-chat-active' : ''}`}>
          <header className="messages-unified-head">
            <div>
              <p className="eyebrow">ADMIN</p>
              <h1>Messages</h1>
              <p>
                Conversations organized by client and project.
              </p>
            </div>

            <div className="messages-unified-head-actions">
              <div className="messages-notif-wrap admin-messages-notification-wrap">
                <button
                  type="button"
                  className="messages-notif-btn admin-messages-notification-button"
                  onClick={() => setNotificationsOpen((value) => !value)}
                  aria-label={`Notifications${unreadTotal ? `, ${unreadTotal} unread` : ''}`}
                  aria-expanded={notificationsOpen}
                >
                  <span className="admin-messages-notification-icon" aria-hidden="true">🔔</span>
                  {unreadTotal > 0 && <span className="messages-notif-badge">{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
                </button>
                {notificationsOpen && (
                  <div className="messages-notif-panel admin-messages-notification-panel">
                    <div className="messages-notif-panel-head admin-messages-notification-head">
                      <strong>Notifications</strong>
                      <span>{unreadTotal} unread</span>
                    </div>
                    {!notifications.length ? (
                      <div className="admin-messages-notification-empty" style={{ padding: '14px', fontSize: '12px', color: '#888', textAlign: 'center' }}>
                        No unread client messages.
                      </div>
                    ) : notifications.map((notification) => (
                      <button
                        type="button"
                        className="messages-notif-item admin-messages-notification-item"
                        key={`${notification.order.id}-${notification.latest.id}`}
                        onClick={() => {
                          selectOrder(notification.order.id);
                          setNotificationsOpen(false);
                        }}
                      >
                        <span className="admin-messages-notification-dot" />
                        <div className="messages-notif-item-copy">
                          <strong>{notification.clientName}</strong>
                          <small>Order #{notification.order.id} · {parseMessageBody(notification.latest.body).text || (parseMessageBody(notification.latest.body).attachment ? `📎 ${parseMessageBody(notification.latest.body).attachment.name}` : 'New message')}</small>
                        </div>
                        {notification.unread > 0 && (
                          <span className="messages-thread-unread-pill" style={{ margin: 'auto 0 auto auto' }}>{notification.unread}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={`messages-live-indicator ${connection === 'online' ? 'online' : connection === 'connecting' ? 'connecting' : 'offline'}`}>
                <span className="messages-live-dot" />
                <span>{connection === 'online' ? 'Live' : connection === 'connecting' ? 'Connecting…' : 'Offline'}</span>
              </div>
            </div>
          </header>

          {error && (
            <div
              className="project-brief-error messages-error"
              role="alert"
              style={{ marginBottom: 0 }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Dismiss"
                style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800 }}
              >
                ×
              </button>
            </div>
          )}

          <div className={`messages-chat-shell ${mobileView === 'chat' ? 'mobile-view-chat' : 'mobile-view-list'}`}>
            <aside className="messages-inbox-sidebar">
              <div className="messages-inbox-header">
                <div className="messages-inbox-header-title">
                  <span>Clients</span>
                  <span className="messages-inbox-count-badge">{groupedClients.length}</span>
                </div>

                <small style={{ fontSize: '11px', color: '#6d7069' }}>
                  {visibleOrderCount} project{visibleOrderCount === 1 ? '' : 's'}
                </small>
              </div>

              <div className="messages-inbox-search-wrap">
                <div className="messages-inbox-search">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search clients or projects…"
                    aria-label="Search clients or projects"
                  />
                </div>
              </div>

              <div className="messages-filter-tabs" aria-label="Conversation filters">
                <button
                  type="button"
                  aria-pressed={filterMode === 'all'}
                  className={`messages-filter-btn ${filterMode === 'all' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('all')}
                >
                  All
                </button>
                <button
                  type="button"
                  aria-pressed={filterMode === 'unread'}
                  className={`messages-filter-btn ${filterMode === 'unread' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('unread')}
                >
                  Unread
                  {totalUnreadOrders > 0 && (
                    <span className="messages-filter-count">{totalUnreadOrders}</span>
                  )}
                </button>
                <button
                  type="button"
                  aria-pressed={filterMode === 'needs_reply'}
                  className={`messages-filter-btn ${filterMode === 'needs_reply' ? 'is-active' : ''}`}
                  onClick={() => setFilterMode('needs_reply')}
                >
                  Needs Reply
                  {totalNeedsReplyOrders > 0 && (
                    <span className="messages-filter-count">{totalNeedsReplyOrders}</span>
                  )}
                </button>
              </div>

              <div className="messages-inbox-list">
                {loading ? (
                  <div className="messages-empty-state"><SkeletonState label="Loading client conversations" variant="messages" count={4} /></div>
                ) : !groupedClients.length ? (
                  <div className="messages-empty-state">
                    <div className="messages-empty-state-icon">
                      {filterMode === 'unread' ? '✓' : filterMode === 'needs_reply' ? '✉️' : '⌕'}
                    </div>
                    <h3>
                      {filterMode === 'unread'
                        ? 'No unread messages'
                        : filterMode === 'needs_reply'
                        ? 'No replies needed'
                        : 'No matching clients'}
                    </h3>
                    <p>
                      {filterMode === 'unread'
                        ? 'All client messages have been read.'
                        : filterMode === 'needs_reply'
                        ? 'The latest message in each conversation has been answered.'
                        : 'Try searching for a different client name or order ID.'}
                    </p>
                  </div>
                ) : (
                  groupedClients.map((group) => {
                    const isExpanded = expandedClientIds.has(String(group.userId));
                    const hasActiveProject = group.orders.some(
                      ({ order }) => String(order.id) === String(selectedOrderId)
                    );

                    return (
                      <section
                        className={`messages-admin-client-group admin-client-group ${isExpanded ? 'is-expanded' : ''} ${hasActiveProject ? 'has-active-project' : ''}`}
                        key={String(group.userId)}
                      >
                        <button
                          type="button"
                          id={`client-head-${group.userId}`}
                          className={`messages-admin-client-group-head admin-client-group-head ${isExpanded ? 'is-expanded' : ''}`}
                          onClick={() => toggleClient(group.userId)}
                          aria-expanded={isExpanded}
                          aria-controls={`client-projects-${group.userId}`}
                        >
                          <div className="messages-admin-client-identity admin-client-group-identity">
                            <ProfileAvatar className="messages-admin-client-avatar admin-client-group-avatar" avatarId={group.avatarId} decorative initials={group.clientName.charAt(0).toUpperCase()} />

                            <div>
                              <strong>{group.clientName}</strong>
                              <small>
                                {group.orders.length} project{group.orders.length === 1 ? '' : 's'}
                              </small>
                            </div>
                          </div>

                          <div className="messages-admin-client-head-right">
                            {hasActiveProject && !isExpanded && (
                              <span
                                className="messages-admin-client-active-dot"
                                title="Contains active conversation"
                                aria-label="Contains active conversation"
                              />
                            )}

                            {group.unread > 0 && (
                              <span className="messages-admin-client-unread-badge admin-client-group-unread">
                                {group.unread}
                              </span>
                            )}

                            <span
                              className={`messages-admin-client-chevron ${isExpanded ? 'is-expanded' : ''}`}
                              aria-hidden="true"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div
                            id={`client-projects-${group.userId}`}
                            className="messages-admin-project-list admin-client-projects"
                            role="region"
                            aria-labelledby={`client-head-${group.userId}`}
                          >
                            {group.orders.map(({ order, last, unread }) => {
                              const active = String(order.id) === String(selectedOrderId);
                              const lastParsed = parseMessageBody(last?.body);
                              const snippetText =
                                lastParsed.text ||
                                (lastParsed.attachment
                                  ? `📎 ${lastParsed.attachment.name}`
                                  : 'No messages yet — start the conversation.');

                              return (
                                <button
                                  className={`messages-admin-project-item admin-client-project ${active ? 'is-active' : ''}`}
                                  type="button"
                                  key={order.id}
                                  disabled={sending}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectOrder(order.id);
                                  }}
                                >
                                  <div className="messages-admin-project-copy admin-client-project-copy">
                                    <div className="messages-admin-project-top admin-client-project-top">
                                      <small>ORDER #{order.id}</small>
                                      <small>
                                        {last
                                          ? formatMessageTime(last.created_at)
                                          : formatOrderDate(order.created_at)}
                                      </small>
                                    </div>

                                    <strong>{getOrderLabel(order)}</strong>

                                    <span>{snippetText}</span>
                                  </div>

                                  {unread > 0 && (
                                    <span className="messages-thread-unread-pill" style={{ marginLeft: 6 }}>
                                      {unread}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })
                )}
              </div>
            </aside>

            <section className="messages-chat-pane">
              {!selectedOrder ? (
                <div className="messages-empty-state">
                  <div className="messages-empty-state-icon">💬</div>
                  <h3>Select a project</h3>
                  <p>Choose a project under a client to open the conversation.</p>
                </div>
              ) : (
                <>
                  <header className="messages-chat-header">
                    <div className="messages-chat-header-identity">
                      <button
                        type="button"
                        className="messages-mobile-back-btn"
                        onClick={() => setMobileView('list')}
                        title="Back to conversations"
                        aria-label="Back to conversations"
                      >
                        ←
                      </button>

                      <ProfileAvatar className="messages-chat-avatar" avatarId={profiles[selectedOrder.user_id]?.avatar_id} decorative initials={(profiles[selectedOrder.user_id]?.name || 'Client').charAt(0).toUpperCase()} />

                      <div className="messages-chat-header-details">
                        <h2 className="messages-chat-title">
                          {profiles[selectedOrder.user_id]?.name || 'Client'}
                        </h2>
                        <div className="messages-chat-subtitle">
                          <span>Order #{selectedOrder.id}</span>
                          <span>·</span>
                          <span>{getOrderLabel(selectedOrder)}</span>
                          <span className={`messages-chat-status-pill ${String(selectedOrder.status || '').toLowerCase()}`}>
                            {String(selectedOrder.status || 'pending').replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="messages-chat-header-actions">
                      <Link to="/admin/workspace" className="messages-workspace-link">
                        Open workspace →
                      </Link>
                    </div>
                  </header>

                  <div
                    className="messages-chat-body"
                    ref={chatBodyRef}
                    role="log"
                    aria-label="Conversation messages"
                  >
                    {threadError ? (
                      <div className="messages-empty-state messages-empty-state-error" role="alert">
                        <div className="messages-empty-state-icon">⚠️</div>
                        <h3>Could not load conversation</h3>
                        <p>{threadError}</p>
                        <button type="button" className="btn dark" onClick={() => void loadAdminThread(selectedOrder.id)}>Retry</button>
                      </div>
                    ) : loadingThread ? (
                      <div className="messages-empty-state"><SkeletonState label="Loading messages" variant="thread" count={4} /></div>
                    ) : !selectedMessages.length ? (
                      <div className="messages-empty-state">
                        <div className="messages-empty-state-icon">✉️</div>
                        <h3>Start the project conversation</h3>
                        <p>Send the first update, question or next-step instruction to the client.</p>
                      </div>
                    ) : (
                      <>
                        {hasOlderMessages && (
                          <button
                            type="button"
                            className="messages-load-older"
                            disabled={loadingThread}
                            onClick={() => void loadAdminThread(selectedOrder.id, selectedMessages[0], true)}
                          >
                            {loadingThread ? 'Loading…' : 'Load older messages'}
                          </button>
                        )}
                        <div className="messages-system-notice">
                          This conversation is shared with the client in their Formant dashboard.
                        </div>

                        {selectedMessages.map((message) => {
                          const isClientMessage = String(message.sender_id) === String(selectedOrder.user_id);
                          const isTeam = !isClientMessage;
                          const staffSenderName = profiles[message.sender_id]?.name;
                          const parsed = parseMessageBody(message.body);

                          return (
                            <div
                              id={`message-${message.id}`}
                              tabIndex={0}
                              role="group"
                              aria-label={`Message from ${isTeam ? 'Formant Team' : profiles[selectedOrder.user_id]?.name || 'Client'}. Press Enter or Space to show actions.`}
                              onClick={(event) => {
                                if (event.target.closest?.('button, a, input, textarea, .message-actions')) return;
                                selectMessageForActions(message.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                                event.preventDefault();
                                selectMessageForActions(message.id);
                              }}
                              className={`messages-row ${isTeam ? 'is-sent' : 'is-received'} ${String(activeActionMessageId) === String(message.id) ? 'has-context-actions' : ''} ${String(highlightedMessageId) === String(message.id) ? 'is-highlighted' : ''}`}
                              key={message.id}
                            >
                              <span className="messages-sender-tag">
                                {isTeam
                                  ? (String(message.sender_id) === String(staffUserId)
                                      ? 'You · Formant Team'
                                      : staffSenderName || 'Formant Team')
                                  : profiles[selectedOrder.user_id]?.name || 'Client'}
                              </span>

                              <div className="messages-bubble">
                                {message.reply_to_message_id && (() => {
                                  const original = selectedMessages.find((item) => String(item.id) === String(message.reply_to_message_id));
                                  const originalText = original?.deleted_at ? 'Original message was deleted' : original ? parseMessageBody(original.body).text || 'Attachment' : 'Referenced message';
                                  return <button type="button" className="messages-reply-reference" onClick={() => void scrollToReferencedMessage(message.reply_to_message_id)}><strong>Reply to {original ? (String(original.sender_id) === String(selectedOrder.user_id) ? (profiles[selectedOrder.user_id]?.name || 'Client') : 'Formant Team') : 'message'}</strong><span>{originalText.slice(0, 120)}</span></button>;
                                })()}
                                {message.deleted_at ? (
                                  <div className="messages-deleted-copy" role="note">This message was deleted.</div>
                                ) : parsed.text && (
                                  <div className="messages-bubble-text">
                                    {parsed.text}
                                  </div>
                                )}

                                {!message.deleted_at && parsed.attachment && (
                                  <AdminMessageAttachmentLink
                                    attachment={parsed.attachment}
                                    isTeam={isTeam}
                                  />
                                )}

                                <div className="messages-bubble-footer">
                                  <span>{formatMessageTime(message.created_at)}</span>
                                  {message.edited_at && !message.deleted_at && <span className="messages-edited-label"> · Edited</span>}
                                  {isTeam && (
                                    <span className="messages-read-status" title={Boolean(message.read_at) ? 'Seen by client' : 'Sent'}>
                                      {Boolean(message.read_at) ? ' · Seen ✓' : ' · Sent'}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <MessageActions
                                active={String(activeActionMessageId) === String(message.id)}
                                contextual
                                canReply={staffRole !== 'finance'}
                                canEdit={String(message.sender_id) === String(staffUserId) && !message.deleted_at && !parsed.attachment && staffRole !== 'finance'}
                                canDelete={String(message.sender_id) === String(staffUserId) && !message.deleted_at && staffRole !== 'finance'}
                                onReply={() => { setActiveActionMessageId(null); beginReply(message); }}
                                onEdit={() => { setActiveActionMessageId(null); beginEdit(message); }}
                                onDelete={() => { setActiveActionMessageId(null); void deleteOwnMessage(message); }}
                              />
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {staffRole === 'finance' && (
                    <div className="messages-finance-readonly" role="status" style={{ margin: '8px 18px' }}>
                      Finance has read-only access to client conversations.
                    </div>
                  )}

                    <div className="messages-composer-area">
                    <div
                      className="sr-only"
                      aria-live="polite"
                      aria-atomic="true"
                      role="status"
                    >
                      {liveAnnouncement}
                    </div>

                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        sendMessage();
                      }}
                    >
                      <div className="messages-composer-box">
                        {(replyTo || editingMessage) && (
                          <div className={`messages-composer-context ${editingMessage ? 'is-editing' : ''}`} role="status">
                            <div><strong>{editingMessage ? 'Editing message' : 'Replying to'}</strong><span>{editingMessage ? editingMessage.originalText : (replyTo.deleted_at ? 'Original message was deleted' : parseMessageBody(replyTo.body).text || 'Attachment').slice(0, 120)}</span></div>
                            <button type="button" onClick={() => editingMessage ? cancelEdit() : setReplyTo(null)} aria-label={editingMessage ? 'Cancel edit' : 'Cancel reply'}>×</button>
                          </div>
                        )}
                        {attachment && (
                          <div className="messages-attachment-preview">
                            <span>📎</span>
                            <strong>{attachment.name}</strong>
                            <small>({formatFileSize(attachment.size)})</small>
                            <button
                              type="button"
                              onClick={removeAttachment}
                              disabled={sending}
                              aria-label="Remove attachment"
                            >
                              ×
                            </button>
                          </div>
                        )}

                        {attachmentError && (
                          <div className="messages-attachment-error" role="alert">
                            {attachmentError}
                          </div>
                        )}

                        <div className="messages-composer-row">
                          <label
                            className="messages-attach-btn"
                            title="Attach file (PDF, Word, images up to 10 MB)"
                          >
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.webp"
                              onChange={handleAttachmentChange}
                              disabled={!selectedOrderId || sending || staffRole === 'finance' || Boolean(editingMessage)}
                              aria-label="Attach file"
                            />
                            <span>+</span>
                          </label>

                          <textarea
                            className="messages-composer-textarea"
                            onFocus={handleMessageComposerFocus}
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            onKeyDown={handleComposerKeyDown}
                            placeholder={`Write to ${profiles[selectedOrder.user_id]?.name || 'your client'}…`}
                            maxLength={2000}
                            rows={1}
                            disabled={sending || staffRole === 'finance'}
                            aria-label={editingMessage ? 'Edit message text' : 'Write a message'}
                          />

                          <button
                            className="messages-send-btn"
                            type="submit"
                            disabled={
                              sending || staffRole === 'finance' || (!text.trim() && !attachment)
                            }
                            aria-label={editingMessage ? 'Save edited message' : replyTo ? 'Send reply' : 'Send message'}
                          >
                            {sending ? (editingMessage ? 'Saving…' : 'Sending…') : editingMessage ? 'Save edit' : 'Send ↗'}
                          </button>
                        </div>

                        <div className="messages-composer-footer">
                          <span className="messages-composer-hint">
                            Enter to send · Shift + Enter for new line
                          </span>
                          <span
                            className="messages-composer-counter"
                            aria-label={`${text.length} of 2000 characters`}
                          >
                            {text.length}/2000
                          </span>
                        </div>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </DashboardShell>
    );
  }

  export function AdminMessages() {
    return <AdminMessagesPage />;
  }

  export function AdminNotifications() {
    return <AdminNotificationsPage />;
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
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [attachmentRowsLoaded, setAttachmentRowsLoaded] = useState(0);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const hasLoadedFilesRef = useRef(false);

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

  async function loadFiles({ append = false } = {}) {
    if (!supabase) {
      setFiles([]);
      setOrders([]);
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }

    if (append) setLoadingMore(true);
    else if (hasLoadedFilesRef.current) setRefreshing(true);
    else setLoading(true);
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
        setHasMoreFiles(false);
        setAttachmentRowsLoaded(0);
        hasLoadedFilesRef.current = true;
        return;
      }

      const { data: messageData, error: messageError } = await supabase.rpc(
        'admin_list_message_attachments_v1',
        { p_limit: 100, p_offset: append ? attachmentRowsLoaded : 0 }
      );

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
            .select('id, full_name, name, email, avatar_id')
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
            avatarId: profile?.avatar_id ?? null,
            serviceName: order?.service_name || 'Formant service',
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
          avatarId: profile?.avatar_id ?? null,
          serviceName: order.service_name || 'Formant service',
          packageName: order.package_name || '',
          status: order.status || '',
          createdAt: order.created_at
        };
      });

      setOrders(normalizedOrders);
      setFiles((current) => append
        ? [...current, ...extracted.filter((file) => !current.some((item) => item.id === file.id))]
        : extracted);
      setAttachmentRowsLoaded((current) => append ? current + (messageData || []).length : (messageData || []).length);
      setHasMoreFiles((messageData || []).length === 100);
      if (!append) hasLoadedFilesRef.current = true;

    } catch (loadError) {
      console.error('Admin files load error:', loadError);
      setError(loadError?.message || 'Files could not be loaded.');
    } finally {
      if (append) setLoadingMore(false);
      else {
        setLoading(false);
        setRefreshing(false);
      }
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
       * Existing Formant attachment files are private message attachments.
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
          avatarId: file.avatarId,
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
          avatarId: file.avatarId,
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
      const { error: unlinkError } = await supabase.rpc(
        'admin_remove_message_attachment_v1',
        { p_message_id: Number(file.messageId), p_storage_path: file.path }
      );
      if (unlinkError) throw unlinkError;
      const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([file.path]);

      setFiles((current) =>
        current.filter((item) => item.id !== file.id)
      );

      setSelectedIds((current) =>
        current.filter((id) => id !== file.id)
      );

      setNotice(storageError
        ? `The conversation no longer links this file, but storage cleanup failed for "${file.path}". Remove that object from the private message-attachments bucket.`
        : 'File removed.');

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
          const { error: unlinkError } = await supabase.rpc(
            'admin_remove_message_attachment_v1',
            { p_message_id: Number(file.messageId), p_storage_path: file.path }
          );
          if (unlinkError) throw unlinkError;
          const { error: storageError } = await supabase.storage
            .from(ATTACHMENT_BUCKET)
            .remove([file.path]);
          if (storageError) throw storageError;

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
    <DashboardShell admin>
      <main className="admin-files-page">
        <div className="dash-head admin-files-head">
          <div>
            <p className="eyebrow">ADMIN / FILES</p>
            <h1>File management</h1>
            <p>
              Manage files shared through Formant client conversations,
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
              disabled={loading || refreshing}
            >
              {loading || refreshing ? 'Refreshing…' : 'Refresh'}
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
              <section className="admin-files-panel"><SkeletonState label="Loading the file library" variant="rows" count={5} /></section>
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
                        <ProfileAvatar className="admin-files-client-avatar" avatarId={group.avatarId} decorative initials={getInitials(group.name)} />

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
            {!loading && hasMoreFiles && (
              <div className="admin-files-load-more">
                <button type="button" className="admin-files-btn" onClick={() => void loadFiles({ append: true })} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more files'}
                </button>
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


  export { default as AdminSettings } from './AdminSettings';

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

            <p>This section is not available yet.</p>

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
              Sign in to access the Formant
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
                placeholder="you@example.com"
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
            Formant's secure authentication system.
          </p>

        </div>

      </div>

    );
  }


  /* =========================================================
    ADMIN GATE
    ========================================================= */

  export function AdminGate() {
    // /admin is wrapped by AdminProtected in the route table.
    return <AdminOverview />;
  }




  /* =========================================================
    PHASE 1H — TEAM WORKSPACE
    ========================================================= */


  export {
    default as AdminWorkspace
  } from './AdminWorkspace';
