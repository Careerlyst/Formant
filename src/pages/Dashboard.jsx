  import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
  import DashboardShell from '../components/DashboardShell';
import { load, patch, services } from '../lib/store';
import { supabase } from '../lib/supabase';
import { showcaseTabForService } from '../lib/showcase';
import { fetchProfile, saveProfile } from '../lib/profileRepository';
import { subscribeToClientMessages } from '../lib/messageRealtime';
import { useMessageViewport } from '../lib/messageViewport';
import MessageActions from '../components/MessageActions';
  import { getProfileCompletion, getProfileProgress } from '../lib/profileCompletion';
  import './my-profile.css';
  import './workspace-client.css';
  import {
    applyTheme,
    getStoredThemePreference,
    hasStoredThemePreference,
    normalizeThemePreference,
    saveThemePreference,
    watchSystemTheme
  } from '../lib/theme';
  import {
    getPushStatus,
    subscribeUserToPush,
    unsubscribeUserFromPush,
    isPushSupported
  } from '../lib/pushNotifications';

  /* =========================================================
    SHARED
  ========================================================= */

  const TARGET_ROLE_GROUPS = [
    {
      title: 'ENGINEERING & ARCHITECTURE',
      roles: [
        'Frontend Developer',
        'Backend Developer',
        'Full-Stack Developer',
        'Software Engineer',
        'Mobile App Developer',
        'DevOps & Cloud Engineer',
        'Solutions Architect',
        'Engineering Manager'
      ]
    },
    {
      title: 'DATA & ARTIFICIAL INTELLIGENCE',
      roles: [
        'Data Analyst',
        'Data Scientist',
        'Machine Learning Engineer',
        'AI Research Engineer',
        'Data Engineer',
        'Business Intelligence Analyst'
      ]
    },
    {
      title: 'PRODUCT & DESIGN',
      roles: [
        'UI/UX Designer',
        'Product Designer',
        'Lead Design Strategist',
        'Product Manager',
        'Technical Product Owner',
        'Design Systems Engineer'
      ]
    },
    {
      title: 'OPERATIONS & MARKETING',
      roles: [
        'Technical Project Manager',
        'Scrum Master / Agile Coach',
        'Growth & Marketing Strategist',
        'Customer Success Specialist'
      ]
    }
  ];

  const ALL_TARGET_ROLES = TARGET_ROLE_GROUPS.flatMap((group) => group.roles);

  const Stat = ({ label, value, detail }) => (
    <div className="overview-stat">
      <div className="overview-stat-top">
        <span>{label}</span>
        <span className="overview-stat-mark">↗</span>
      </div>

      <strong>{value}</strong>

      {detail && <p>{detail}</p>}
    </div>
  );

  function ProgressItem({ done, children }) {
    return (
      <div className={`overview-check ${done ? 'is-done' : ''}`}>
        <span className="overview-check-icon">
          {done ? '✓' : ''}
        </span>

        <span>{children}</span>

        {!done && (
          <span className="overview-check-arrow">
            →
          </span>
        )}
      </div>
    );
  }

  function OrderMini({ order }) {
    const serviceName = order.service_name || 'Formant service';
    const packageName = order.package_name || '';
    const status = order.status || 'pending';
    const displayStatus = status
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    return (
      <div className="overview-order">

        <div className="overview-order-main">

          <div className="overview-order-id">
            <span>ORDER</span>
            <strong>#{order.id}</strong>
          </div>

          <h3>
            {serviceName}
            {packageName ? ` · ${packageName}` : ''}
          </h3>

          <p>
            {status.toLowerCase() === 'queued'
              ? `You're in the queue${order.queue_position ? ` at position ${order.queue_position}` : ''}.`
              : status.toLowerCase() === 'pending'
                ? 'Your order is confirmed and waiting for the next step.'
                : 'Your project is currently being handled by the Formant team.'}
          </p>

        </div>
      </div>
    );
  }

  function RoadmapPreview({ order, roadmap }) {
    const stages = Array.isArray(roadmap.stages) ? roadmap.stages : [];
    const currentStageIndex = stages.findIndex(
      (stage) => stage.stage_key === roadmap.current_stage_key
    );
    const currentStage = currentStageIndex >= 0 ? stages[currentStageIndex] : null;
    const completedStages = stages
      .filter((stage) => stage.status === 'COMPLETED')
      .slice(-2);
    const nextStage = currentStageIndex >= 0
      ? stages.slice(currentStageIndex + 1).find((stage) => stage.status === 'NOT_STARTED')
      : null;
    const previewStages = [...completedStages, currentStage, nextStage]
      .filter(Boolean)
      .filter((stage, index, list) => list.findIndex((item) => item.stage_key === stage.stage_key) === index);
    const rawProgress = roadmap.progress;
    const progress = rawProgress !== null && rawProgress !== undefined && rawProgress !== '' && Number.isFinite(Number(rawProgress))
      ? Math.max(0, Math.min(100, Number(rawProgress)))
      : null;
    const isComplete = roadmap.current_status === 'COMPLETED';
    const currentDescription = currentStage?.description || roadmap.client_update || '';
    const hasClientAction = roadmap.current_status === 'WAITING_ON_CLIENT'
      && (roadmap.client_action_title || roadmap.client_action_description);

    return (
      <article className="overview-roadmap-card">
        <header className="overview-roadmap-card-head">
          <div>
            <span className="overview-roadmap-order">ORDER #{order.id}</span>
            <h3>{roadmap.service_name}</h3>
          </div>
          <strong className="overview-roadmap-percent">
            {progress === null ? '—' : `${progress}%`}
          </strong>
        </header>

        {progress !== null ? (
          <div
            className="overview-roadmap-progress"
            role="progressbar"
            aria-label={`Service delivery progress for order ${order.id}`}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : (
          <p className="overview-roadmap-progress-unavailable">Progress unavailable</p>
        )}

        <div className="overview-roadmap-current">
          <span className="overview-roadmap-label">{isComplete ? 'COMPLETE' : 'CURRENT STAGE'}</span>
          <strong>{roadmap.current_stage_title || 'Stage unavailable'}</strong>
          {currentDescription && <p>{currentDescription}</p>}
        </div>

        {previewStages.length > 0 && (
          <ol className="overview-roadmap-timeline" aria-label={`Roadmap preview for order ${order.id}`}>
            {previewStages.map((stage) => {
              const isCurrent = stage.stage_key === roadmap.current_stage_key && !isComplete;
              const isCompleted = stage.status === 'COMPLETED' || (stage.stage_key === roadmap.current_stage_key && isComplete);
              return (
                <li
                  key={stage.stage_key}
                  className={isCompleted ? 'is-completed' : isCurrent ? 'is-current' : 'is-upcoming'}
                >
                  <span className="overview-roadmap-marker" aria-hidden="true">{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
                  <strong>{stage.title}</strong>
                </li>
              );
            })}
          </ol>
        )}

        {hasClientAction && (
          <div className="overview-roadmap-client-action">
            {roadmap.client_action_title && <strong>{roadmap.client_action_title}</strong>}
            {roadmap.client_action_description && <p>{roadmap.client_action_description}</p>}
          </div>
        )}

        <Link className="overview-roadmap-link" to={`/dashboard/orders?order=${encodeURIComponent(order.id)}`}>
          View full roadmap <span aria-hidden="true">↗</span>
        </Link>
      </article>
    );
  }

  export function Dashboard() {
    const [s, setStoreSnapshot] = useState(() => load());

    useEffect(() => {
      const refresh = () => setStoreSnapshot(load());
      window.addEventListener('careerlyst-store', refresh);
      return () => window.removeEventListener('careerlyst-store', refresh);
    }, []);

    const firstName =
      s.user?.name?.split(' ')[0] ||
      s.profile?.name?.split(' ')[0] ||
      'there';

    const [orders, setOrders] = useState(s.orders || []);
    const [ordersLoading, setOrdersLoading] = useState(Boolean(supabase));
    const [roadmaps, setRoadmaps] = useState({});
    const [roadmapsLoading, setRoadmapsLoading] = useState(Boolean(supabase));
    const [roadmapsError, setRoadmapsError] = useState(false);

    useEffect(() => {
      let mounted = true;

      async function loadOverviewOrders() {
        if (!supabase) {
          if (mounted) {
            setOrdersLoading(false);
            setRoadmapsLoading(false);
            setRoadmapsError(Boolean((s.orders || []).length));
          }
          return;
        }

        setOrdersLoading(true);

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !sessionData?.session?.user) {
          if (mounted) {
            setOrdersLoading(false);
            setRoadmapsLoading(false);
            setRoadmapsError(true);
          }
          return;
        }

        const { data, error: queryError } = await supabase
          .from('orders')
          .select(
            'id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, created_at, updated_at'
          )
          .eq('user_id', sessionData.session.user.id)
          .order('created_at', { ascending: false });

        if (!mounted) return;
        if (queryError) {
          setRoadmapsError(true);
          setOrdersLoading(false);
          setRoadmapsLoading(false);
          return;
        }

        const nextOrders = data || [];
        setOrders(nextOrders);
        setOrdersLoading(false);
        const orderIds = nextOrders.map((order) => order.id).filter(Boolean);
        if (!orderIds.length) {
          setRoadmaps({});
          setRoadmapsError(false);
          setRoadmapsLoading(false);
          return;
        }

        const { data: roadmapData, error: roadmapError } = await supabase.rpc(
          'get_my_order_roadmaps_v1',
          { p_order_ids: orderIds }
        );
        if (!mounted) return;
        if (roadmapError) {
          setRoadmapsError(true);
          setRoadmaps({});
        } else {
          setRoadmaps(Object.fromEntries(
            (roadmapData || []).map((roadmap) => [String(roadmap.order_id), roadmap])
          ));
          setRoadmapsError(false);
        }
        setRoadmapsLoading(false);
      }

      loadOverviewOrders();

      return () => {
        mounted = false;
      };
    }, []);

    // Pending, queued and active-work orders are still part of the client's
    // active workload. Completed/cancelled orders should not count here.
    const activeOrderList = orders.filter((order) => {
      const status = String(order.status || '').trim().toLowerCase();
      return !['completed', 'cancelled', 'canceled'].includes(status);
    });

    const activeOrders = activeOrderList.length;
    const currentOrder = activeOrderList[0] || null;
    const nonCancelledOrders = orders.filter((order) => {
      const status = String(order.status || '').trim().toLowerCase();
      return !['cancelled', 'canceled'].includes(status);
    });
    const completedOrders = nonCancelledOrders.filter((order) => String(order.status || '').trim().toLowerCase() === 'completed');
    const roadmapCandidates = [...activeOrderList, ...completedOrders]
      .map((order) => ({ order, roadmap: roadmaps[String(order.id)] }))
      .filter((item) => item.roadmap)
      .slice(0, 2);
    const hasAdditionalOrders = orders.length > roadmapCandidates.length;
    const hasEligibleOrders = nonCancelledOrders.length > 0;

    const unreadMessages =
      s.messages?.filter(
        (message) => !message.read
      ).length || 0;

    const totalFiles = s.files?.length || 0;

    const profileProgress = getProfileCompletion(s.profile);
    const dashboardChecklist = [
      { label: 'Core profile ready', done: profileProgress === 100 },
      { label: 'Career assessment completed', done: Boolean(s.user?.assessmentCompleted) },
      { label: 'Service order started', done: orders.length > 0 },
      { label: 'Professional link added', done: Boolean(s.profile?.linkedin || s.profile?.github || s.profile?.portfolio) }
    ];

    const activeOrdersValue = ordersLoading ? '—' : (activeOrders || '—');
    const activeOrdersDetail = ordersLoading
      ? 'Checking your projects'
      : activeOrders
        ? `${activeOrders} project${activeOrders === 1 ? '' : 's'} currently open`
        : 'No active projects';

    return (
      <DashboardShell>

        <main className="overview-page">

          {/* =====================================================
              HEADER
          ===================================================== */}

          <section className="overview-header">

            <div className="overview-header-copy">

              <p className="eyebrow">
                CLIENT AREA
              </p>

              <h1>
                Good to see you,{' '}
                <span>{firstName}.</span>
              </h1>

              <p className="overview-lede">
                Here's where your Formant work stands.
              </p>

            </div>

            <div className="overview-header-action">

              <span>
                NEED SOMETHING ELSE?
              </span>

              <Link
                className="btn lime"
                to="/services"
              >
                Start a new service
                <span>↗</span>
              </Link>

            </div>

          </section>

          {/* =====================================================
              QUICK STATS
          ===================================================== */}

          <section className="overview-stats">

            <Stat
              label="Active orders"
              value={activeOrdersValue}
              detail={activeOrdersDetail}
            />

            <Stat
              label="Unread messages"
              value={unreadMessages}
              detail={
                unreadMessages
                  ? 'Needs your attention'
                  : 'Inbox is up to date'
              }
            />

            <Stat
              label="Project files"
              value={totalFiles}
              detail={
                totalFiles
                  ? 'Uploaded to workspace'
                  : 'Nothing uploaded yet'
              }
            />

            <Stat
              label="Profile"
              value={`${profileProgress}%`}
              detail="Profile completion"
            />

          </section>


          {/* =====================================================
              MAIN CONTENT
          ===================================================== */}

          <section className="overview-grid">

            {/* PROFILE */}

            <div className="overview-panel overview-progress-panel">

              <div className="overview-panel-head">

                <div>

                  <span className="overview-panel-label">
                    YOUR PROFILE
                  </span>

                  <h2>
                    Keep moving.
                  </h2>

                </div>

                <strong>
                  {profileProgress}%
                </strong>

              </div>


              <div className="overview-progress-track">

                <span
                  style={{
                    width: `${profileProgress}%`
                  }}
                />

              </div>

              <div className="overview-progress-meta">

                <span>
                  Profile completion
                </span>

                <span>
                  {profileProgress}% complete
                </span>

              </div>


              <div className="overview-checklist">

                {dashboardChecklist.map((item) => (
                  <ProgressItem key={item.label} done={item.done}>
                    {item.label}
                  </ProgressItem>
                ))}

              </div>


              <Link
                className="overview-text-link"
                to="/dashboard/profile"
              >
                Complete your profile
                <span>↗</span>
              </Link>

            </div>


            {/* CURRENT PROJECT */}

            <div className="overview-panel overview-order-panel">

              <div className="overview-panel-head">

                <div>

                  <span className="overview-panel-label">
                    CURRENT PROJECT
                  </span>

                  <h2>
                    Your work.
                  </h2>

                </div>

                <Link
                  className="overview-view-link"
                  to="/dashboard/orders"
                >
                  View all
                  <span>↗</span>
                </Link>

              </div>


              {ordersLoading ? (

                <div className="overview-empty">
                  <div className="overview-empty-number">
                    —
                  </div>
                  <h3>
                    Checking your projects.
                  </h3>
                  <p>
                    We're loading the latest order status.
                  </p>
                </div>

              ) : currentOrder ? (

                <OrderMini
                  order={currentOrder}
                />

              ) : (

                <div className="overview-empty">

                  <div className="overview-empty-number">
                    01
                  </div>

                  <h3>
                    Nothing started yet.
                  </h3>

                  <p>
                    Choose a service and we'll take it
                    from there.
                  </p>

                  <Link
                    className="overview-text-link"
                    to="/services"
                  >
                    Explore services
                    <span>↗</span>
                  </Link>

                </div>

              )}

            </div>

          </section>

          <section className="overview-roadmap-section" aria-labelledby="overview-roadmap-title">
            <div className="overview-roadmap-heading">
              <div>
                <span className="overview-roadmap-label">SERVICE ROADMAP</span>
                <h2 id="overview-roadmap-title">Your progress.</h2>
                <p>See where your services stand and what comes next.</p>
              </div>
              {hasAdditionalOrders && (
                <Link className="overview-roadmap-link overview-roadmap-all" to="/dashboard/orders">
                  View all services <span aria-hidden="true">↗</span>
                </Link>
              )}
            </div>

            {ordersLoading || roadmapsLoading ? (
              <div className="overview-roadmap-state" role="status">Loading your service progress…</div>
            ) : roadmapsError ? (
              <div className="overview-roadmap-state" role="alert">
                <p>Service progress is temporarily unavailable.</p>
                <Link className="overview-roadmap-link" to="/dashboard/orders">View all services <span aria-hidden="true">↗</span></Link>
              </div>
            ) : roadmapCandidates.length ? (
              <div className="overview-roadmap-grid">
                {roadmapCandidates.map(({ order, roadmap }) => (
                  <RoadmapPreview key={order.id} order={order} roadmap={roadmap} />
                ))}
              </div>
            ) : (
              <div className="overview-roadmap-state">
                <p>{hasEligibleOrders ? 'No service roadmap is available yet.' : 'Your service roadmap will appear here after you start a service.'}</p>
                {hasEligibleOrders && <Link className="overview-roadmap-link" to="/dashboard/orders">View all services <span aria-hidden="true">↗</span></Link>}
                {!hasEligibleOrders && <Link className="overview-roadmap-link" to="/services">Explore services <span aria-hidden="true">↗</span></Link>}
                {!hasEligibleOrders && orders.length > 0 && <Link className="overview-roadmap-link" to="/dashboard/orders">View all services <span aria-hidden="true">↗</span></Link>}
              </div>
            )}
          </section>


          {/* =====================================================
              MESSAGE + CAPACITY
          ===================================================== */}

          <section className="overview-bottom-grid">

            {/* TEAM MESSAGE */}

            <div className="overview-panel overview-message-panel">

              <div className="overview-panel-head">

                <div>

                  <span className="overview-panel-label">
                    TEAM MESSAGE
                  </span>

                  <h2>
                    Stay connected.
                  </h2>

                </div>

                <Link
                  className="overview-view-link"
                  to="/dashboard/messages"
                >
                  Open inbox
                  <span>↗</span>
                </Link>

              </div>


              <div className="overview-message">

                <div className="overview-avatar">
                  C
                </div>

                <div className="overview-message-copy">

                  <div className="overview-message-top">

                    <strong>
                      Formant Team
                    </strong>

                    <span>
                      Today
                    </span>

                  </div>

                  <p>
                    Once your information is complete,
                    we'll begin your project.
                  </p>

                </div>

              </div>

            </div>


            {/* CAPACITY */}

            <div className="overview-panel overview-capacity-panel">

              <div className="overview-capacity-top">

                <span className="overview-panel-label">
                  CURRENT AVAILABILITY
                </span>

                <span className="overview-capacity-status">
                  LIMITED CAPACITY
                </span>

              </div>

              <h2>
                Focused attention.
              </h2>

              <p>
                We keep the number of active projects
                intentionally small so every client gets
                proper attention.
              </p>

              <div className="overview-capacity-line">
                <span />
              </div>

              <div className="overview-capacity-meta">

                <span>
                  ACTIVE PROJECTS
                </span>

                <strong>
                  2 / 2
                </strong>

              </div>

            </div>

          </section>


          {/* =====================================================
              SERVICES CTA
          ===================================================== */}

          <section className="overview-cta">

            <div>

              <span className="overview-panel-label">
                NEED SOMETHING ELSE?
              </span>

              <h2>
                Build the next piece
                <br />
                of your <span>profile.</span>
              </h2>

            </div>

            <Link
              className="overview-cta-button"
              to="/services"
            >
              <span>
                Explore services
              </span>

              <span>
                ↗
              </span>
            </Link>

          </section>

        </main>

      </DashboardShell>
    );
  }


  /* =========================================================
    PROFILE
  ========================================================= */

  export function Profile() {
    const initial = load().profile || {};
    const initialUser = load().user || {};
    const rolePickerRef = useRef(null);

    const emptyForm = {
      name: initial.name || initialUser.name || '',
      email: initial.email || initialUser.email || '',
      phone: initial.phone || '',
      target_role: initial.target_role || '',
      experience: initial.experience || '',
      education: initial.education || '',
      linkedin: initial.linkedin || '',
      github: initial.github || '',
      portfolio: initial.portfolio || '',
      bio: initial.bio || '',
      location: initial.location || '',
      skills: initial.skills || '',
      certifications: initial.certifications || '',
      lead_score: initial.lead_score ?? null,
      lead_status: initial.lead_status || '',
      lead_assessment_completed_at: initial.lead_assessment_completed_at || null,
      preferences: {
        cv_style: initial.preferences?.cv_style || 'modern_tech',
        language: initial.preferences?.language || 'en_us',
        tone: initial.preferences?.tone || 'authoritative',
        career_interest: initial.preferences?.career_interest || 'full_time',
        interview_focus: initial.preferences?.interview_focus || 'tech_system',
        ...(initial.preferences || {})
      }
    };

    const [form, setForm] = useState(emptyForm);
    const [savedForm, setSavedForm] = useState(emptyForm);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(Boolean(supabase));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [editingSection, setEditingSection] = useState(null); // 'all' | 'personal' | 'career' | 'education' | 'links' | 'preferences' | null
    const [rolePickerOpen, setRolePickerOpen] = useState(false);
    const [roleSearch, setRoleSearch] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const allowNavigationRef = useRef(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [profileLoadFailed, setProfileLoadFailed] = useState(false);
    const [assessmentSummary, setAssessmentSummary] = useState(null);

    // Initial Profile Load from Supabase or Fallback
    useEffect(() => {
      let mounted = true;

      async function getProfile() {
        if (!supabase) {
          setLoading(false);
          return;
        }

        try {
          const {
            data: { session },
            error: sessionError
          } = await supabase.auth.getSession();

          if (!mounted) return;

          if (sessionError || !session?.user) {
            setError('Your session could not be verified. Please sign in again.');
            setLoading(false);
            return;
          }

          const user = session.user;
          setUserId(user.id);

          const authName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            '';

          const data = await fetchProfile(user.id);

          if (!mounted) return;

          const loaded = {
            name: data?.name || authName,
            email: user.email || '',
            phone: data?.phone || '',
            target_role: data?.target_role || '',
            experience: data?.experience || '',
            education: data?.education || '',
            linkedin: data?.linkedin || '',
            github: data?.github || '',
            portfolio: data?.portfolio || '',
            bio: data?.bio || '',
            location: data.location || '',
            skills: Array.isArray(data.skills) ? data.skills.join(', ') : (data.skills || ''),
            certifications: data.certifications || '',
            lead_score: data.lead_score,
            lead_status: data.lead_status || '',
            lead_assessment_completed_at: data.lead_assessment_completed_at || null,
            lead_assessment: data.lead_assessment,
            preferences: {
              cv_style: data.preferences?.cv_style || 'modern_tech',
              language: data.preferences?.language || 'en_us',
              tone: data.preferences?.tone || 'authoritative',
              career_interest: data.preferences?.career_interest || 'full_time',
              interview_focus: data.preferences?.interview_focus || 'tech_system',
              ...(data.preferences || {})
            }
          };

          setProfileLoadFailed(false);
          setAssessmentSummary(data.lead_assessment || user.user_metadata?.careerlyst_lead_assessment || null);
          setEmailVerified(Boolean(user.email_confirmed_at));

          setForm(loaded);
          setSavedForm(loaded);

          patch((current) => ({
            ...current,
            user: {
              ...(current.user || {}),
              name: loaded.name,
              email: loaded.email
            },
            profile: {
              ...(current.profile || {}),
              ...loaded
            }
          }));
        } catch (loadErr) {
          console.error('Unexpected profile load exception:', loadErr);
          if (mounted) {
            setProfileLoadFailed(true);
            setForm(emptyForm);
            setSavedForm(emptyForm);
            setError('We could not load your saved profile from the server. Refresh to try again; local cache is not being treated as current.');
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }

      getProfile();

      return () => {
        mounted = false;
      };
    }, []);

    // Outside click listener for target role picker
    useEffect(() => {
      function handleOutsideClick(event) {
        if (rolePickerRef.current && !rolePickerRef.current.contains(event.target)) {
          setRolePickerOpen(false);
        }
      }

      if (rolePickerOpen) {
        document.addEventListener('mousedown', handleOutsideClick);
      }

      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
      };
    }, [rolePickerOpen]);

    const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);
    useEffect(() => {
      if (!dirty) return undefined;
      const warnBeforeUnload = (event) => {
        if (allowNavigationRef.current) return;
        event.preventDefault();
        event.returnValue = '';
      };
      const confirmRouteLink = (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || anchor.target === '_blank') return;
        const next = new URL(anchor.href, window.location.href);
        if (next.origin !== window.location.origin || (next.pathname === window.location.pathname && next.search === window.location.search && next.hash === window.location.hash)) return;
        if (!window.confirm('You have unsaved profile changes. Leave this page and discard them?')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
        } else allowNavigationRef.current = true;
      };
      window.addEventListener('beforeunload', warnBeforeUnload);
      window.addEventListener('click', confirmRouteLink, true);
      return () => {
        window.removeEventListener('beforeunload', warnBeforeUnload);
        window.removeEventListener('click', confirmRouteLink, true);
      };
    }, [dirty]);

    // Helpers & Calculations
    const profileProgress = getProfileProgress(form);
    const completion = profileProgress.percent;
    const missingKeys = profileProgress.missing;

    const FIELD_LABELS = {
      name: 'Full name',
      phone: 'Phone number',
      target_role: 'Target role',
      career_background: 'Experience or education'
    };

    const FIELD_SUGGESTIONS = {
      name: 'Add your full name so our career consultants can identify your records.',
      target_role: 'Select your target role to calibrate your resume and interview preparation.',
      career_background: 'Add either experience or education to give the team career context.'
    };

    const nextSuggestion = useMemo(() => {
      if (!missingKeys.length) {
        return 'Your core profile is complete. Optional details can still improve service-specific tailoring.';
      }
      const nextField = missingKeys[0];
      return FIELD_SUGGESTIONS[nextField] || `Add your ${FIELD_LABELS[nextField] || nextField} to strengthen your profile.`;
    }, [missingKeys]);

    const userInitials = useMemo(() => {
      const nameStr = String(form.name || '').trim();
      if (!nameStr) return 'CL';
      const parts = nameStr.split(/\s+/);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }, [form.name]);

    const allRolesList = ALL_TARGET_ROLES;

    const filteredRoleGroups = TARGET_ROLE_GROUPS
      .map((group) => ({
        ...group,
        roles: group.roles.filter((role) =>
          role.toLowerCase().includes(roleSearch.trim().toLowerCase())
        )
      }))
      .filter((group) => group.roles.length);

    const customRoleSearch = roleSearch.trim();
    const canUseCustomRole =
      customRoleSearch &&
      !allRolesList.some((role) => role.toLowerCase() === customRoleSearch.toLowerCase());

    function handleRolePickerKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setRolePickerOpen(false);
        document.getElementById('field-target-role')?.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const options = Array.from(rolePickerRef.current?.querySelectorAll('[role="option"]') || []);
        if (!options.length) return;
        event.preventDefault();
        const currentIndex = options.indexOf(document.activeElement);
        const nextIndex = event.key === 'ArrowDown'
          ? (currentIndex + 1) % options.length
          : (currentIndex <= 0 ? options.length - 1 : currentIndex - 1);
        options[nextIndex].focus();
      }
    }

    function cleanUrl(url) {
      if (!url) return '';
      const trimmed = url.trim();
      if (!trimmed) return '';
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      return `https://${trimmed}`;
    }

    function urlError(value, expectedHost = null) {
      if (!String(value || '').trim()) return '';
      const rawValue = String(value).trim();
      if (/^[a-z][a-z\d+.-]*:/i.test(rawValue) && !/^https?:\/\//i.test(rawValue)) {
        return 'Use an HTTP or HTTPS URL.';
      }
      try {
        const parsed = new URL(cleanUrl(value));
        if (!['http:', 'https:'].includes(parsed.protocol)) return 'Use an HTTP or HTTPS URL.';
        if (expectedHost && !(parsed.hostname === expectedHost || parsed.hostname.endsWith(`.${expectedHost}`))) {
          return `Enter a valid ${expectedHost} URL.`;
        }
        return '';
      } catch {
        return 'Enter a valid website URL.';
      }
    }

    function updateField(key, value) {
      setForm((current) => ({
        ...current,
        [key]: value
      }));
      setMessage('');
      setError('');
      setFieldErrors((current) => ({ ...current, [key]: '' }));
    }

    function updatePreference(key, value) {
      setForm((current) => ({
        ...current,
        preferences: {
          ...current.preferences,
          [key]: value
        }
      }));
      setMessage('');
      setError('');
    }

    function startEditing(section) {
      setEditingSection(section);
      setMessage('');
      setError('');
    }

    function cancelEditing() {
      setForm({ ...savedForm });
      setEditingSection(null);
      setFieldErrors({});
      setError('');
      setMessage('');
    }

    function copyProfileSummary() {
      const summaryText = `Formant Profile — ${form.name || 'Client'}\nTarget Role: ${form.target_role || 'Not set'}\nLocation: ${form.location || 'Not set'}\nEmail: ${form.email}\nPhone: ${form.phone || 'Not set'}\nProfile Strength: ${completion}%\nLinkedIn: ${form.linkedin || 'Not set'}\nPortfolio: ${form.portfolio || 'Not set'}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(summaryText).then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        }).catch(() => {});
      }
    }

    async function handleSave(e, section = null) {
      if (e && e.preventDefault) e.preventDefault();
      if (saving) return;
      if (supabase && profileLoadFailed) {
        setError('The saved profile has not loaded. Refresh before editing so a stale cache cannot overwrite server data.');
        return;
      }

      const cleanName = String(form.name || '').trim();
      if (!cleanName) {
        setFieldErrors((current) => ({ ...current, name: 'Full name is required.' }));
        setError('Please fix the highlighted field before saving.');
        return;
      }
      const validatesRole = section === 'career' || section === 'all' || form.target_role !== savedForm.target_role;
      if (validatesRole && !String(form.target_role || '').trim()) {
        setFieldErrors((current) => ({ ...current, target_role: 'Choose or enter a target role.' }));
        setError('Please fix the highlighted field before saving.');
        document.getElementById('field-target-role')?.focus();
        return;
      }

      const shouldValidateLinks = section === 'links' || section === 'all';
      const nextFieldErrors = {};
      if (shouldValidateLinks || form.linkedin !== savedForm.linkedin) nextFieldErrors.linkedin = urlError(form.linkedin, 'linkedin.com');
      if (shouldValidateLinks || form.github !== savedForm.github) nextFieldErrors.github = urlError(form.github, 'github.com');
      if (shouldValidateLinks || form.portfolio !== savedForm.portfolio) nextFieldErrors.portfolio = urlError(form.portfolio);
      setFieldErrors((current) => ({ ...current, ...nextFieldErrors }));
      const invalidLink = Object.values(nextFieldErrors).some(Boolean);
      if (invalidLink) {
        setError('Please fix the highlighted links before saving.');
        return;
      }

      setSaving(true);
      setError('');
      setMessage('');

      const profileValues = {
        name: cleanName,
        phone: String(form.phone || '').trim(),
        location: String(form.location || '').trim(),
        target_role: String(form.target_role || '').trim(),
        experience: String(form.experience || '').trim(),
        education: String(form.education || '').trim(),
        skills: String(form.skills || '').split(',').map((skill) => skill.trim()).filter(Boolean),
        certifications: String(form.certifications || '').trim(),
        linkedin: cleanUrl(form.linkedin),
        github: cleanUrl(form.github),
        portfolio: cleanUrl(form.portfolio),
        bio: String(form.bio || '').trim(),
        preferences: form.preferences || {}
      };

      try {
        let persisted = profileValues;
        if (supabase) {
          persisted = await saveProfile(userId, profileValues);
          let nameSyncError = null;
          const { data: authUserData, error: authUserError } = await supabase.auth.getUser();
          if (authUserError) {
            nameSyncError = authUserError;
          } else {
            const { error: authUpdateError } = await supabase.auth.updateUser({
              data: { ...(authUserData?.user?.user_metadata || {}), name: cleanName, full_name: cleanName }
            });
            nameSyncError = authUpdateError;
          }

          const nextState = {
            ...form,
            ...persisted,
            skills: Array.isArray(persisted.skills) ? persisted.skills.join(', ') : (persisted.skills || ''),
            preferences: persisted.preferences || form.preferences,
            email: form.email
          };
          patch((current) => ({
            ...current,
            user: { ...(current.user || {}), id: userId, name: cleanName, email: form.email },
            profile: { ...(current.profile || {}), ...nextState }
          }));
          window.dispatchEvent(new CustomEvent('careerlyst-profile-updated', { detail: { userId, name: cleanName } }));
          setForm(nextState);
          setSavedForm(nextState);
          setEditingSection(null);
          if (nameSyncError) {
            console.error('Profile saved but Auth display-name compatibility sync failed:', nameSyncError);
            setError('Your profile was saved, but the account display-name mirror could not be updated. The saved profile name remains authoritative; please retry or refresh.');
          } else {
            setMessage('Your profile has been saved successfully.');
          }
          return;
        }

        const nextState = {
          ...form,
          ...profileValues,
          skills: profileValues.skills.join(', ')
        };

        patch((current) => ({
          ...current,
          user: {
            ...(current.user || {}),
            name: profileValues.name,
            email: form.email
          },
          profile: {
            ...(current.profile || {}),
            ...nextState
          }
        }));

        setForm(nextState);
        setSavedForm(nextState);
        setEditingSection(null);
        setMessage('Your profile has been saved successfully.');
      } catch (err) {
        console.error('Save profile error:', err);
        setError(err.message || 'We could not save your profile changes. Please try again.');
      } finally {
        setSaving(false);
      }
    }

    const skillsArray = useMemo(() => {
      if (!form.skills) return [];
      if (Array.isArray(form.skills)) return form.skills;
      return String(form.skills)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }, [form.skills]);

    const serviceReadiness = useMemo(() => [
      {
        name: 'CV / Resume Revamp',
        ready: Boolean(form.name && form.target_role && (form.experience || form.education)),
        description: 'Uses target role, career timeline, and education to build an ATS-ready document.'
      },
      {
        name: 'LinkedIn Optimization',
        ready: Boolean(form.linkedin && form.bio && form.target_role),
        description: 'Uses headline, bio, and target role to sharpen your professional story.'
      },
      {
        name: 'Portfolio & GitHub',
        ready: Boolean(form.portfolio || form.github),
        description: 'Uses project links and code repositories as credible evidence for technical roles.'
      },
      {
        name: 'Interview Preparation',
        ready: Boolean(form.target_role && form.experience),
        description: 'Calibrates mock questions and technical scope around your targeted seniority.'
      }
    ], [form]);

    if (loading) {
      return (
        <DashboardShell>
          <div className="profile-loading">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #deded5', borderTopColor: '#11120f', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink, #11120f)' }}>Loading your professional profile…</p>
            </div>
          </div>
        </DashboardShell>
      );
    }

    const isEditing = (section) => editingSection === 'all' || editingSection === section;

    return (
      <DashboardShell>
        <div className="profile-redesign-root">

          {/* Feedback Banners */}
          {error && (
            <div className="profile-alert-banner error" role="alert">
              <span>{error}</span>
              <button type="button" className="profile-alert-close" onClick={() => setError('')} aria-label="Dismiss error">×</button>
            </div>
          )}

          {message && (
            <div className="profile-alert-banner success" role="status">
              <span>✓ {message}</span>
              <button type="button" className="profile-alert-close" onClick={() => setMessage('')} aria-label="Dismiss message">×</button>
            </div>
          )}

          {/* =====================================================
              A. PROFILE IDENTITY HERO CARD
          ===================================================== */}
          <section className="profile-hero-card" aria-label="Profile Identity Header">
            <div className="profile-hero-identity">
              <div className="profile-hero-avatar-wrap">
                <div className="profile-hero-avatar" aria-hidden="true">
                  {userInitials}
                </div>
                <div className="profile-hero-status-dot" title="Active Client Profile" />
              </div>

              <div className="profile-hero-details">
                <div className="profile-hero-eyebrow-row">
                  <span className="profile-hero-badge">Professional Identity</span>
                  {completion === 100 && (
                    <span className="profile-hero-badge" style={{ background: '#eafbe3', color: '#2d6810', borderColor: '#b1e59c' }}>
                      ✓ 100% Complete
                    </span>
                  )}
                  <span className="profile-hero-badge account-badge">Client Workspace</span>
                </div>

                <h1 className="profile-hero-name">
                  {form.name || 'Your Full Name'}
                </h1>

                <p className="profile-hero-role">
                  <span>Target:</span>
                  <strong className="profile-hero-role-pill">
                    {form.target_role || 'Role not specified yet'}
                  </strong>
                </p>

                <div className="profile-hero-meta-row">
                  {form.location ? (
                    <span className="profile-hero-meta-item">
                      <span aria-hidden="true">📍</span> {form.location}
                    </span>
                  ) : (
                    <span className="profile-hero-meta-item" style={{ color: '#9da096', fontStyle: 'italic' }}>
                      <span aria-hidden="true">📍</span> Location not specified
                    </span>
                  )}

                  {form.email && (
                    <span className="profile-hero-meta-item">
                      <span aria-hidden="true">✉</span> {form.email}
                    </span>
                  )}

                  {form.phone && (
                    <span className="profile-hero-meta-item">
                      <span aria-hidden="true">📞</span> {form.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-hero-actions">
              <button
                type="button"
                className="profile-action-btn secondary"
                onClick={copyProfileSummary}
                title="Copy profile details summary"
              >
                <span>{copiedLink ? '✓ Copied' : '📋 Copy Summary'}</span>
              </button>

              <button
                type="button"
                className={`profile-action-btn ${editingSection === 'all' ? 'accent' : 'primary'}`}
                onClick={() => {
                  if (editingSection === 'all') {
                    cancelEditing();
                  } else {
                    startEditing('all');
                  }
                }}
              >
                <span>{editingSection === 'all' ? '✕ Done Editing' : '✎ Edit Profile'}</span>
              </button>
            </div>
          </section>

          {/* =====================================================
              TWO-COLUMN WORKSPACE
          ===================================================== */}
          <div className="profile-workspace-grid">

            {/* MAIN COLUMN: PROFILE SECTIONS */}
            <div className="profile-main-column">

              {/* -------------------------------------------------
                  B. PERSONAL INFORMATION
              ------------------------------------------------- */}
              <div className="profile-card" id="profile-section-personal">
                <div className="profile-card-header">
                  <div className="profile-card-header-left">
                    <span className="profile-section-num">01</span>
                    <div className="profile-card-title-group">
                      <h2>Personal Information</h2>
                      <p>Core identity and verified contact details.</p>
                    </div>
                  </div>

                  {!isEditing('personal') && (
                    <button
                      type="button"
                      className="profile-card-edit-btn"
                      onClick={() => startEditing('personal')}
                      aria-label="Edit Personal Information"
                    >
                      <span>✎ Edit</span>
                    </button>
                  )}
                </div>

                <div className="profile-card-body">
                  {isEditing('personal') ? (
                    <form onSubmit={(e) => handleSave(e, 'personal')}>
                      <div className="profile-form-grid">
                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="field-name">
                            <span>Full name *</span>
                          </label>
                          <input
                            id="field-name"
                            className="profile-form-input"
                            type="text"
                            value={form.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            placeholder="e.g. Eleanor Vance"
                            autoComplete="name"
                            aria-required="true"
                            aria-invalid={Boolean(fieldErrors.name)}
                            aria-describedby={fieldErrors.name ? 'field-name-error' : undefined}
                            required
                          />
                          {fieldErrors.name && <span className="profile-field-error" id="field-name-error">{fieldErrors.name}</span>}
                        </div>

                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="field-email">
                            <span>Email address</span>
                            <span className="helper">🔒 Managed by Formant Auth</span>
                          </label>
                          <input
                            id="field-email"
                            className="profile-form-input"
                            type="email"
                            value={form.email}
                            disabled
                          />
                          <span className="profile-form-note">Account email cannot be modified through the profile editor.</span>
                        </div>

                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="field-phone">
                            <span>Phone number</span>
                          </label>
                          <input
                            id="field-phone"
                            className="profile-form-input"
                            type="tel"
                            value={form.phone}
                            onChange={(e) => updateField('phone', e.target.value)}
                            placeholder="+1 (555) 019-2834"
                            autoComplete="tel"
                          />
                        </div>

                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="field-location">
                            <span>Location / Timezone</span>
                          </label>
                          <input
                            id="field-location"
                            className="profile-form-input"
                            type="text"
                            value={form.location}
                            onChange={(e) => updateField('location', e.target.value)}
                            placeholder="e.g. San Francisco, CA / PST"
                          />
                        </div>

                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-bio">
                            <span>Professional Bio & Summary</span>
                            <span className="helper">{form.bio ? `${form.bio.length} characters` : 'Optional but recommended'}</span>
                          </label>
                          <textarea
                            id="field-bio"
                            className="profile-form-textarea"
                            rows="4"
                            value={form.bio}
                            onChange={(e) => updateField('bio', e.target.value)}
                            placeholder="Briefly describe your career background, key competencies, and what you aim to achieve next."
                          />
                        </div>
                      </div>

                      <div className="profile-edit-actions-bar">
                        <button type="button" className="profile-btn-cancel" onClick={cancelEditing}>Cancel</button>
                        <button type="submit" className="profile-btn-save" disabled={saving}>
                          {saving ? 'Saving…' : 'Save Changes ↗'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="profile-data-grid">
                      <div className="profile-data-cell">
                        <span className="profile-data-label">Full Name</span>
                        <span className="profile-data-value">{form.name || <span className="empty-state">Not provided</span>}</span>
                      </div>

                      <div className="profile-data-cell">
                        <span className="profile-data-label">Email Address</span>
                        <span className="profile-data-value">
                          {form.email || <span className="empty-state">Not linked</span>}
                          <span className={`profile-email-status ${emailVerified ? 'is-verified' : 'is-pending'}`}>
                            {emailVerified ? 'Verified' : 'Pending confirmation'}
                          </span>
                        </span>
                      </div>

                      <div className="profile-data-cell">
                        <span className="profile-data-label">Phone Number</span>
                        <span className="profile-data-value">{form.phone || <span className="empty-state">Not provided</span>}</span>
                      </div>

                      <div className="profile-data-cell">
                        <span className="profile-data-label">Location</span>
                        <span className="profile-data-value">{form.location || <span className="empty-state">Not provided</span>}</span>
                      </div>

                      <div className="profile-data-cell span-two">
                        <span className="profile-data-label">Professional Summary</span>
                        {form.bio ? (
                          <div className="profile-bio-quote">{form.bio}</div>
                        ) : (
                          <div className="profile-bio-quote empty">
                            No summary provided. Adding a bio provides critical context for your cover letter and LinkedIn services.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------
                  C. CAREER & EXPERIENCE
              ------------------------------------------------- */}
              <div className="profile-card" id="profile-section-career">
                <div className="profile-card-header">
                  <div className="profile-card-header-left">
                    <span className="profile-section-num">02</span>
                    <div className="profile-card-title-group">
                      <h2>Career & Experience</h2>
                      <p>Target role, professional seniority, and core competencies.</p>
                    </div>
                  </div>

                  {!isEditing('career') && (
                    <button
                      type="button"
                      className="profile-card-edit-btn"
                      onClick={() => startEditing('career')}
                      aria-label="Edit Career & Experience"
                    >
                      <span>✎ Edit</span>
                    </button>
                  )}
                </div>

                <div className="profile-card-body">
                  {isEditing('career') ? (
                    <form onSubmit={(e) => handleSave(e, 'career')}>
                      <div className="profile-form-grid">
                        <div className="profile-form-field span-two" ref={rolePickerRef} onKeyDown={handleRolePickerKeyDown} style={{ position: 'relative' }}>
                          <label className="profile-form-label" htmlFor="field-target-role">
                            <span>Target Role *</span>
                            <span className="helper">Select or enter a custom title</span>
                          </label>

                          <div className={`target-role-control ${rolePickerOpen ? 'is-open' : ''}`}>
                            <input
                              id="field-target-role"
                              className="profile-form-input"
                              type="text"
                              role="combobox"
                              aria-autocomplete="list"
                              aria-haspopup="listbox"
                              aria-expanded={rolePickerOpen}
                              aria-controls="target-role-options"
                              aria-required="true"
                              aria-invalid={Boolean(fieldErrors.target_role)}
                              aria-describedby={fieldErrors.target_role ? 'field-target-role-error' : undefined}
                              value={form.target_role}
                              onFocus={(event) => {
                                // Closing the picker returns focus to this input. Do not
                                // immediately reopen it when focus came from inside the picker.
                                if (event.relatedTarget?.closest?.('.target-role-picker')) return;
                                setRolePickerOpen(true);
                              }}
                              onClick={() => setRolePickerOpen(true)}
                              onChange={(e) => {
                                updateField('target_role', e.target.value);
                                setRoleSearch(e.target.value);
                                setRolePickerOpen(true);
                              }}
                              placeholder="e.g. Senior Frontend Developer"
                              autoComplete="off"
                            />

                            <button
                              type="button"
                              className="target-role-toggle"
                              aria-label="Toggle role picker menu"
                              aria-haspopup="listbox"
                              aria-expanded={rolePickerOpen}
                              aria-controls="target-role-options"
                              onClick={() => setRolePickerOpen((open) => !open)}
                            >
                              <span>⌄</span>
                            </button>
                          </div>
                          {fieldErrors.target_role && <span className="profile-field-error" id="field-target-role-error">{fieldErrors.target_role}</span>}

                          {rolePickerOpen && (
                            <div className="target-role-picker" style={{ zIndex: 120 }}>
                              <div className="target-role-picker-head">
                                <div>
                                  <span className="target-role-picker-kicker">SUGGESTED ROLES</span>
                                  <h3 style={{ margin: 0, fontSize: 14 }}>Choose your target title</h3>
                                </div>
                                <button
                                  type="button"
                                  className="target-role-close"
                                  onClick={() => {
                                    setRolePickerOpen(false);
                                    document.getElementById('field-target-role')?.focus();
                                  }}
                                  aria-label="Close role picker"
                                >
                                  ×
                                </button>
                              </div>

                              <div className="target-role-search">
                                <span>⌕</span>
                                <input
                                  type="text"
                                  value={roleSearch}
                                  onChange={(e) => setRoleSearch(e.target.value)}
                                  placeholder="Type to filter roles…"
                                  aria-label="Search suggested target roles"
                                  autoFocus
                                />
                              </div>

                              <div className="target-role-options" id="target-role-options" role="listbox" aria-label="Suggested target roles">
                                {filteredRoleGroups.map((group) => (
                                  <div className="target-role-group" key={group.title}>
                                    <span className="target-role-group-title">{group.title}</span>
                                    <div className="target-role-group-list">
                                      {group.roles.map((role) => (
                                        <button
                                          type="button"
                                          className={`target-role-option ${form.target_role === role ? 'is-selected' : ''}`}
                                          role="option"
                                          aria-selected={form.target_role === role}
                                          key={role}
                                          onClick={() => {
                                            updateField('target_role', role);
                                            setRoleSearch('');
                                            setRolePickerOpen(false);
                                            requestAnimationFrame(() => document.getElementById('field-target-role')?.focus());
                                          }}
                                        >
                                          <span>{role}</span>
                                          <span className="target-role-option-arrow">↗</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}

                                {canUseCustomRole && (
                                  <button
                                    type="button"
                                    className="target-role-custom"
                                    role="option"
                                    aria-selected={form.target_role === customRoleSearch}
                                    onClick={() => {
                                      updateField('target_role', customRoleSearch);
                                      setRoleSearch('');
                                      setRolePickerOpen(false);
                                      requestAnimationFrame(() => document.getElementById('field-target-role')?.focus());
                                    }}
                                  >
                                    <span>+ Use “{customRoleSearch}” as custom target role</span>
                                    <span>↗</span>
                                  </button>
                                )}

                                {!filteredRoleGroups.length && !canUseCustomRole && (
                                  <div className="target-role-no-results">No matching role templates found. Type any custom role above.</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-experience">
                            <span>Work Experience Summary</span>
                            <span className="helper">Years in field or recent employment</span>
                          </label>
                          <textarea
                            id="field-experience"
                            className="profile-form-textarea"
                            rows="3"
                            value={form.experience}
                            onChange={(e) => updateField('experience', e.target.value)}
                            placeholder="e.g. 5+ years building distributed React/Node applications; previously Senior Engineer at Acme Tech."
                          />
                        </div>

                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-skills">
                            <span>Core Skills & Technologies</span>
                            <span className="helper">Comma-separated tags</span>
                          </label>
                          <input
                            id="field-skills"
                            className="profile-form-input"
                            type="text"
                            value={form.skills}
                            onChange={(e) => updateField('skills', e.target.value)}
                            placeholder="e.g. React, TypeScript, Next.js, Node.js, GraphQL, System Design, UX Architecture"
                          />
                          <span className="profile-form-note">These skills help calibrate keyword density for ATS optimization.</span>
                        </div>
                      </div>

                      <div className="profile-edit-actions-bar">
                        <button type="button" className="profile-btn-cancel" onClick={cancelEditing}>Cancel</button>
                        <button type="submit" className="profile-btn-save" disabled={saving}>
                          {saving ? 'Saving…' : 'Save Changes ↗'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="profile-data-grid single-col">
                      <div className="profile-data-cell">
                        <span className="profile-data-label">Target Role</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink, #11120f)' }}>
                            {form.target_role || <span className="empty-state">Target role not specified</span>}
                          </span>
                        </div>
                      </div>

                      <div className="profile-data-cell">
                        <span className="profile-data-label">Experience & Career Background</span>
                        <span className="profile-data-value">
                          {form.experience || <span className="empty-state">No experience details added yet. Useful for experienced hires and career changers alike.</span>}
                        </span>
                      </div>

                      <div className="profile-data-cell">
                        <span className="profile-data-label">Key Competencies & Skills</span>
                        {skillsArray.length > 0 ? (
                          <div className="profile-skills-wrap">
                            {skillsArray.map((skill, idx) => (
                              <span key={idx} className="profile-skill-chip">{skill}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="profile-data-value empty-state">No skills listed. Adding technologies helps our writers tailor your CV keywords.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------
                  D. EDUCATION & CERTIFICATIONS
              ------------------------------------------------- */}
              <div className="profile-card" id="profile-section-education">
                <div className="profile-card-header">
                  <div className="profile-card-header-left">
                    <span className="profile-section-num">03</span>
                    <div className="profile-card-title-group">
                      <h2>Education & Credentials</h2>
                      <p>Academic degrees, institutions, and professional licenses.</p>
                    </div>
                  </div>

                  {!isEditing('education') && (
                    <button
                      type="button"
                      className="profile-card-edit-btn"
                      onClick={() => startEditing('education')}
                      aria-label="Edit Education & Credentials"
                    >
                      <span>✎ Edit</span>
                    </button>
                  )}
                </div>

                <div className="profile-card-body">
                  {isEditing('education') ? (
                    <form onSubmit={(e) => handleSave(e, 'education')}>
                      <div className="profile-form-grid">
                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-education">
                            <span>Highest Education / Degree</span>
                            <span className="helper">Degree, University, Graduation Year</span>
                          </label>
                          <textarea
                            id="field-education"
                            className="profile-form-textarea"
                            rows="2"
                            value={form.education}
                            onChange={(e) => updateField('education', e.target.value)}
                            placeholder="e.g. BSc in Computer Science, University of California, Berkeley (2021)"
                          />
                        </div>

                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-certifications">
                            <span>Certifications & Accreditations</span>
                            <span className="helper">Optional</span>
                          </label>
                          <textarea
                            id="field-certifications"
                            className="profile-form-textarea"
                            rows="2"
                            value={form.certifications}
                            onChange={(e) => updateField('certifications', e.target.value)}
                            placeholder="e.g. AWS Certified Solutions Architect (Associate), PMP Certification"
                          />
                        </div>
                      </div>

                      <div className="profile-edit-actions-bar">
                        <button type="button" className="profile-btn-cancel" onClick={cancelEditing}>Cancel</button>
                        <button type="submit" className="profile-btn-save" disabled={saving}>
                          {saving ? 'Saving…' : 'Save Changes ↗'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="profile-data-grid single-col">
                      <div className="profile-data-cell">
                        <span className="profile-data-label">Education Background</span>
                        <span className="profile-data-value">
                          {form.education || <span className="empty-state">No education history recorded yet.</span>}
                        </span>
                      </div>

                      <div className="profile-data-cell">
                        <span className="profile-data-label">Certifications & Licenses</span>
                        <span className="profile-data-value">
                          {form.certifications || <span className="empty-state">No certifications listed.</span>}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------
                  E. PROFESSIONAL LINKS
              ------------------------------------------------- */}
              <div className="profile-card" id="profile-section-links">
                <div className="profile-card-header">
                  <div className="profile-card-header-left">
                    <span className="profile-section-num">04</span>
                    <div className="profile-card-title-group">
                      <h2>Professional Links</h2>
                      <p>Public URLs used to review and demonstrate your work.</p>
                    </div>
                  </div>

                  {!isEditing('links') && (
                    <button
                      type="button"
                      className="profile-card-edit-btn"
                      onClick={() => startEditing('links')}
                      aria-label="Edit Professional Links"
                    >
                      <span>✎ Edit</span>
                    </button>
                  )}
                </div>

                <div className="profile-card-body">
                  {isEditing('links') ? (
                    <form onSubmit={(e) => handleSave(e, 'links')}>
                      <div className="profile-form-grid">
                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-linkedin">
                            <span>LinkedIn Profile URL</span>
                          </label>
                          <input
                            id="field-linkedin"
                            className="profile-form-input"
                            type="text"
                            inputMode="url"
                            aria-invalid={Boolean(fieldErrors.linkedin)}
                            aria-describedby={fieldErrors.linkedin ? 'field-linkedin-error' : undefined}
                            value={form.linkedin}
                            onChange={(e) => updateField('linkedin', e.target.value)}
                            placeholder="https://linkedin.com/in/yourname"
                          />
                          {fieldErrors.linkedin && <span className="profile-field-error" id="field-linkedin-error">{fieldErrors.linkedin}</span>}
                        </div>

                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-github">
                            <span>GitHub Profile URL</span>
                          </label>
                          <input
                            id="field-github"
                            className="profile-form-input"
                            type="text"
                            inputMode="url"
                            aria-invalid={Boolean(fieldErrors.github)}
                            aria-describedby={fieldErrors.github ? 'field-github-error' : undefined}
                            value={form.github}
                            onChange={(e) => updateField('github', e.target.value)}
                            placeholder="https://github.com/yourusername"
                          />
                          {fieldErrors.github && <span className="profile-field-error" id="field-github-error">{fieldErrors.github}</span>}
                        </div>

                        <div className="profile-form-field span-two">
                          <label className="profile-form-label" htmlFor="field-portfolio">
                            <span>Portfolio or Personal Website URL</span>
                          </label>
                          <input
                            id="field-portfolio"
                            className="profile-form-input"
                            type="text"
                            inputMode="url"
                            aria-invalid={Boolean(fieldErrors.portfolio)}
                            aria-describedby={fieldErrors.portfolio ? 'field-portfolio-error' : undefined}
                            value={form.portfolio}
                            onChange={(e) => updateField('portfolio', e.target.value)}
                            placeholder="https://yourportfolio.com"
                          />
                          {fieldErrors.portfolio && <span className="profile-field-error" id="field-portfolio-error">{fieldErrors.portfolio}</span>}
                        </div>
                      </div>

                      <div className="profile-edit-actions-bar">
                        <button type="button" className="profile-btn-cancel" onClick={cancelEditing}>Cancel</button>
                        <button type="submit" className="profile-btn-save" disabled={saving}>
                          {saving ? 'Saving…' : 'Save Changes ↗'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="profile-links-grid">
                      {/* LinkedIn Card */}
                      <div className="profile-link-card">
                        <div className="profile-link-card-top">
                          <div className="profile-link-icon-box linkedin" aria-hidden="true">in</div>
                          <div>
                            <div className="profile-link-info-name">LinkedIn</div>
                            <div className="profile-link-info-handle">{form.linkedin ? form.linkedin.replace(/^https?:\/\/(www\.)?/, '') : 'Not connected'}</div>
                          </div>
                        </div>
                        <div className="profile-link-card-action">
                          {form.linkedin ? (
                            <a href={cleanUrl(form.linkedin)} target="_blank" rel="noopener noreferrer">
                              Visit Profile ↗
                            </a>
                          ) : (
                            <button type="button" onClick={() => startEditing('links')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--ink, #11120f)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
                              + Connect LinkedIn
                            </button>
                          )}
                        </div>
                      </div>

                      {/* GitHub Card */}
                      <div className="profile-link-card">
                        <div className="profile-link-card-top">
                          <div className="profile-link-icon-box github" aria-hidden="true">GH</div>
                          <div>
                            <div className="profile-link-info-name">GitHub</div>
                            <div className="profile-link-info-handle">{form.github ? form.github.replace(/^https?:\/\/(www\.)?/, '') : 'Not connected'}</div>
                          </div>
                        </div>
                        <div className="profile-link-card-action">
                          {form.github ? (
                            <a href={cleanUrl(form.github)} target="_blank" rel="noopener noreferrer">
                              Visit GitHub ↗
                            </a>
                          ) : (
                            <button type="button" onClick={() => startEditing('links')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--ink, #11120f)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
                              + Connect GitHub
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Portfolio Card */}
                      <div className="profile-link-card">
                        <div className="profile-link-card-top">
                          <div className="profile-link-icon-box portfolio" aria-hidden="true">🌐</div>
                          <div>
                            <div className="profile-link-info-name">Portfolio</div>
                            <div className="profile-link-info-handle">{form.portfolio ? form.portfolio.replace(/^https?:\/\/(www\.)?/, '') : 'Not connected'}</div>
                          </div>
                        </div>
                        <div className="profile-link-card-action">
                          {form.portfolio ? (
                            <a href={cleanUrl(form.portfolio)} target="_blank" rel="noopener noreferrer">
                              View Portfolio ↗
                            </a>
                          ) : (
                            <button type="button" onClick={() => startEditing('links')} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--ink, #11120f)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
                              + Add Portfolio
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* -------------------------------------------------
                  F. CAREER DOCUMENTS & SERVICE PREFERENCES
              ------------------------------------------------- */}
              <div className="profile-card" id="profile-section-preferences">
                <div className="profile-card-header">
                  <div className="profile-card-header-left">
                    <span className="profile-section-num">05</span>
                    <div className="profile-card-title-group">
                      <h2>Document & Service Preferences</h2>
                      <p>Tailor your CV styling, document language, and interview coaching focus.</p>
                    </div>
                  </div>

                  {!isEditing('preferences') && (
                    <button
                      type="button"
                      className="profile-card-edit-btn"
                      onClick={() => startEditing('preferences')}
                      aria-label="Edit Preferences"
                    >
                      <span>✎ Edit</span>
                    </button>
                  )}
                </div>

                <div className="profile-card-body">
                  {isEditing('preferences') ? (
                    <form onSubmit={(e) => handleSave(e, 'preferences')}>
                      <div className="profile-form-grid">
                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="pref-cv-style">
                            <span>Preferred CV Style</span>
                          </label>
                          <select
                            id="pref-cv-style"
                            className="profile-form-select"
                            value={form.preferences?.cv_style || 'modern_tech'}
                            onChange={(e) => updatePreference('cv_style', e.target.value)}
                          >
                            <option value="modern_tech">Modern Tech & ATS-Optimized</option>
                            <option value="executive_editorial">Executive & Editorial Minimalist</option>
                            <option value="academic_formal">Academic & Formal Comprehensive</option>
                            <option value="creative_portfolio">Creative & Product-Focused</option>
                          </select>
                        </div>

                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="pref-language">
                            <span>Document Language</span>
                          </label>
                          <select
                            id="pref-language"
                            className="profile-form-select"
                            value={form.preferences?.language || 'en_us'}
                            onChange={(e) => updatePreference('language', e.target.value)}
                          >
                            <option value="en_us">English (US Spelling)</option>
                            <option value="en_uk">English (UK / Commonwealth)</option>
                            <option value="en_intl">English (International)</option>
                            <option value="de">German (Deutsch)</option>
                            <option value="fr">French (Français)</option>
                          </select>
                        </div>

                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="pref-tone">
                            <span>Writing Tone</span>
                          </label>
                          <select
                            id="pref-tone"
                            className="profile-form-select"
                            value={form.preferences?.tone || 'authoritative'}
                            onChange={(e) => updatePreference('tone', e.target.value)}
                          >
                            <option value="authoritative">Authoritative, Concise & Impactful</option>
                            <option value="innovative">Dynamic, Modern & Innovative</option>
                            <option value="technical">Rigorous, Technical & Metric-Driven</option>
                            <option value="narrative">Narrative Storytelling & Leadership</option>
                          </select>
                        </div>

                        <div className="profile-form-field">
                          <label className="profile-form-label" htmlFor="pref-interview">
                            <span>Interview Coaching Focus</span>
                          </label>
                          <select
                            id="pref-interview"
                            className="profile-form-select"
                            value={form.preferences?.interview_focus || 'tech_system'}
                            onChange={(e) => updatePreference('interview_focus', e.target.value)}
                          >
                            <option value="tech_system">System Design & Technical Architecture</option>
                            <option value="behavioral_exec">Executive Presence & Behavioral (STAR)</option>
                            <option value="product_case">Product Sense & Strategy Case Studies</option>
                            <option value="offer_negotiation">Offer Evaluation & Compensation Strategy</option>
                          </select>
                        </div>
                      </div>

                      <div className="profile-edit-actions-bar">
                        <button type="button" className="profile-btn-cancel" onClick={cancelEditing}>Cancel</button>
                        <button type="submit" className="profile-btn-save" disabled={saving}>
                          {saving ? 'Saving…' : 'Save Changes ↗'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="profile-prefs-grid">
                      <div className="profile-pref-item">
                        <span className="profile-pref-label">Preferred CV Style</span>
                        <span className="profile-pref-value">
                          {form.preferences?.cv_style === 'executive_editorial' ? 'Executive & Editorial Minimalist' :
                           form.preferences?.cv_style === 'academic_formal' ? 'Academic & Formal Comprehensive' :
                           form.preferences?.cv_style === 'creative_portfolio' ? 'Creative & Product-Focused' :
                           'Modern Tech & ATS-Optimized'}
                        </span>
                      </div>

                      <div className="profile-pref-item">
                        <span className="profile-pref-label">Document Language</span>
                        <span className="profile-pref-value">
                          {form.preferences?.language === 'en_uk' ? 'English (UK / Commonwealth)' :
                           form.preferences?.language === 'en_intl' ? 'English (International)' :
                           form.preferences?.language === 'de' ? 'German (Deutsch)' :
                           form.preferences?.language === 'fr' ? 'French (Français)' :
                           'English (US Spelling)'}
                        </span>
                      </div>

                      <div className="profile-pref-item">
                        <span className="profile-pref-label">Writing Tone</span>
                        <span className="profile-pref-value">
                          {form.preferences?.tone === 'innovative' ? 'Dynamic, Modern & Innovative' :
                           form.preferences?.tone === 'technical' ? 'Rigorous, Technical & Metric-Driven' :
                           form.preferences?.tone === 'narrative' ? 'Narrative Storytelling & Leadership' :
                           'Authoritative, Concise & Impactful'}
                        </span>
                      </div>

                      <div className="profile-pref-item">
                        <span className="profile-pref-label">Interview Coaching Focus</span>
                        <span className="profile-pref-value">
                          {form.preferences?.interview_focus === 'behavioral_exec' ? 'Executive Presence & Behavioral (STAR)' :
                           form.preferences?.interview_focus === 'product_case' ? 'Product Sense & Strategy Case Studies' :
                           form.preferences?.interview_focus === 'offer_negotiation' ? 'Offer Evaluation & Compensation Strategy' :
                           'System Design & Technical Architecture'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* SIDEBAR COLUMN */}
            <div className="profile-side-column">

              {/* Profile Strength Panel */}
              <div className="profile-strength-panel" aria-label="Profile Strength Status">
                <div className="profile-strength-header">
                  <span className="profile-strength-kicker">PROFILE STRENGTH</span>
                  <span className="profile-strength-score">{completion}%</span>
                </div>

                <div className="profile-progress-bar-track">
                  <div
                    className="profile-progress-bar-fill"
                    style={{ width: `${completion}%` }}
                    role="progressbar"
                    aria-label="Profile strength"
                    aria-valuenow={completion}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  />
                </div>

                <p className="profile-strength-suggestion">
                  {nextSuggestion}
                </p>

                <div className="profile-strength-checklist">
                  {profileProgress.checks.map(({ key, label, done: isDone }) => {
                    return (
                      <div key={key} className={`profile-checklist-item ${isDone ? 'is-done' : ''}`}>
                        <span className="profile-check-indicator" aria-hidden="true">
                          {isDone ? '✓' : '·'}
                        </span>
                        <span>{label || FIELD_LABELS[key] || key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Service Readiness Panel */}
              <div className="profile-service-panel">
                <h3 className="profile-service-panel-title">Service-Ready Data</h3>
                <p className="profile-service-panel-desc">
                  Formant consultants use your saved profile to skip redundant intake forms.
                </p>

                <div className="profile-service-list">
                  {serviceReadiness.map((item) => (
                    <div key={item.name} className="profile-service-item">
                      <span>{item.name}</span>
                      <span className={`profile-service-status-tag ${item.ready ? 'ready' : 'partial'}`}>
                        {item.ready ? 'Ready ✓' : 'Details needed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Confidentiality & Security Panel */}
              <div className="profile-security-panel">
                <h4>
                  <span aria-hidden="true">🛡</span> Confidential & Secure
                </h4>
                <p>
                  Your profile is protected by database access controls. Authorized Formant staff roles may review client profiles to support service operations.
                </p>
              </div>

              <div className="profile-service-panel profile-pathways-panel">
                <h3 className="profile-service-panel-title">Keep your career context current</h3>
                <p className="profile-service-panel-desc">Assessment helps us understand your goals. Your profile stores the professional details used to deliver services.</p>
                <div className="profile-service-list">
                  <Link className="profile-pathway-link" to="/assessment">Review career assessment ↗</Link>
                  <Link className="profile-pathway-link" to="/service-selection">Explore service recommendations ↗</Link>
                </div>
              </div>

              <div className="profile-service-panel">
                <h3 className="profile-service-panel-title">Career assessment</h3>
                {assessmentSummary ? (
                  <div className="profile-assessment-summary">
                    <p>Assessment answers are used for service recommendations and team context.</p>
                    <span>Status: {form.lead_status || assessmentSummary.leadStatus || 'Submitted'}</span>
                    {form.lead_score != null && <span>Score: {form.lead_score}</span>}
                    {(form.lead_assessment_completed_at || assessmentSummary.completedAt) && <span>Completed: {new Date(form.lead_assessment_completed_at || assessmentSummary.completedAt).toLocaleDateString()}</span>}
                  </div>
                ) : <p className="profile-service-panel-desc">No completed assessment is recorded yet. You can add career-goal context separately from this profile.</p>}
                <Link className="profile-pathway-link" to="/assessment">Open assessment ↗</Link>
              </div>

            </div>

          </div>

        </div>
      </DashboardShell>
    );
  }



  /* =========================================================
    ORDERS
  ========================================================= */

  export function Orders() {
    const localState = load();
    const location = useLocation();
    const [orders, setOrders] = useState([]);
    const [clientTasks, setClientTasks] = useState({});
    const [clientGoals, setClientGoals] = useState({});
    const [clientNotes, setClientNotes] = useState({});
    const [clientRoadmaps, setClientRoadmaps] = useState({});
    const [clientWorkspaceError, setClientWorkspaceError] = useState('');
    const [clientWorkspaceLoading, setClientWorkspaceLoading] = useState(false);
    const [roadmapReveal, setRoadmapReveal] = useState({ orderId: null, mode: null });
    const [canHoverOrders, setCanHoverOrders] = useState(false);
    const [loading, setLoading] = useState(Boolean(supabase));
    const [error, setError] = useState('');
    const [briefOrder, setBriefOrder] = useState(null);
    const [brief, setBrief] = useState({
      target_role: '',
      experience: '',
      education: '',
      career_goal: '',
      deadline: '',
      current_cv: '',
      job_description: '',
      achievements: '',
      linkedin_url: '',
      github_url: '',
      portfolio_url: '',
      projects: '',
      preferred_style: '',
      additional_notes: ''
    });
    const [briefLoading, setBriefLoading] = useState(false);
    const [briefSaving, setBriefSaving] = useState(false);
    const [briefMessage, setBriefMessage] = useState('');
    const [briefError, setBriefError] = useState('');

    useEffect(() => {
      const requestedOrderId = new URLSearchParams(location.search).get('order');
      if (!requestedOrderId) return;
      setRoadmapReveal({ orderId: String(requestedOrderId), mode: 'tap' });
    }, [location.search]);

    useEffect(() => {
      const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
      const updateHoverCapability = () => setCanHoverOrders(hoverQuery.matches);
      updateHoverCapability();
      hoverQuery.addEventListener?.('change', updateHoverCapability);
      return () => hoverQuery.removeEventListener?.('change', updateHoverCapability);
    }, []);

    useEffect(() => {
      let mounted = true;
      async function loadOrders() {
        if (!supabase) {
          if (mounted) { setOrders(localState.orders || []); setLoading(false); }
          return;
        }
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionError || !session?.user) {
          setError('Your session could not be verified. Please sign in again.');
          setLoading(false);
          return;
        }
        const { data, error: queryError } = await supabase
          .from('orders')
          .select('id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, client_notes, created_at, updated_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        if (!mounted) return;
        if (queryError) {
          console.error('Orders load error:', queryError);
          setError('We could not load your orders right now. Please try again.');
          setOrders([]);
        } else {
          setOrders(data || []);
          setError('');
          const orderIds = (data || []).map((order) => order.id).filter(Boolean);
          if (orderIds.length) {
            setClientWorkspaceLoading(true);
            const [taskResult, goalResult, noteResult, roadmapResult] = await Promise.all([
              supabase.from('workspace_tasks').select('id, order_id, title, description, status, priority, due_at').in('order_id', orderIds).eq('client_visible', true).order('due_at', { ascending: true, nullsFirst: false }),
              supabase.from('workspace_goals').select('id, order_id, title, description, status, target_date').in('order_id', orderIds).eq('client_visible', true).order('target_date', { ascending: true, nullsFirst: false }),
              supabase.from('workspace_notes').select('id, order_id, body, created_at').in('order_id', orderIds).eq('visibility', 'shared').order('created_at', { ascending: false }).limit(100),
              supabase.rpc('get_my_order_roadmaps_v1', { p_order_ids: orderIds })
            ]);
            if (!mounted) return;
            const groupByOrder = (rows) => (rows || []).reduce((grouped, row) => {
              grouped[String(row.order_id)] ||= [];
              grouped[String(row.order_id)].push(row);
              return grouped;
            }, {});
            const failed = [taskResult, goalResult, noteResult].some((result) => result.error);
            if (failed) console.error('Client workspace context load error:', taskResult.error || goalResult.error || noteResult.error);
            setClientTasks(groupByOrder(taskResult.data));
            setClientGoals(groupByOrder(goalResult.data));
            setClientNotes(groupByOrder(noteResult.data));
            setClientRoadmaps(Object.fromEntries((roadmapResult.data || []).map((roadmap) => [String(roadmap.order_id), roadmap])));
            const roadmapFailed = Boolean(roadmapResult.error);
            if (roadmapFailed) console.error('Client roadmap load error:', roadmapResult.error);
            setClientWorkspaceError(failed || roadmapFailed ? 'Some client-visible delivery context is temporarily unavailable.' : '');
            setClientWorkspaceLoading(false);
          } else {
            setClientTasks({});
            setClientGoals({});
            setClientNotes({});
            setClientRoadmaps({});
            setClientWorkspaceError('');
          }
        }
        setLoading(false);
      }
      loadOrders();
      return () => { mounted = false; };
    }, []);

    function formatDate(value) {
      if (!value) return 'Date unavailable';
      try {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
          ? 'Date unavailable'
          : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
      } catch { return 'Date unavailable'; }
    }

    function statusClass(status) {
      return String(status || 'pending').toLowerCase().replace(/\s+/g, '-');
    }

    function briefType(order) {
      const name = `${order?.service_name || ''} ${order?.package_name || ''}`.toLowerCase();
      if (name.includes('linkedin')) return 'linkedin';
      if (name.includes('github')) return 'github';
      if (name.includes('portfolio')) return 'portfolio';
      if (name.includes('cover')) return 'cover';
      if (name.includes('interview')) return 'interview';
      return 'resume';
    }

    function briefLabel(order) {
      const type = briefType(order);
      return type === 'linkedin'
        ? 'LinkedIn brief'
        : type === 'github'
          ? 'GitHub brief'
          : type === 'portfolio'
            ? 'Portfolio brief'
            : type === 'cover'
              ? 'Cover letter brief'
              : type === 'interview'
                ? 'Interview brief'
                : 'Project brief';
    }

    function emptyBrief() {
      return {
        target_role: '',
        experience: '',
        education: '',
        career_goal: '',
        deadline: '',
        current_cv: '',
        job_description: '',
        achievements: '',
        linkedin_url: '',
        github_url: '',
        portfolio_url: '',
        projects: '',
        preferred_style: '',
        additional_notes: ''
      };
    }

    async function openBrief(order) {
      setBriefOrder(order);
      setBrief(emptyBrief());
      setBriefMessage('');
      setBriefError('');
      setBriefLoading(true);

      if (!supabase || !order?.id) {
        setBriefLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setBriefError('Your session could not be verified. Please sign in again.');
        setBriefLoading(false);
        return;
      }

      const { data, error: briefLoadError } = await supabase
        .from('project_briefs')
        .select('target_role, experience, education, career_goal, deadline, current_cv, job_description, achievements, linkedin_url, github_url, portfolio_url, projects, preferred_style, additional_notes, submitted_at')
        .eq('order_id', order.id)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (briefLoadError) {
        console.error('Project brief load error:', briefLoadError);
        if (briefLoadError.code !== '42P01') {
          setBriefError('We could not load your project brief right now.');
        }
      } else if (data) {
        setBrief(data);
        if (data.submitted_at) {
          setBriefMessage('Your brief is already submitted. You can update it anytime before work begins.');
        }
      }

      setBriefLoading(false);
    }

    function closeBrief() {
      if (briefSaving) return;
      setBriefOrder(null);
      setBriefError('');
      setBriefMessage('');
    }

    function updateBrief(key, value) {
      setBrief((current) => ({ ...current, [key]: value }));
      setBriefError('');
      setBriefMessage('');
    }

    async function saveBrief(event) {
      event.preventDefault();
      if (!briefOrder) return;

      setBriefSaving(true);
      setBriefError('');
      setBriefMessage('');

      try {
        if (!supabase) {
          throw new Error('Project brief database is not connected yet.');
        }

        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          throw new Error('Your session could not be verified. Please sign in again.');
        }

        const payload = {
          order_id: briefOrder.id,
          user_id: session.user.id,
          ...Object.fromEntries(
            Object.entries(brief).map(([key, value]) => [
              key,
              String(value || '').trim() || null
            ])
          ),
          submitted_at: new Date().toISOString()
        };

        const { error: saveError } = await supabase
          .from('project_briefs')
          .upsert(payload, { onConflict: 'order_id' });

        if (saveError) {
          if (saveError.code === '42P01') {
            throw new Error(
              'Project brief database is not connected yet. Run the Phase 1G SQL migration in Supabase, then try again.'
            );
          }
          throw new Error(
            saveError.message || 'We could not save your brief right now.'
          );
        }

        setBriefMessage(
          'Brief saved. Your Formant team now has the information needed to start your project.'
        );

        setOrders((current) =>
          current.map((order) =>
            order.id === briefOrder.id &&
            String(order.status || '').toLowerCase() === 'information required'
              ? { ...order, status: 'Pending' }
              : order
          )
        );
      } catch (err) {
        console.error('Project brief save error:', err);
        setBriefError(
          err?.message || 'We could not save your brief right now.'
        );
      } finally {
        setBriefSaving(false);
      }
    }

    const type = briefType(briefOrder);
    const showResume = type === 'resume' || type === 'cover' || type === 'interview';
    const showLinkedIn = type === 'linkedin';
    const showGitHub = type === 'github';
    const showPortfolio = type === 'portfolio';

    return (
      <DashboardShell>
        <div className="dash-head orders-page-header">
          <div className="orders-header-copy">
            <p className="eyebrow">MY ORDERS</p>
            <h1>Your projects.</h1>
            <p className="orders-page-subtitle">Track the progress of your services and see what’s happening next.</p>
          </div>
          <Link className="btn lime" to="/service-selection">New service ↗</Link>
        </div>
        <div className="panel table-panel orders-list-panel">
          {loading ? (
            <div className="empty"><h3>Loading your orders…</h3><p>We’re fetching your projects from your Formant workspace.</p></div>
          ) : error ? (
            <div className="empty"><h3>We couldn’t load your orders.</h3><p>{error}</p><button type="button" className="btn dark" onClick={() => window.location.reload()}>Try again ↗</button></div>
          ) : orders.length ? (
            orders.map((o) => {
              const currency = o.currency === 'USD' ? '$' : `${o.currency || 'USD'} `;
              const serviceName = o.service_name || 'Formant service';
              const serviceType = briefType(o);
              const showcaseTab = showcaseTabForService(o.service_name, o.package_name);
              const serviceDescription = services.find((service) => service.id === serviceType)?.desc;
              const statusLabel = String(o.status || 'Pending').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
              const needsBrief =
                ['information required', 'pending'].includes(
                  String(o.status || '').toLowerCase()
                ) &&
                String(o.payment_status || '').toLowerCase() === 'paid';
              const visibleTasks = clientTasks[String(o.id)] || [];
              const visibleGoals = clientGoals[String(o.id)] || [];
              const sharedNotes = clientNotes[String(o.id)] || [];
              const serviceRoadmap = clientRoadmaps[String(o.id)] || null;
              const roadmapStages = serviceRoadmap?.stages || [];
              const currentStageIndex = roadmapStages.findIndex((stage) => stage.stage_key === serviceRoadmap?.current_stage_key);
              const currentRoadmapStage = currentStageIndex >= 0 ? roadmapStages[currentStageIndex] : null;
              const nextRoadmapStage = currentStageIndex >= 0 ? roadmapStages[currentStageIndex + 1] : null;
              const roadmapOrderId = String(o.id);
              const hasOrderDetails = clientWorkspaceLoading || Boolean(serviceRoadmap) || Boolean(clientWorkspaceError) || visibleTasks.length > 0 || visibleGoals.length > 0 || sharedNotes.length > 0;
              const isRoadmapExpanded = roadmapReveal.orderId === roadmapOrderId;
              const revealRoadmap = (mode) => setRoadmapReveal({ orderId: roadmapOrderId, mode });
              const handleOrderFocus = (event) => {
                if (canHoverOrders && hasOrderDetails && !event.target.closest('.order-progress-toggle')) {
                  revealRoadmap('focus');
                }
              };
              const handleOrderBlur = (event) => {
                if (!canHoverOrders || !hasOrderDetails || event.currentTarget.contains(event.relatedTarget)) return;
                const remainsHovered = event.currentTarget.matches(':hover');
                setRoadmapReveal((current) => current.orderId === roadmapOrderId && current.mode === 'focus'
                  ? (remainsHovered ? { orderId: roadmapOrderId, mode: 'hover' } : { orderId: null, mode: null })
                  : current);
              };
              return (
                <div
                  key={o.id}
                  className={`client-order-card${isRoadmapExpanded ? ' is-roadmap-expanded' : ''}`}
                  onMouseEnter={() => {
                    if (canHoverOrders && hasOrderDetails) revealRoadmap('hover');
                  }}
                  onMouseLeave={() => {
                    if (canHoverOrders) {
                      setRoadmapReveal((current) => current.orderId === roadmapOrderId && current.mode === 'hover'
                        ? { orderId: null, mode: null }
                        : current);
                    }
                  }}
                  onFocusCapture={handleOrderFocus}
                  onBlurCapture={handleOrderBlur}
                >
                  <div className="order-row detailed">
                    <div className="order-card-header">
                      <div className="order-card-identity">
                        <strong className="order-number">#{o.id}</strong>
                        <span className="order-card-date">Placed {formatDate(o.created_at)}</span>
                      </div>
                      <div className={`order-service-icon order-service-icon-${serviceType}`} aria-hidden="true">
                        {serviceType === 'linkedin' ? (
                          <span className="order-service-linkedin">in</span>
                        ) : serviceType === 'github' ? (
                          <svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.25a9.75 9.75 0 0 0-3.08 19c.49.09.67-.21.67-.47v-1.82c-2.74.6-3.32-1.16-3.32-1.16-.45-1.14-1.1-1.44-1.1-1.44-.9-.61.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.08 2.91.83.09-.65.35-1.08.64-1.33-2.19-.25-4.49-1.1-4.49-4.87 0-1.08.39-1.96 1.03-2.65-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.69 1.02a9.36 9.36 0 0 1 4.9 0c1.86-1.29 2.69-1.02 2.69-1.02.54 1.37.2 2.39.1 2.64.64.69 1.03 1.57 1.03 2.65 0 3.78-2.3 4.61-4.5 4.85.36.31.68.91.68 1.84v2.72c0 .26.18.56.68.46A9.76 9.76 0 0 0 12 2.25Z" /></svg>
                        ) : serviceType === 'portfolio' ? (
                          <svg viewBox="0 0 24 24" focusable="false"><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M4 8h16M7 6.25h.01M10 6.25h.01M7 15l3-3 2.5 2 2-2 3.5 3" /></svg>
                        ) : serviceType === 'interview' ? (
                          <svg viewBox="0 0 24 24" focusable="false"><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-4.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" /><path d="M7 10h10M7 13.5h6" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" focusable="false"><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></svg>
                        )}
                      </div>
                      <div className="order-card-copy">
                        <h2>
                          {serviceName}
                          {o.package_name && <span className="order-card-package"> · {o.package_name}</span>}
                        </h2>
                        {serviceDescription && <p className="order-card-description">{serviceDescription}</p>}
                        <Link className="order-showcase-link" to={showcaseTab ? `/showcase?tab=${showcaseTab}` : '/showcase'}>
                          Explore related work <span aria-hidden="true">↗</span>
                        </Link>
                      </div>
                      <strong className="order-card-price">{currency}{Number(o.total || 0).toFixed(0)}</strong>
                      <span className={`status order-card-status ${statusClass(o.status)}`}>{statusLabel}</span>
                      <div className="order-card-actions">
                        <button
                          type="button"
                          className={`order-brief-button ${needsBrief ? 'is-required' : ''}`}
                          onClick={() => openBrief(o)}
                        >
                          {needsBrief ? 'Complete project brief ↗' : 'Open project brief ↗'}
                        </button>
                        {hasOrderDetails && <button
                          type="button"
                          className="order-progress-toggle"
                          aria-label={`${isRoadmapExpanded ? 'Hide' : 'View'} progress for order #${o.id}`}
                          aria-expanded={isRoadmapExpanded}
                          aria-controls={`order-progress-${roadmapOrderId}`}
                          onClick={() => setRoadmapReveal((current) => current.orderId === roadmapOrderId
                            ? { orderId: null, mode: null }
                            : { orderId: roadmapOrderId, mode: 'tap' })}
                        >
                          <span className="order-progress-label">{isRoadmapExpanded ? 'Hide progress' : 'View progress'}</span>
                          <span className="order-progress-icon" aria-hidden="true">{isRoadmapExpanded ? '⌃' : '⌄'}</span>
                        </button>}
                      </div>
                    </div>
                  </div>
                  {hasOrderDetails && <div
                    id={`order-progress-${roadmapOrderId}`}
                    className={`client-order-details${isRoadmapExpanded ? ' is-expanded' : ''}`}
                    aria-hidden={!isRoadmapExpanded}
                    inert={!isRoadmapExpanded ? true : undefined}
                  >
                    <div className="client-order-details-inner">
                      {clientWorkspaceLoading ? <section className="client-order-roadmap" role="status">Loading your service progress…</section>
                        : serviceRoadmap ? <section className="client-order-roadmap" aria-label={`Service progress for order ${o.id}`}>
                          <div className="client-roadmap-summary">
                            <header><div><p className="eyebrow">YOUR SERVICE PROGRESS</p><h3>{serviceRoadmap.service_name}</h3></div><strong>{serviceRoadmap.progress}%</strong></header>
                            <div className="client-roadmap-progress" role="progressbar" aria-label="Service delivery progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={serviceRoadmap.progress}><span style={{ width: `${serviceRoadmap.progress}%` }} /></div>
                            <div className="client-roadmap-current"><span className="client-roadmap-current-icon" aria-hidden="true">◎</span><div><small>{serviceRoadmap.current_status === 'WAITING_ON_CLIENT' ? 'ACTION REQUIRED' : serviceRoadmap.current_status === 'BLOCKED' ? 'IN PROGRESS' : serviceRoadmap.current_status === 'COMPLETED' ? 'COMPLETE' : 'CURRENT STAGE'}</small><strong>{serviceRoadmap.current_stage_title}</strong>{serviceRoadmap.client_update && <p>{serviceRoadmap.client_update}</p>}</div></div>
                            {(currentRoadmapStage?.description || serviceRoadmap.client_update) && <div className="client-roadmap-about"><span>ABOUT THIS STAGE</span><p>{currentRoadmapStage?.description || serviceRoadmap.client_update}</p></div>}
                            {nextRoadmapStage && serviceRoadmap.current_status !== 'COMPLETED' && <div className="client-roadmap-next"><span aria-hidden="true">›</span><div><small>NEXT STEP</small><strong>{nextRoadmapStage.title}</strong><p>{nextRoadmapStage.description}</p></div></div>}
                            {serviceRoadmap.current_status === 'WAITING_ON_CLIENT' && <div className="client-roadmap-action"><strong>{serviceRoadmap.client_action_title}</strong><p>{serviceRoadmap.client_action_description}</p></div>}
                          </div>
                          <div className="client-roadmap-stage-list">
                            <p className="eyebrow">SERVICE ROADMAP</p>
                            <ol className="client-roadmap-stages">{(serviceRoadmap.stages || []).map((stage) => <li key={stage.stage_key} className={`is-${String(stage.status).toLowerCase()}`} aria-current={stage.stage_key === serviceRoadmap.current_stage_key ? 'step' : undefined}><span aria-hidden="true">{stage.status === 'COMPLETED' ? '✓' : stage.stage_key === serviceRoadmap.current_stage_key ? (serviceRoadmap.current_status === 'WAITING_ON_CLIENT' || serviceRoadmap.current_status === 'BLOCKED' ? '!' : serviceRoadmap.current_status === 'COMPLETED' ? '✓' : '●') : '○'}</span><div><strong>{stage.title}</strong><small>{stage.description}</small></div></li>)}</ol>
                          </div>
                        </section> : clientWorkspaceError ? <section className="client-order-roadmap" role="alert">Your service progress is temporarily unavailable.</section> : null}
                      {(clientWorkspaceLoading || clientWorkspaceError || visibleTasks.length > 0 || visibleGoals.length > 0 || sharedNotes.length > 0) && (
                        <section className="client-order-action-plan" aria-label={`Action plan for order ${o.id}`}>
                          <h3>Delivery updates</h3>
                          {clientWorkspaceLoading ? <p role="status">Loading your delivery updates…</p>
                            : clientWorkspaceError ? <p role="alert">{clientWorkspaceError}</p>
                              : <>
                                {visibleTasks.length > 0 && <ul>{visibleTasks.map((task) => (
                                <li key={task.id}>
                                  <div><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}</div>
                                  <span>{String(task.status || 'todo').replace(/_/g, ' ')}</span>
                                  {task.due_at && <time dateTime={task.due_at}>Due {formatDate(task.due_at)}</time>}
                                </li>
                              ))}</ul>}
                                {visibleGoals.length > 0 && <div className="client-order-shared-items"><strong>Goals</strong><ul>{visibleGoals.map((goal) => <li key={goal.id}><div><strong>{goal.title}</strong>{goal.description && <p>{goal.description}</p>}</div><span>{String(goal.status || 'active').replace(/_/g, ' ')}</span>{goal.target_date && <time dateTime={goal.target_date}>Target {formatDate(goal.target_date)}</time>}</li>)}</ul></div>}
                                {sharedNotes.length > 0 && <div className="client-order-shared-items"><strong>Notes from your team</strong><ul>{sharedNotes.map((note) => <li key={note.id}><div><p>{note.body}</p></div><time dateTime={note.created_at}>{formatDate(note.created_at)}</time></li>)}</ul></div>}
                              </>}
                        </section>
                      )}
                    </div>
                  </div>}
                </div>
              );
            })
          ) : (
            <div className="empty"><h3>No orders yet.</h3><p>Choose a service and your project will appear here.</p><Link to="/services">Browse services →</Link></div>

          )}
        </div>

        {briefOrder && (
          <div
            className="project-brief-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-brief-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeBrief();
            }}
          >
            <div className="project-brief-modal">
              <div className="project-brief-head">
                <div>
                  <span className="eyebrow">{briefLabel(briefOrder)}</span>
                  <h2 id="project-brief-title">
                    Let’s get the<br />
                    <span>right context.</span>
                  </h2>
                  <p>
                    Give the team the information they need to make the work specific to you.
                  </p>
                </div>

                <button
                  type="button"
                  className="project-brief-close"
                  onClick={closeBrief}
                  disabled={briefSaving}
                  aria-label="Close project brief"
                >
                  ×
                </button>
              </div>

              {briefLoading ? (
                <div className="project-brief-loading">Loading your brief…</div>
              ) : (
                <form onSubmit={saveBrief} className="project-brief-form">
                  <section className="brief-section">
                    <div className="brief-section-label">
                      <span>01</span>
                      <div>
                        <strong>YOUR DIRECTION</strong>
                        <small>Start with the basics.</small>
                      </div>
                    </div>

                    <div className="brief-grid">
                      <label>
                        Target role
                        <input
                          value={brief.target_role}
                          onChange={(e) => updateBrief('target_role', e.target.value)}
                          placeholder="e.g. Frontend Developer"
                        />
                      </label>

                      <label>
                        Experience level
                        <input
                          value={brief.experience}
                          onChange={(e) => updateBrief('experience', e.target.value)}
                          placeholder="e.g. 2 years / Fresh graduate"
                        />
                      </label>

                      <label>
                        Education
                        <input
                          value={brief.education}
                          onChange={(e) => updateBrief('education', e.target.value)}
                          placeholder="Degree, institution, field"
                        />
                      </label>

                      <label>
                        Ideal deadline
                        <input
                          type="date"
                          value={brief.deadline}
                          onChange={(e) => updateBrief('deadline', e.target.value)}
                        />
                      </label>

                      <label className="brief-full">
                        Career goal
                        <textarea
                          rows="4"
                          value={brief.career_goal}
                          onChange={(e) => updateBrief('career_goal', e.target.value)}
                          placeholder="What are you trying to achieve with this project?"
                        />
                      </label>
                    </div>
                  </section>

                  {showResume && (
                    <section className="brief-section">
                      <div className="brief-section-label">
                        <span>02</span>
                        <div>
                          <strong>YOUR MATERIALS</strong>
                          <small>What should we work from?</small>
                        </div>
                      </div>

                      <div className="brief-grid">
                        <label className="brief-full">
                          Current CV / resume
                          <textarea
                            rows="5"
                            value={brief.current_cv}
                            onChange={(e) => updateBrief('current_cv', e.target.value)}
                            placeholder="Paste the text from your current CV, or tell us if you’re starting from scratch."
                          />
                        </label>

                        <label className="brief-full">
                          Target job description
                          <textarea
                            rows="5"
                            value={brief.job_description}
                            onChange={(e) => updateBrief('job_description', e.target.value)}
                            placeholder="Paste a job description you’re targeting, if you have one."
                          />
                        </label>

                        <label className="brief-full">
                          Key achievements
                          <textarea
                            rows="4"
                            value={brief.achievements}
                            onChange={(e) => updateBrief('achievements', e.target.value)}
                            placeholder="Results, projects, awards, metrics, or anything you’re proud of."
                          />
                        </label>
                      </div>
                    </section>
                  )}

                  {showLinkedIn && (
                    <section className="brief-section">
                      <div className="brief-section-label">
                        <span>02</span>
                        <div>
                          <strong>LINKEDIN CONTEXT</strong>
                          <small>Help us shape your positioning.</small>
                        </div>
                      </div>

                      <div className="brief-grid">
                        <label>
                          Current LinkedIn URL
                          <input
                            value={brief.linkedin_url}
                            onChange={(e) => updateBrief('linkedin_url', e.target.value)}
                            placeholder="https://linkedin.com/in/…"
                          />
                        </label>

                        <label className="brief-full">
                          What should your profile communicate?
                          <textarea
                            rows="5"
                            value={brief.career_goal}
                            onChange={(e) => updateBrief('career_goal', e.target.value)}
                            placeholder="Tell us about the roles, industry, or direction you want to be known for."
                          />
                        </label>

                        <label className="brief-full">
                          Key achievements
                          <textarea
                            rows="4"
                            value={brief.achievements}
                            onChange={(e) => updateBrief('achievements', e.target.value)}
                            placeholder="Results, projects, awards, metrics, or strengths we should highlight."
                          />
                        </label>
                      </div>
                    </section>
                  )}

                  {showGitHub && (
                    <section className="brief-section">
                      <div className="brief-section-label">
                        <span>02</span>
                        <div>
                          <strong>GITHUB CONTEXT</strong>
                          <small>Show us what you build.</small>
                        </div>
                      </div>

                      <div className="brief-grid">
                        <label>
                          GitHub URL
                          <input
                            value={brief.github_url}
                            onChange={(e) => updateBrief('github_url', e.target.value)}
                            placeholder="https://github.com/…"
                          />
                        </label>

                        <label>
                          Portfolio URL
                          <input
                            value={brief.portfolio_url}
                            onChange={(e) => updateBrief('portfolio_url', e.target.value)}
                            placeholder="https://…"
                          />
                        </label>

                        <label className="brief-full">
                          Main projects
                          <textarea
                            rows="5"
                            value={brief.projects}
                            onChange={(e) => updateBrief('projects', e.target.value)}
                            placeholder="Which repositories or projects should we focus on? What did you build?"
                          />
                        </label>
                      </div>
                    </section>
                  )}

                  {showPortfolio && (
                    <section className="brief-section">
                      <div className="brief-section-label">
                        <span>02</span>
                        <div>
                          <strong>PORTFOLIO DIRECTION</strong>
                          <small>Tell us what the site should say about you.</small>
                        </div>
                      </div>

                      <div className="brief-grid">
                        <label>
                          Existing portfolio
                          <input
                            value={brief.portfolio_url}
                            onChange={(e) => updateBrief('portfolio_url', e.target.value)}
                            placeholder="https://…"
                          />
                        </label>

                        <label>
                          Preferred style
                          <input
                            value={brief.preferred_style}
                            onChange={(e) => updateBrief('preferred_style', e.target.value)}
                            placeholder="e.g. Minimal, editorial, technical"
                          />
                        </label>

                        <label className="brief-full">
                          Projects to feature
                          <textarea
                            rows="5"
                            value={brief.projects}
                            onChange={(e) => updateBrief('projects', e.target.value)}
                            placeholder="List your strongest projects and what you want visitors to understand about them."
                          />
                        </label>
                      </div>
                    </section>
                  )}

                  <section className="brief-section brief-last-section">
                    <div className="brief-section-label">
                      <span>03</span>
                      <div>
                        <strong>ANYTHING ELSE?</strong>
                        <small>Optional, but useful.</small>
                      </div>
                    </div>

                    <label className="brief-full">
                      Additional notes
                      <textarea
                        rows="4"
                        value={brief.additional_notes}
                        onChange={(e) => updateBrief('additional_notes', e.target.value)}
                        placeholder="Anything else the Formant team should know?"
                      />
                    </label>
                  </section>

                  {briefError && (
                    <div className="project-brief-error" role="alert">
                      {briefError}
                    </div>
                  )}

                  {briefMessage && (
                    <div className="project-brief-success" role="status">
                      {briefMessage}
                    </div>
                  )}

                  <div className="project-brief-actions">
                    <p>Your information stays inside your Formant project.</p>
                    <button className="btn lime" type="submit" disabled={briefSaving}>
                      {briefSaving ? 'Saving…' : 'Save project brief ↗'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </DashboardShell>
    );
  }

  /*
    Formant — Messages UX replacement
    Replace only the existing Messages() function with this component.

    Expected existing imports:
      import React, { useEffect, useRef, useState } from 'react';
      import DashboardShell from '../components/DashboardShell';
      import { load, patch } from '../lib/store';
      import { supabase } from '../lib/supabase';

    This keeps the existing Formant UI classes and fixes chat behaviour:
    - Your messages -> right
    - Formant/team messages -> left
    - Enter -> send
    - Shift + Enter -> new line
    - auto-growing composer
    - auto-scroll to latest message
    - Enter disabled while sending / no order / empty message
    - realtime insert de-duplication
    - readable timestamps
    - preserves line breaks in messages
  */

  function MessageAttachmentLink({ attachment, mine = false }) {
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
      return <div className={`message-attachment ${mine ? 'is-mine' : ''}`}>Loading attachment…</div>;
    }

    if (!url) return null;

    return (
      <a
        className={`message-attachment ${mine ? 'is-mine' : ''}`}
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

  export function Messages() {
    const localState = load();
    const location = useLocation();

    const [userId, setUserId] = useState('');
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [mobileView, setMobileView] = useState('list');
    const [orderSearch, setOrderSearch] = useState('');
    const [messages, setMessages] = useState([]);
    const [messageMap, setMessageMap] = useState({});
    const [messageSummaries, setMessageSummaries] = useState({});
    const [threadError, setThreadError] = useState('');
    const [hasOlderMessages, setHasOlderMessages] = useState(false);
    const [text, setText] = useState('');
    const [drafts, setDrafts] = useState({});
    const [attachment, setAttachment] = useState(null);
    const [attachmentError, setAttachmentError] = useState('');
    const [liveAnnouncement, setLiveAnnouncement] = useState('');
    const [replyTo, setReplyTo] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState(null);
    const [activeActionMessageId, setActiveActionMessageId] = useState(null);

    const ordersRef = useRef(orders);
    const selectedOrderIdRef = useRef(selectedOrderId);
    const userIdRef = useRef(userId);
    const messageMapRef = useRef(messageMap);
    const threadRequestRef = useRef(0);
    const actionScrollProgrammaticRef = useRef(false);
    const actionScrollTimerRef = useRef(0);

    useEffect(() => { ordersRef.current = orders; }, [orders]);
    useEffect(() => { selectedOrderIdRef.current = selectedOrderId; }, [selectedOrderId]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { messageMapRef.current = messageMap; }, [messageMap]);

    const [loadingOrders, setLoadingOrders] = useState(Boolean(supabase));
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sending, setSending] = useState(false);

    const [connectionState, setConnectionState] = useState(
      supabase ? 'connecting' : 'offline'
    );
    const [error, setError] = useState('');

    const chatBodyRef = useRef(null);
    const textareaRef = useRef(null);
    const messagesRootRef = useRef(null);
    const handleMessageComposerFocus = useMessageViewport(messagesRootRef, mobileView === 'chat');

    const selectedOrder = orders.find(
      (order) => String(order.id) === String(selectedOrderId)
    ) || null;

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

    function scrollToBottom(behavior = 'smooth') {
      const node = chatBodyRef.current;
      if (!node) return;

      node.scrollTo({
        top: node.scrollHeight,
        behavior
      });
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

    function resizeComposer() {
      const node = textareaRef.current;
      if (!node) return;

      node.style.height = 'auto';

      const maxHeight = 168;
      const minHeight = 46;
      const nextHeight = Math.min(
        Math.max(node.scrollHeight, minHeight),
        maxHeight
      );

      node.style.height = `${nextHeight}px`;
      node.style.overflowY = node.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }

    function appendMessage(nextMessage) {
      if (!nextMessage?.id) return;

      setMessages((current) => {
        if (current.some((message) => String(message.id) === String(nextMessage.id))) {
          return current;
        }

        return [...current, nextMessage].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() -
            new Date(b.created_at || 0).getTime()
        );
      });
    }

    async function loadThreadPage(orderId, before = null, appendOlder = false) {
      if (!supabase || !orderId) return;
      const requestId = ++threadRequestRef.current;
      setThreadError('');
      if (!appendOlder) setLoadingMessages(true);
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
        setHasOlderMessages((data || []).length === 50);
        setMessages((current) => {
          if (!appendOlder) return page;
          const ids = new Set(current.map((message) => String(message.id)));
          return [...page.filter((message) => !ids.has(String(message.id))), ...current];
        });
        setMessageMap((current) => ({
          ...current,
          [String(orderId)]: appendOlder
            ? [...page, ...(current[String(orderId)] || [])]
                .filter((message, index, rows) => rows.findIndex((row) => String(row.id) === String(message.id)) === index)
            : page
        }));
      } catch (pageError) {
        if (requestId === threadRequestRef.current) {
          setThreadError(pageError?.message || 'We could not load this conversation.');
        }
      } finally {
        if (requestId === threadRequestRef.current) setLoadingMessages(false);
      }
    }

    function formatMessageTime(value) {
      if (!value) return '';

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return '';
      }

      const now = new Date();

      const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

      if (sameDay) {
        return new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit'
        }).format(date);
      }

      return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    }

    const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
    const ATTACHMENT_BUCKET = 'message-attachments';

    function formatFileSize(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

    function updateMessageEverywhere(updated) {
      const merge = (rows) => rows.map((row) => String(row.id) === String(updated.id) ? { ...row, ...updated } : row);
      setMessages((rows) => merge(rows));
      setMessageMap((current) => {
        const key = String(updated.order_id);
        return { ...current, [key]: merge(current[key] || []) };
      });
      if (supabase && updated.order_id) {
        void supabase.rpc('list_message_summaries_v1', { p_order_ids: [Number(updated.order_id)] }).then(({ data, error: summaryError }) => {
          if (summaryError) return;
          const summary = data?.[0];
          if (summary) setMessageSummaries((current) => ({ ...current, [String(summary.order_id)]: summary }));
        });
      }
    }

    function beginReply(message) {
      setEditingMessage(null);
      setReplyTo(message);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }

    function beginEdit(message) {
      if (message.deleted_at) return;
      const originalText = parseMessageBody(message.body).text;
      setEditingMessage({ id: message.id, orderId: String(message.order_id), originalText, draft: text, draftAttachment: attachment });
      setReplyTo(null);
      setAttachment(null);
      setText(originalText);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        resizeComposer();
      });
    }

    function cancelEdit() {
      if (!editingMessage) return;
      setText(editingMessage.draft);
      setAttachment(editingMessage.draftAttachment || null);
      setEditingMessage(null);
    }

    async function saveEditedMessage() {
      if (!editingMessage || editingMessage.orderId !== String(selectedOrderId) || !supabase) return;
      const nextBody = text.trim();
      if (!nextBody || nextBody.length > 2000 || nextBody === editingMessage.originalText) {
        if (nextBody === editingMessage.originalText) cancelEdit();
        return;
      }
      setSending(true);
      setError('');
      try {
        const { data, error: editError } = await supabase.rpc('edit_message_v1', {
          p_message_id: Number(editingMessage.id), p_body: nextBody
        });
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
      } finally {
        setSending(false);
      }
    }

    async function deleteOwnMessage(message) {
      if (!supabase || String(message.sender_id) !== String(userId) || !window.confirm('Delete this message? Its text will no longer be visible.')) return;
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
      let target = messages.find((item) => String(item.id) === String(messageId));
      if (!target && supabase) {
        const { data, error: contextError } = await supabase.rpc('get_message_reply_context_v1', { p_message_id: Number(messageId) });
        if (contextError) {
          setError(contextError.message || 'Could not load the referenced message.');
          return;
        }
        target = Array.isArray(data) ? data[0] : data;
        if (target && String(target.order_id) === String(selectedOrderId)) {
          setMessages((current) => current.some((item) => String(item.id) === String(target.id))
            ? current : [...current, target].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
          setMessageMap((current) => {
            const key = String(target.order_id);
            const rows = current[key] || [];
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

    function handleComposerChange(event) {
      setText(event.target.value);

      requestAnimationFrame(() => {
        resizeComposer();
      });
    }

    function handleComposerKeyDown(event) {
      if (event.key === 'Escape' && (editingMessage || replyTo)) {
        event.preventDefault();
        if (editingMessage) cancelEdit();
        else setReplyTo(null);
        return;
      }
      // Keep Enter available to IME/composition input methods.
      if (event.nativeEvent?.isComposing) {
        return;
      }

      // Enter = send. Shift + Enter = normal newline.
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();

        if (!sending && selectedOrderId && userId && (text.trim() || attachment)) {
          void sendMessage();
        }
      }
    }

    async function sendMessage() {
      if (editingMessage) {
        await saveEditedMessage();
        return;
      }
      const body = text.trim();

      if ((!body && !attachment) || sending || !selectedOrderId) {
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
        let currentUserId = userId;

        if (supabase) {
          const { data: authData, error: authError } = await supabase.auth.getUser();
          if (authError || !authData?.user?.id) {
            throw new Error('Your session could not be verified. Please sign in again.');
          }

          currentUserId = authData.user.id;
          setUserId(currentUserId);

          // Verify the selected order belongs to the currently authenticated client.
          const { data: ownedOrder, error: orderError } = await supabase
            .from('orders')
            .select('id, user_id')
            .eq('id', Number(selectedOrderId))
            .eq('user_id', currentUserId)
            .maybeSingle();

          if (orderError) throw orderError;
          if (!ownedOrder) {
            throw new Error('This order does not belong to your account.');
          }
        }

        if (attachment && supabase) {
          const safeName = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '-');
          const path = `${currentUserId}/${selectedOrderId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
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
              `Could not upload the attachment. Make sure the '${ATTACHMENT_BUCKET}' storage bucket is configured.`
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

        if (!supabase) {
          const fallbackMessage = {
            id: `local-${Date.now()}`,
            order_id: Number(selectedOrderId),
            sender_id: currentUserId,
            body: storedBody,
            reply_to_message_id: replyTo?.id || null,
            created_at: new Date().toISOString()
          };

          appendMessage(fallbackMessage);
          setMessageMap((current) => {
            const key = String(selectedOrderId);
            const thread = current[key] || [];
            return { ...current, [key]: [...thread, fallbackMessage] };
          });
          setText('');
          setReplyTo(null);
          setAttachment(null);
          setDrafts((current) => ({ ...current, [String(selectedOrderId)]: { text: '', attachment: null } }));
          setLiveAnnouncement('Message sent');

          requestAnimationFrame(() => {
            resizeComposer();
            scrollToBottom('smooth');
          });

          return;
        }

        const { data, error: insertError } = await supabase
          .from('messages')
          .insert({
            order_id: Number(selectedOrderId),
            sender_id: currentUserId,
            body: storedBody,
            reply_to_message_id: replyTo?.id || null
          })
          .select(
            'id, order_id, sender_id, body, created_at, read_at, reply_to_message_id, edited_at, deleted_at'
          )
          .single();

        if (insertError) {
          throw insertError;
        }

        appendMessage(data);
        setMessageMap((current) => {
          const key = String(selectedOrderId);
          const thread = current[key] || [];
          if (thread.some((m) => String(m.id) === String(data.id))) return current;
          return { ...current, [key]: [...thread, data] };
        });
        setText('');
        setReplyTo(null);
        setAttachment(null);
        setDrafts((current) => ({ ...current, [String(selectedOrderId)]: { text: '', attachment: null } }));
        setLiveAnnouncement('Message sent');

        requestAnimationFrame(() => {
          resizeComposer();
          scrollToBottom('smooth');
        });
      } catch (sendError) {
        console.error('Message send error:', sendError);
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
            : 'Your message could not be sent. Please check your network connection and try again.';
        setError(errMsg);
        if (attachment) {
          setAttachmentError(errMsg);
        }
      } finally {
        setSending(false);
      }
    }

    useEffect(() => {
      let mounted = true;
      let unsubscribeMessages = null;
      let eventCleanup = null;

      async function loadConversationList() {
        setError('');

        if (!supabase) {
          const fallbackOrders = Array.isArray(localState.orders)
            ? localState.orders
            : [];
          const fallbackMessages = Array.isArray(localState.messages)
            ? localState.messages
            : [];

          const grouped = {};
          fallbackMessages.forEach((msg) => {
            const key = String(msg.order_id);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({
              ...msg,
              sender_id: msg.sender_id || (msg.from === 'You' ? 'local-user' : 'careerlyst-team'),
              read_at: msg.read_at || null
            });
          });

          if (mounted) {
            setUserId('local-user');
            setOrders(fallbackOrders);
            setMessageMap(grouped);
            const requestedId = new URLSearchParams(location.search).get('order');
            const requestedOrder = fallbackOrders.find((order) => String(order.id) === String(requestedId));
            const activeId = requestedOrder?.id ?? fallbackOrders[0]?.id ?? null;
            selectedOrderIdRef.current = activeId;
            setSelectedOrderId(activeId);
            if (activeId) {
              setMessages(grouped[String(activeId)] || []);
            }
            setLoadingOrders(false);
            setConnectionState('offline');
          }

          return;
        }

        setLoadingOrders(true);
        setConnectionState('connecting');

        try {
          const {
            data: sessionData,
            error: sessionError
          } = await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          const currentUser = sessionData?.session?.user;

          if (!currentUser) {
            throw new Error(
              'Your session could not be verified. Please sign in again.'
            );
          }

          const {
            data,
            error: ordersError
          } = await supabase
            .from('orders')
            .select(
              'id, user_id, service_name, package_name, status, queue_position, created_at'
            )
            .eq('user_id', currentUser.id)
            .order('created_at', {
              ascending: false
            });

          if (ordersError) {
            throw ordersError;
          }

          if (!mounted) return;

          const nextOrders = data || [];
          setUserId(currentUser.id);
          setOrders(nextOrders);

          const requestedId = new URLSearchParams(location.search).get('order');
          const requestedOrder = nextOrders.find((order) => String(order.id) === String(requestedId));
          const initialOrderId = requestedOrder?.id ?? nextOrders[0]?.id ?? null;
          selectedOrderIdRef.current = initialOrderId;
          setSelectedOrderId((current) => {
            const stillExists = nextOrders.some(
              (order) => String(order.id) === String(current)
            );

            return stillExists ? current : initialOrderId;
          });

          const orderIds = nextOrders.map((o) => o.id).filter(Boolean);
          if (orderIds.length) {
            const { data: summaryData, error: summaryError } = await supabase.rpc(
              'list_message_summaries_v1',
              { p_order_ids: orderIds }
            );
            if (summaryError) throw summaryError;
            if (mounted) {
              const summaryByOrder = {};
              const previews = {};
              (summaryData || []).forEach((summary) => {
                const key = String(summary.order_id);
                summaryByOrder[key] = summary;
                previews[key] = summary.latest_message_id ? [{
                  id: summary.latest_message_id,
                  order_id: summary.order_id,
                  sender_id: summary.latest_sender_id,
                  body: summary.latest_body,
                  created_at: summary.latest_created_at,
                  read_at: null
                }] : [];
              });
              setMessageSummaries(summaryByOrder);
              setMessageMap(previews);
              const activeId = selectedOrderIdRef.current || initialOrderId;
              if (activeId) void loadThreadPage(activeId);
            }
          }

          const reconcile = async () => {
            const { data: latestSummaries, error: latestError } = await supabase.rpc(
              'list_message_summaries_v1',
              { p_order_ids: orderIds }
            );
            if (latestError) throw latestError;
            if (!mounted) return;
            const nextSummaries = {};
            const previews = {};
            (latestSummaries || []).forEach((summary) => {
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
              Object.entries(current).forEach(([key, thread]) => {
                if (key === String(selectedOrderIdRef.current) && thread?.length > 1) next[key] = thread;
              });
              return next;
            });
            if (selectedOrderIdRef.current) await loadThreadPage(selectedOrderIdRef.current);
          };

          // One scoped subscription handles all of this client's orders.
          unsubscribeMessages = subscribeToClientMessages(currentUser.id, {
            onMessage: (payload) => {
                if (!mounted || (!payload?.new && !payload?.old)) return;

                const next = payload.new || payload.old;
                const orderId = next?.order_id;
                if (!orderId) return;

                const belongs = ordersRef.current.some(
                  (o) => String(o.id) === String(orderId)
                );
                if (!belongs) return;

                const key = String(orderId);

                if (payload.eventType === 'INSERT') {
                  const inserted = payload.new;
                  setMessageSummaries((current) => ({
                    ...current,
                    [key]: {
                      ...(current[key] || {}),
                      order_id: orderId,
                      latest_message_id: inserted.id,
                      latest_sender_id: inserted.sender_id,
                      latest_body: inserted.body,
                      latest_created_at: inserted.created_at,
                      unread_count: String(inserted.sender_id) === String(userIdRef.current)
                        ? current[key]?.unread_count || 0
                        : Number(current[key]?.unread_count || 0) + 1
                    }
                  }));
                  setMessageMap((current) => {
                    const thread = current[key] ? [...current[key]] : [];
                    if (thread.some((m) => String(m.id) === String(inserted.id))) {
                      return current;
                    }
                    thread.push(inserted);
                    thread.sort(
                      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
                    );
                    return { ...current, [key]: thread };
                  });

                  if (String(orderId) === String(selectedOrderIdRef.current)) {
                    setMessages((current) => {
                      if (current.some((m) => String(m.id) === String(inserted.id))) {
                        return current;
                      }
                      return [...current, inserted].sort(
                        (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
                      );
                    });

                    if (
                      String(inserted.sender_id) !== String(userIdRef.current) &&
                      !inserted.read_at
                    ) {
                      setLiveAnnouncement('New message from Formant Team');
                      void markConversationAsRead(selectedOrderIdRef.current);
                    }

                    requestAnimationFrame(() => {
                      scrollToBottom('smooth');
                    });
                  }
                } else if (payload.eventType === 'UPDATE') {
                  const updated = payload.new;
                  void supabase.rpc('list_message_summaries_v1', { p_order_ids: [Number(orderId)] }).then(({ data, error: summaryError }) => {
                    const summary = !summaryError ? data?.[0] : null;
                    if (summary) setMessageSummaries((current) => ({ ...current, [key]: summary }));
                  });
                  setMessageMap((current) => {
                    const thread = current[key];
                    if (!thread) return current;
                    return {
                      ...current,
                      [key]: thread.map((m) =>
                        String(m.id) === String(updated.id) ? { ...m, ...updated } : m
                      )
                    };
                  });

                  if (String(orderId) === String(selectedOrderIdRef.current)) {
                    setMessages((current) =>
                      current.map((m) =>
                        String(m.id) === String(updated.id) ? { ...m, ...updated } : m
                      )
                    );
                  }
                } else if (payload.eventType === 'DELETE') {
                  const deletedId = String(payload.old.id);
                  setMessageMap((current) => {
                    const thread = current[key];
                    if (!thread) return current;
                    return {
                      ...current,
                      [key]: thread.filter((m) => String(m.id) !== deletedId)
                    };
                  });

                  if (String(orderId) === String(selectedOrderIdRef.current)) {
                    setMessages((current) =>
                      current.filter((m) => String(m.id) !== deletedId)
                    );
                  }
                }
            },
            onStatus: (status) => {
              if (!mounted) return;
              if (status === 'SUBSCRIBED') {
                setConnectionState('online');
                void reconcile().catch((reconcileError) => {
                  setThreadError(reconcileError?.message || 'Could not refresh messages after reconnect.');
                });
              } else if (
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT' ||
                status === 'CLOSED'
              ) {
                setConnectionState('offline');
              }
            }
          });
          const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
              void reconcile().catch((reconcileError) => {
                setThreadError(reconcileError?.message || 'Could not refresh messages.');
              });
            }
          };
          document.addEventListener('visibilitychange', handleVisibility);
          const handleOnline = () => void reconcile().catch(() => setConnectionState('offline'));
          const handleOffline = () => setConnectionState('offline');
          window.addEventListener('online', handleOnline);
          window.addEventListener('offline', handleOffline);
          eventCleanup = () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
          };
        } catch (loadError) {
          console.error('Messages orders load error:', loadError);

          if (mounted) {
            setOrders([]);
            setSelectedOrderId(null);
            setConnectionState('offline');
            setError(
              loadError?.message ||
              'We could not load your message threads right now.'
            );
          }
        } finally {
          if (mounted) {
            setLoadingOrders(false);
          }
        }
      }

      loadConversationList();

      return () => {
        mounted = false;
        eventCleanup?.();
        unsubscribeMessages?.();
      };
    }, [location.search]);

    async function markConversationAsRead(orderId) {
      if (!orderId || !userId) return;

      const readAt = new Date().toISOString();

      setMessageMap((current) => {
        const key = String(orderId);
        const thread = current[key];
        if (!thread || !thread.length) return current;

        let changed = false;
        const nextThread = thread.map((m) => {
          if (String(m.sender_id) !== String(userId) && !m.read_at) {
            changed = true;
            return { ...m, read: true, read_at: readAt };
          }
          return m;
        });

        if (!changed) return current;
        return { ...current, [key]: nextThread };
      });

      setMessages((current) =>
        current.map((m) =>
          String(m.order_id) === String(orderId) &&
          String(m.sender_id) !== String(userId) &&
          !m.read_at
            ? { ...m, read: true, read_at: readAt }
            : m
        )
      );

      /*
       * Local/demo mode.
       */
      if (!supabase) {
        patch((current) => ({
          ...current,
          messages: Array.isArray(current.messages)
            ? current.messages.map((message) => {
                const sameOrder =
                  String(message?.order_id) === String(orderId);

                const senderId =
                  message?.sender_id ||
                  (message?.from === 'You'
                    ? userId
                    : 'careerlyst-team');

                const incoming =
                  String(senderId) !== String(userId);

                if (sameOrder && incoming && !message.read_at) {
                  return {
                    ...message,
                    read: true,
                    read_at: readAt
                  };
                }

                return message;
              })
            : current.messages
        }));

        return;
      }

      /*
       * Supabase mode.
       *
       * This uses a SECURITY DEFINER RPC so the client only gets
       * permission to mark its own incoming messages as read.
       */
      try {
        const { error } = await supabase.rpc(
          'mark_order_messages_read_v1',
          {
            p_order_id: Number(orderId)
          }
        );

        if (error) {
          console.error(
            'Message mark-as-read failed:',
            error
          );
        } else {
          setMessageSummaries((current) => ({
            ...current,
            [String(orderId)]: { ...(current[String(orderId)] || {}), unread_count: 0 }
          }));
        }
      } catch (rpcErr) {
        console.error('Message mark-as-read RPC error:', rpcErr);
      }
    }

    useEffect(() => {
      if (!selectedOrderId) {
        setMessages([]);
        setLoadingMessages(false);
        setThreadError('');
        return;
      }
      if (!supabase) {
        const thread = messageMap[String(selectedOrderId)] || [];
        setMessages(thread);
        setLoadingMessages(false);
        return;
      }
      void loadThreadPage(selectedOrderId).then(() => {
        if (selectedOrderIdRef.current === selectedOrderId) {
          void markConversationAsRead(selectedOrderId);
        }
        requestAnimationFrame(() => scrollToBottom('auto'));
      });
    }, [selectedOrderId, userId]);

    useEffect(() => {
      requestAnimationFrame(() => {
        resizeComposer();
      });
    }, [text]);

    useEffect(() => {
      if (!loadingMessages) {
        requestAnimationFrame(() => {
          scrollToBottom('smooth');
        });
      }
    }, [messages.length, loadingMessages]);

    const filteredOrders = useMemo(() => {
      const q = orderSearch.trim().toLowerCase();
      if (!q) return orders;
      return orders.filter((o) => {
        const title = (o.service_name || '').toLowerCase();
        const pkg = (o.package_name || '').toLowerCase();
        const id = String(o.id);
        return title.includes(q) || pkg.includes(q) || id.includes(q);
      });
    }, [orders, orderSearch]);

    return (
      <DashboardShell>
        <div ref={messagesRootRef} className={`messages-unified-container ${mobileView === 'chat' ? 'mobile-chat-active' : ''}`}>
          <div className="messages-unified-head">
            <div>
              <p className="eyebrow">MESSAGES</p>
              <h1>Project conversations.</h1>
              <p>Updates, questions and revisions with the Formant team.</p>
            </div>
          </div>

          {error && !messages.length && (
            <div
              className="project-brief-error messages-error"
              role="alert"
              style={{ marginBottom: 0 }}
            >
              {error}
            </div>
          )}

          <div className={`messages-chat-shell ${mobileView === 'chat' ? 'mobile-view-chat' : 'mobile-view-list'}`}>
            <aside className="messages-inbox-sidebar">
              <div className="messages-inbox-header">
                <div className="messages-inbox-header-title">
                  <span>Your Projects</span>
                </div>
                <span className="messages-inbox-count-badge">
                  {orders.length}
                </span>
              </div>

              {orders.length > 2 && (
                <div className="messages-inbox-search-wrap">
                  <div className="messages-inbox-search">
                    <span>⌕</span>
                    <input
                      type="text"
                      placeholder="Search projects…"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      aria-label="Search projects"
                    />
                  </div>
                </div>
              )}

              <div className="messages-inbox-list">
                {loadingOrders ? (
                  <div className="messages-empty-state">
                    <p>Loading conversations…</p>
                  </div>
                ) : filteredOrders.length ? (
                  filteredOrders.map((order) => {
                    const active = String(order.id) === String(selectedOrderId);
                    const isOrderOpen =
                      active &&
                      (mobileView === 'chat' || (typeof window !== 'undefined' && window.innerWidth > 768));
                    const thread = messageMap[String(order.id)] || [];
                    const summary = messageSummaries[String(order.id)];
                    const unreadCount = isOrderOpen
                      ? 0
                      : Number(summary?.unread_count ?? thread.filter(
                          (m) => String(m.sender_id) !== String(userId) && !m.read_at
                        ).length);

                    const lastMessage = thread.length ? thread[thread.length - 1] : null;
                    const lastParsed = lastMessage ? parseMessageBody(lastMessage.body) : null;
                    const snippet = lastParsed
                      ? (lastParsed.text || (lastParsed.attachment ? `📎 ${lastParsed.attachment.name}` : ''))
                      : (order.package_name || 'No messages yet');

                    const timeDisplay = lastMessage?.created_at
                      ? formatMessageTime(lastMessage.created_at)
                      : (order.created_at
                          ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(order.created_at))
                          : '');

                    return (
                      <button
                        type="button"
                        className={`messages-thread-item ${active ? 'is-active' : ''}`}
                        key={order.id}
                        disabled={sending}
                        onClick={() => {
                          if (active) {
                            setMobileView('chat');
                            return;
                          }

                          setError('');
                          if (selectedOrderId) {
                            setDrafts((current) => ({
                              ...current,
                              [String(selectedOrderId)]: { text: editingMessage?.draft ?? text, attachment: editingMessage?.draftAttachment ?? attachment }
                            }));
                          }
                          setEditingMessage(null);
                          setReplyTo(null);
                          const nextDraft = drafts[String(order.id)] || { text: '', attachment: null };
                          setText(nextDraft.text);
                          setAttachment(nextDraft.attachment);
                          setAttachmentError('');
                          setMessages(messageMap[String(order.id)] || []);
                          setSelectedOrderId(order.id);
                          setMobileView('chat');
                          void markConversationAsRead(order.id);

                          requestAnimationFrame(() => {
                            resizeComposer();
                          });
                        }}
                        aria-current={active ? 'page' : undefined}
                      >
                        <div className="messages-thread-avatar">
                          #{order.id}
                        </div>
                        <div className="messages-thread-info">
                          <div className="messages-thread-top">
                            <span className="messages-thread-label">
                              Order #{order.id}
                            </span>
                            {timeDisplay && (
                              <span className="messages-thread-time">
                                {timeDisplay}
                              </span>
                            )}
                          </div>
                          <div className="messages-thread-title">
                            {order.service_name || 'Formant Service'}
                          </div>
                          {snippet && (
                            <div className="messages-thread-snippet">
                              {snippet}
                            </div>
                          )}
                          <div className="messages-thread-badge-row">
                            <span className="messages-thread-status">
                              {String(order.status || 'Pending').replace(/-/g, ' ')}
                            </span>
                            {unreadCount > 0 && (
                              <span
                                className="messages-thread-unread-pill"
                                aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
                              >
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="messages-empty-state">
                    <div className="messages-empty-state-icon">📋</div>
                    <h3>No active orders</h3>
                    <p>Once you place an order, its project conversation will appear here.</p>
                  </div>
                )}
              </div>
            </aside>

            <section className="messages-chat-pane">
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

                  <div className="messages-chat-avatar">
                    F
                  </div>

                  <div className="messages-chat-header-details">
                    <h2 className="messages-chat-title">
                      Formant Team
                    </h2>
                    <div className="messages-chat-subtitle">
                      {selectedOrder ? (
                        <>
                          <span>Order #{selectedOrder.id}</span>
                          <span>·</span>
                          <span>{selectedOrder.service_name || 'Project Support'}</span>
                          {selectedOrder.package_name && (
                            <span>({selectedOrder.package_name})</span>
                          )}
                          <span className={`messages-chat-status-pill ${String(selectedOrder.status || '').toLowerCase()}`}>
                            {String(selectedOrder.status || 'Active').replace(/-/g, ' ')}
                          </span>
                        </>
                      ) : (
                        <span>Project support</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="messages-chat-header-actions">
                  <div
                    className={`messages-live-indicator ${connectionState === 'online' ? 'online' : connectionState === 'connecting' ? 'connecting' : 'offline'}`}
                    aria-label={`Connection: ${connectionState}`}
                  >
                    <span className="messages-live-dot" />
                    <span>
                      {connectionState === 'online'
                        ? 'Live'
                        : connectionState === 'connecting'
                          ? 'Connecting…'
                          : 'Offline'}
                    </span>
                  </div>
                </div>
              </header>

              <div
                className="messages-chat-body"
                ref={chatBodyRef}
                role="log"
                aria-label="Conversation messages"
              >
                {!selectedOrderId ? (
                  <div className="messages-empty-state">
                    <div className="messages-empty-state-icon">💬</div>
                    <h3>Select a project</h3>
                    <p>Choose an order from the list to view updates and chat with your project team.</p>
                  </div>
                ) : loadingMessages ? (
                  <div className="messages-empty-state">
                    <p>Loading messages…</p>
                  </div>
                ) : threadError ? (
                  <div className="messages-empty-state messages-empty-state-error">
                    <div className="messages-empty-state-icon">⚠️</div>
                    <h3>Could not load conversation</h3>
                    <p>{threadError}</p>
                    <button type="button" className="btn dark" onClick={() => void loadThreadPage(selectedOrderId)}>Retry</button>
                  </div>
                ) : messages.length ? (
                  <>
                    {hasOlderMessages && (
                      <button
                        type="button"
                        className="messages-load-older"
                        disabled={loadingMessages}
                        onClick={() => void loadThreadPage(selectedOrderId, messages[0], true)}
                      >
                        {loadingMessages ? 'Loading…' : 'Load older messages'}
                      </button>
                    )}
                    <div className="messages-system-notice">
                      Project conversation started · You are speaking directly with Formant specialists.
                    </div>

                    {messages.map((message) => {
                      const mine = String(message.sender_id) === String(userId);
                      const isRead = Boolean(message.read_at);
                      const parsed = parseMessageBody(message.body);

                      return (
                        <div
                          id={`message-${message.id}`}
                          tabIndex={0}
                          role="group"
                          aria-label={`Message from ${mine ? 'you' : 'Formant Team'}. Press Enter or Space to show actions.`}
                          onClick={(event) => {
                            if (event.target.closest?.('button, a, input, textarea, .message-actions')) return;
                            selectMessageForActions(message.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                            event.preventDefault();
                            selectMessageForActions(message.id);
                          }}
                          className={`messages-row ${mine ? 'is-sent' : 'is-received'} ${String(activeActionMessageId) === String(message.id) ? 'has-context-actions' : ''} ${String(highlightedMessageId) === String(message.id) ? 'is-highlighted' : ''}`}
                          key={message.id}
                        >
                          <span className="messages-sender-tag">
                            {mine ? 'You' : 'Formant Team'}
                          </span>

                          <div className="messages-bubble">
                            {message.reply_to_message_id && (() => {
                              const original = messages.find((item) => String(item.id) === String(message.reply_to_message_id));
                              const originalText = original?.deleted_at ? 'Original message was deleted' : original ? parseMessageBody(original.body).text || 'Attachment' : 'Referenced message';
                              return <button type="button" className="messages-reply-reference" onClick={() => void scrollToReferencedMessage(message.reply_to_message_id)}><strong>You replied to {original && (String(original.sender_id) === String(userId) ? 'your message' : 'Formant Team')}</strong><span>{originalText.slice(0, 120)}</span></button>;
                            })()}
                            {message.deleted_at ? (
                              <div className="messages-deleted-copy" role="note">This message was deleted.</div>
                            ) : parsed.text && (
                              <div className="messages-bubble-text">
                                {parsed.text}
                              </div>
                            )}

                            {!message.deleted_at && parsed.attachment && (
                              <MessageAttachmentLink
                                attachment={parsed.attachment}
                                mine={mine}
                              />
                            )}

                            <div className="messages-bubble-footer">
                              <span>{formatMessageTime(message.created_at)}</span>
                              {message.edited_at && !message.deleted_at && <span className="messages-edited-label"> · Edited</span>}
                              {mine && (
                                <span className="messages-read-status" title={isRead ? 'Seen by team' : 'Sent'}>
                                  {isRead ? ' · Seen ✓' : ' · Sent'}
                                </span>
                              )}
                            </div>
                          </div>
                          <MessageActions
                            active={String(activeActionMessageId) === String(message.id)}
                            contextual
                            canReply
                            canEdit={Boolean(supabase) && mine && !message.deleted_at && !parsed.attachment}
                            canDelete={Boolean(supabase) && mine && !message.deleted_at}
                            onReply={() => { setActiveActionMessageId(null); beginReply(message); }}
                            onEdit={() => { setActiveActionMessageId(null); beginEdit(message); }}
                            onDelete={() => { setActiveActionMessageId(null); void deleteOwnMessage(message); }}
                          />
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="messages-empty-state">
                    <div className="messages-empty-state-icon">✉️</div>
                    <h3>No messages yet</h3>
                    <p>Send a message and the Formant team will reply with updates, questions, or deliverables here.</p>
                  </div>
                )}
              </div>

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
                    void sendMessage();
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
                          disabled={!selectedOrderId || sending || Boolean(editingMessage)}
                          aria-label="Attach file"
                        />
                        <span>+</span>
                      </label>

                      <textarea
                        ref={textareaRef}
                        className="messages-composer-textarea"
                        onFocus={handleMessageComposerFocus}
                        value={text}
                        onChange={handleComposerChange}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={
                          selectedOrderId
                            ? 'Write a message to your team…'
                            : 'Select a project first…'
                        }
                        rows={1}
                        maxLength={2000}
                        disabled={!selectedOrderId || sending}
                        aria-label={editingMessage ? 'Edit message text' : 'Write a message'}
                      />

                      <button
                        type="submit"
                        className="messages-send-btn"
                        disabled={
                          !selectedOrderId ||
                          (!text.trim() && !attachment) ||
                          sending
                        }
                        aria-label={editingMessage ? 'Save edited message' : replyTo ? 'Send reply' : 'Send message'}
                      >
                        {sending ? (editingMessage ? 'Saving…' : 'Sending…') : editingMessage ? 'Save edit' : 'Send ↗'}
                      </button>
                    </div>

                    <div className="messages-composer-footer">
                      <span className="messages-composer-hint">
                        Enter to send · Shift + Enter for new line · Max 10 MB file
                      </span>
                      <span
                        className="messages-composer-counter"
                        aria-label={`${text.length} of 2000 characters`}
                      >
                        {text.length}/2000
                      </span>
                    </div>
                  </div>

                  {error && messages.length > 0 && (
                    <div className="chat-inline-error" role="alert" style={{ marginTop: 8 }}>
                      {error}
                    </div>
                  )}
                </form>
              </div>
            </section>
          </div>
        </div>
      </DashboardShell>
    );
  }

  function ClientFileLink({ file }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let active = true;

      async function createUrl() {
        if (!file?.path || !supabase) {
          if (active) setLoading(false);
          return;
        }

        const { data, error } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrl(file.path, 60 * 60);

        if (active) {
          setUrl(error ? '' : data?.signedUrl || '');
          setLoading(false);
        }
      }

      void createUrl();
      return () => { active = false; };
    }, [file?.path]);

    const size = formatFileSize(file?.size);

    if (loading) {
      return <span className="file-row-link">Preparing…</span>;
    }

    if (!url) {
      return <span className="file-row-link is-unavailable">Unavailable</span>;
    }

    return (
      <a
        className="file-row-link"
        href={url}
        target="_blank"
        rel="noreferrer"
        download={file.name}
      >
        Open ↗
      </a>
    );
  }

  function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const ATTACHMENT_BUCKET = 'message-attachments';

  function parseAttachmentMessage(body) {
    const prefix = '__CAREERLYST_ATTACHMENT__:';
    if (typeof body !== 'string' || !body.startsWith(prefix)) return null;

    try {
      const payload = JSON.parse(body.slice(prefix.length));
      return payload?.attachment || null;
    } catch {
      return null;
    }
  }

  export function Files() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMoreFiles, setHasMoreFiles] = useState(false);
    const [error, setError] = useState('');
    const orderMapRef = useRef({});
    const attachmentCursorRef = useRef(null);

    async function loadMoreFiles() {
      if (!supabase || !hasMoreFiles || loadingMore || !attachmentCursorRef.current) return;
      const cursor = attachmentCursorRef.current;
      setLoadingMore(true);
      setError('');
      try {
        const { data, error: pageError } = await supabase.rpc('list_client_message_attachments_v1', {
          p_order_ids: Object.keys(orderMapRef.current).map(Number),
          p_before_created_at: cursor.createdAt,
          p_before_id: Number(cursor.messageId),
          p_limit: 100
        });
        if (pageError) throw pageError;
        if (data?.length) {
          const oldestRow = data[data.length - 1];
          attachmentCursorRef.current = { created_at: oldestRow.created_at, messageId: oldestRow.id };
        }
        const nextFiles = (data || []).map((message) => {
          const attachment = parseAttachmentMessage(message.body);
          return attachment?.path ? {
            ...attachment,
            messageId: message.id,
            orderId: message.order_id,
            senderId: message.sender_id,
            createdAt: message.created_at,
            order: orderMapRef.current[String(message.order_id)] || null
          } : null;
        }).filter(Boolean);
        setFiles((current) => [...current, ...nextFiles]);
        setHasMoreFiles((data || []).length === 100);
      } catch (pageError) {
        setError(pageError?.message || 'More files could not be loaded.');
      } finally {
        setLoadingMore(false);
      }
    }

    useEffect(() => {
      let mounted = true;

      async function loadFiles() {
        if (!supabase) {
          if (mounted) {
            setFiles([]);
            setLoading(false);
            setError('Supabase is not configured.');
          }
          return;
        }

        setLoading(true);
        setError('');

        try {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          const user = sessionData?.session?.user;
          if (!user) throw new Error('Please sign in to view your files.');

          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('id, service_name, package_name, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (orderError) throw orderError;

          const orderIds = (orderData || []).map((order) => order.id);
          orderMapRef.current = Object.fromEntries(
            (orderData || []).map((order) => [String(order.id), order])
          );
          if (!orderIds.length) {
            if (mounted) {
              setFiles([]);
              setHasMoreFiles(false);
              attachmentCursorRef.current = null;
            }
            return;
          }

          const { data: messageData, error: messageError } = await supabase.rpc(
            'list_client_message_attachments_v1',
            { p_order_ids: orderIds, p_limit: 100 }
          );

          if (messageError) throw messageError;

          const extracted = (messageData || [])
            .map((message) => {
              const attachment = parseAttachmentMessage(message.body);
              if (!attachment?.path) return null;
              return {
                ...attachment,
                messageId: message.id,
                orderId: message.order_id,
                senderId: message.sender_id,
                createdAt: message.created_at,
                order: orderMapRef.current[String(message.order_id)] || null
              };
            })
            .filter(Boolean);

          if (mounted) {
            setFiles(extracted);
            setHasMoreFiles((messageData || []).length === 100);
            const oldestRow = messageData?.[messageData.length - 1];
            attachmentCursorRef.current = oldestRow
              ? { created_at: oldestRow.created_at, messageId: oldestRow.id }
              : null;
          }
        } catch (loadError) {
          console.error('Client files load error:', loadError);
          if (mounted) setError(loadError?.message || 'Files could not be loaded.');
        } finally {
          if (mounted) setLoading(false);
        }
      }

      void loadFiles();
      return () => { mounted = false; };
    }, []);

    return (
      <DashboardShell>
        <main className="careerlyst-files-page">
          <div className="dash-head">
            <div>
              <p className="eyebrow">FILES</p>
              <h1>Your project files.</h1>
              <p>Files shared with you through your Formant conversations.</p>
            </div>
          </div>

          {error && <div className="admin-messages-error" role="alert">{error}</div>}

          <section className="panel">
            {loading ? (
              <div className="empty"><h3>Loading files…</h3></div>
            ) : !files.length ? (
              <div className="empty">
                <h3>No files yet.</h3>
                <p>Files attached to your project conversations will appear here.</p>
              </div>
            ) : (
              <div className="file-list">
                {files.map((file) => (
                  <div className="file-row" key={`${file.messageId}-${file.path}`}>
                    <span>📎</span>
                    <div className="file-row-copy">
                      <strong>{file.name}</strong>
                      <small>
                        Order #{file.orderId}
                        {file.order?.service_name ? ` · ${file.order.service_name}` : ''}
                        {file.size ? ` · ${formatFileSize(file.size)}` : ''}
                      </small>
                    </div>
                    <ClientFileLink file={file} />
                  </div>
                ))}
              </div>
            )}
            {hasMoreFiles && (
              <button type="button" className="messages-load-older" onClick={() => void loadMoreFiles()} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more files'}
              </button>
            )}
          </section>
        </main>
      </DashboardShell>
    );
  }

  /* =========================================================
    PAYMENTS
  ========================================================= */

  export function Payments() {

    return (
      <DashboardShell>

        <div className="dash-head">

          <div>

            <p className="eyebrow">
              PAYMENTS
            </p>

            <h1>
              Payment history.
            </h1>

          </div>

        </div>


        <div className="panel">

          <div className="empty">

            <h3>
              No payments yet.
            </h3>

            <p>
              Payment records will appear here
              after your first order.
            </p>

          </div>

        </div>

      </DashboardShell>
    );
  }


  /* =========================================================
    NOTIFICATIONS
  ========================================================= */

  export function Notifications() {

    const localState = load();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(Boolean(supabase));
    const [error, setError] = useState('');
    const [userId, setUserId] = useState('');

    function formatNotificationTime(value) {
      if (!value) return 'Recently';

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'Recently';

      const diff = Date.now() - date.getTime();
      const minute = 60 * 1000;
      const hour = 60 * minute;
      const day = 24 * hour;

      if (diff < minute) return 'Just now';
      if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
      if (diff < day) return `${Math.floor(diff / hour)}h ago`;
      if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;

      try {
        return new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric'
        }).format(date);
      } catch {
        return 'Recently';
      }
    }

    function notificationTypeLabel(type) {
      const labels = {
        message: 'MESSAGE',
        order: 'ORDER',
        project: 'PROJECT',
        payment: 'PAYMENT',
        file: 'FILE',
        account: 'ACCOUNT',
        security: 'SECURITY'
      };

      return labels[String(type || '').toLowerCase()] || 'UPDATE';
    }

    function notificationIcon(type) {
      const icons = {
        message: '✦',
        order: '↗',
        project: '◌',
        payment: '$',
        file: '⌁',
        account: '◎',
        security: '◈'
      };

      return icons[String(type || '').toLowerCase()] || '•';
    }

    useEffect(() => {
      let mounted = true;
      let channel = null;

      async function loadNotifications() {
        if (!supabase) {
          const fallback = Array.isArray(localState.notifications)
            ? localState.notifications
            : [];

          if (mounted) {
            setNotifications(fallback);
            setLoading(false);
          }
          return;
        }

        setLoading(true);
        setError('');

        try {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

          if (sessionError) throw sessionError;

          const user = sessionData?.session?.user;
          if (!user) throw new Error('Please sign in to view notifications.');

          if (mounted) setUserId(user.id);

          const { data, error: notificationError } = await supabase
            .from('notifications')
            .select('id, user_id, order_id, type, title, body, action_url, link, read_at, created_at, metadata')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (notificationError) throw notificationError;

          if (mounted) {
            setNotifications(data || []);
            setError('');
          }

          channel = supabase
            .channel(`client-notifications-${user.id}`)
            .on(
              'postgres_changes',
              {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
              },
              (payload) => {
                setNotifications((current) => {
                  if (current.some((item) => String(item.id) === String(payload.new.id))) {
                    return current;
                  }
                  return [payload.new, ...current];
                });
              }
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
              },
              (payload) => {
                setNotifications((current) =>
                  current.map((item) =>
                    String(item.id) === String(payload.new.id)
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
                table: 'notifications'
              },
              (payload) => {
                setNotifications((current) =>
                  current.filter((item) => String(item.id) !== String(payload.old.id))
                );
              }
            )
            .subscribe();
        } catch (loadError) {
          console.error('Notifications load error:', loadError);

          if (mounted) {
            setNotifications([]);
            setError(
              loadError?.message?.includes('notifications')
                ? 'Notifications are not configured yet. Run the notification SQL migration first.'
                : 'We could not load your notifications right now.'
            );
          }
        } finally {
          if (mounted) setLoading(false);
        }
      }

      loadNotifications();

      return () => {
        mounted = false;
        if (channel && supabase) {
          supabase.removeChannel(channel);
        }
      };
    }, []);

    async function markAsRead(notificationId) {
      if (!supabase || !notificationId) return;

      const { data, error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .is('read_at', null)
        .select('id, user_id, order_id, type, title, body, read_at, created_at, metadata')
        .maybeSingle();

      if (updateError) {
        console.error('Notification read update error:', updateError);
        return;
      }

      if (data) {
        setNotifications((current) =>
          current.map((item) =>
            String(item.id) === String(data.id) ? data : item
          )
        );
      }
    }

    async function markAllAsRead() {
      const unreadIds = notifications
        .filter((item) => !item.read_at)
        .map((item) => item.id);

      if (!unreadIds.length) return;

      if (!supabase) {
        setNotifications((current) =>
          current.map((item) => ({
            ...item,
            read_at: item.read_at || new Date().toISOString()
          }))
        );
        return;
      }

      const readAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: readAt })
        .eq('user_id', userId)
        .is('read_at', null);

      if (updateError) {
        console.error('Mark all notifications read error:', updateError);
        return;
      }

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read_at: item.read_at || readAt
        }))
      );
    }

    function notificationDestination(notification) {
      if (notification?.action_url || notification?.link) {
        return notification.action_url || notification.link;
      }

      const orderId = notification?.order_id;
      const type = String(notification?.type || '').toLowerCase();

      if (type === 'message' || type === 'file') {
        return orderId
          ? `/dashboard/messages?order=${encodeURIComponent(orderId)}`
          : '/dashboard/messages';
      }

      if (orderId) {
        return `/dashboard/orders?order=${encodeURIComponent(orderId)}`;
      }

      return null;
    }

    const unreadCount = notifications.filter((item) => !item.read_at).length;

    return (
      <DashboardShell>

        <div className="dash-head notifications-page-header">
          <div>
            <p className="eyebrow">NOTIFICATIONS</p>
            <h1>Updates from your team.</h1>
            <p className="notifications-page-subtitle">
              Messages, project updates, files, payments and order activity in one place.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              className="btn dark notifications-mark-all"
              onClick={markAllAsRead}
            >
              Mark all as read ↗
            </button>
          )}
        </div>

        <div className="panel notifications-panel">
          {loading ? (
            <div className="notifications-empty">
              <div className="notifications-empty-mark">•</div>
              <h3>Loading notifications…</h3>
              <p>Checking the latest updates from your Formant workspace.</p>
            </div>
          ) : error ? (
            <div className="notifications-empty notifications-empty-error">
              <div className="notifications-empty-mark">!</div>
              <h3>Notifications need setup.</h3>
              <p>{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-empty">
              <div className="notifications-empty-mark">✓</div>
              <h3>You're all caught up.</h3>
              <p>New messages, files and project updates will appear here.</p>
            </div>
          ) : (
            <div className="notifications-list">
              {notifications.map((notification) => {
                const destination = notificationDestination(notification);
                const unread = !notification.read_at;
                const content = (
                  <>
                    <div className="notification-item-icon" aria-hidden="true">
                      {notificationIcon(notification.type)}
                    </div>

                    <div className="notification-item-content">
                      <div className="notification-item-topline">
                        <span className="notification-item-type">
                          {notificationTypeLabel(notification.type)}
                        </span>
                        <span className="notification-item-time">
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </div>

                      <h3>{notification.title || 'Formant update'}</h3>
                      <p>{notification.body || ''}</p>

                      {notification.order_id && (
                        <span className="notification-item-order">
                          Order #{notification.order_id}
                        </span>
                      )}
                    </div>

                    <div className="notification-item-status">
                      {unread && <span className="notification-unread-dot" />}
                      {destination && <span className="notification-item-arrow">↗</span>}
                    </div>
                  </>
                );

                return destination ? (
                  <Link
                    key={notification.id}
                    to={destination}
                    className={`notification-item ${unread ? 'is-unread' : ''}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={notification.id}
                    type="button"
                    className={`notification-item notification-item-button ${unread ? 'is-unread' : ''}`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </DashboardShell>
    );
  }


  /* =========================================================
    SETTINGS
  ========================================================= */

  export function Settings() {

    const s = load();
    const [emailNotifications, setEmailNotifications] = useState(
      s.settings?.emailNotifications ?? true
    );
    const [currentUserId, setCurrentUserId] = useState('');
    const [pushSupported, setPushSupported] = useState(false);
    const [pushPermission, setPushPermission] = useState('default');
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushNotice, setPushNotice] = useState('');
    const [language, setLanguage] = useState(
      s.settings?.language || 'English'
    );
    const [theme, setTheme] = useState(() => getStoredThemePreference());
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [savingPreferences, setSavingPreferences] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
      const normalized = normalizeThemePreference(theme);

      if (normalized !== theme) {
        setTheme(normalized);
        return undefined;
      }

      applyTheme(normalized);

      return watchSystemTheme(normalized);
    }, [theme]);

    useEffect(() => {
      let mounted = true;

      async function loadSettings() {
        if (!supabase) return;

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mounted || sessionError) return;

        const user = data?.session?.user;
        if (user) {
          setCurrentUserId(user.id);
          const pushStat = await getPushStatus(user.id);
          if (mounted) {
            setPushSupported(pushStat.supported);
            setPushPermission(pushStat.permission);
            setPushSubscribed(pushStat.isSubscribed);
          }
        }

        const stored = data?.session?.user?.user_metadata?.careerlyst_settings;
        if (!stored || typeof stored !== 'object') return;

        if (typeof stored.emailNotifications === 'boolean') {
          setEmailNotifications(stored.emailNotifications);
        }
        if (stored.language) setLanguage(stored.language);

        // localStorage is the immediate startup source of truth. Only hydrate
        // from Supabase when no valid local preference exists.
        if (stored.theme && !hasStoredThemePreference()) {
          const storedTheme = normalizeThemePreference(stored.theme);
          saveThemePreference(storedTheme);
          setTheme(storedTheme);
        }
      }

      void loadSettings();

      return () => {
        mounted = false;
      };
    }, []);

    async function handleTogglePush() {
      if (!pushSupported) {
        setPushNotice('Browser push notifications are not supported by this browser.');
        return;
      }
      if (!currentUserId) {
        setPushNotice('Please sign in to configure browser push notifications.');
        return;
      }

      setPushLoading(true);
      setPushNotice('');

      try {
        if (pushSubscribed) {
          const res = await unsubscribeUserFromPush(currentUserId);
          if (res.success) {
            setPushSubscribed(false);
            setPushNotice('Browser notifications turned off for this device.');
          } else {
            setPushNotice(res.error || 'Failed to turn off notifications.');
          }
        } else {
          const res = await subscribeUserToPush(currentUserId);
          if (res.success) {
            setPushSubscribed(true);
            setPushPermission('granted');
            setPushNotice('Browser push notifications enabled on this device.');
          } else {
            setPushNotice(res.error || 'Failed to enable notifications.');
          }
        }
      } catch (err) {
        setPushNotice(err.message || 'Notification setup failed.');
      } finally {
        setPushLoading(false);
      }
    }

    async function savePreferences(e) {
      e.preventDefault();
      setMessage('');
      setError('');
      setSavingPreferences(true);

      try {
        const nextSettings = {
          ...(s.settings || {}),
          emailNotifications,
          language,
          theme
        };

        if (supabase) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.getSession();

          if (sessionError || !sessionData?.session?.user) {
            throw new Error('Your session could not be verified. Please sign in again.');
          }

          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              ...(sessionData.session.user.user_metadata || {}),
              careerlyst_settings: nextSettings
            }
          });

          if (updateError) throw updateError;
        }

        patch((current) => ({
          ...current,
          settings: nextSettings
        }));

        setMessage('Preferences saved.');
      } catch (saveError) {
        console.error('Settings save error:', saveError);
        setError(saveError?.message || 'We could not save your settings.');
      } finally {
        setSavingPreferences(false);
      }
    }

    async function changePassword(e) {
      e.preventDefault();
      setMessage('');
      setError('');

      if (!supabase) {
        setError('Password changes are currently unavailable.');
        return;
      }

      if (!currentPassword) {
        setError('Enter your current password.');
        return;
      }

      if (newPassword.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('New passwords do not match.');
        return;
      }

      setChangingPassword(true);

      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        const user = sessionData?.session?.user;

        if (sessionError || !user?.email) {
          throw new Error('Your session could not be verified. Please sign in again.');
        }

        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        });

        if (reauthError) throw new Error('Current password is incorrect.');

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) throw updateError;

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMessage('Password changed successfully.');
      } catch (passwordError) {
        console.error('Password change error:', passwordError);
        setError(passwordError?.message || 'We could not change your password.');
      } finally {
        setChangingPassword(false);
      }
    }

    return (
      <DashboardShell>
        <div className="settings-page-v2">
          <header className="settings-hero-v2">
            <div>
              <p className="eyebrow">ACCOUNT / SETTINGS</p>
              <h1>Everything in<br /><span>one place.</span></h1>
            </div>
            <p className="settings-hero-copy">
              Manage your Formant preferences, security and account without leaving your workspace.
            </p>
          </header>

          {(message || error) && (
            <div
              className={`settings-feedback-v2 ${error ? 'is-error' : 'is-success'}`}
              role={error ? 'alert' : 'status'}
            >
              <span>{error ? '!' : '✓'}</span>
              <strong>{error || message}</strong>
            </div>
          )}

          <div className="settings-v2-grid">
            <aside className="settings-index-v2">
              <span className="settings-index-label">SETTINGS</span>
              <a href="#preferences">01&nbsp;&nbsp; Preferences</a>
              <a href="#security">02&nbsp;&nbsp; Security</a>
              <a href="#account">03&nbsp;&nbsp; Account</a>
            </aside>

            <div className="settings-content-v2">
              <form id="preferences" className="settings-section-v2" onSubmit={savePreferences}>
                <div className="settings-section-number">01</div>
                <div className="settings-section-body">
                  <div className="settings-section-title">
                    <div>
                      <p className="settings-kicker">PREFERENCES</p>
                      <h2>Your experience.</h2>
                    </div>
                    <span className="settings-section-icon">✦</span>
                  </div>

                  <div className="settings-options-v2">
                    <label className="settings-toggle-v2">
                      <span className="settings-option-icon">@</span>
                      <span className="settings-option-copy">
                        <strong>Email notifications</strong>
                        <small>Important project, order and account updates.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                      />
                      <span className="settings-switch-v2" aria-hidden="true"><i /></span>
                    </label>

                    <label className="settings-toggle-v2">
                      <span className="settings-option-icon">🔔</span>
                      <span className="settings-option-copy">
                        <strong>Browser push notifications</strong>
                        <small>
                          {!pushSupported
                            ? 'Not supported by this browser.'
                            : pushPermission === 'denied'
                            ? 'Notifications are blocked in your browser settings.'
                            : pushSubscribed
                            ? 'Active — instant project alerts and updates on this device.'
                            : 'Receive instant desktop and mobile updates from Formant.'}
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={pushSubscribed}
                        onChange={handleTogglePush}
                        disabled={pushLoading || !pushSupported}
                      />
                      <span className="settings-switch-v2" aria-hidden="true"><i /></span>
                    </label>
                    {pushNotice && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--muted, #666)',
                          padding: '6px 10px',
                          margin: '6px 0 12px',
                          background: 'var(--soft, #f7f7f5)',
                          borderRadius: '8px'
                        }}
                      >
                        {pushNotice}
                      </div>
                    )}

                    <label className="settings-select-v2">
                      <span className="settings-option-icon">文</span>
                      <span className="settings-option-copy">
                        <strong>Language</strong>
                        <small>Choose the language used across your account.</small>
                      </span>
                      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option>English</option>
                      </select>
                    </label>

                    <label className="settings-select-v2">
                      <span className="settings-option-icon">◐</span>
                      <span className="settings-option-copy">
                        <strong>Appearance</strong>
                        <small>Use your device preference or choose a fixed theme.</small>
                      </span>
                      <select
                        value={theme}
                        onChange={(e) => {
                          const nextTheme = normalizeThemePreference(e.target.value);
                          saveThemePreference(nextTheme);
                          setTheme(nextTheme);
                        }}
                      >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </label>
                  </div>

                  <div className="settings-section-footer-v2">
                    <span>Changes are saved to your Formant account.</span>
                    <button className="btn dark" type="submit" disabled={savingPreferences}>
                      {savingPreferences ? 'Saving…' : 'Save changes ↗'}
                    </button>
                  </div>
                </div>
              </form>

              <form id="security" className="settings-section-v2" onSubmit={changePassword}>
                <div className="settings-section-number">02</div>
                <div className="settings-section-body">
                  <div className="settings-section-title">
                    <div>
                      <p className="settings-kicker">SECURITY</p>
                      <h2>Keep it protected.</h2>
                    </div>
                    <span className="settings-section-icon">⌁</span>
                  </div>

                  <div className="settings-security-grid-v2">
                    {[
                      ['Current password', currentPassword, setCurrentPassword, showCurrent, setShowCurrent, 'current-password', 'Enter current password'],
                      ['New password', newPassword, setNewPassword, showNew, setShowNew, 'new-password', 'At least 6 characters'],
                      ['Confirm new password', confirmPassword, setConfirmPassword, showConfirm, setShowConfirm, 'new-password', 'Repeat new password']
                    ].map(([label, value, setter, visible, setVisible, autoComplete, placeholder]) => (
                      <label className="settings-password-v2" key={label}>
                        <span>{label}</span>
                        <div>
                          <input
                            type={visible ? 'text' : 'password'}
                            value={value}
                            onChange={(e) => setter(e.target.value)}
                            autoComplete={autoComplete}
                            minLength={6}
                            placeholder={placeholder}
                            required
                          />
                          <button type="button" onClick={() => setVisible((v) => !v)}>
                            {visible ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="settings-security-foot-v2">
                    <div>
                      <strong>Authentication handled by Supabase.</strong>
                      <span>Your password is never stored in Formant profile data.</span>
                    </div>
                    <button className="btn dark" type="submit" disabled={changingPassword}>
                      {changingPassword ? 'Updating…' : 'Update password ↗'}
                    </button>
                  </div>
                </div>
              </form>

              <section id="account" className="settings-section-v2 account-section-v2">
                <div className="settings-section-number">03</div>
                <div className="settings-section-body">
                  <div className="settings-section-title">
                    <div>
                      <p className="settings-kicker">ACCOUNT</p>
                      <h2>Your account.</h2>
                    </div>
                    <span className="settings-section-icon">↗</span>
                  </div>

                  <div className="settings-account-list-v2">
                    <Link to="/dashboard/profile" className="settings-account-row-v2">
                      <span className="settings-account-icon">◎</span>
                      <span>
                        <strong>Edit profile</strong>
                        <small>Update your professional information.</small>
                      </span>
                      <b>↗</b>
                    </Link>

                    <button
                      type="button"
                      className="settings-account-row-v2"
                      onClick={async () => {
                        if (supabase) await supabase.auth.signOut();
                        window.location.href = '/login';
                      }}
                    >
                      <span className="settings-account-icon">→</span>
                      <span>
                        <strong>Sign out</strong>
                        <small>End your current Formant session.</small>
                      </span>
                      <b>↗</b>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

export default Dashboard;
