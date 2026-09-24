import React, { useEffect, useMemo, useState } from 'react';
import DashboardShell from '../components/DashboardShell';
import { supabase } from '../lib/supabase';

const QUESTIONS = [
  {
    id: 'service',
    number: '01',
    title: 'What are you looking for help with?',
    options: {
      resume: 'Resume / CV',
      linkedin: 'LinkedIn',
      portfolio: 'Portfolio',
      github: 'GitHub',
      cover_letter: 'Cover Letter',
      interview: 'Interview Preparation',
      unsure: 'Not sure yet'
    }
  },
  {
    id: 'situation',
    number: '02',
    title: 'What are you currently preparing for?',
    options: {
      job_search: 'Applying for jobs',
      career_switch: 'Switching careers',
      internship: 'Looking for internships',
      interview: 'Preparing for interviews',
      profile: 'Improving my professional profile',
      exploring: 'Just exploring my options'
    }
  },
  {
    id: 'urgency',
    number: '03',
    title: 'How soon do you need it?',
    options: {
      less_than_day: 'Less than a day (Urgent)',
      '1_3_days': 'Within 1–3 days',
      '1_week': 'Within 1 week',
      '2_4_weeks': 'Within 2–4 weeks',
      '1_3_months': 'Within 1–3 months',
      exploring: 'Just exploring for now'
    }
  },
  {
    id: 'materials',
    number: '04',
    title: 'Do you already have something we can work with?',
    options: {
      yes: 'Yes, I have existing materials',
      some: 'I have some materials',
      no: 'No, I’m starting from scratch',
      unsure: 'I’m not sure what I need'
    }
  },
  {
    id: 'activity',
    number: '05',
    title: 'What best describes your current situation?',
    options: {
      actively_applying: 'I’m actively applying for opportunities',
      upcoming: 'I have an upcoming interview/application',
      preparing: 'I’m preparing before I start applying',
      unhappy: 'I’m unhappy with my current profile',
      researching: 'I’m only researching right now'
    }
  },
  {
    id: 'budget',
    number: '06',
    title: 'How much are you looking to invest?',
    options: {
      under_25: 'Under $25',
      '25_50': '$25–$50',
      '50_100': '$50–$100',
      '100_plus': '$100+',
      unsure: 'I’m not sure yet'
    }
  },
  {
    id: 'readiness',
    number: '07',
    title: 'How soon would you be ready to get started?',
    options: {
      now: 'I’m ready to start now',
      few_days: 'Within a few days',
      few_weeks: 'Within a few weeks',
      comparing: 'I’m still comparing options',
      exploring: 'Just exploring'
    }
  }
];

function formatAnswer(question, value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => question.options[item] || item)
      .join(', ');
  }

  if (!value) {
    return 'Not answered';
  }

  return question.options[value] || value;
}

