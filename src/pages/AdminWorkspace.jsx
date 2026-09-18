import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

const STAFF_ROLES = ['admin', 'expert', 'support', 'finance'];
const ACTIVE_STATUSES = ['pending', 'information_required', 'queued', 'in_progress', 'internal_review', 'client_review', 'revision'];
const STATUS_OPTIONS = [
  ['pending', 'Pending'],
  ['information_required', 'Information required'],
  ['queued', 'Queued'],
  ['in_progress', 'In progress'],
  ['internal_review', 'Internal review'],
  ['client_review', 'Client review'],
  ['revision', 'Revision'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled']
];
const ACTIVE_CAPACITY = 2;

function prettyStatus(value) {
  const found = STATUS_OPTIONS.find(([key]) => key === String(value || '').toLowerCase());
  return found?.[1] || String(value || 'Pending').replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', withTime
    ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', year: 'numeric' }
  ).format(date);
}

function money(order) {
  const currency = order?.currency || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(order?.total || 0));
  } catch {
    return `${currency} ${Number(order?.total || 0).toFixed(2)}`;
  }
}

function StatusPill({ status }) {
  return <span className={`team-status team-status-${String(status || 'pending').toLowerCase()}`}>{prettyStatus(status)}</span>;
}

function Field({ label, value, full = false, link = false }) {
  const text = value ? String(value) : '';
  return (
    <div className={`team-field ${full ? 'team-field-full' : ''}`}>
      <span>{label}</span>
      <div>
        {text ? (
          link && /^https?:\/\//i.test(text)
            ? <a href={text} target="_blank" rel="noreferrer">{text}</a>
            : text
        ) : <em>Not provided</em>}
      </div>
    </div>
  );
}

