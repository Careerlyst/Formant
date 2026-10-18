import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import { services as fallbackServices, load } from '../lib/store';
import { supabase } from '../lib/supabase';
import { classifyRequestFailure } from '../lib/requestFailure';
import { RequestProblem } from '../components/ErrorExperience';
import './service-selection.css';

/* =========================================================
   SERVICE ICONS HELPER
   ========================================================= */

function getServiceIcon(service) {
  const key = `${service?.slug || ''} ${service?.id || ''} ${service?.name || ''}`.toLowerCase();

  if (key.includes('resume') || key.includes('cv')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }

  if (key.includes('linkedin')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  }

  if (key.includes('github')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
    );
  }

  if (key.includes('portfolio')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }

  if (key.includes('cover')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }

  if (key.includes('interview')) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 8 8 12 12 16 16 12 12 8" />
    </svg>
  );
}

/* =========================================================
   EDITORIAL COPY ENHANCER
   Concise, high-impact descriptions per the redesign spec
   ========================================================= */

function getRefinedDescription(service) {
  const key = `${service?.slug || ''} ${service?.id || ''} ${service?.name || ''}`.toLowerCase();

  if (key.includes('resume') || key.includes('cv')) {
    return 'Turn your experience into a clear, compelling story.';
  }
  if (key.includes('linkedin')) {
    return 'Build a profile that communicates your value.';
  }
  if (key.includes('portfolio')) {
    return 'Show your work with structure and confidence.';
  }
  if (key.includes('github')) {
    return 'Make your technical work easier to understand.';
  }
  if (key.includes('cover')) {
    return 'Make every application feel intentional.';
  }
  if (key.includes('interview')) {
    return 'Prepare with clarity before the conversation starts.';
  }

  return service.desc || service.description || 'Professional bespoke career advancement service.';
}

/* =========================================================
   SERVICE MATCHING LOGIC FOR RECOMMENDATIONS
   ========================================================= */

function matchesAssessmentAnswer(service, targetKey) {
  const sId = (service.slug || service.id || '').toLowerCase();
  const sName = (service.name || '').toLowerCase();

  switch (targetKey) {
    case 'resume':
      return sId.includes('resume') || sName.includes('resume') || sName.includes('cv');
    case 'linkedin':
      return sId.includes('linkedin') || sName.includes('linkedin');
    case 'portfolio':
      return sId.includes('portfolio') || sName.includes('portfolio');
    case 'github':
      return sId.includes('github') || sName.includes('github');
    case 'cover_letter':
    case 'cover':
      return sId.includes('cover') || sName.includes('cover');
    case 'interview':
      return sId.includes('interview') || sName.includes('interview');
    default:
      return false;
  }
}

/* =========================================================
   CARD THEME RHYTHM
   Strict alternating pattern by position/index:
   Card 1, 3, 5... (odd / index 0, 2, 4...) = BLACK
   Card 2, 4, 6... (even / index 1, 3, 5...) = LIME
   ========================================================= */

const CARD_THEMES = [
  'card-theme-dark',
  'card-theme-lime'
];

/* =========================================================
   SERVICE SELECTION PAGE COMPONENT
   ========================================================= */

