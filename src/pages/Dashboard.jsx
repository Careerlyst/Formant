import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardShell from '../components/DashboardShell';
import { load, patch } from '../lib/store';
import { supabase } from '../lib/supabase';

/* =========================================================
   SHARED
========================================================= */

const TARGET_ROLE_GROUPS = [
  {
    title: 'DEVELOPMENT',
    roles: [
      'Frontend Developer',
      'Backend Developer',
      'Full-Stack Developer',
      'Software Engineer',
      'Mobile App Developer'
    ]
  },
  {
    title: 'DATA & AI',
    roles: [
      'Data Analyst',
      'Data Scientist',
      'Machine Learning Engineer',
      'AI Engineer'
    ]
  },
  {
    title: 'DESIGN',
    roles: [
      'UI/UX Designer',
      'Product Designer'
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
  const serviceName = order.service_name || 'Careerlyst service';
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
              : 'Your project is currently being handled by the Careerlyst team.'}
        </p>

      </div>
    </div>
  );
}

export function Dashboard() {

  const s = load();

  const firstName =
    s.user?.name?.split(' ')[0] ||
    s.profile?.name?.split(' ')[0] ||
    'there';

  const [orders, setOrders] = useState(s.orders || []);
  const [ordersLoading, setOrdersLoading] = useState(Boolean(supabase));

  useEffect(() => {
    let mounted = true;

    async function loadOverviewOrders() {
      if (!supabase) {
        if (mounted) setOrdersLoading(false);
        return;
      }

      setOrdersLoading(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session?.user) {
        if (mounted) setOrdersLoading(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('orders')
        .select(
          'id, user_id, service_name, package_name, total, currency, status, queue_position, payment_status, created_at, updated_at'
        )
        .eq('user_id', sessionData.session.user.id)
        .order('created_at', { ascending: false });

      if (mounted) {
        if (!queryError) {
          setOrders(data || []);
        }
        setOrdersLoading(false);
      }
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

  const unreadMessages =
    s.messages?.filter(
      (message) => !message.read
    ).length || 0;

  const totalFiles = s.files?.length || 0;

  const profileKeys = [
    'name',
    'phone',
    'target_role',
    'experience',
    'education',
    'linkedin',
    'github',
    'portfolio',
    'bio'
  ];

  const profileProgress = Math.round(
    (
      profileKeys.filter(
        (key) => String(s.profile?.[key] || '').trim()
      ).length /
      profileKeys.length
    ) * 100
  );

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
              Here's where your Careerlyst work stands.
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

              <ProgressItem done>
                Profile information completed
              </ProgressItem>

              <ProgressItem done>
                Resume submitted
              </ProgressItem>

              <ProgressItem done>
                LinkedIn reviewed
              </ProgressItem>

              <ProgressItem>
                Interview preparation
              </ProgressItem>

              <ProgressItem>
                Portfolio
              </ProgressItem>

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
                    Careerlyst Team
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
  const rolePickerRef = useRef(null);

  const [form, setForm] = useState({
    name: initial.name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    target_role: initial.target_role || '',
    experience: initial.experience || '',
    education: initial.education || '',
    linkedin: initial.linkedin || '',
    github: initial.github || '',
    portfolio: initial.portfolio || '',
    bio: initial.bio || ''
  });

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');

  const completionFields = [
    'name',
    'phone',
    'target_role',
    'experience',
    'education',
    'linkedin',
    'github',
    'portfolio',
    'bio'
  ];

  const completion = Math.round(
    (
      completionFields.filter(
        (key) => String(form[key] || '').trim()
      ).length /
      completionFields.length
    ) * 100
  );

  useEffect(() => {
    let mounted = true;

    async function getProfile() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionError || !session?.user) {
        setError(
          'Your session could not be verified. Please sign in again.'
        );
        setLoading(false);
        return;
      }

      const user = session.user;
      setUserId(user.id);

      const authName =
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        '';

      const {
        data,
        error: profileError
      } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          phone,
          target_role,
          experience,
          education,
          linkedin,
          github,
          portfolio,
          bio
        `)
        .eq('id', user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError) {
        console.error('Profile load error:', profileError);
        setError(
          'We could not load your profile. Please try again.'
        );
        setLoading(false);
        return;
      }

      const next = {
        name: data?.name || authName,
        email: user.email || '',
        phone: data?.phone || '',
        target_role: data?.target_role || '',
        experience: data?.experience || '',
        education: data?.education || '',
        linkedin: data?.linkedin || '',
        github: data?.github || '',
        portfolio: data?.portfolio || '',
        bio: data?.bio || ''
      };

      setForm(next);

      patch((current) => ({
        ...current,
        user: {
          ...(current.user || {}),
          name: next.name,
          email: next.email
        },
        profile: {
          ...(current.profile || {}),
          ...next
        }
      }));

      setLoading(false);
    }

    getProfile();

    return () => {
      mounted = false;
    };
  }, []);

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

  const filteredRoleGroups = TARGET_ROLE_GROUPS
    .map((group) => ({
      ...group,
      roles: group.roles.filter((role) =>
        role.toLowerCase().includes(roleSearch.trim().toLowerCase())
      )
    }))
    .filter((group) => group.roles.length);

  const customRoleSearch = roleSearch.trim();
  const canUseCustomRole = customRoleSearch &&
    !ALL_TARGET_ROLES.some((role) => role.toLowerCase() === customRoleSearch.toLowerCase());

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
    setMessage('');
    setError('');
  }

  async function saveProfile(e) {
    e.preventDefault();

    setSaving(true);
    setMessage('');
    setError('');

    const clean = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      target_role: form.target_role.trim(),
      experience: form.experience.trim(),
      education: form.education.trim(),
      linkedin: form.linkedin.trim(),
      github: form.github.trim(),
      portfolio: form.portfolio.trim(),
      bio: form.bio.trim()
    };

    try {
      if (supabase) {
        if (!userId) {
          setError(
            'Your session could not be verified. Please sign in again.'
          );
          return;
        }

        const {
          data,
          error: saveError
        } = await supabase
          .from('profiles')
          .upsert(
            {
              id: userId,
              ...clean
            },
            {
              onConflict: 'id'
            }
          )
          .select(`
            id,
            name,
            phone,
            target_role,
            experience,
            education,
            linkedin,
            github,
            portfolio,
            bio
          `)
          .single();

        if (saveError) {
          console.error('Profile save error:', saveError);
          setError(
            saveError.message ||
            'We could not save your profile. Please try again.'
          );
          return;
        }

        const next = {
          ...clean,
          email: form.email
        };

        if (data) {
          Object.assign(next, data, {
            email: form.email
          });
        }

        setForm(next);

        patch((current) => ({
          ...current,
          user: {
            ...(current.user || {}),
            name: next.name,
            email: next.email
          },
          profile: {
            ...(current.profile || {}),
            ...next
          }
        }));

        setMessage('Profile saved successfully.');
        return;
      }

      // Demo/local mode fallback.
      const next = {
        ...form,
        ...clean
      };

      patch((current) => ({
        ...current,
        user: {
          ...(current.user || {}),
          name: next.name,
          email: next.email
        },
        profile: {
          ...(current.profile || {}),
          ...next
        }
      }));

      setForm(next);
      setMessage('Profile saved successfully.');

    } catch (saveException) {
      console.error('Unexpected profile save error:', saveException);
      setError(
        'Something went wrong while saving your profile. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="profile-loading">
          Loading your profile…
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>

      <div className="dash-head profile-head">
        <div>
          <p className="eyebrow">
            MY PROFILE
          </p>

          <h1>
            Your professional profile.
          </h1>

          <p>
            Keep these details up to date. We use them
            to understand your goals and prepare your
            Careerlyst work.
          </p>
        </div>
      </div>

      <div className="profile-layout">

        <form
          className="panel form-panel profile-form"
          onSubmit={saveProfile}
        >

          <div className="profile-section-intro">
            <span>01</span>

            <div>
              <h2>About you</h2>

              <p>
                Basic information that helps us understand
                who you are and where you're heading.
              </p>
            </div>
          </div>

          <div className="profile-fields profile-fields-two">

            <label>
              Full name

              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  updateField('name', e.target.value)
                }
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </label>

            <label>
              Email address

              <input
                type="email"
                value={form.email}
                disabled
              />

              <small>
                Managed through your Careerlyst account.
              </small>
            </label>

            <label>
              Phone number

              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  updateField('phone', e.target.value)
                }
                placeholder="+880 1XXXXXXXXX"
                autoComplete="tel"
              />
            </label>

            <div className="target-role-field" ref={rolePickerRef}>
              <label htmlFor="target-role-input">Target role</label>

              <div className={`target-role-control ${rolePickerOpen ? 'is-open' : ''}`}>
                <input
                  id="target-role-input"
                  type="text"
                  value={form.target_role}
                  onFocus={() => setRolePickerOpen(true)}
                  onClick={() => setRolePickerOpen(true)}
                  onChange={(e) => {
                    updateField('target_role', e.target.value);
                    setRoleSearch(e.target.value);
                    setRolePickerOpen(true);
                  }}
                  placeholder="e.g. Frontend Developer"
                  autoComplete="off"
                />

                <button
                  type="button"
                  className="target-role-toggle"
                  aria-label="Choose target role"
                  aria-expanded={rolePickerOpen}
                  onClick={() => setRolePickerOpen((open) => !open)}
                >
                  <span>⌄</span>
                </button>
              </div>

              {rolePickerOpen && (
                <div className="target-role-picker">
                  <div className="target-role-picker-head">
                    <div>
                      <span className="target-role-picker-kicker">TARGET ROLE</span>
                      <h3>Choose your target role</h3>
                    </div>
                    <button
                      type="button"
                      className="target-role-close"
                      onClick={() => setRolePickerOpen(false)}
                      aria-label="Close target role picker"
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
                      placeholder="Search roles..."
                      autoFocus
                    />
                  </div>

                  <div className="target-role-options">
                    {filteredRoleGroups.map((group) => (
                      <div className="target-role-group" key={group.title}>
                        <span className="target-role-group-title">{group.title}</span>

                        <div className="target-role-group-list">
                          {group.roles.map((role) => (
                            <button
                              type="button"
                              className={`target-role-option ${form.target_role === role ? 'is-selected' : ''}`}
                              key={role}
                              onClick={() => {
                                updateField('target_role', role);
                                setRoleSearch('');
                                setRolePickerOpen(false);
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
                        onClick={() => {
                          updateField('target_role', customRoleSearch);
                          setRoleSearch('');
                          setRolePickerOpen(false);
                        }}
                      >
                        <span>+ Use “{customRoleSearch}” as a custom role</span>
                        <span>↗</span>
                      </button>
                    )}

                    {!filteredRoleGroups.length && !canUseCustomRole && (
                      <div className="target-role-no-results">No matching roles found.</div>
                    )}
                  </div>

                  <div className="target-role-picker-footer">
                    <span>Pick a template or enter your own role.</span>
                  </div>
                </div>
              )}
            </div>

            <label>
              Experience

              <input
                type="text"
                value={form.experience}
                onChange={(e) =>
                  updateField('experience', e.target.value)
                }
                placeholder="e.g. 2 years in web development"
              />
            </label>

            <label>
              Education

              <input
                type="text"
                value={form.education}
                onChange={(e) =>
                  updateField('education', e.target.value)
                }
                placeholder="e.g. BSc in Computer Science"
              />
            </label>

          </div>

          <div className="profile-section-intro profile-section-spaced">
            <span>02</span>

            <div>
              <h2>Professional links</h2>

              <p>
                Add the profiles you want our team to
                review or use as project inputs.
              </p>
            </div>
          </div>

          <div className="profile-fields profile-fields-two">

            <label>
              LinkedIn URL

              <input
                type="url"
                value={form.linkedin}
                onChange={(e) =>
                  updateField('linkedin', e.target.value)
                }
                placeholder="https://linkedin.com/in/your-name"
                autoComplete="url"
              />
            </label>

            <label>
              GitHub URL

              <input
                type="url"
                value={form.github}
                onChange={(e) =>
                  updateField('github', e.target.value)
                }
                placeholder="https://github.com/your-username"
                autoComplete="url"
              />
            </label>

            <label>
              Portfolio URL

              <input
                type="url"
                value={form.portfolio}
                onChange={(e) =>
                  updateField('portfolio', e.target.value)
                }
                placeholder="https://yourportfolio.com"
                autoComplete="url"
              />
            </label>

          </div>

          <div className="profile-section-intro profile-section-spaced">
            <span>03</span>

            <div>
              <h2>Your story</h2>

              <p>
                A little context helps us make your profile
                feel specific rather than generic.
              </p>
            </div>
          </div>

          <label className="profile-bio-field">
            Professional summary

            <textarea
              rows="7"
              value={form.bio}
              onChange={(e) =>
                updateField('bio', e.target.value)
              }
              placeholder="Tell us about your background, strengths, goals, or the kind of roles you're targeting."
            />
          </label>

          <div className="profile-save-row">

            <div>
              {error && (
                <p className="profile-form-error">
                  {error}
                </p>
              )}

              {message && (
                <p className="profile-form-success">
                  {message}
                </p>
              )}
            </div>

            <button
              className="btn lime"
              type="submit"
              disabled={saving}
            >
              {saving
                ? 'Saving…'
                : 'Save profile ↗'}
            </button>

          </div>

        </form>

        <aside className="profile-side">

          <div className="panel profile-progress-card">

            <div className="panel-head">
              <h2>Profile strength</h2>

              <strong>
                {completion}%
              </strong>
            </div>

            <div className="progress">
              <i
                style={{
                  width: `${completion}%`
                }}
              />
            </div>

            <p>
              {completion === 100
                ? 'Your core profile is complete.'
                : completion >= 70
                  ? 'Good foundation. Add the remaining details to give your team more context.'
                  : 'Complete more of your profile so we can work with better context.'}
            </p>

          </div>

          

        </aside>

      </div>

    </DashboardShell>
  );
}



/* =========================================================
   ORDERS
========================================================= */

export function Orders() {
  const localState = load();
  const [orders, setOrders] = useState([]);
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
      }
      setLoading(false);
    }
    loadOrders();
    return () => { mounted = false; };
  }, []);

  function formatDate(value) {
    if (!value) return 'Recently';
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
    } catch { return 'Recently'; }
  }

  function statusClass(status) {
    return String(status || 'pending').toLowerCase().replace(/\s+/g, '-');
  }

  function timelineState(status, paymentStatus) {
    const normalized = String(status || 'pending').toLowerCase();
    const paymentDone = String(paymentStatus || '').toLowerCase() === 'paid';
    if (normalized === 'cancelled') return { payment: paymentDone ? 'done' : '', information: '', progress: '', review: '', completed: '' };
    const informationDone = ['queued', 'in progress', 'internal review', 'client review', 'revision', 'completed'].includes(normalized);
    const progressDone = ['internal review', 'client review', 'revision', 'completed'].includes(normalized);
    const reviewDone = normalized === 'completed';
    const current = normalized === 'pending' ? 'payment' : normalized === 'information required' ? 'information' : ['queued', 'in progress'].includes(normalized) ? 'progress' : ['internal review', 'client review', 'revision'].includes(normalized) ? 'review' : 'completed';
    return {
      payment: paymentDone || current !== 'payment' ? 'done' : '',
      information: informationDone ? 'done' : current === 'information' ? 'current' : '',
      progress: progressDone ? 'done' : current === 'progress' ? 'current' : '',
      review: reviewDone ? 'done' : current === 'review' ? 'current' : '',
      completed: normalized === 'completed' ? 'done current' : ''
    };
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
        'Brief saved. Your Careerlyst team now has the information needed to start your project.'
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
      <div className="dash-head">
        <div><p className="eyebrow">MY ORDERS</p><h1>Your projects.</h1></div>
        <Link className="btn lime" to="/services">New service ↗</Link>
      </div>
      <div className="panel table-panel">
        {loading ? (
          <div className="empty"><h3>Loading your orders…</h3><p>We’re fetching your projects from your Careerlyst workspace.</p></div>
        ) : error ? (
          <div className="empty"><h3>We couldn’t load your orders.</h3><p>{error}</p><button type="button" className="btn dark" onClick={() => window.location.reload()}>Try again ↗</button></div>
        ) : orders.length ? (
          orders.map((o) => {
            const timeline = timelineState(o.status, o.payment_status);
            const currency = o.currency === 'USD' ? '$' : `${o.currency || 'USD'} `;
            const needsBrief =
              ['information required', 'pending'].includes(
                String(o.status || '').toLowerCase()
              ) &&
              String(o.payment_status || '').toLowerCase() === 'paid';
            return (
              <div className="order-row detailed" key={o.id}>
                <div>
                  <b>#{o.id}</b>
                  <p>{o.service_name || 'Careerlyst service'}{o.package_name ? ` · ${o.package_name}` : ''}</p>
                  <small>Placed {formatDate(o.created_at)}</small>
                </div>
                <div className="order-timeline">
                  <span className={timeline.payment}>Payment</span>
                  <span className={timeline.information}>Information</span>
                  <span className={timeline.progress}>In progress</span>
                  <span className={timeline.review}>Review</span>
                  <span className={timeline.completed}>Completed</span>
                </div>
                <div className="order-row-meta">
                  <strong>{currency}{Number(o.total || 0).toFixed(0)}</strong>
                  <span className={`status ${statusClass(o.status)}`}>{o.status || 'Pending'}</span>
                  {String(o.status || '').toLowerCase() === 'queued' && o.queue_position != null && <small>Queue #{o.queue_position}</small>}
                  <small>Payment: {o.payment_status || 'Pending'}</small>
                  <button
                    type="button"
                    className={`order-brief-button ${needsBrief ? 'is-required' : ''}`}
                    onClick={() => openBrief(o)}
                  >
                    {needsBrief ? 'Complete project brief ↗' : 'Open project brief ↗'}
                  </button>
                </div>
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
                      placeholder="Anything else the Careerlyst team should know?"
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
                  <p>Your information stays inside your Careerlyst project.</p>
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
  Careerlyst — Messages UX replacement
  Replace only the existing Messages() function with this component.

  Expected existing imports:
    import React, { useEffect, useRef, useState } from 'react';
    import DashboardShell from '../components/DashboardShell';
    import { load } from '../lib/store';
    import { supabase } from '../lib/supabase';

  This keeps the existing Careerlyst UI classes and fixes chat behaviour:
  - Your messages -> right
  - Careerlyst/team messages -> left
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

  const [userId, setUserId] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');

  const [loadingOrders, setLoadingOrders] = useState(Boolean(supabase));
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [connectionState, setConnectionState] = useState(
    supabase ? 'connecting' : 'offline'
  );
  const [error, setError] = useState('');

  const chatBodyRef = useRef(null);
  const textareaRef = useRef(null);

  const selectedOrder = orders.find(
    (order) => String(order.id) === String(selectedOrderId)
  ) || null;

  function scrollToBottom(behavior = 'smooth') {
    const node = chatBodyRef.current;
    if (!node) return;

    node.scrollTo({
      top: node.scrollHeight,
      behavior
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
    const body = text.trim();

    if ((!body && !attachment) || sending || !selectedOrderId) {
      return;
    }

    setSending(true);
    setError('');
    setAttachmentError('');

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
          created_at: new Date().toISOString()
        };

        appendMessage(fallbackMessage);
        setText('');
        setAttachment(null);

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
          body: storedBody
        })
        .select(
          'id, order_id, sender_id, body, created_at, read_at'
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      appendMessage(data);
      setText('');
      setAttachment(null);

      requestAnimationFrame(() => {
        resizeComposer();
        scrollToBottom('smooth');
      });
    } catch (sendError) {
      console.error('Message send error:', sendError);
      setError(
        sendError?.message ||
        'Your message could not be sent. Please try again.'
      );
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadConversationList() {
      setError('');

      if (!supabase) {
        const fallbackOrders = Array.isArray(localState.orders)
          ? localState.orders
          : [];

        if (mounted) {
          setUserId('local-user');
          setOrders(fallbackOrders);
          setSelectedOrderId(fallbackOrders[0]?.id ?? null);
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

        setSelectedOrderId((current) => {
          const stillExists = nextOrders.some(
            (order) => String(order.id) === String(current)
          );

          return stillExists
            ? current
            : nextOrders[0]?.id ?? null;
        });
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
    };
  }, []);

  useEffect(() => {
    if (!selectedOrderId || !userId) {
      setMessages([]);
      setLoadingMessages(false);
      return undefined;
    }

    if (!supabase) {
      const fallback = Array.isArray(localState.messages)
        ? localState.messages
        : [];

      setMessages(
        fallback
          .filter((message) => {
            if (!message?.order_id) return true;

            return String(message.order_id) === String(selectedOrderId);
          })
          .map((message, index) => ({
            id: message.id || `local-${selectedOrderId}-${index}`,
            order_id: Number(selectedOrderId),
            sender_id:
              message.sender_id ||
              (message.from === 'You'
                ? userId
                : 'careerlyst-team'),
            body: message.body || message.text || '',
            created_at:
              message.created_at ||
              new Date().toISOString()
          }))
      );

      setConnectionState('offline');

      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });

      return undefined;
    }

    let active = true;

    const channel = supabase
      .channel(`client-messages-${userId}-${selectedOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${selectedOrderId}`
        },
        (payload) => {
          if (!active || !payload.new) {
            return;
          }

          appendMessage(payload.new);

          requestAnimationFrame(() => {
            scrollToBottom('smooth');
          });
        }
      )
      .subscribe((status) => {
        if (!active) {
          return;
        }

        if (status === 'SUBSCRIBED') {
          setConnectionState('online');
          return;
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setConnectionState('offline');
        }
      });

    async function loadThread() {
      setLoadingMessages(true);
      setError('');
      setConnectionState('connecting');
      setMessages([]);

      try {
        const {
          data,
          error: messageError
        } = await supabase
          .from('messages')
          .select(
            'id, order_id, sender_id, body, created_at, read_at'
          )
          .eq('order_id', Number(selectedOrderId))
          .order('created_at', {
            ascending: true
          });

        if (!active) return;

        if (messageError) {
          throw messageError;
        }

        setMessages(data || []);

        requestAnimationFrame(() => {
          scrollToBottom('auto');
        });
      } catch (messageError) {
        console.error('Messages load error:', messageError);

        if (active) {
          setMessages([]);
          setError(
            messageError?.message ||
            'We could not load this conversation right now.'
          );
        }
      } finally {
        if (active) {
          setLoadingMessages(false);
        }
      }
    }

    void loadThread();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
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

  return (
    <DashboardShell>
      <div className="dash-head messages-page-header">
        <div>
          <p className="eyebrow">MESSAGES</p>

          <h1>
            Project conversations.
          </h1>

          <p>
            Updates, questions and revisions.
          </p>
        </div>
      </div>

      {error && !messages.length && (
        <div
          className="project-brief-error messages-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="messages-layout">
        <aside className="messages-sidebar panel">
          <div className="messages-sidebar-head">
            <span className="eyebrow">
              YOUR PROJECTS
            </span>

            <span className="messages-count">
              {orders.length}
            </span>
          </div>

          <div className="message-order-list">
            {loadingOrders ? (
              <div className="chat-empty">
                Loading conversations…
              </div>
            ) : orders.length ? (
              orders.map((order) => {
                const active =
                  String(order.id) ===
                  String(selectedOrderId);

                return (
                  <button
                    type="button"
                    className={`message-order ${
                      active ? 'active' : ''
                    }`}
                    key={order.id}
                    onClick={() => {
                      if (active) return;

                      setError('');
                      setText('');
                      setAttachment(null);
                      setAttachmentError('');
                      setMessages([]);
                      setSelectedOrderId(order.id);

                      requestAnimationFrame(() => {
                        resizeComposer();
                      });
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span>
                      ORDER #{order.id}
                    </span>

                    <strong>
                      {order.service_name ||
                        'Careerlyst service'}
                      {order.package_name
                        ? ` · ${order.package_name}`
                        : ''}
                    </strong>

                    <small>
                      {String(order.status || 'Pending')
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, (letter) =>
                          letter.toUpperCase()
                        )}
                    </small>
                  </button>
                );
              })
            ) : (
              <div className="chat-empty">
                <strong>
                  No active orders yet.
                </strong>

                <p>
                  Once you place an order, its
                  conversation will appear here.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="chat panel">
          <div className="chat-head">
            <span className="avatar">
              C
            </span>

            <div className="chat-head-copy">
              <b>
                Careerlyst Team
              </b>

              <small>
                {selectedOrder
                  ? `Order #${selectedOrder.id} · ${
                      selectedOrder.service_name ||
                      'Project support'
                    }`
                  : 'Project support'}
              </small>
            </div>

            <div
              className="message-connection"
              aria-label={`Connection status: ${connectionState}`}
            >
              <span
                className={`connection-dot ${
                  connectionState === 'online'
                    ? 'online'
                    : ''
                }`}
              />

              <span>
                {connectionState === 'online'
                  ? 'Live'
                  : connectionState === 'connecting'
                    ? 'Connecting…'
                    : 'Offline'}
              </span>
            </div>
          </div>

          <div
            className="chat-body"
            ref={chatBodyRef}
            aria-live="polite"
          >
            {!selectedOrderId ? (
              <div className="chat-empty">
                <strong>
                  Select a project to start a conversation.
                </strong>

                <p>
                  Your Careerlyst messages are organized
                  by order.
                </p>
              </div>
            ) : loadingMessages ? (
              <div className="chat-empty">
                Loading conversation…
              </div>
            ) : messages.length ? (
              messages.map((message) => {
                const mine =
                  String(message.sender_id) ===
                  String(userId);

                // read_at is the message-state source of truth.
                // Missing read_at = new/unread; present read_at = read.
                const isRead = Boolean(message.read_at);
                const messageState = isRead ? 'is-read' : 'is-new';
                const parsed = parseMessageBody(message.body);

                return (
                  <div
                    className={`message-row ${
                      mine ? 'you' : 'team'
                    } ${messageState}`}
                    key={message.id}
                  >
                    <div
                      className={`bubble ${
                        mine ? 'you' : 'team'
                      } ${messageState}`}
                    >
                      {parsed.text && (
                        <div className="bubble-text">
                          {parsed.text}
                        </div>
                      )}

                      {parsed.attachment && <MessageAttachmentLink attachment={parsed.attachment} mine={mine} />}

                      <small>
                        {formatMessageTime(
                          message.created_at
                        )}
                      </small>
                    </div>
                  </div>
                );
              })
            ) : error ? (
              <div className="chat-empty">
                <strong>
                  We couldn’t load this conversation.
                </strong>

                <p>{error}</p>
              </div>
            ) : (
              <div className="chat-empty">
                <strong>
                  No messages yet.
                </strong>

                <p>
                  Send a message and the Careerlyst
                  team can reply here.
                </p>
              </div>
            )}
          </div>

          <form
            className="chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <div className="chat-composer-row">
              <label
                className="chat-attach-button"
                title="Attach a file (max 10 MB)"
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.jpg,.jpeg,.png,.webp"
                  onChange={handleAttachmentChange}
                  disabled={!selectedOrderId || sending}
                  aria-label="Attach a file"
                />
                <span>＋</span>
                <small>Attach</small>
              </label>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleComposerChange}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  selectedOrderId
                    ? 'Write a message…'
                    : 'Select a project first…'
                }
                rows={1}
                maxLength={2000}
                disabled={!selectedOrderId || sending}
                aria-label="Write a message"
              />

              <button
                type="submit"
                className="btn dark chat-send-button"
                disabled={
                  !selectedOrderId ||
                  (!text.trim() && !attachment) ||
                  sending
                }
              >
                {sending
                  ? 'Sending…'
                  : 'Send ↗'}
              </button>
            </div>

            {attachment && (
              <div className="chat-attachment-preview">
                <span>📎</span>
                <strong>{attachment.name}</strong>
                <small>{formatFileSize(attachment.size)}</small>
                <button type="button" onClick={removeAttachment} disabled={sending}>×</button>
              </div>
            )}

            {attachmentError && (
              <div className="chat-attachment-error" role="alert">
                {attachmentError}
              </div>
            )}

            <div className="chat-input-meta">
              <small>
                Attach files up to 10 MB · Enter to send · Shift + Enter
                for a new line
              </small>

              <small className="chat-char-count">
                {text.length}/2000
              </small>
            </div>

            {error && messages.length > 0 && (
              <div
                className="chat-inline-error"
                role="alert"
              >
                {error}
              </div>
            )}
          </form>
        </section>
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
  const [error, setError] = useState('');

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
        if (!orderIds.length) {
          if (mounted) setFiles([]);
          return;
        }

        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select('id, order_id, sender_id, body, created_at')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false });

        if (messageError) throw messageError;

        const orderMap = Object.fromEntries(
          (orderData || []).map((order) => [String(order.id), order])
        );

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
              order: orderMap[String(message.order_id)] || null
            };
          })
          .filter(Boolean);

        if (mounted) setFiles(extracted);
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
            <p>Files shared with you through your Careerlyst conversations.</p>
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
          .select('id, user_id, order_id, type, title, body, read_at, created_at, metadata')
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
            <p>Checking the latest updates from your Careerlyst workspace.</p>
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

                    <h3>{notification.title || 'Careerlyst update'}</h3>
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
  const [language, setLanguage] = useState(
    s.settings?.language || 'English'
  );
  const [theme, setTheme] = useState(
    localStorage.getItem('careerlyst-theme') || 'system'
  );
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
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      const resolved = theme === 'system'
        ? (media.matches ? 'dark' : 'light')
        : theme;
      root.dataset.theme = resolved;
    }

    applyTheme();
    localStorage.setItem('careerlyst-theme', theme);

    if (theme !== 'system') return undefined;

    media.addEventListener?.('change', applyTheme);
    return () => media.removeEventListener?.('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      if (!supabase) return;

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted || sessionError) return;

      const stored = data?.session?.user?.user_metadata?.careerlyst_settings;
      if (!stored || typeof stored !== 'object') return;

      if (typeof stored.emailNotifications === 'boolean') {
        setEmailNotifications(stored.emailNotifications);
      }
      if (stored.language) setLanguage(stored.language);
      if (stored.theme) setTheme(stored.theme);
    }

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

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
            Manage your Careerlyst preferences, security and account without leaving your workspace.
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
                    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                </div>

                <div className="settings-section-footer-v2">
                  <span>Changes are saved to your Careerlyst account.</span>
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
                    <span>Your password is never stored in Careerlyst profile data.</span>
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
                      <small>End your current Careerlyst session.</small>
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
