import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import AdminProfileContext from '../components/AdminProfileContext';
import SkeletonState from '../components/SkeletonState';
import { useToast } from '../components/ToastProvider';
import { getProfileProgress } from '../lib/profileCompletion';
import { supabase } from '../lib/supabase';
import './admin-workspace.css';

const STAFF_ROLES = ['admin', 'expert', 'support', 'finance'];
const EDIT_ROLES = ['admin', 'expert', 'support'];
const TERMINAL_ORDER_STATES = ['completed', 'cancelled', 'canceled'];
const ACTIVE_ORDER_STATES = ['pending', 'information_required', 'queued', 'in_progress', 'internal_review', 'client_review', 'revision'];
const TASK_STATES = [['todo', 'To do'], ['in_progress', 'In progress'], ['waiting', 'Waiting'], ['review', 'Review'], ['done', 'Done']];
const TASK_PRIORITIES = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
const ATTACHMENT_PREFIX = '__CAREERLYST_ATTACHMENT__:';

function formatDate(value, withTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

function humanize(value) {
  return String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name) {
  return String(name || 'Client').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function parseAttachment(body) {
  if (typeof body !== 'string' || !body.startsWith(ATTACHMENT_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(ATTACHMENT_PREFIX.length))?.attachment || null;
  } catch {
    return null;
  }
}

function messageText(body) {
  if (typeof body !== 'string') return '';
  if (!body.startsWith(ATTACHMENT_PREFIX)) return body;
  try {
    return JSON.parse(body.slice(ATTACHMENT_PREFIX.length))?.text || '';
  } catch {
    return 'Attachment';
  }
}

function StatusBadge({ children, tone = '' }) {
  return <span className={`workspace-badge ${tone}`.trim()}>{children}</span>;
}

function Section({ id, eyebrow, title, action, children, className = '' }) {
  return (
    <section className={`workspace-panel ${className}`.trim()} id={id}>
      <header className="workspace-panel-head">
        <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>
        {action}
      </header>
      <div className="workspace-panel-body">{children}</div>
    </section>
  );
}

function AttachmentLink({ attachment, orderId }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    async function createSignedUrl() {
      if (!supabase || !attachment?.path) { if (active) setLoading(false); return; }
      const { data, error } = await supabase.storage.from('message-attachments').createSignedUrl(attachment.path, 60 * 60);
      if (active) { setUrl(error ? '' : data?.signedUrl || ''); setLoading(false); }
    }
    void createSignedUrl();
    return () => { active = false; };
  }, [attachment?.path]);
  return loading ? <span className="workspace-file-link">Preparing secure link…</span>
    : url ? <a className="workspace-file-link" href={url} target="_blank" rel="noreferrer" download={attachment.name || undefined}>Open file ↗</a>
      : <span className="workspace-file-link is-unavailable">File unavailable</span>;
}

function ErrorNotice({ children }) {
  return <div className="workspace-inline-error" role="alert">{children}</div>;
}