function formatDate(value) {
  if (!value) return '—';

  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

function statusClass(status) {
  return `admin-lead-status admin-lead-status-${status || 'exploring'}`;
}

export default function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadLeads() {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Verify current staff session.
      const {
        data: sessionData,
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const currentUser = sessionData?.session?.user;

      if (!currentUser) {
        throw new Error(
          'Your admin session could not be verified.'
        );
      }

      // Verify staff role.
      const {
        data: roleRow,
        error: roleError
      } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (roleError) throw roleError;

      const allowedRoles = [
        'admin',
        'expert',
        'support',
        'finance'
      ];

      if (!allowedRoles.includes(
        String(roleRow?.role || '').toLowerCase()
      )) {
        throw new Error(
          'This account does not have staff access.'
        );
      }

      // Load assessment data.
      const {
        data: profileRows,
        error: profileError
      } = await supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          lead_assessment,
          lead_score,
          lead_status,
          lead_assessment_completed_at
        `)
        .not(
          'lead_assessment',
          'is',
          null
        )
        .order(
          'lead_assessment_completed_at',
          {
            ascending: false,
            nullsFirst: false
          }
        );

      if (profileError) throw profileError;

      setLeads(profileRows || []);

    } catch (loadError) {
      console.error(
        'Admin leads load error:',
        loadError
      );

      setError(
        loadError?.message ||
        'Could not load lead assessments.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const status =
        String(
          lead.lead_status || 'exploring'
        ).toLowerCase();

      if (
        statusFilter !== 'all' &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        lead.name,
        lead.email,
        status,
        String(lead.lead_score || ''),
        JSON.stringify(
          lead.lead_assessment || {}
        )
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    leads,
    search,
    statusFilter
  ]);

  const stats = useMemo(() => {
    return {
      total: leads.length,

      hot: leads.filter(
        (lead) =>
          lead.lead_status === 'hot'
      ).length,

      warm: leads.filter(
        (lead) =>
          lead.lead_status === 'warm'
      ).length,

      cold: leads.filter(
        (lead) =>
          lead.lead_status === 'cold'
      ).length,

      exploring: leads.filter(
        (lead) =>
          lead.lead_status === 'exploring'
      ).length
    };
  }, [leads]);

  function getAnswers(lead) {
    return lead?.lead_assessment?.answers || {};
  }

  return (
    <DashboardShell admin>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="dash-head admin-leads-head">

        <div>
          <p className="eyebrow">
            LEAD ASSESSMENTS
          </p>

          <h1>
            Understand every client.
          </h1>

          <p>
            Review the answers clients give before
            starting their Careerlyst journey.
          </p>
        </div>

        <button
          type="button"
          className="btn light"
          onClick={loadLeads}
          disabled={loading}
        >
          {loading
            ? 'Refreshing…'
            : 'Refresh ↻'}
        </button>

      </div>


      {/* =====================================================
          STATS
      ===================================================== */}

      <section className="admin-leads-stats">

        <div className="admin-lead-stat">
          <span>Total assessments</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="admin-lead-stat">
          <span>Hot</span>
          <strong>{stats.hot}</strong>
        </div>

        <div className="admin-lead-stat">
          <span>Warm</span>
          <strong>{stats.warm}</strong>
        </div>

        <div className="admin-lead-stat">
          <span>Cold</span>
          <strong>{stats.cold}</strong>
        </div>

        <div className="admin-lead-stat">
          <span>Exploring</span>
          <strong>{stats.exploring}</strong>
        </div>

      </section>


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="panel admin-leads-panel">

        <div className="admin-leads-toolbar">

          <input
            type="search"
            placeholder="Search by name, email, answer..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="admin-leads-search"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="admin-leads-filter"
          >
            <option value="all">
              All statuses
            </option>

            <option value="hot">
              Hot
            </option>

            <option value="warm">
              Warm
            </option>

            <option value="cold">
              Cold
            </option>

            <option value="exploring">
              Exploring
            </option>
          </select>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="admin-leads-error">
            {error}
          </div>
        )}


        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (

          <div className="empty">
            <h3>
              Loading assessments…
            </h3>

            <p>
              Fetching client assessment data
              from Supabase.
            </p>
          </div>

        ) : !filteredLeads.length ? (

          <div className="empty">
            <h3>
              No assessments found.
            </h3>

            <p>
              Completed client assessments will
              appear here.
            </p>
          </div>

        ) : (

          <div className="admin-leads-list">

            {filteredLeads.map((lead) => (

              <article
                className="admin-lead-row"
                key={lead.id}
                onClick={() =>
                  setSelectedLead(lead)
                }
              >

                <div className="admin-lead-avatar">
                  {(
                    lead.name ||
                    lead.email ||
                    'U'
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="admin-lead-main">

                  <div className="admin-lead-title">

                    <strong>
                      {lead.name ||
                        'Unnamed client'}
                    </strong>

                    <span>
                      {lead.email ||
                        'No email'}
                    </span>

                  </div>

                  <small>
                    Completed{' '}
                    {formatDate(
                      lead.lead_assessment_completed_at
                    )}
                  </small>

                </div>

                <div className="admin-lead-summary">

                  <span>
                    Score
                    <b>
                      {lead.lead_score ?? '—'}
                    </b>
                  </span>

                  <span
                    className={statusClass(
                      lead.lead_status
                    )}
                  >
                    {lead.lead_status ||
                      'exploring'}
                  </span>

                </div>

                <button
                  type="button"
                  className="text-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLead(lead);
                  }}
                >
                  View answers →
                </button>

              </article>

            ))}

          </div>

        )}

      </section>


      {/* =====================================================
          DETAIL DRAWER
      ===================================================== */}

      {selectedLead && (

        <div
          className="admin-lead-overlay"
          role="presentation"
          onClick={() =>
            setSelectedLead(null)
          }
        >

          <aside
            className="admin-lead-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Lead assessment details"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <header className="admin-lead-drawer-head">

              <div>

                <p className="eyebrow">
                  CLIENT ASSESSMENT
                </p>

                <h2>
                  {selectedLead.name ||
                    'Unnamed client'}
                </h2>

                <p>
                  {selectedLead.email ||
                    'No email available'}
                </p>

              </div>

              <button
                type="button"
                className="admin-lead-close"
                onClick={() =>
                  setSelectedLead(null)
                }
                aria-label="Close"
              >
                ×
              </button>

            </header>


            <div className="admin-lead-drawer-meta">

              <div>
                <span>Lead score</span>
                <strong>
                  {selectedLead.lead_score ?? '—'}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong
                  className={statusClass(
                    selectedLead.lead_status
                  )}
                >
                  {selectedLead.lead_status ||
                    'exploring'}
                </strong>
              </div>

              <div>
                <span>Completed</span>
                <strong>
                  {formatDate(
                    selectedLead.lead_assessment_completed_at
                  )}
                </strong>
              </div>

            </div>


            <div className="admin-lead-answers">

              {QUESTIONS.map((question) => {

                const answers =
                  getAnswers(
                    selectedLead
                  );

                return (
                  <section
                    className="admin-lead-question"
                    key={question.id}
                  >

                    <span className="admin-lead-question-number">
                      {question.number}
                    </span>

                    <div>

                      <p>
                        {question.title}
                      </p>

                      <strong>
                        {formatAnswer(
                          question,
                          answers[
                            question.id
                          ]
                        )}
                      </strong>

                    </div>

                  </section>
                );
              })}

            </div>


            <footer className="admin-lead-drawer-footer">

              <span>
                Assessment version{' '}
                {selectedLead
                  .lead_assessment
                  ?.version || 1}
              </span>

              <button
                type="button"
                className="btn dark"
                onClick={() =>
                  setSelectedLead(null)
                }
              >
                Close
              </button>

            </footer>

          </aside>

        </div>

      )}

    </DashboardShell>
  );
}