function BriefPanel({ order, brief, clientName, onClose }) {
  if (!order) return null;
  return (
    <div className="team-drawer-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="team-drawer" aria-label="Order details">
        <header className="team-drawer-head">
          <div>
            <p className="eyebrow">ORDER #{order.id}</p>
            <h2>{order.service_name || 'Careerlyst service'}</h2>
            <p>{order.package_name || 'Package'} · {clientName}</p>
          </div>
          <button type="button" className="team-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="team-drawer-body">
          <section className="team-detail-summary">
            <div><span>Status</span><StatusPill status={order.status} /></div>
            <div><span>Payment</span><strong>{String(order.payment_status || 'pending')}</strong></div>
            <div><span>Total</span><strong>{money(order)}</strong></div>
            <div><span>Created</span><strong>{formatDate(order.created_at)}</strong></div>
          </section>

          <section className="team-brief-section">
            <p className="team-section-kicker">CLIENT</p>
            <div className="team-field-grid">
              <Field label="Name" value={clientName} />
              <Field label="User ID" value={order.user_id} />
              <Field label="Client notes" value={order.client_notes} full />
            </div>
          </section>

          {!brief ? (
            <div className="team-empty team-empty-compact">
              <h3>No project brief yet.</h3>
              <p>The client has not submitted the information needed to start this order.</p>
            </div>
          ) : (
            <>
              <section className="team-brief-section">
                <p className="team-section-kicker">01 · DIRECTION</p>
                <div className="team-field-grid">
                  <Field label="Target role" value={brief.target_role} />
                  <Field label="Experience" value={brief.experience} />
                  <Field label="Education" value={brief.education} />
                  <Field label="Deadline" value={brief.deadline} />
                  <Field label="Career goal" value={brief.career_goal} full />
                </div>
              </section>
              <section className="team-brief-section">
                <p className="team-section-kicker">02 · RESUME / COVER / INTERVIEW</p>
                <div className="team-field-grid">
                  <Field label="Current CV" value={brief.current_cv} full link />
                  <Field label="Job description" value={brief.job_description} full />
                  <Field label="Achievements" value={brief.achievements} full />
                </div>
              </section>
              <section className="team-brief-section">
                <p className="team-section-kicker">03 · LINKEDIN</p>
                <div className="team-field-grid">
                  <Field label="LinkedIn URL" value={brief.linkedin_url} full link />
                </div>
              </section>
              <section className="team-brief-section">
                <p className="team-section-kicker">04 · GITHUB / PORTFOLIO</p>
                <div className="team-field-grid">
                  <Field label="GitHub URL" value={brief.github_url} link />
                  <Field label="Portfolio URL" value={brief.portfolio_url} link />
                  <Field label="Projects" value={brief.projects} full />
                  <Field label="Preferred style" value={brief.preferred_style} full />
                </div>
              </section>
              <section className="team-brief-section">
                <p className="team-section-kicker">05 · ADDITIONAL NOTES</p>
                <Field label="Client notes" value={brief.additional_notes} full />
              </section>
              <p className="team-brief-meta">Brief submitted {formatDate(brief.submitted_at || brief.updated_at || brief.created_at, true)}</p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function EditDrawer({ order, brief, clientName, role, saving, onClose, onSave }) {
  const [status, setStatus] = useState(order?.status || 'pending');
  const [queue, setQueue] = useState(order?.queue_position ?? '');
  const [notes, setNotes] = useState(order?.client_notes || '');

  useEffect(() => {
    setStatus(order?.status || 'pending');
    setQueue(order?.queue_position ?? '');
    setNotes(order?.client_notes || '');
  }, [order]);

  if (!order) return null;
  const canEdit = role === 'admin' || role === 'expert' || role === 'support';

  return (
    <div className="team-drawer-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="team-drawer team-edit-drawer" aria-label="Edit order">
        <header className="team-drawer-head">
          <div><p className="eyebrow">MANAGE ORDER #{order.id}</p><h2>{clientName}</h2><p>{order.service_name || 'Careerlyst service'} · {order.package_name || 'Package'}</p></div>
          <button type="button" className="team-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="team-drawer-body team-edit-form" onSubmit={(e) => { e.preventDefault(); onSave({ status, queue_position: queue === '' ? null : Math.max(1, Number(queue)), client_notes: notes }); }}>
          {!canEdit && <div className="team-permission-note">Your <strong>{role}</strong> role is read-only for order workflow changes.</div>}
          <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!canEdit || saving}>{STATUS_OPTIONS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>Queue position<input type="number" min="1" step="1" value={queue} onChange={(e) => setQueue(e.target.value)} placeholder="Leave empty if not queued" disabled={!canEdit || saving} /></label>
          <label>Internal/client note context<textarea rows="8" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add useful context for the team…" disabled={!canEdit || saving} /></label>
          <div className="team-form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            {canEdit && <button type="submit" className="btn dark" disabled={saving}>{saving ? 'Saving…' : 'Save changes →'}</button>}
          </div>
          {brief && <div className="team-inline-note"><strong>Brief available.</strong> Open the brief from the order list to review the client's full project direction.</div>}
        </form>
      </aside>
    </div>
  );
}


function TeamConversationDrawer({
  order,
  clientName,
  staffUserId,
  role,
  messages,
  loading,
  sending,
  text,
  connection,
  error,
  onTextChange,
  onKeyDown,
  onSend,
  onClose,
  bodyRef,
  textareaRef
}) {
  if (!order) return null;

  return (
    <div
      className="team-drawer-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="team-drawer team-chat-drawer"
        aria-label="Client conversation"
      >
        <header className="team-drawer-head team-chat-head">
          <div>
            <p className="eyebrow">CONVERSATION · ORDER #{order.id}</p>
            <h2>{clientName}</h2>
            <p>
              {order.service_name || 'Careerlyst service'}
              {order.package_name ? ` · ${order.package_name}` : ''}
            </p>
          </div>

          <div className="team-chat-head-actions">
            <span className="team-chat-connection">
              <i className={connection === 'online' ? 'is-online' : ''} />
              {connection === 'online'
                ? 'Live'
                : connection === 'connecting'
                  ? 'Connecting…'
                  : 'Offline'}
            </span>
            <button
              type="button"
              className="team-close"
              onClick={onClose}
              aria-label="Close conversation"
            >
              ×
            </button>
          </div>
        </header>

        <div className="team-chat-drawer-body">
          <div className="team-chat-meta-strip">
            <span>{prettyStatus(order.status)}</span>
            <span>{clientName}</span>
          </div>

          <div className="team-chat-messages" ref={bodyRef}>
            <div className="team-chat-system-note">
              This thread is shared with the client in their Careerlyst dashboard.
            </div>

            {loading ? (
              <div className="team-chat-empty">
                Loading conversation…
              </div>
            ) : !messages.length ? (
              <div className="team-chat-empty">
                <strong>No messages yet.</strong>
                <span>Send the first project update to the client.</span>
              </div>
            ) : (
              messages.map((message) => {
                const isTeam = message.sender_id !== order.user_id;
                return (
                  <div
                    className={`team-chat-row ${isTeam ? 'is-team' : 'is-client'}`}
                    key={message.id}
                  >
                    <div className="team-chat-bubble">
                      <p>{message.body}</p>
                      <small>
                        {isTeam ? 'Careerlyst Team' : clientName}
                        {' · '}
                        {formatDate(message.created_at, true)}
                      </small>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form className="team-chat-composer" onSubmit={onSend}>
            {role === 'finance' && (
              <div className="team-permission-note">Finance access is read-only for client conversations.</div>
            )}
            {error && (
              <div className="team-chat-error" role="alert">
                {error}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={onTextChange}
              onKeyDown={onKeyDown}
              placeholder={role === 'finance' ? 'Read-only conversation' : 'Write an update or reply…'}
              rows="1"
              maxLength={2000}
              disabled={sending || role === 'finance'}
              aria-label="Message client"
            />

            <div className="team-chat-composer-footer">
              <span>
                Enter to send · Shift + Enter for a new line · {text.length}/2000
              </span>
              <button
                type="submit"
                className="btn dark"
                disabled={sending || !text.trim() || !staffUserId || role === 'finance'}
              >
                {sending ? 'Sending…' : 'Send ↗'}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

export default function AdminWorkspace() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(null);
  const [role, setRole] = useState('');
  const [orders, setOrders] = useState([]);
  const [briefs, setBriefs] = useState({});
  const [profiles, setProfiles] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [staffUserId, setStaffUserId] = useState('');
  const [conversationOrder, setConversationOrder] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [conversationText, setConversationText] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationSending, setConversationSending] = useState(false);
  const [conversationConnection, setConversationConnection] = useState('offline');
  const [conversationError, setConversationError] = useState('');
  const conversationBodyRef = useRef(null);
  const conversationTextareaRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData?.session?.user;
      if (!user) { setAuthorized(false); return; }

      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (roleError) throw roleError;
      const currentRole = roleRow?.role || '';
      if (!STAFF_ROLES.includes(currentRole)) { setAuthorized(false); return; }
      setRole(currentRole);
      setStaffUserId(user.id);
      setAuthorized(true);

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, client_notes, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (orderError) throw orderError;
      const nextOrders = orderData || [];
      setOrders(nextOrders);

      const userIds = [...new Set(nextOrders.map((o) => o.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: profileData, error: profileError } = await supabase.from('profiles').select('id, name').in('id', userIds);
        if (profileError) throw profileError;
        setProfiles(Object.fromEntries((profileData || []).map((p) => [p.id, p])));
      } else setProfiles({});

      const orderIds = nextOrders.map((o) => o.id).filter(Boolean);
      if (orderIds.length) {
        const { data: briefData, error: briefError } = await supabase.from('project_briefs').select('*').in('order_id', orderIds);
        if (briefError) throw briefError;
        setBriefs(Object.fromEntries((briefData || []).map((b) => [b.order_id, b])));
      } else setBriefs({});
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Team workspace load error:', err);
      setError(err?.message || 'Could not load the operations workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  useEffect(() => {
    if (!supabase || authorized !== true) return undefined;
    const channel = supabase.channel('careerlyst-admin-workspace')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadWorkspace(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_briefs' }, () => loadWorkspace(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authorized, loadWorkspace]);


  function scrollConversationToBottom(behavior = 'smooth') {
    const node = conversationBodyRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  }

  function resizeConversationComposer() {
    const node = conversationTextareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    const maxHeight = 168;
    const nextHeight = Math.min(Math.max(node.scrollHeight, 48), maxHeight);
    node.style.height = `${nextHeight}px`;
    node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function appendConversationMessage(nextMessage) {
    if (!nextMessage?.id) return;
    setConversationMessages((current) => {
      if (current.some((item) => String(item.id) === String(nextMessage.id))) {
        return current.map((item) =>
          String(item.id) === String(nextMessage.id) ? nextMessage : item
        );
      }
      return [...current, nextMessage].sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
      );
    });
  }

  async function markConversationRead(orderId) {
    if (!supabase || !staffUserId || !orderId) return;

    const { data, error: readError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('order_id', Number(orderId))
      .neq('sender_id', staffUserId)
      .is('read_at', null)
      .select('id, order_id, sender_id, body, created_at, read_at');

    if (readError) {
      console.error('Admin conversation read update error:', readError);
      return;
    }

    (data || []).forEach(appendConversationMessage);
  }

  useEffect(() => {
    if (!conversationOrder || !supabase || !staffUserId) {
      setConversationMessages([]);
      setConversationConnection(supabase && staffUserId ? 'offline' : 'offline');
      return undefined;
    }

    let active = true;
    let channel;
    const orderId = String(conversationOrder.id);

    async function loadConversation() {
      setConversationLoading(true);
      setConversationError('');
      setConversationConnection('connecting');
      setConversationMessages([]);

      try {
        const { data, error: messageError } = await supabase
          .from('messages')
          .select('id, order_id, sender_id, body, created_at, read_at')
          .eq('order_id', Number(orderId))
          .order('created_at', { ascending: true });

        if (!active) return;
        if (messageError) throw messageError;

        setConversationMessages(data || []);
        await markConversationRead(orderId);
        requestAnimationFrame(() => scrollConversationToBottom('auto'));
      } catch (messageError) {
        console.error('Admin conversation load error:', messageError);
        if (active) {
          setConversationMessages([]);
          setConversationError(
            messageError?.message || 'Could not load this client conversation.'
          );
        }
      } finally {
        if (active) setConversationLoading(false);
      }
    }

    loadConversation();

    channel = supabase
      .channel(`careerlyst-admin-messages-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          if (!active || !payload.new) return;
          appendConversationMessage(payload.new);
          if (String(payload.new.sender_id) !== String(conversationOrder.user_id)) {
            // A staff-authored realtime insert is already read by the client-facing thread.
          } else {
            markConversationRead(orderId);
          }
          requestAnimationFrame(() => scrollConversationToBottom('smooth'));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          if (!active || !payload.new) return;
          appendConversationMessage(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          if (!active || !payload.old) return;
          setConversationMessages((current) =>
            current.filter(
              (item) => String(item.id) !== String(payload.old.id)
            )
          );
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          setConversationConnection('online');
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setConversationConnection('offline');
        }
      });

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationOrder, staffUserId]);

  useEffect(() => {
    if (!conversationOrder || conversationLoading) return;
    requestAnimationFrame(() => scrollConversationToBottom('smooth'));
  }, [conversationMessages.length, conversationLoading, conversationOrder]);

  useEffect(() => {
    if (conversationOrder) {
      requestAnimationFrame(() => resizeConversationComposer());
    }
  }, [conversationOrder, conversationText]);

  function handleConversationKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }
    if (event.nativeEvent?.isComposing) return;
    event.preventDefault();
    if (!conversationSending && conversationText.trim() && conversationOrder && role !== 'finance') {
      event.currentTarget.form?.requestSubmit();
    }
  }

  function closeConversation() {
    if (conversationSending) return;
    setConversationOrder(null);
    setConversationMessages([]);
    setConversationText('');
    setConversationError('');
    setConversationConnection('offline');
  }

  async function sendConversationMessage(event) {
    event.preventDefault();
    const cleanText = conversationText.trim();
    if (!cleanText || !conversationOrder || !staffUserId || conversationSending || role === 'finance') return;

    setConversationSending(true);
    setConversationError('');

    try {
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({
          order_id: Number(conversationOrder.id),
          sender_id: staffUserId,
          body: cleanText
        })
        .select('id, order_id, sender_id, body, created_at, read_at')
        .single();

      if (insertError) throw insertError;
      if (data) appendConversationMessage(data);
      setConversationText('');
      requestAnimationFrame(() => {
        resizeConversationComposer();
        scrollConversationToBottom('smooth');
      });
    } catch (sendError) {
      console.error('Admin conversation send error:', sendError);
      setConversationError(
        sendError?.message || 'Could not send this message.'
      );
    } finally {
      setConversationSending(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((order) => {
      const status = String(order.status || 'pending').toLowerCase();
      const client = String(profiles[order.user_id]?.name || 'Client').toLowerCase();
      const service = String(order.service_name || '').toLowerCase();
      const matchesFilter = filter === 'all' || status === filter || (filter === 'needs_brief' && !briefs[order.id]);
      const matchesSearch = !q || String(order.id).includes(q) || client.includes(q) || service.includes(q) || String(order.package_name || '').toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [orders, profiles, briefs, search, filter]);

  const stats = useMemo(() => ({
    active: orders.filter((o) => ACTIVE_STATUSES.includes(String(o.status || 'pending').toLowerCase())).length,
    queued: orders.filter((o) => String(o.status || '').toLowerCase() === 'queued').length,
    needsBrief: orders.filter((o) => !briefs[o.id] && !['completed', 'cancelled'].includes(String(o.status || '').toLowerCase())).length,
    paid: orders.filter((o) => String(o.payment_status || '').toLowerCase() === 'paid').length,
  }), [orders, briefs]);

  async function saveOrderChanges(order, changes) {
    setSavingId(order.id);
    setError('');
    try {
      const { data, error: updateError } = await supabase
        .from('orders')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .select('id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, client_notes, created_at, updated_at')
        .single();
      if (updateError) throw updateError;
      setOrders((current) => current.map((item) => item.id === data.id ? data : item));
      setSelectedOrder((current) => current?.id === data.id ? data : current);
      setEditingOrder(null);
      showToast(`Order #${data.id} updated.`);
    } catch (err) {
      console.error('Order update error:', err);
      setError(err?.message || 'Could not update the order.');
    } finally { setSavingId(null); }
  }

  function exportOrders() {
    const rows = filteredOrders.map((o) => ({
      order_id: o.id,
      client: profiles[o.user_id]?.name || 'Client',
      service: o.service_name || '',
      package: o.package_name || '',
      amount: o.total ?? '',
      currency: o.currency || 'USD',
      status: o.status || '',
      payment_status: o.payment_status || '',
      queue_position: o.queue_position ?? '',
      brief: briefs[o.id] ? 'ready' : 'missing',
      created_at: o.created_at || ''
    }));
    const headers = Object.keys(rows[0] || { order_id: '', client: '', service: '', status: '' });
    const csv = [headers, ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`))]
      .map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `careerlyst-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Order CSV exported.');
  }

  if (authorized === false) return <Navigate to="/dashboard" replace />;
  if (authorized === null && !loading) return <Navigate to="/admin" replace />;

  return (
    <DashboardShell admin>
      <main className="team-workspace">
        <div className="team-head">
          <div>
            <p className="eyebrow">TEAM WORKSPACE · {role.toUpperCase() || 'STAFF'}</p>
            <h1>Run the work.</h1>
            <p>Live orders, client briefs and delivery status in one place.</p>
          </div>
          <div className="team-head-actions">
            <button type="button" className="btn" onClick={exportOrders} disabled={!filteredOrders.length}>Export CSV</button>
            <button type="button" className="btn dark" onClick={() => loadWorkspace()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh ↻'}</button>
          </div>
        </div>

        <section className="team-stats">
          <div><span>Active orders</span><strong>{loading ? '—' : stats.active}</strong><small>Capacity {Math.min(stats.active, ACTIVE_CAPACITY)} / {ACTIVE_CAPACITY}</small></div>
          <div><span>Queue</span><strong>{loading ? '—' : stats.queued}</strong><small>Waiting for capacity</small></div>
          <div><span>Briefs needed</span><strong>{loading ? '—' : stats.needsBrief}</strong><small>Active orders without brief</small></div>
          <div><span>Paid</span><strong>{loading ? '—' : stats.paid}</strong><small>Payment confirmed</small></div>
        </section>

        <section className="team-capacity panel">
          <div><p className="eyebrow">CAPACITY</p><h2>{Math.min(stats.active, ACTIVE_CAPACITY)} of {ACTIVE_CAPACITY} active slots in use</h2><p>{stats.queued ? `${stats.queued} order${stats.queued === 1 ? '' : 's'} waiting in the queue.` : 'No orders are currently waiting for capacity.'}</p></div>
          <div className="team-capacity-track"><i style={{ width: `${Math.min(100, (stats.active / ACTIVE_CAPACITY) * 100)}%` }} /></div>
        </section>

        <section className="team-toolbar panel">
          <div className="team-search-wrap"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, client, service or package…" /></div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter orders">
            <option value="all">All orders</option><option value="needs_brief">Needs brief</option>
            {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </section>

        {error && <div className="team-error"><strong>Workspace error</strong><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div>}
        {toast && <div className="team-toast">{toast}</div>}

        <section className="panel team-orders-panel">
          <div className="team-panel-head"><div><p className="eyebrow">ORDER QUEUE</p><h2>Projects</h2></div><span>{filteredOrders.length} shown{lastUpdated ? ` · synced ${formatDate(lastUpdated, true)}` : ''}</span></div>
          {loading ? <div className="team-empty"><h3>Loading workspace…</h3><p>Fetching live orders, profiles and project briefs.</p></div> : !filteredOrders.length ? <div className="team-empty"><h3>No matching orders.</h3><p>Try another filter or search term.</p></div> : (
            <div className="team-order-list">
              {filteredOrders.map((order) => {
                const brief = briefs[order.id];
                const client = profiles[order.user_id]?.name || 'Client';
                return (
                  <article className="team-order-card" key={order.id}>
                    <div className="team-order-main">
                      <div className="team-order-kicker"><span>ORDER #{order.id}</span><span>{formatDate(order.created_at)}</span></div>
                      <h3>{order.service_name || 'Careerlyst service'}{order.package_name ? ` · ${order.package_name}` : ''}</h3>
                      <p>{client} · {money(order)} · Payment {order.payment_status || 'Pending'}</p>
                      <div className="team-order-tags"><StatusPill status={order.status} />{order.queue_position != null && <span>Queue #{order.queue_position}</span>}<span className={brief ? 'brief-ready' : 'brief-missing'}>{brief ? 'Brief ready' : 'Brief missing'}</span></div>
                    </div>
                    <div className="team-order-actions">
                      <button type="button" className="text-button team-message-action" onClick={() => setConversationOrder(order)}>Message →</button>
                      <button type="button" className="text-button" onClick={() => setSelectedOrder(order)}>View brief →</button>
                      <button type="button" className="text-button" onClick={() => setEditingOrder(order)}>Manage →</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <div className="team-back-row"><Link to="/admin">← Back to control panel</Link></div>
      </main>
      {selectedOrder && <BriefPanel order={selectedOrder} brief={briefs[selectedOrder.id]} clientName={profiles[selectedOrder.user_id]?.name || 'Client'} onClose={() => setSelectedOrder(null)} />}
      {editingOrder && <EditDrawer order={editingOrder} brief={briefs[editingOrder.id]} clientName={profiles[editingOrder.user_id]?.name || 'Client'} role={role} saving={savingId === editingOrder.id} onClose={() => setEditingOrder(null)} onSave={(changes) => saveOrderChanges(editingOrder, changes)} />}
      {conversationOrder && (
        <TeamConversationDrawer
          order={conversationOrder}
          clientName={profiles[conversationOrder.user_id]?.name || 'Client'}
          staffUserId={staffUserId}
          role={role}
          messages={conversationMessages}
          loading={conversationLoading}
          sending={conversationSending}
          text={conversationText}
          connection={conversationConnection}
          error={conversationError}
          onTextChange={(event) => setConversationText(event.target.value)}
          onKeyDown={handleConversationKeyDown}
          onSend={sendConversationMessage}
          onClose={closeConversation}
          bodyRef={conversationBodyRef}
          textareaRef={conversationTextareaRef}
        />
      )}
    </DashboardShell>
  );
}