export default function ServiceSelection() {
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [services, setServices] = useState([]);
  const [recommendedSlugs, setRecommendedSlugs] = useState(new Set());
  const [failureKind, setFailureKind] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setChecking(true);
      setFailureKind(null);
      try {
        let assessmentAnswers = null;
        let isCompleted = false;

        if (supabase) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          const user = session?.user;

          if (!user) {
            navigate('/login', { replace: true });
            return;
          }

          const hasCompletedFlag = user.user_metadata?.careerlyst_assessment_completed === true;
          const userAssessment = user.user_metadata?.careerlyst_lead_assessment;

          if (hasCompletedFlag || userAssessment) {
            isCompleted = true;
            assessmentAnswers = userAssessment?.answers || null;
          }

          // User-scoped localStorage check if needed
          if (!isCompleted || !assessmentAnswers) {
            try {
              const userDraft = localStorage.getItem(`careerlyst_assessment_${user.id}`);
              if (userDraft) {
                const parsed = JSON.parse(userDraft);
                if (parsed?.completed || parsed?.assessment?.completedAt) {
                  isCompleted = true;
                }
                if (!assessmentAnswers && (parsed?.answers || parsed?.assessment?.answers)) {
                  assessmentAnswers = parsed.answers || parsed.assessment.answers;
                }
              }
            } catch (e) {
              console.warn('Error reading user assessment:', e);
            }
          }
        } else {
          // Demo fallback (when supabase is not configured)
          const stored = load();
          const demoId = stored.user?.id || stored.user?.email || 'demo_user';
          try {
            const userDraft = localStorage.getItem(`careerlyst_assessment_${demoId}`);
            if (userDraft) {
              const parsed = JSON.parse(userDraft);
              if (parsed?.completed || parsed?.assessment?.completedAt) {
                isCompleted = true;
              }
              if (parsed?.answers || parsed?.assessment?.answers) {
                assessmentAnswers = parsed.answers || parsed.assessment.answers;
              }
            }
          } catch (e) {
            console.warn('Error reading demo assessment:', e);
          }
        }

        // Route guard: Incomplete users must complete the assessment first
        if (!isCompleted) {
          navigate('/assessment', { replace: true });
          return;
        }

        // Load active services
        let loadedServices = [];

        if (supabase) {
          const { data, error: queryError } = await supabase
            .from('services')
            .select('id, slug, name, description, starting_price, active, show_on_services_page')
            .eq('active', true)
            .eq('show_on_services_page', true)
            .order('created_at', { ascending: true });

          if (queryError) {
            console.error('ServiceSelection request failed:', classifyRequestFailure(queryError));
            if (mounted) {
              setFailureKind(classifyRequestFailure(queryError));
              setChecking(false);
            }
            return;
          } else if (data && data.length > 0) {
            loadedServices = data;
          } else {
            loadedServices = fallbackServices;
          }
        } else {
          loadedServices = fallbackServices;
        }

        if (!mounted) return;

        // Format services consistently
        const displayServices = loadedServices.map((item) => ({
          ...item,
          id: item.slug || item.id,
          slug: item.slug || item.id,
          desc: item.description || item.desc || '',
          price: item.starting_price != null
            ? `From $${Number(item.starting_price).toFixed(0)}`
            : (item.price || 'Custom')
        }));

        setServices(displayServices);

        // Derive recommendations from assessment answers
        const rawSelected = assessmentAnswers?.service;
        const selectedKeys = Array.isArray(rawSelected)
          ? rawSelected
          : rawSelected
            ? [rawSelected]
            : [];

        const activeKeys = selectedKeys.filter((key) => key && key !== 'unsure');
        let recs = [];

        if (activeKeys.length > 0) {
          recs = displayServices.filter((service) =>
            activeKeys.some((targetKey) => matchesAssessmentAnswer(service, targetKey))
          );
        }

        // If user was unsure or no specific matches matched the active catalogue,
        // provide sensible defaults (first 2 foundational services: Resume & LinkedIn)
        if (recs.length === 0 && displayServices.length > 0) {
          recs = displayServices.slice(0, 2);
        }

        const recSet = new Set(recs.map((s) => s.slug || s.id));
        setRecommendedSlugs(recSet);
        setChecking(false);

      } catch (err) {
        console.error('ServiceSelection request failed:', classifyRequestFailure(err));
        if (mounted) {
          setFailureKind(classifyRequestFailure(err));
          setChecking(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [navigate, retryCount]);

  if (checking) {
    return (
      <div className="service-selection-loading" role="status">
        Loading services...
      </div>
    );
  }

  if (failureKind && services.length === 0) {
    return (
      <div className="service-selection-page">
        <PublicNav />
        <main className="service-selection-main" id="main-content">
          <RequestProblem kind={failureKind} onRetry={() => setRetryCount((count) => count + 1)} headingLevel="h1" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="service-selection-page">
      <PublicNav />

      <main className="service-selection-main" id="main-content">
        {/* =====================================================
            SECTION 01 — LARGE LIME HERO BOX (CONTAINED)
            ===================================================== */}
        <header className="service-selection-hero-box" aria-label="Services Header">
          <div className="service-selection-hero-content">
            <p className="service-selection-hero-eyebrow">
              SERVICES
            </p>
            <h1 className="service-selection-hero-title">
              SERVICES
            </h1>
            <p className="service-selection-hero-sub">
              Choose what you want to build next.
            </p>
          </div>
        </header>

        {failureKind && <RequestProblem kind={failureKind} onRetry={() => setRetryCount((count) => count + 1)} className="service-selection-request-error" />}

        {/* =====================================================
            SECTION 02 — OUR NEXT MISSION (EDITORIAL STATEMENT)
            ===================================================== */}
        <section className="service-selection-mission" aria-label="Our Next Mission">
          <p className="service-selection-mission-eyebrow">
            OUR NEXT MISSION
          </p>
          <h2 className="service-selection-mission-statement">
            Build a career presence{' '}
            <span className="service-selection-mission-highlight">that gets you noticed.</span>
          </h2>
        </section>

        {/* =====================================================
            SECTION 03 — SERVICES GRID
            - Desktop & Tablet: 3 columns
            - Mobile: 2 columns
            ===================================================== */}
        <section className="service-selection-catalogue" aria-labelledby="catalogue-heading">
          <div className="service-selection-catalogue-header">
            <p id="catalogue-heading" className="service-selection-catalogue-eyebrow">
              OUR SERVICES
            </p>
          </div>

          <div className="service-selection-grid">
            {services.map((service, index) => {
              const isRec = recommendedSlugs.has(service.slug || service.id);
              const themeClass = index % 2 === 0 ? 'card-theme-dark' : 'card-theme-lime';

              return (
                <Link
                  key={`service-${service.slug || service.id}`}
                  to={`/services/${service.slug || service.id}`}
                  className={`service-card ${themeClass} ${isRec ? 'is-recommended' : ''}`}
                  aria-label={`${service.name}${isRec ? ' (Recommended)' : ''} — Starting from ${service.price}`}
                >
                  <div className="service-card-top">
                    <div className="service-card-icon-box" aria-hidden="true">
                      {getServiceIcon(service)}
                    </div>
                    {isRec && (
                      <span className="service-card-rec-badge">
                        RECOMMENDED
                      </span>
                    )}
                  </div>

                  <div className="service-card-middle">
                    <h3 className="service-card-title">
                      {service.name}
                    </h3>
                    <p className="service-card-desc">
                      {getRefinedDescription(service)}
                    </p>
                  </div>

                  <div className="service-card-bottom">
                    <div className="service-card-price-group">
                      <span className="service-card-price-label">
                        Starting from
                      </span>
                      <span className="service-card-price-value">
                        {service.price}
                      </span>
                    </div>

                    <span className="service-card-arrow" aria-hidden="true">
                      →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* =====================================================
            SECTION 04 — SMALL DASHBOARD ESCAPE
            ===================================================== */}
        <section className="service-selection-escape" aria-label="Dashboard quick exit">
          <div className="service-selection-escape-inner">
            <p className="service-selection-escape-kicker">
              NOT READY TO CHOOSE YET?
            </p>
            <p className="service-selection-escape-text">
              Continue from your dashboard whenever you're ready.
            </p>
            <Link to="/dashboard" className="service-selection-escape-btn">
              <span>Go to Dashboard</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