export default function AdminWorkspace() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOrderId = searchParams.get('order') || '';
  const requestedClientId = searchParams.get('client') || '';
  const [authorized, setAuthorized] = useState(null);
  const [role, setRole] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [orders, setOrders] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [briefs, setBriefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [messageSummary, setMessageSummary] = useState(null);
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [goals, setGoals] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [roadmap, setRoadmap] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState('');
  const [roadmapSaving, setRoadmapSaving] = useState(false);
  const [roadmapEditorOpen, setRoadmapEditorOpen] = useState(false);
  const [roadmapDraft, setRoadmapDraft] = useState({ stage_key: '', status: 'CURRENT', client_update: '', client_action_title: '', client_action_description: '', internal_reason: '' });
  const [staffOptions, setStaffOptions] = useState([]);
  const [sectionErrors, setSectionErrors] = useState({});
  const [sectionLoading, setSectionLoading] = useState({});
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', status: 'todo', priority: 'medium', due_at: '', assigned_to: '', client_visible: false });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState({ body: '', visibility: 'internal' });
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ title: '', description: '', target_date: '', status: 'active', client_visible: false });
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionDraft, setSessionDraft] = useState({ title: '', starts_at: '', assigned_to: '', meeting_url: '', notes: '' });
  const workspaceLoadSequenceRef = useRef(0);

  const loadWorkspace = useCallback(async (silent = false) => {
    const requestId = ++workspaceLoadSequenceRef.current;
    const isCurrentRequest = () => requestId === workspaceLoadSequenceRef.current;
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!isCurrentRequest()) return;
      const user = sessionData?.session?.user;
      if (!user) { setAuthorized(false); return; }
      const { data: roleRow, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (roleError) throw roleError;
      if (!isCurrentRequest()) return;
      const currentRole = String(roleRow?.role || '').toLowerCase();
      if (!STAFF_ROLES.includes(currentRole)) { setAuthorized(false); return; }
      setRole(currentRole);
      setStaffUserId(user.id);
      setAuthorized(true);

      const { data: orderRows, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id, service_name, package_name, status, queue_position, client_notes, created_at, updated_at')
        .order('created_at', { ascending: false }).limit(100);
      if (orderError) throw orderError;
      const nextOrders = orderRows || [];
      if (!isCurrentRequest()) return;

      const ids = [...new Set([...nextOrders.map((order) => order.user_id), requestedClientId].filter(Boolean))];
      let nextProfiles = {};
      if (ids.length) {
        const { data: profileRows, error: profileError } = await supabase.from('profiles')
          .select('id, name, email, phone, location, target_role, experience, education, skills, certifications, linkedin, github, portfolio, bio, preferences, lead_assessment, lead_score, lead_status, lead_assessment_completed_at, updated_at')
          .in('id', ids);
        if (profileError) throw profileError;
        nextProfiles = Object.fromEntries((profileRows || []).map((profile) => [String(profile.id), profile]));
        if (!isCurrentRequest()) return;
      }

      const orderIds = nextOrders.map((order) => order.id).filter(Boolean);
      let nextBriefs = {};
      if (orderIds.length) {
        const { data: briefRows, error: briefError } = await supabase.from('project_briefs').select('*').in('order_id', orderIds);
        if (briefError) throw briefError;
        nextBriefs = Object.fromEntries((briefRows || []).map((brief) => [String(brief.order_id), brief]));
      }
      if (!isCurrentRequest()) return;
      setOrders(nextOrders);
      setProfiles(nextProfiles);
      setBriefs(nextBriefs);
    } catch (loadError) {
      if (isCurrentRequest()) {
        console.error('Admin workspace load error:', loadError);
        setError(loadError?.message || 'Could not load the client workspace.');
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [requestedClientId]);

  useEffect(() => {
    void loadWorkspace();
    return () => { workspaceLoadSequenceRef.current += 1; };
  }, [loadWorkspace]);

  const requestedOrder = orders.find((order) => String(order.id) === String(requestedOrderId)) || null;
  const orderClientMismatch = Boolean(requestedClientId && requestedOrder && String(requestedOrder.user_id) !== String(requestedClientId));
  const selectedOrder = orderClientMismatch ? null : requestedOrder;
  const selectedClientId = selectedOrder?.user_id || requestedClientId || '';
  const clientProfile = selectedClientId ? profiles[String(selectedClientId)] || null : null;
  const selectedBrief = selectedOrder ? briefs[String(selectedOrder.id)] || null : null;
  const ordersForClient = useMemo(() => selectedClientId ? orders.filter((order) => String(order.user_id) === String(selectedClientId)) : [], [orders, selectedClientId]);
  const assignedStaffSummary = useMemo(() => {
    const assignedIds = [...new Set([...tasks, ...sessions].map((item) => item.assigned_to).filter(Boolean).map(String))];
    if (!assignedIds.length) return 'Not assigned';
    const names = assignedIds.map((id) => staffOptions.find((person) => person.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : `${assignedIds.length} assigned`;
  }, [sessions, staffOptions, tasks]);
  const selectableOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return orders.filter((order) => {
      if (requestedClientId && String(order.user_id) !== String(requestedClientId)) return false;
      if (!query) return true;
      const profile = profiles[String(order.user_id)] || {};
      return [String(order.id), profile.name, profile.email, order.service_name, order.package_name].join(' ').toLowerCase().includes(query);
    });
  }, [orders, orderSearch, profiles, requestedClientId]);

  const loadSelectedContext = useCallback(async (order) => {
    setMessageSummary(null); setMessages([]); setTasks([]); setNotes([]); setGoals([]); setSessions([]); setSectionErrors({});
    setRoadmap(null); setRoadmapError(''); setRoadmapLoading(Boolean(order)); setRoadmapEditorOpen(false);
    if (!order || !supabase || authorized !== true) return;
    setSectionLoading({ messages: true, tasks: true, notes: true, goals: true, sessions: true, roadmap: true });
    const safeQuery = async (key, request, setter) => {
      try {
        const { data, error: queryError } = await request;
        if (queryError) throw queryError;
        setter(data || []);
      } catch (queryError) {
        console.error(`Workspace ${key} load error:`, queryError);
        setSectionErrors((current) => ({ ...current, [key]: queryError?.message || `Could not load ${key}.` }));
      } finally {
        setSectionLoading((current) => ({ ...current, [key]: false }));
      }
    };
    const orderId = order.id;
    const [summaryRequest, messagesRequest] = await Promise.allSettled([
      supabase.rpc('list_message_summaries_v1', { p_order_ids: [orderId] }),
      supabase.rpc('list_message_thread_actions_v1', { p_order_id: orderId, p_before_created_at: null, p_before_id: null, p_limit: 100 })
    ]);
    const summaryError = summaryRequest.status === 'rejected' ? summaryRequest.reason : summaryRequest.value.error;
    const messagesError = messagesRequest.status === 'rejected' ? messagesRequest.reason : messagesRequest.value.error;
    if (summaryError) setSectionErrors((current) => ({ ...current, messages: summaryError.message || 'Conversation summary could not be loaded.' }));
    else setMessageSummary(summaryRequest.value.data?.[0] || null);
    if (messagesError) setSectionErrors((current) => ({ ...current, messages: messagesError.message || 'Conversation could not be loaded.' }));
    else setMessages([...(messagesRequest.value.data || [])].reverse());
    setSectionLoading((current) => ({ ...current, messages: false }));

    try {
      const { data: roadmapData, error: roadmapLoadError } = await supabase.rpc('admin_get_order_roadmap_v1', { p_order_id: orderId });
      if (roadmapLoadError) throw roadmapLoadError;
      setRoadmap(roadmapData || null);
      setRoadmapDraft({ stage_key: roadmapData?.current_stage_key || '', status: roadmapData?.current_status || 'CURRENT', client_update: roadmapData?.client_update || '', client_action_title: roadmapData?.client_action_title || '', client_action_description: roadmapData?.client_action_description || '', internal_reason: '' });
    } catch (roadmapLoadError) {
      console.error('Workspace roadmap load error:', roadmapLoadError);
      setRoadmapError(roadmapLoadError?.message || 'The service roadmap could not be loaded.');
    } finally {
      setRoadmapLoading(false);
      setSectionLoading((current) => ({ ...current, roadmap: false }));
    }

    await Promise.all([
      safeQuery('tasks', supabase.from('workspace_tasks').select('id, order_id, title, description, status, priority, due_at, assigned_to, created_by, client_visible, completed_at, created_at, updated_at').eq('order_id', orderId).order('created_at', { ascending: false }).limit(100), setTasks),
      safeQuery('notes', supabase.from('workspace_notes').select('id, order_id, body, visibility, created_by, created_at').eq('order_id', orderId).order('created_at', { ascending: false }).limit(50), setNotes),
      safeQuery('goals', supabase.from('workspace_goals').select('id, order_id, title, description, status, target_date, client_visible, created_by, created_at, updated_at').eq('order_id', orderId).order('created_at', { ascending: false }).limit(25), setGoals),
      safeQuery('sessions', supabase.from('workspace_sessions').select('id, order_id, title, starts_at, assigned_to, meeting_url, status, notes, created_by, created_at, updated_at').eq('order_id', orderId).order('starts_at', { ascending: true }).limit(25), setSessions)
    ]);

    if (!EDIT_ROLES.includes(role)) { setStaffOptions([]); return; }
    try {
      const { data: directoryRoles, error: directoryError } = await supabase.rpc('admin_list_directory_user_roles_v1');
      if (directoryError) throw directoryError;
      const staff = (directoryRoles || []).filter((entry) => STAFF_ROLES.includes(String(entry.role || '').toLowerCase()));
      const ids = [...new Set(staff.map((entry) => entry.user_id).filter(Boolean))];
      if (!ids.length) { setStaffOptions([]); return; }
      const { data: staffProfiles, error: staffProfileError } = await supabase.from('profiles').select('id, name').in('id', ids);
      if (staffProfileError) throw staffProfileError;
      const names = Object.fromEntries((staffProfiles || []).map((profile) => [String(profile.id), profile.name || 'Staff member']));
      setStaffOptions(staff.map((entry) => ({ id: String(entry.user_id), role: String(entry.role).toLowerCase(), name: names[String(entry.user_id)] || 'Staff member' })));
    } catch (staffError) {
      console.error('Workspace staff directory load error:', staffError);
      setSectionErrors((current) => ({ ...current, assignment: staffError?.message || 'Staff directory could not be loaded.' }));
    }
  }, [authorized, role]);

  useEffect(() => { void loadSelectedContext(selectedOrder); }, [loadSelectedContext, selectedOrder]);

  function selectOrder(order) {
    const next = new URLSearchParams(searchParams);
    next.set('order', String(order.id));
    next.set('client', String(order.user_id));
    setSearchParams(next);
  }

  function jumpTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveTask(event) {
    event.preventDefault();
    if (!selectedOrder || !EDIT_ROLES.includes(role)) return;
    if (!taskDraft.title?.trim()) {
      showToast.warning('Please enter a task title.', { title: 'Title required' });
      return;
    }
    const values = { ...taskDraft, title: taskDraft.title.trim(), order_id: selectedOrder.id, due_at: taskDraft.due_at ? new Date(taskDraft.due_at).toISOString() : null, assigned_to: taskDraft.assigned_to || null, updated_at: new Date().toISOString() };
    if (values.status === 'done') values.completed_at = new Date().toISOString();
    else values.completed_at = null;
    try {
      const request = editingTaskId
        ? supabase.from('workspace_tasks').update(values).eq('id', editingTaskId).eq('order_id', selectedOrder.id).select().single()
        : supabase.from('workspace_tasks').insert({ ...values, created_by: staffUserId }).select().single();
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      setTaskDraft({ title: '', description: '', status: 'todo', priority: 'medium', due_at: '', assigned_to: '', client_visible: false });
      setEditingTaskId(''); setTaskOpen(false); await loadSelectedContext(selectedOrder); showToast(editingTaskId ? 'Task updated.' : 'Task added.', { type: 'success' });
    } catch (saveError) {
      const msg = saveError?.message || 'Task could not be saved.';
      setSectionErrors((current) => ({ ...current, tasks: msg }));
      showToast.error(msg, { title: 'Task save failed' });
    }
  }

  function editTask(task) {
    setEditingTaskId(task.id);
    setTaskDraft({ title: task.title || '', description: task.description || '', status: task.status || 'todo', priority: task.priority || 'medium', due_at: task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : '', assigned_to: task.assigned_to || '', client_visible: Boolean(task.client_visible) });
    setTaskOpen(true); jumpTo('workspace-tasks');
  }

  async function updateTask(task, changes) {
    if (!selectedOrder || !EDIT_ROLES.includes(role)) return;
    const nextStatus = changes.status || task.status;
    try {
      const { error: updateError } = await supabase.from('workspace_tasks').update({ ...changes, completed_at: nextStatus === 'done' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', task.id).eq('order_id', selectedOrder.id);
      if (updateError) throw updateError;
      await loadSelectedContext(selectedOrder); showToast('Task status updated.', { type: 'success' });
    } catch (updateError) {
      const msg = updateError?.message || 'Task could not be updated.';
      setSectionErrors((current) => ({ ...current, tasks: msg }));
      showToast.error(msg, { title: 'Task update failed' });
    }
  }

  async function deleteTask(task) {
    if (!selectedOrder || !EDIT_ROLES.includes(role) || !window.confirm(`Delete “${task.title}”?`)) return;
    try {
      const { error: deleteError } = await supabase.from('workspace_tasks').delete().eq('id', task.id).eq('order_id', selectedOrder.id);
      if (deleteError) throw deleteError;
      await loadSelectedContext(selectedOrder); showToast('Task deleted.', { type: 'success' });
    } catch (deleteError) {
      const msg = deleteError?.message || 'Task could not be deleted.';
      setSectionErrors((current) => ({ ...current, tasks: msg }));
      showToast.error(msg, { title: 'Task deletion failed' });
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    if (!selectedOrder || !EDIT_ROLES.includes(role)) return;
    if (!noteDraft.body?.trim()) {
      showToast.warning('Please enter a note body.', { title: 'Note content required' });
      return;
    }
    try {
      const { error: insertError } = await supabase.from('workspace_notes').insert({ order_id: selectedOrder.id, body: noteDraft.body.trim(), visibility: noteDraft.visibility, created_by: staffUserId });
      if (insertError) throw insertError;
      setNoteDraft({ body: '', visibility: 'internal' }); setNoteOpen(false); await loadSelectedContext(selectedOrder); showToast('Note added.', { type: 'success' });
    } catch (insertError) {
      const msg = insertError?.message || 'Note could not be saved.';
      setSectionErrors((current) => ({ ...current, notes: msg }));
      showToast.error(msg, { title: 'Note save failed' });
    }
  }

  async function saveGoal(event) {
    event.preventDefault();
    if (!selectedOrder || !EDIT_ROLES.includes(role)) return;
    if (!goalDraft.title?.trim()) {
      showToast.warning('Please enter a goal title.', { title: 'Goal title required' });
      return;
    }
    try {
      const { error: insertError } = await supabase.from('workspace_goals').insert({ ...goalDraft, title: goalDraft.title.trim(), order_id: selectedOrder.id, target_date: goalDraft.target_date || null, created_by: staffUserId });
      if (insertError) throw insertError;
      setGoalDraft({ title: '', description: '', target_date: '', status: 'active', client_visible: false }); setGoalOpen(false); await loadSelectedContext(selectedOrder); showToast('Goal added.', { type: 'success' });
    } catch (insertError) {
      const msg = insertError?.message || 'Goal could not be saved.';
      setSectionErrors((current) => ({ ...current, goals: msg }));
      showToast.error(msg, { title: 'Goal save failed' });
    }
  }

  async function saveSession(event) {
    event.preventDefault();
    if (!selectedOrder || !EDIT_ROLES.includes(role)) return;
    if (!sessionDraft.title?.trim() || !sessionDraft.starts_at) {
      showToast.warning('Please enter a title and start date/time for the session.', { title: 'Session details required' });
      return;
    }
    try {
      const { error: insertError } = await supabase.from('workspace_sessions').insert({ ...sessionDraft, title: sessionDraft.title.trim(), order_id: selectedOrder.id, starts_at: new Date(sessionDraft.starts_at).toISOString(), assigned_to: sessionDraft.assigned_to || null, created_by: staffUserId });
      if (insertError) throw insertError;
      setSessionDraft({ title: '', starts_at: '', assigned_to: '', meeting_url: '', notes: '' }); setSessionOpen(false); await loadSelectedContext(selectedOrder); showToast('Session scheduled.', { type: 'success' });
    } catch (insertError) {
      const msg = insertError?.message || 'Session could not be saved.';
      setSectionErrors((current) => ({ ...current, sessions: msg }));
      showToast.error(msg, { title: 'Session save failed' });
    }
  }

  async function saveRoadmap(event) {
    event.preventDefault();
    if (!selectedOrder || !canEdit) return;
    if (!roadmapDraft.stage_key) {
      showToast.warning('Please select a stage for the roadmap.', { title: 'Stage required' });
      return;
    }
    setRoadmapSaving(true);
    setRoadmapError('');
    try {
      const { data, error: updateError } = await supabase.rpc('admin_update_order_roadmap_v1', {
        p_order_id: selectedOrder.id,
        p_stage_key: roadmapDraft.stage_key,
        p_status: roadmapDraft.status,
        p_client_update: roadmapDraft.client_update,
        p_client_action_title: roadmapDraft.status === 'WAITING_ON_CLIENT' ? roadmapDraft.client_action_title : '',
        p_client_action_description: roadmapDraft.status === 'WAITING_ON_CLIENT' ? roadmapDraft.client_action_description : '',
        p_internal_reason: roadmapDraft.internal_reason
      });
      if (updateError) throw updateError;
      setRoadmap(data || null);
      setRoadmapDraft({ stage_key: data?.current_stage_key || '', status: data?.current_status || 'CURRENT', client_update: data?.client_update || '', client_action_title: data?.client_action_title || '', client_action_description: data?.client_action_description || '', internal_reason: '' });
      setRoadmapEditorOpen(false);
      showToast('Service roadmap updated.', { type: 'success' });
    } catch (updateError) {
      const msg = updateError?.message || 'The service roadmap could not be updated.';
      setRoadmapError(msg);
      showToast.error(msg, { title: 'Roadmap update failed' });
    } finally {
      setRoadmapSaving(false);
    }
  }

  const attention = useMemo(() => {
    if (!selectedOrder) return [];
    const items = [];
    if (Number(messageSummary?.unread_count) > 0) items.push({ level: 'high', text: `${messageSummary.unread_count} unread client message${Number(messageSummary.unread_count) === 1 ? '' : 's'}`, action: 'Open conversation', target: 'messages' });
    const latest = messages[messages.length - 1];
    if (latest && String(latest.sender_id) === String(selectedOrder.user_id) && !latest.read_at) items.push({ level: 'high', text: 'Client is waiting for a response', action: 'Open conversation', target: 'messages' });
    if (!selectedBrief && ACTIVE_ORDER_STATES.includes(String(selectedOrder.status || '').toLowerCase())) items.push({ level: 'normal', text: 'Project brief has not been submitted', action: 'Review service details', target: 'service-overview' });
    const deadline = selectedBrief?.deadline ? new Date(selectedBrief.deadline) : null;
    if (deadline && Number.isFinite(deadline.getTime()) && deadline.getTime() < Date.now() && !TERMINAL_ORDER_STATES.includes(String(selectedOrder.status || '').toLowerCase())) items.push({ level: 'high', text: `Brief deadline passed on ${formatDate(deadline)}`, action: 'Review service details', target: 'service-overview' });
    const profileProgress = getProfileProgress(clientProfile || {});
    if (clientProfile && profileProgress.percent < 100) items.push({ level: 'normal', text: `Profile is ${profileProgress.percent}% complete`, action: 'Review profile', target: 'client-profile' });
    const overdueTasks = tasks.filter((task) => task.status !== 'done' && task.due_at && new Date(task.due_at).getTime() < Date.now());
    overdueTasks.slice(0, 3).forEach((task) => items.push({ level: 'high', text: `Overdue task: ${task.title}`, action: 'Open tasks', target: 'workspace-tasks' }));
    if (String(selectedOrder.status).toLowerCase() === 'client_review') items.push({ level: 'high', text: 'Deliverable is awaiting client review', action: 'Review service details', target: 'service-overview' });
    const upcoming = sessions.find((session) => session.status === 'scheduled' && new Date(session.starts_at).getTime() >= Date.now() && new Date(session.starts_at).getTime() <= Date.now() + 7 * 86400000);
    if (upcoming) items.push({ level: 'normal', text: `Upcoming session: ${upcoming.title} · ${formatDate(upcoming.starts_at, true)}`, action: 'Open sessions', target: 'workspace-sessions' });
    return items.slice(0, 6);
  }, [clientProfile, messageSummary, messages, selectedBrief, selectedOrder, sessions, tasks]);

  const progressStages = useMemo(() => {
    if (!selectedOrder) return [];
    const assessmentDone = Boolean(clientProfile?.lead_assessment_completed_at || clientProfile?.lead_assessment);
    const profileDone = Boolean(clientProfile && getProfileProgress(clientProfile).percent === 100);
    const hasClientFiles = messages.some((message) => String(message.sender_id) === String(selectedOrder.user_id) && parseAttachment(message.body));
    const reviewDone = ['internal_review', 'client_review', 'revision', 'completed'].includes(String(selectedOrder.status || '').toLowerCase());
    const complete = String(selectedOrder.status || '').toLowerCase() === 'completed';
    return [
      { label: 'Assessment', state: assessmentDone ? 'Complete' : 'Not started', done: assessmentDone },
      { label: 'Profile', state: profileDone ? 'Complete' : clientProfile ? `${getProfileProgress(clientProfile).percent}% complete` : 'Unavailable', done: profileDone },
      { label: 'Documents', state: hasClientFiles ? 'Client file shared' : 'Not configured', done: hasClientFiles },
      { label: 'Review', state: reviewDone ? humanize(selectedOrder.status) : 'Waiting', done: reviewDone },
      { label: 'Complete', state: complete ? 'Complete' : 'In progress', done: complete }
    ];
  }, [clientProfile, messages, selectedOrder]);

  const files = useMemo(() => messages.map((message) => {
    const attachment = parseAttachment(message.body);
    return attachment?.path ? { ...attachment, senderId: message.sender_id, created_at: message.created_at, messageId: message.id } : null;
  }).filter(Boolean), [messages]);

  const timeline = useMemo(() => {
    if (!selectedOrder) return [];
    const rows = [
      { at: selectedOrder.created_at, title: `Order #${selectedOrder.id} created`, detail: `${selectedOrder.service_name || 'Service'}${selectedOrder.package_name ? ` · ${selectedOrder.package_name}` : ''}`, kind: 'order' },
      selectedOrder.updated_at && selectedOrder.updated_at !== selectedOrder.created_at ? { at: selectedOrder.updated_at, title: 'Order details updated', detail: `Current status: ${humanize(selectedOrder.status)}`, kind: 'order' } : null,
      clientProfile?.updated_at ? { at: clientProfile.updated_at, title: 'Profile last updated', detail: clientProfile.name || 'Client profile', kind: 'profile' } : null,
      clientProfile?.lead_assessment_completed_at ? { at: clientProfile.lead_assessment_completed_at, title: 'Career assessment completed', detail: `${clientProfile.lead_status || 'Assessment'}${clientProfile.lead_score != null ? ` · ${clientProfile.lead_score} points` : ''}`, kind: 'assessment' } : null,
      selectedBrief?.submitted_at ? { at: selectedBrief.submitted_at, title: 'Project brief submitted', detail: selectedBrief.target_role || 'Client brief', kind: 'brief' } : null,
      ...messages.map((message) => ({ at: message.created_at, title: String(message.sender_id) === String(selectedOrder.user_id) ? 'Client message' : 'Team message', detail: messageText(message.body).slice(0, 160) || (parseAttachment(message.body)?.name ? `Attachment: ${parseAttachment(message.body).name}` : 'Attachment'), kind: 'message' })),
      ...tasks.map((task) => ({ at: task.updated_at || task.created_at, title: task.status === 'done' ? 'Task completed' : 'Task updated', detail: task.title, kind: 'task' })),
      ...notes.map((note) => ({ at: note.created_at, title: note.visibility === 'shared' ? 'Shared note added' : 'Internal note added', detail: note.body.slice(0, 160), kind: 'note' })),
      ...goals.map((goal) => ({ at: goal.updated_at || goal.created_at, title: 'Goal recorded', detail: goal.title, kind: 'goal' })),
      ...sessions.map((session) => ({ at: session.created_at, title: 'Session scheduled', detail: `${session.title} · ${formatDate(session.starts_at, true)}`, kind: 'session' })),
      ...(roadmap?.history || []).map((entry) => {
        const previous = roadmap.stages?.find((stage) => stage.stage_key === entry.previous_stage_key)?.admin_title || humanize(entry.previous_stage_key);
        const next = roadmap.stages?.find((stage) => stage.stage_key === entry.new_stage_key)?.admin_title || humanize(entry.new_stage_key);
        const actor = staffOptions.find((person) => person.id === String(entry.actor_id));
        const transition = previous === next ? `${next} · ${humanize(entry.new_status)}` : `${previous} → ${next}`;
        return { at: entry.created_at, title: previous === next ? `Roadmap state: ${humanize(entry.new_status)}` : `Delivery stage: ${next}`, detail: `${transition} · Updated by ${actor?.name || 'staff'}${entry.internal_reason ? ` · ${entry.internal_reason}` : ''}`, kind: 'roadmap' };
      })
    ].filter((entry) => entry?.at);
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 30);
  }, [clientProfile, goals, messages, notes, roadmap, selectedBrief, selectedOrder, sessions, staffOptions, tasks]);

  if (authorized === false) return <Navigate to="/dashboard" replace />;
  if (authorized === null && !loading) return <Navigate to="/admin" replace />;

  const canEdit = EDIT_ROLES.includes(role);
  const roadmapStages = roadmap?.stages || [];
  const currentRoadmapStage = roadmapStages.find((stage) => stage.stage_key === roadmap?.current_stage_key) || null;
  const nextRoadmapStage = currentRoadmapStage
    ? roadmapStages.find((stage) => Number(stage.sequence) > Number(currentRoadmapStage.sequence)) || null
    : null;
  const availableRoadmapStages = roadmapStages.filter((stage) => !currentRoadmapStage || Math.abs(Number(stage.sequence) - Number(currentRoadmapStage.sequence)) <= 1);

  return (
    <DashboardShell admin>
      <main className="client360-page">
        <header className="client360-page-head">
          <div><p className="eyebrow">ADMIN · CLIENT SERVICE DELIVERY</p><h1>Client service workspace</h1><p>Review client details, delivery stages, tasks and scheduled sessions.</p></div>
          <button type="button" className="btn" onClick={() => void loadWorkspace(true)} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh ↻'}</button>
        </header>

        {error && <ErrorNotice>{error}</ErrorNotice>}
        {loading ? <div className="workspace-state panel"><SkeletonState label="Loading client workspace" variant="profile" /></div> : (
          <div className="client360-layout">
            <aside className="client360-rail" aria-label="Client and order selector">
              <label className="workspace-search"><span aria-hidden="true">⌕</span><input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Find a client or order" aria-label="Search clients and orders" /></label>
              <div className="workspace-selector-title"><span>RECENT SERVICE ORDERS</span><b>{selectableOrders.length}</b></div>
              {loading ? <SkeletonState label="Loading orders" variant="rows" count={3} className="workspace-muted" /> : selectableOrders.length ? (
                <ul className="workspace-order-picker">
                  {selectableOrders.map((order) => {
                    const profile = profiles[String(order.user_id)] || {};
                    return <li key={order.id}><button type="button" className={String(order.id) === String(requestedOrderId) ? 'is-selected' : ''} onClick={() => selectOrder(order)} aria-current={String(order.id) === String(requestedOrderId) ? 'page' : undefined}>
                      <span className="workspace-order-picker-top"><b>#{order.id}</b><small>{formatDate(order.created_at)}</small></span>
                      <strong>{profile.name || 'Client'}</strong><span>{order.service_name || 'Service'}{order.package_name ? ` · ${order.package_name}` : ''}</span>
                      <StatusBadge>{humanize(order.status)}</StatusBadge>
                    </button></li>;
                  })}
                </ul>
              ) : <div className="workspace-empty workspace-empty-small">No service orders match this client.</div>}
            </aside>

            {!selectedOrder ? (
              <section className="workspace-state panel"><span className="workspace-overline">CLIENT 360</span><h2>{requestedClientId ? (clientProfile?.name || 'Client profile') : 'Choose a client order'}</h2><p>{requestedClientId ? 'This client has no order in the recent order list. Their profile context can be reviewed when an order is available.' : 'Select an order to open its client, service, and delivery context.'}</p>
                {orderClientMismatch && <ErrorNotice>The selected order does not belong to this client. Choose an order from this client’s list.</ErrorNotice>}
                {clientProfile && <div className="workspace-unordered-profile"><AdminProfileContext profile={clientProfile} /></div>}
              </section>
            ) : (
              <div className="client360-main">
                <section className="client360-hero" aria-labelledby="workspace-client-name">
                  <div className="client360-identity"><div className="client360-avatar" aria-hidden="true">{initials(clientProfile?.name)}</div><div><p className="eyebrow">CLIENT 360 · ORDER #{selectedOrder.id}</p><h2 id="workspace-client-name">{clientProfile?.name || 'Client'}</h2><p className="client360-target">{clientProfile?.target_role || 'Target role not provided'}{clientProfile?.experience ? ` · ${clientProfile.experience}` : ''}{clientProfile?.location ? ` · ${clientProfile.location}` : ''}</p><div className="client360-tags"><StatusBadge>{humanize(selectedOrder.status)}</StatusBadge><StatusBadge>{selectedOrder.service_name || 'Service'}</StatusBadge>{selectedOrder.package_name && <StatusBadge>{selectedOrder.package_name}</StatusBadge>}</div></div></div>
                  <nav className="client360-actions" aria-label="Workspace actions"><Link className="btn dark" to={`/admin/messages?order=${encodeURIComponent(selectedOrder.id)}`}>Message</Link><button type="button" className="btn" onClick={() => { setTaskOpen(true); jumpTo('workspace-tasks'); }} disabled={!canEdit}>Add task</button><button type="button" className="btn" onClick={() => { setNoteOpen(true); jumpTo('workspace-notes'); }} disabled={!canEdit}>Add note</button></nav>
                  <div className="client360-keyfacts"><div><span>Profile readiness</span><strong>{clientProfile ? `${getProfileProgress(clientProfile).percent}%` : 'Unknown'}</strong></div><div><span>Assessment</span><strong>{clientProfile?.lead_score != null ? `${clientProfile.lead_score} points` : 'Not completed'}</strong></div><div><span>Assessment status</span><strong>{clientProfile?.lead_status ? humanize(clientProfile.lead_status) : 'Not completed'}</strong></div><div><span>Task/session assignees</span><strong>{assignedStaffSummary}</strong></div><div><span>Last activity</span><strong>{timeline[0] ? formatDate(timeline[0].at, true) : 'No activity'}</strong></div></div>
                </section>

                <div className="client360-columns">
                  <div className="client360-primary">
                    <Section id="service-roadmap" eyebrow={`ORDER #${selectedOrder.id} · ${selectedOrder.service_name || 'SERVICE'}`} title="Service roadmap" className="workspace-roadmap-panel" action={canEdit && roadmap && <button type="button" className="btn dark" onClick={() => { setRoadmapDraft({ stage_key: roadmap.current_stage_key, status: roadmap.current_status, client_update: roadmap.client_update || '', client_action_title: roadmap.client_action_title || '', client_action_description: roadmap.client_action_description || '', internal_reason: '' }); setRoadmapEditorOpen((open) => !open); }}>{roadmapEditorOpen ? 'Close' : 'Update stage'}</button>}>
                      {roadmapLoading ? <SkeletonState label="Loading the service roadmap" variant="rows" count={2} className="workspace-empty workspace-empty-small" />
                        : roadmapError ? <ErrorNotice>{roadmapError}</ErrorNotice>
                          : !roadmap ? <div className="workspace-empty workspace-empty-small"><strong>No delivery roadmap is configured.</strong><p>This order’s service is not mapped to a delivery workflow yet.</p></div>
                            : <>
                              <div className="workspace-roadmap-summary">
                                <div><span>Current stage</span><strong>{currentRoadmapStage?.admin_title || humanize(roadmap.current_stage_key)}</strong></div>
                                <div><span>Next stage</span><strong>{nextRoadmapStage?.admin_title || (roadmap.current_status === 'COMPLETED' ? 'No next stage' : 'Final stage')}</strong></div>
                                <div className="workspace-roadmap-progress"><div><span>Progress</span><strong>{roadmap.progress}%</strong></div><div className="workspace-roadmap-progress-track" role="progressbar" aria-label="Service delivery progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={roadmap.progress}><span style={{ width: `${roadmap.progress}%` }} /></div></div>
                              </div>
                              <p className="workspace-muted workspace-roadmap-scope-note">This roadmap tracks service delivery. Order and payment status remain in the order record.</p>
                              <ol className="workspace-roadmap-stages" aria-label={`${roadmap.service_name} delivery stages`}>
                                {roadmapStages.map((stage) => <li key={stage.stage_key} className={`is-${String(stage.status).toLowerCase()}`} aria-current={stage.stage_key === roadmap.current_stage_key ? 'step' : undefined}>
                                  <span className="workspace-roadmap-mark" aria-hidden="true">{stage.status === 'COMPLETED' || (stage.stage_key === roadmap.current_stage_key && roadmap.current_status === 'COMPLETED') ? '✓' : stage.stage_key === roadmap.current_stage_key ? (roadmap.current_status === 'WAITING_ON_CLIENT' || roadmap.current_status === 'BLOCKED' ? '!' : '●') : '○'}</span>
                                  <div><strong>{stage.admin_title}</strong>{stage.stage_key === roadmap.current_stage_key && <small>{humanize(roadmap.current_status)}</small>}</div>
                                </li>)}
                              </ol>
                              {roadmap.current_status === 'WAITING_ON_CLIENT' && <div className="workspace-roadmap-alert"><strong>Waiting on client · {roadmap.client_action_title}</strong><p>{roadmap.client_action_description}</p></div>}
                              {roadmap.client_update && <p className="workspace-roadmap-client-update"><span>Client update</span>{roadmap.client_update}</p>}
                              {roadmapEditorOpen && canEdit && <form className="workspace-form workspace-roadmap-form" onSubmit={saveRoadmap}>
                                <h3>Update order #{selectedOrder.id} roadmap</h3>
                                <label>Current stage<select required value={roadmapDraft.stage_key} onChange={(event) => setRoadmapDraft({ ...roadmapDraft, stage_key: event.target.value, status: 'CURRENT' })}>{availableRoadmapStages.map((stage) => <option key={stage.stage_key} value={stage.stage_key}>{stage.admin_title}</option>)}</select></label>
                                <label>Stage state<select value={roadmapDraft.status} onChange={(event) => setRoadmapDraft({ ...roadmapDraft, status: event.target.value })}><option value="CURRENT">In progress</option><option value="BLOCKED">Blocked · staff action</option><option value="WAITING_ON_CLIENT">Waiting on client</option>{roadmapStages.at(-1)?.stage_key === roadmapDraft.stage_key && <option value="COMPLETED">Complete</option>}</select></label>
                                <label>Client-safe update<textarea rows="2" maxLength={1200} value={roadmapDraft.client_update} onChange={(event) => setRoadmapDraft({ ...roadmapDraft, client_update: event.target.value })} placeholder="Optional update the client can see" /></label>
                                {roadmapDraft.status === 'WAITING_ON_CLIENT' && <><label>Client action title<input required maxLength={160} value={roadmapDraft.client_action_title} onChange={(event) => setRoadmapDraft({ ...roadmapDraft, client_action_title: event.target.value })} placeholder="Action required" /></label><label>Client action details<textarea required rows="2" maxLength={1000} value={roadmapDraft.client_action_description} onChange={(event) => setRoadmapDraft({ ...roadmapDraft, client_action_description: event.target.value })} placeholder="Tell the client exactly what they need to do" /></label></>}
                                <label>Internal reason<textarea rows="2" maxLength={2000} value={roadmapDraft.internal_reason} onChange={(event) => setRoadmapDraft({ ...roadmapDraft, internal_reason: event.target.value })} placeholder="Required when reopening an earlier stage" /></label>
                                {roadmapError && <ErrorNotice>{roadmapError}</ErrorNotice>}
                                <div className="workspace-form-actions"><button type="button" className="btn" onClick={() => setRoadmapEditorOpen(false)}>Cancel</button><button type="submit" className="btn dark" disabled={roadmapSaving}>{roadmapSaving ? 'Saving…' : 'Save stage'}</button></div>
                              </form>}
                            </>}
                    </Section>

                    <Section id="workspace-attention" eyebrow="PRIORITY QUEUE" title="Needs attention" className="workspace-attention-panel">
                      {sectionErrors.messages && <ErrorNotice>{sectionErrors.messages}</ErrorNotice>}
                      {sectionErrors.tasks && <ErrorNotice>{sectionErrors.tasks}</ErrorNotice>}
                      {attention.length ? <ul className="workspace-attention-list">{attention.map((item, index) => <li key={`${item.target}-${index}`} className={`priority-${item.level}`}><span className="workspace-attention-mark" aria-hidden="true">{item.level === 'high' ? '!' : '•'}</span><div><strong>{item.text}</strong><button type="button" className="workspace-text-action" onClick={() => jumpTo(item.target)}>{item.action} →</button></div><StatusBadge tone={item.level}>{humanize(item.level)}</StatusBadge></li>)}</ul> : <div className="workspace-caught-up"><span aria-hidden="true">✓</span><div><strong>You're all caught up.</strong><p>No actionable issues are visible for this service order.</p></div></div>}
                    </Section>

                    <Section id="service-overview" eyebrow="CURRENT ENGAGEMENT" title="Service / order">
                      <div className="workspace-service-summary"><div className="workspace-service-name"><span>Service</span><strong>{selectedOrder.service_name || 'Service not recorded'}</strong></div><div><span>Package</span><strong>{selectedOrder.package_name || 'Not recorded'}</strong></div><div><span>Order number</span><strong>#{selectedOrder.id}</strong></div><div><span>Status</span><strong><StatusBadge>{humanize(selectedOrder.status)}</StatusBadge></strong></div><div><span>Assigned staff</span><strong>Not configured</strong></div><div><span>Started</span><strong>{formatDate(selectedOrder.created_at)}</strong></div><div className="workspace-service-next"><span>Next action</span><strong>{attention[0]?.text || 'Continue the current delivery workflow.'}</strong></div></div>
                      {selectedBrief ? <details className="workspace-brief-details"><summary>View submitted project brief</summary><div className="workspace-brief-grid">{[['Target role', selectedBrief.target_role], ['Career goal', selectedBrief.career_goal], ['Experience', selectedBrief.experience], ['Education', selectedBrief.education], ['Deadline', selectedBrief.deadline], ['Current CV', selectedBrief.current_cv], ['Job description', selectedBrief.job_description], ['Achievements', selectedBrief.achievements], ['LinkedIn', selectedBrief.linkedin_url], ['GitHub', selectedBrief.github_url], ['Portfolio', selectedBrief.portfolio_url], ['Client notes', selectedBrief.additional_notes]].filter(([, value]) => value).map(([label, value]) => <div key={label}><span>{label}</span><p>{String(value)}</p></div>)}</div></details> : <p className="workspace-muted">No project brief has been submitted for this order.</p>}
                    </Section>

                    <Section id="career-progress" eyebrow="DELIVERY JOURNEY" title="Career progress"><ol className="workspace-progress-list">{progressStages.map((stage, index) => <li className={stage.done ? 'is-complete' : ''} key={stage.label}><span className="workspace-progress-index">{stage.done ? '✓' : String(index + 1).padStart(2, '0')}</span><div><strong>{stage.label}</strong><span>{stage.state}</span></div></li>)}</ol><p className="workspace-muted workspace-progress-note">Stages use saved assessment/profile data, shared message files, and the existing order status. No percentage is inferred.</p></Section>

                    <Section id="workspace-tasks" eyebrow="ACTION PLAN" title="Tasks" action={canEdit && <button className="btn dark" type="button" onClick={() => { setEditingTaskId(''); setTaskDraft({ title: '', description: '', status: 'todo', priority: 'medium', due_at: '', assigned_to: '', client_visible: false }); setTaskOpen((open) => !open); }}>{taskOpen ? 'Close' : '+ Add task'}</button>}>
                      {sectionLoading.tasks ? <SkeletonState label="Loading tasks" variant="rows" count={3} className="workspace-empty" /> : sectionErrors.tasks ? <ErrorNotice>{sectionErrors.tasks}</ErrorNotice> : tasks.length ? <div className="workspace-task-list">{tasks.map((task) => {
                        const due = task.due_at ? new Date(task.due_at) : null; const overdue = due && due.getTime() < Date.now() && task.status !== 'done'; const assignee = staffOptions.find((person) => person.id === String(task.assigned_to));
                        return <article className="workspace-task" key={task.id}><div className="workspace-task-main"><div className="workspace-task-heading"><strong>{task.title}</strong><div className="workspace-task-tags"><StatusBadge tone={overdue ? 'high' : ''}>{overdue ? 'Overdue' : humanize(task.status)}</StatusBadge><StatusBadge>{humanize(task.priority)} priority</StatusBadge>{task.client_visible && <StatusBadge tone="visible">Client visible</StatusBadge>}</div></div>{task.description && <p>{task.description}</p>}<small>{due ? `Due ${formatDate(due)}` : 'No due date'}{assignee ? ` · ${assignee.name}` : ''}</small></div><div className="workspace-task-controls">{canEdit ? <><label className="workspace-control-label">Status<select value={task.status} onChange={(event) => void updateTask(task, { status: event.target.value })}>{TASK_STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="workspace-text-action" onClick={() => editTask(task)}>Edit</button><button type="button" className="workspace-text-action is-danger" onClick={() => void deleteTask(task)}>Delete</button></> : <span>{humanize(task.status)}</span>}</div></article>;
                      })}</div> : <div className="workspace-empty"><strong>No tasks yet.</strong><p>Create a clear next action for this service.</p>{canEdit && <button type="button" className="workspace-text-action" onClick={() => setTaskOpen(true)}>Add the first task →</button>}</div>}
                      {taskOpen && canEdit && <form className="workspace-form" onSubmit={saveTask}><h3>{editingTaskId ? 'Edit task' : 'New task'}</h3><label>Title<input required maxLength={180} value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /></label><label>Description<textarea rows="3" value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} /></label><div className="workspace-form-grid"><label>Status<select value={taskDraft.status} onChange={(event) => setTaskDraft({ ...taskDraft, status: event.target.value })}>{TASK_STATES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Priority<select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value })}>{TASK_PRIORITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Due date<input type="datetime-local" value={taskDraft.due_at} onChange={(event) => setTaskDraft({ ...taskDraft, due_at: event.target.value })} /></label><label>Assign to<select value={taskDraft.assigned_to} onChange={(event) => setTaskDraft({ ...taskDraft, assigned_to: event.target.value })}><option value="">Unassigned</option>{staffOptions.map((person) => <option key={person.id} value={person.id}>{person.name} · {humanize(person.role)}</option>)}</select></label></div><label className="workspace-check"><input type="checkbox" checked={taskDraft.client_visible} onChange={(event) => setTaskDraft({ ...taskDraft, client_visible: event.target.checked })} />Visible to this client</label>{sectionErrors.assignment && <ErrorNotice>{sectionErrors.assignment}</ErrorNotice>}<div className="workspace-form-actions"><button type="button" className="btn" onClick={() => { setTaskOpen(false); setEditingTaskId(''); }}>Cancel</button><button type="submit" className="btn dark">{editingTaskId ? 'Save task' : 'Create task'}</button></div></form>}
                    </Section>

                    <Section id="workspace-documents" eyebrow="FILES & DELIVERABLES" title="Documents">
                      <div className="workspace-docs-intro"><p>Files shared through the existing private order conversation appear here. Attachments stay in the existing messaging and storage system.</p><Link className="workspace-text-action" to={`/admin/messages?order=${encodeURIComponent(selectedOrder.id)}`}>Upload or share a file in conversation →</Link></div>
                      {sectionErrors.messages ? <ErrorNotice>{sectionErrors.messages}</ErrorNotice> : files.length ? <div className="workspace-file-list">{files.map((file) => { const isClient = String(file.senderId) === String(selectedOrder.user_id); return <article className="workspace-file-row" key={`${file.messageId}-${file.path}`}><span className="workspace-file-icon" aria-hidden="true">↗</span><div><strong>{file.name || 'Shared attachment'}</strong><small>{isClient ? 'Uploaded by client' : 'Shared by Formant'} · {formatDate(file.created_at, true)}</small></div><AttachmentLink attachment={file} orderId={selectedOrder.id} /></article>; })}</div> : <div className="workspace-empty"><strong>No shared documents yet.</strong><p>Files attached to messages in this order will appear here.</p></div>}
                    </Section>

                    <Section id="workspace-goals" eyebrow="CLIENT OUTCOME" title="Goals" action={canEdit && <button className="btn" type="button" onClick={() => setGoalOpen((open) => !open)}>{goalOpen ? 'Close' : '+ Add goal'}</button>}>
                      {sectionLoading.goals ? <SkeletonState label="Loading goals" variant="rows" count={3} className="workspace-empty" /> : sectionErrors.goals ? <ErrorNotice>{sectionErrors.goals}</ErrorNotice> : goals.length ? <div className="workspace-simple-list">{goals.map((goal) => <article key={goal.id}><div><strong>{goal.title}</strong><p>{goal.description || 'No additional detail.'}</p></div><div><StatusBadge>{humanize(goal.status)}</StatusBadge>{goal.target_date && <small>Target {formatDate(goal.target_date)}</small>}</div></article>)}</div> : <div className="workspace-empty"><strong>No goals recorded.</strong><p>A goal describes the outcome; tasks describe the work to reach it.</p></div>}
                      {goalOpen && canEdit && <form className="workspace-form" onSubmit={saveGoal}><h3>New goal</h3><label>Goal<input required maxLength={180} value={goalDraft.title} onChange={(event) => setGoalDraft({ ...goalDraft, title: event.target.value })} /></label><label>Description<textarea rows="2" value={goalDraft.description} onChange={(event) => setGoalDraft({ ...goalDraft, description: event.target.value })} /></label><div className="workspace-form-grid"><label>Target date<input type="date" value={goalDraft.target_date} onChange={(event) => setGoalDraft({ ...goalDraft, target_date: event.target.value })} /></label><label>Status<select value={goalDraft.status} onChange={(event) => setGoalDraft({ ...goalDraft, status: event.target.value })}><option value="active">Active</option><option value="achieved">Achieved</option><option value="paused">Paused</option></select></label></div><label className="workspace-check"><input type="checkbox" checked={goalDraft.client_visible} onChange={(event) => setGoalDraft({ ...goalDraft, client_visible: event.target.checked })} />Visible to this client</label><div className="workspace-form-actions"><button type="button" className="btn" onClick={() => setGoalOpen(false)}>Cancel</button><button className="btn dark" type="submit">Save goal</button></div></form>}
                    </Section>

                    <Section id="workspace-sessions" eyebrow="CONSULTATION" title="Sessions" action={canEdit && <button className="btn" type="button" onClick={() => setSessionOpen((open) => !open)}>{sessionOpen ? 'Close' : '+ Add session'}</button>}>
                      {sectionLoading.sessions ? <SkeletonState label="Loading sessions" variant="rows" count={2} className="workspace-empty" /> : sectionErrors.sessions ? <ErrorNotice>{sectionErrors.sessions}</ErrorNotice> : sessions.length ? <div className="workspace-simple-list">{sessions.map((session) => { const meetingUrl = safeHttpUrl(session.meeting_url); return <article key={session.id}><div><strong>{session.title}</strong><p>{formatDate(session.starts_at, true)}{session.assigned_to ? ` · ${staffOptions.find((person) => person.id === String(session.assigned_to))?.name || 'Assigned consultant'}` : ''}</p>{session.notes && <small>{session.notes}</small>}</div><div><StatusBadge>{humanize(session.status)}</StatusBadge>{meetingUrl && <a className="workspace-text-action" href={meetingUrl} target="_blank" rel="noreferrer">Meeting link ↗</a>}</div></article>; })}</div> : <div className="workspace-empty"><strong>No sessions scheduled.</strong><p>Session records are lightweight and do not connect to a scheduling service.</p></div>}
                      {sessionOpen && canEdit && <form className="workspace-form" onSubmit={saveSession}><h3>New session</h3><label>Title<input required maxLength={180} value={sessionDraft.title} onChange={(event) => setSessionDraft({ ...sessionDraft, title: event.target.value })} /></label><div className="workspace-form-grid"><label>Date and time<input required type="datetime-local" value={sessionDraft.starts_at} onChange={(event) => setSessionDraft({ ...sessionDraft, starts_at: event.target.value })} /></label><label>Consultant<select value={sessionDraft.assigned_to} onChange={(event) => setSessionDraft({ ...sessionDraft, assigned_to: event.target.value })}><option value="">Unassigned</option>{staffOptions.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div><label>Meeting link<input type="url" placeholder="https://" value={sessionDraft.meeting_url} onChange={(event) => setSessionDraft({ ...sessionDraft, meeting_url: event.target.value })} /></label><label>Internal notes<textarea rows="2" value={sessionDraft.notes} onChange={(event) => setSessionDraft({ ...sessionDraft, notes: event.target.value })} /></label><p className="workspace-muted">Session details are staff-only in this phase.</p><div className="workspace-form-actions"><button type="button" className="btn" onClick={() => setSessionOpen(false)}>Cancel</button><button className="btn dark" type="submit">Save session</button></div></form>}
                    </Section>

                    <Section id="workspace-notes" eyebrow="TEAM CONTEXT" title="Notes" action={canEdit && <button className="btn" type="button" onClick={() => setNoteOpen((open) => !open)}>{noteOpen ? 'Close' : '+ Add note'}</button>}>
                      {sectionLoading.notes ? <SkeletonState label="Loading notes" variant="rows" count={2} className="workspace-empty" /> : sectionErrors.notes ? <ErrorNotice>{sectionErrors.notes}</ErrorNotice> : notes.length ? <div className="workspace-note-list">{notes.map((note) => <article key={note.id} className={note.visibility === 'internal' ? 'is-internal' : 'is-shared'}><header><StatusBadge tone={note.visibility === 'internal' ? 'high' : 'visible'}>{note.visibility === 'internal' ? 'Internal note' : 'Shared with client'}</StatusBadge><time>{formatDate(note.created_at, true)}</time></header><p>{note.body}</p></article>)}</div> : <div className="workspace-empty"><strong>No notes yet.</strong><p>Keep operational context here without duplicating profile or order fields.</p></div>}
                      {noteOpen && canEdit && <form className="workspace-form" onSubmit={saveNote}><h3>New note</h3><label>Note<textarea required rows="4" maxLength={5000} value={noteDraft.body} onChange={(event) => setNoteDraft({ ...noteDraft, body: event.target.value })} /></label><label>Visibility<select value={noteDraft.visibility} onChange={(event) => setNoteDraft({ ...noteDraft, visibility: event.target.value })}><option value="internal">Internal · staff only</option><option value="shared">Shared with this client</option></select></label><p className="workspace-muted">Visibility is enforced by database row-level security.</p><div className="workspace-form-actions"><button type="button" className="btn" onClick={() => setNoteOpen(false)}>Cancel</button><button className="btn dark" type="submit">Save note</button></div></form>}
                    </Section>
                  </div>

                  <aside className="client360-context">
                    <Section id="client-profile" eyebrow="PROFESSIONAL IDENTITY" title="Client profile"><div className="workspace-profile-summary"><div className="workspace-profile-contact"><strong>{clientProfile?.name || 'Client'}</strong><span>{clientProfile?.email || 'Email not provided'}</span><span>{clientProfile?.phone || 'Phone not provided'}</span></div><div className="workspace-profile-grid">{[['Target role', clientProfile?.target_role], ['Experience', clientProfile?.experience], ['Education', clientProfile?.education], ['Location', clientProfile?.location], ['LinkedIn', clientProfile?.linkedin], ['GitHub', clientProfile?.github], ['Portfolio', clientProfile?.portfolio]].map(([label, value]) => { const safeUrl = safeHttpUrl(value); return <div key={label}><span>{label}</span>{safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer">Open link ↗</a> : <p>{value || 'Not provided'}</p>}</div>; })}</div><Link className="workspace-text-action" to="/admin/users">View user directory →</Link></div></Section>

                    <Section id="workspace-assessment" eyebrow="CAREER DIRECTION" title="Assessment">{clientProfile?.lead_assessment ? <div className="workspace-assessment-summary"><div className="workspace-score"><strong>{clientProfile.lead_score ?? '—'}</strong><span>{clientProfile.lead_status ? humanize(clientProfile.lead_status) : 'Completed'}</span></div><p>Completed {formatDate(clientProfile.lead_assessment_completed_at || clientProfile.lead_assessment.completedAt)}</p><dl>{Object.entries(clientProfile.lead_assessment.answers || {}).slice(0, 7).map(([key, value]) => <div key={key}><dt>{humanize(key)}</dt><dd>{Array.isArray(value) ? value.join(', ') : humanize(value)}</dd></div>)}</dl><Link className="workspace-text-action" to={`/admin/leads?client=${encodeURIComponent(selectedClientId)}`}>Open lead assessments →</Link></div> : <div className="workspace-empty workspace-empty-small"><strong>No assessment on file.</strong><p>Assessment state is read from the profile source of truth.</p></div>}</Section>

                    <Section id="messages" eyebrow="CONVERSATION" title="Messages" action={<Link className="workspace-text-action" to={`/admin/messages?order=${encodeURIComponent(selectedOrder.id)}`}>Open conversation →</Link>}>{sectionLoading.messages ? <SkeletonState label="Loading conversation" variant="messages" count={2} className="workspace-empty workspace-empty-small" /> : sectionErrors.messages ? <ErrorNotice>{sectionErrors.messages}</ErrorNotice> : <div className="workspace-message-summary"><StatusBadge tone={Number(messageSummary?.unread_count) ? 'high' : 'visible'}>{Number(messageSummary?.unread_count) || 0} unread</StatusBadge><p>{messageSummary?.latest_message_id ? messageText(messageSummary.latest_body).slice(0, 220) || 'Attachment shared' : 'No messages in this conversation yet.'}</p><small>{messageSummary?.latest_created_at ? `Last message ${formatDate(messageSummary.latest_created_at, true)}` : 'Conversation activity will appear here.'}</small></div>}</Section>

                    <Section id="workspace-activity" eyebrow="RECENT HISTORY" title="Activity"><div className="workspace-timeline">{timeline.length ? timeline.map((entry, index) => <article key={`${entry.kind}-${entry.at}-${index}`}><span className="workspace-timeline-dot" aria-hidden="true" /><div><time>{formatDate(entry.at, true)}</time><strong>{entry.title}</strong><p>{entry.detail}</p></div></article>) : <div className="workspace-empty workspace-empty-small"><strong>No activity recorded yet.</strong></div>}</div></Section>
                  </aside>
                </div>
                <footer className="workspace-client-orders"><span>CLIENT SERVICE ORDERS</span>{ordersForClient.length > 1 ? ordersForClient.map((order) => <button type="button" key={order.id} className={String(order.id) === String(selectedOrder.id) ? 'is-active' : ''} onClick={() => selectOrder(order)}>#{order.id} · {order.service_name || 'Service'} · {humanize(order.status)}</button>) : <span>One order in this workspace context.</span>}</footer>
              </div>
            )}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
