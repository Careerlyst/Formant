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

/* =========================================================
   MESSAGES
========================================================= */

export function Messages() {

  const [s, setS] = useState(load());

  const [text, setText] = useState('');

  function send() {

    if (!text.trim()) return;

    patch((x) => ({

      ...x,

      messages: [
        ...(x.messages || []),

        {
          from: 'You',
          text: text.trim(),
          date: 'Just now',
          read: true
        }

      ]

    }));

    setS(load());
    setText('');
  }

  return (
    <DashboardShell>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            MESSAGES
          </p>

          <h1>
            Your Careerlyst conversation.
          </h1>

        </div>

      </div>


      <div className="chat panel">

        <div className="chat-head">

          <span className="avatar">
            C
          </span>

          <div>

            <b>
              Careerlyst Team
            </b>

            <small>
              Project support
            </small>

          </div>

        </div>


        <div className="chat-body">

          <div className="bubble team">
            Hi. Once your order is active, we'll use
            this thread for questions, updates and
            revisions.
          </div>


          {(s.messages || []).map((m, i) => (

            <div
              className="bubble you"
              key={i}
            >

              {m.text}

              <small>
                {m.date}
              </small>

            </div>

          ))}

        </div>


        <div className="chat-input">

          <textarea
            value={text}
            onChange={(e) =>
              setText(e.target.value)
            }
            placeholder="Write a message…"
          />

          <button
            className="btn dark"
            onClick={send}
          >
            Send ↗
          </button>

        </div>

      </div>

    </DashboardShell>
  );
}


/* =========================================================
   FILES
========================================================= */

export function Files() {

  const [s, setS] = useState(load());

  function add(e) {

    const f = e.target.files?.[0];

    if (!f) return;

    patch((x) => ({

      ...x,

      files: [
        ...(x.files || []),

        {
          name: f.name,
          size: `${(f.size / 1024).toFixed(0)} KB`,
          date: 'Just now'
        }

      ]

    }));

    setS(load());

    /*
      Reset input so selecting the same
      file again still triggers change.
    */
    e.target.value = '';
  }

  return (
    <DashboardShell>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            FILES
          </p>

          <h1>
            Your project files.
          </h1>

        </div>


        <label className="btn lime file-btn">

          Upload file ↗

          <input
            type="file"
            hidden
            onChange={add}
          />

        </label>

      </div>


      <div className="panel file-list">

        {s.files?.length ? (

          s.files.map((f, i) => (

            <div
              className="file-row"
              key={i}
            >

              <span>
                FILE
              </span>

              <div>

                <b>
                  {f.name}
                </b>

                <small>
                  {f.size} · {f.date}
                </small>

              </div>

              <button>
                Download
              </button>

            </div>

          ))

        ) : (

          <div className="empty">

            <h3>
              No files yet.
            </h3>

            <p>
              Upload your existing CV, job
              descriptions or supporting material.
            </p>

          </div>

        )}

      </div>

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

  return (
    <DashboardShell>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            NOTIFICATIONS
          </p>

          <h1>
            Updates from your team.
          </h1>

        </div>

      </div>


      <div className="panel notification">

        <div>

          <b>
            Careerlyst team
          </b>

          <p>
            Your project workspace is ready.
            Upload your current resume to begin.
          </p>

        </div>

        <small>
          Today
        </small>

      </div>

    </DashboardShell>
  );
}


/* =========================================================
   SETTINGS
========================================================= */

export function Settings() {

  return (
    <DashboardShell>

      <div className="dash-head">

        <div>

          <p className="eyebrow">
            SETTINGS
          </p>

          <h1>
            Account settings.
          </h1>

        </div>

      </div>


      <div className="panel form-panel">

        <label>

          Email notifications

          <select>
            <option>
              On
            </option>

            <option>
              Off
            </option>
          </select>

        </label>


        <label>

          Language

          <select>

            <option>
              English
            </option>

          </select>

        </label>


        <button className="btn dark">
          Save settings ↗
        </button>

      </div>

    </DashboardShell>
  );
}