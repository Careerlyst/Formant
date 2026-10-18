import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import { PageNotFound, RequestProblem } from '../components/ErrorExperience';
import { classifyRequestFailure } from '../lib/requestFailure';
import { services as fallbackServices } from '../lib/store';
import { applySeoMetadata, normalizePath } from '../lib/seo';
import { supabase } from '../lib/supabase';
import './service-detail.css';

/* =========================================================
   SERVICE ICONS HELPER
   ========================================================= */

function getServiceIcon(service) {
  const key = `${service?.slug || ''} ${service?.id || ''} ${service?.name || ''}`.toLowerCase();

  if (key.includes('resume') || key.includes('cv')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    );
  }

  if (key.includes('github')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
    );
  }

  if (key.includes('portfolio')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  }

  if (key.includes('cover')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }

  if (key.includes('interview')) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 8 8 12 12 16 16 12 12 8" />
    </svg>
  );
}

/* =========================================================
   SERVICE ALIASES HELPER
   ========================================================= */

function getSlugAliases(slug) {
  const normalized = (slug || '').toLowerCase();
  const aliases = [normalized];

  if (normalized === 'cover-letter') aliases.push('cover');
  if (normalized === 'cover') aliases.push('cover-letter');
  if (normalized === 'interview-preparation') aliases.push('interview', 'interview-prep');
  if (normalized === 'interview') aliases.push('interview-preparation', 'interview-prep');
  if (normalized === 'resume-cv') aliases.push('resume', 'cv');
  if (normalized === 'resume') aliases.push('resume-cv', 'cv');
  if (normalized === 'linkedin-profile') aliases.push('linkedin');
  if (normalized === 'linkedin') aliases.push('linkedin-profile');
  if (normalized === 'github-profile') aliases.push('github');
  if (normalized === 'github') aliases.push('github-profile');

  return aliases;
}

/* =========================================================
   SERVICE SPECIFIC EDITORIAL PROFILES
   ========================================================= */

const SERVICE_PROFILES = {
  github: {
    category: 'TECHNICAL PRESENCE',
    tagline: 'Make your technical work easier to understand, evaluate, and trust.'
  },
  linkedin: {
    category: 'EXECUTIVE PRESENCE',
    tagline: 'Build a profile that communicates your value before the first conversation.'
  },
  resume: {
    category: 'CORE ASSET',
    tagline: 'A focused, role-specific resume built for clarity, relevance, and ATS readability.'
  },
  portfolio: {
    category: 'CREATIVE CRAFT',
    tagline: 'Show your work with structure, depth, and visual confidence.'
  },
  cover: {
    category: 'WRITTEN ARTIFACT',
    tagline: 'A concise, specific letter tailored to the exact opportunity you want.'
  },
  interview: {
    category: 'PERFORMANCE',
    tagline: 'Targeted preparation, practice, and feedback for the conversation ahead.'
  }
};

function getServiceProfile(service) {
  const key = `${service?.slug || ''} ${service?.id || ''} ${service?.name || ''}`.toLowerCase();

  if (key.includes('github')) return SERVICE_PROFILES.github;
  if (key.includes('linkedin')) return SERVICE_PROFILES.linkedin;
  if (key.includes('resume') || key.includes('cv')) return SERVICE_PROFILES.resume;
  if (key.includes('portfolio')) return SERVICE_PROFILES.portfolio;
  if (key.includes('cover')) return SERVICE_PROFILES.cover;
  if (key.includes('interview')) return SERVICE_PROFILES.interview;

  return {
    category: 'BESPOKE SERVICE',
    tagline: service?.description || 'Bespoke editorial career advancement service.'
  };
}

/* =========================================================
   SERVICE DETAIL MASTER COMPONENT (3-SECTION ARCHITECTURE)
   01 — SERVICE HERO
   02 — PACKAGES / PRICING
   03 — FINAL CTA
   ========================================================= */

export default function ServiceDetail() {
  const { id } = useParams();

  const [service, setService] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failureKind, setFailureKind] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [orderError, setOrderError] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (service?.name) {
      const currentSlug = (service.slug || service.id || id || '').toLowerCase();
      const canonicalSlug = [
        ['resume', 'resume-cv', 'cv'],
        ['linkedin', 'linkedin-profile'],
        ['github', 'github-profile'],
        ['portfolio'],
        ['cover', 'cover-letter'],
        ['interview', 'interview-preparation', 'interview-prep']
      ].find((aliases) => aliases.includes(currentSlug))?.[0] || currentSlug;
      const serviceDescription = service.description || getServiceProfile(service).tagline;

      applySeoMetadata(normalizePath(`/services/${canonicalSlug}`), {
        title: `${service.name} | Formant`,
        description: serviceDescription,
        canonical: `https://careerlyst-three.vercel.app/services/${canonicalSlug}`,
        indexable: Boolean(service.active && service.show_on_services_page)
      });
    } else if (!loading) {
      applySeoMetadata(`/services/${id}`, { indexable: false });
    }
  }, [service, id, loading]);

  useEffect(() => {
    let mounted = true;

    async function loadService() {
      setLoading(true);
      setFailureKind(null);
      setNotFound(false);
      setService(null);
      setPackages([]);
      const aliases = getSlugAliases(id);

      if (!supabase) {
        const fallback = fallbackServices.find((item) =>
          aliases.includes((item.id || '').toLowerCase()) ||
          aliases.includes((item.slug || '').toLowerCase())
        );

        if (mounted) {
          setService(fallback ? {
            ...fallback,
            slug: fallback.slug || fallback.id,
            description: fallback.description || fallback.desc || '',
            starting_price: fallback.starting_price ?? null,
            active: fallback.active ?? true,
            show_on_services_page: fallback.show_on_services_page ?? true,
            accept_orders: fallback.accept_orders ?? true
          } : null);
          setNotFound(!fallback);
          setLoading(false);
        }
        return;
      }

      // 1. Direct query by slug
      let { data, error: queryError } = await supabase
        .from('services')
        .select('id, slug, name, description, starting_price, active, show_on_services_page, accept_orders')
        .eq('slug', id)
        .eq('active', true)
        .eq('show_on_services_page', true)
        .maybeSingle();

      if (queryError) {
        if (mounted) {
          console.error('Service detail request failed:', classifyRequestFailure(queryError));
          setFailureKind(classifyRequestFailure(queryError));
          setLoading(false);
        }
        return;
      }

      // 2. Query by aliases if not matched directly
      if (!data) {
        const otherAliases = aliases.filter((a) => a !== id);
        for (const alias of otherAliases) {
          const { data: aliasData, error: aliasError } = await supabase
            .from('services')
            .select('id, slug, name, description, starting_price, active, show_on_services_page, accept_orders')
            .eq('slug', alias)
            .eq('active', true)
            .eq('show_on_services_page', true)
            .maybeSingle();

          if (aliasError) {
            if (mounted) {
              console.error('Service detail request failed:', classifyRequestFailure(aliasError));
              setFailureKind(classifyRequestFailure(aliasError));
              setLoading(false);
            }
            return;
          }

          if (aliasData) {
            data = aliasData;
            break;
          }
        }
      }

      // 3. Fallback store lookup if database query returned no record
      if (!data) {
        const fallback = fallbackServices.find((item) =>
          aliases.includes((item.id || '').toLowerCase()) ||
          aliases.includes((item.slug || '').toLowerCase())
        );

        if (fallback) {
          data = {
            ...fallback,
            slug: fallback.slug || fallback.id,
            description: fallback.description || fallback.desc || '',
            starting_price: fallback.starting_price ?? null,
            active: fallback.active ?? true,
            show_on_services_page: fallback.show_on_services_page ?? true,
            accept_orders: fallback.accept_orders ?? true
          };
        }
      }

      if (!mounted) return;

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Load packages if service was found in database
      let packageData = [];
      if (data.id && typeof data.id === 'string' && data.id.includes('-')) {
        const { data: pkgs, error: packageError } = await supabase
          .from('service_packages')
          .select('id, name, description, price, currency, active, sort_order')
          .eq('service_id', data.id)
          .eq('active', true)
          .order('sort_order', { ascending: true });

        if (packageError) {
          if (mounted) {
            console.error('Service package request failed:', classifyRequestFailure(packageError));
            setFailureKind(classifyRequestFailure(packageError));
            setLoading(false);
          }
          return;
        } else if (pkgs) {
          packageData = pkgs;
        }
      }

      if (!mounted) return;

      setService(data);
      setPackages(packageData || []);
      setLoading(false);
    }

    loadService().catch((requestError) => {
      if (!mounted) return;
      console.error('Service detail request failed:', classifyRequestFailure(requestError));
      setFailureKind(classifyRequestFailure(requestError));
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [id, retryCount]);

  function openPackage(pkg) {
    if (!service?.accept_orders) return;
    setOrderError('');
    setOrderNotes('');
    setSelectedPackage(pkg);
  }

  function closePackage() {
    setSelectedPackage(null);
    setOrderError('');
    setCheckoutOpen(false);
  }

  function continueToCheckout() {
    if (!selectedPackage || !service) return;
    if (!service.accept_orders) {
      setOrderError('This service is not accepting orders right now.');
      return;
    }
    setOrderError('');
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    setOrderError('');
  }

  function scrollToPricing() {
    const el = document.getElementById('pricing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (loading) {
    return (
      <div className="service-detail-page">
        <PublicNav />
        <main className="service-detail-main">
          <section className="service-detail-hero">
            <div>
              <p className="service-detail-eyebrow">FORMANT SERVICE</p>
              <h1 className="service-detail-hero-title">Loading…</h1>
              <p className="service-detail-hero-desc">Preparing the service details for you.</p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (notFound) return <PageNotFound />;

  if (failureKind) {
    return (
      <div className="service-detail-page">
        <PublicNav />
        <main className="service-detail-main">
          <RequestProblem kind={failureKind} onRetry={() => setRetryCount((count) => count + 1)} headingLevel="h1" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!service) return <PageNotFound />;

  const profile = getServiceProfile(service);
  const startingPrice = service.starting_price != null
    ? `$${Number(service.starting_price).toFixed(0)}`
    : (service.price || 'Custom');

  return (
    <div className="service-detail-page">
      <PublicNav />

      <main className="service-detail-main" id="main-content">
        {/* =====================================================
            01 — SERVICE HERO
            ===================================================== */}
        <header className="service-detail-hero" aria-label="Service Overview">
          <div className="service-detail-hero-left">
            <div className="service-detail-eyebrow-wrap">
              <span className="service-detail-eyebrow">{profile.category || 'FORMANT SERVICE'}</span>
              <span className="service-detail-badge">BESPOKE</span>
            </div>

            <h1 className="service-detail-hero-title">{service.name}</h1>

            <p className="service-detail-hero-desc">
              {profile.tagline || service.description}
            </p>

            <div className="service-detail-hero-actions">
              <button
                type="button"
                className="service-detail-btn-primary"
                onClick={scrollToPricing}
              >
                <span>Choose a package</span>
                <span aria-hidden="true">↘</span>
              </button>

              <Link
                to="/service-selection"
                className="service-detail-btn-secondary"
              >
                <span>All services</span>
              </Link>
            </div>
          </div>

          <aside className="service-detail-hero-card" aria-label="Service Highlights">
            <div className="service-detail-card-header">
              <div className="service-detail-icon-box" aria-hidden="true">
                {getServiceIcon(service)}
              </div>
              <span className="service-detail-card-badge">EDITORIAL RIGOR</span>
            </div>

            <ul className="service-detail-card-highlights">
              <li>
                <span className="service-detail-check-bullet" aria-hidden="true">✓</span>
                <span>Target-role focused recommendations</span>
              </li>
              <li>
                <span className="service-detail-check-bullet" aria-hidden="true">✓</span>
                <span>Human editorial review from career experts</span>
              </li>
              <li>
                <span className="service-detail-check-bullet" aria-hidden="true">✓</span>
                <span>Clear revision and refinement process</span>
              </li>
              <li>
                <span className="service-detail-check-bullet" aria-hidden="true">✓</span>
                <span>Final files delivered directly to your dashboard</span>
              </li>
            </ul>

            <div className="service-detail-card-footer">
              <div className="service-detail-pricing-pill">
                <span>STARTING FROM</span>
                <strong>{startingPrice}</strong>
              </div>
              <span className="service-detail-turnaround-tag">Guaranteed Review</span>
            </div>
          </aside>
        </header>

        {/* =====================================================
            02 — PACKAGES / PRICING (MAIN DECISION SECTION)
            ===================================================== */}
        <section className="service-detail-section" id="pricing" aria-labelledby="pricing-heading">
          <div className="service-detail-section-head">
            <span className="service-detail-section-eyebrow">PACKAGES & PRICING</span>
            <h2 id="pricing-heading" className="service-detail-section-title">
              Select your level of support.
            </h2>
            <p className="service-detail-section-sub">
              Every package includes dedicated human review, target-role calibration, and direct dashboard delivery.
            </p>
          </div>

          {packages.length > 0 ? (
            <div className="service-detail-packages-grid">
              {packages.map((pkg) => (
                <article className="service-pkg-card" key={pkg.id}>
                  <div>
                    <span className="service-pkg-index">
                      PACKAGE {String(pkg.sort_order || 1).padStart(2, '0')}
                    </span>
                    <h3 className="service-pkg-name">{pkg.name}</h3>
                    <p className="service-pkg-desc">{pkg.description}</p>
                  </div>

                  <div className="service-pkg-bottom">
                    <span className="service-pkg-price">
                      {pkg.currency === 'USD' ? '$' : `${pkg.currency || 'USD'} `}
                      {Number(pkg.price).toFixed(0)}
                    </span>

                    <button
                      type="button"
                      className="service-pkg-btn"
                      onClick={() => openPackage(pkg)}
                      disabled={!service.accept_orders}
                    >
                      <span>{service.accept_orders ? 'Choose package' : 'Orders paused'}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="service-detail-pricing-box">
              <span className="service-detail-pricing-box-label">STARTING FROM</span>
              <p className="service-detail-pricing-box-val">{startingPrice}</p>
              <button
                type="button"
                className="service-detail-btn-primary"
                onClick={() => {
                  if (service.accept_orders) {
                    openPackage({
                      id: service.id,
                      name: `${service.name} Standard Package`,
                      price: service.starting_price || 49,
                      currency: 'USD'
                    });
                  }
                }}
                disabled={!service.accept_orders}
              >
                <span>{service.accept_orders ? 'Start this service' : 'Orders paused'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )}
        </section>

        {/* =====================================================
            03 — FINAL CTA
            ===================================================== */}
        <section className="service-detail-final-cta" aria-label="Get Started Call to Action">
          <div className="service-detail-final-inner">
            <span className="service-detail-final-kicker">READY TO GET STARTED?</span>
            <h2 className="service-detail-final-title">
              Choose the package that fits what you need.
            </h2>
            <p className="service-detail-final-desc">
              Every engagement starts from the same high-standard, target-role focused approach.
            </p>

            <div className="service-detail-final-actions">
              <button
                type="button"
                className="service-detail-final-btn"
                onClick={scrollToPricing}
              >
                <span>Choose a package</span>
                <span aria-hidden="true">→</span>
              </button>

              <Link to="/service-selection" className="service-detail-final-back">
                <span>← Back to Services</span>
              </Link>
            </div>
          </div>
        </section>

        {/* =====================================================
            ORDER MODAL OVERLAY (PRESERVED)
            ===================================================== */}
        {selectedPackage && (
          <div
            className="order-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-confirmation-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closePackage();
            }}
          >
            <div className="order-modal-card">
              <div className="order-modal-top">
                <div>
                  <span className="order-modal-kicker">ORDER REVIEW</span>
                  <h2 id="order-confirmation-title">Ready to start?</h2>
                </div>

                <button
                  type="button"
                  className="order-modal-close"
                  onClick={closePackage}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="order-summary">
                <div>
                  <span>SERVICE</span>
                  <strong>{service.name}</strong>
                </div>

                <div>
                  <span>PACKAGE</span>
                  <strong>{selectedPackage.name}</strong>
                </div>

                <div>
                  <span>PRICE</span>
                  <strong>
                    {selectedPackage.currency === 'USD'
                      ? '$'
                      : `${selectedPackage.currency || 'USD'} `}
                    {Number(selectedPackage.price).toFixed(0)}
                  </strong>
                </div>
              </div>

              <label className="order-notes-field">
                <span>Anything we should know? <em>Optional</em></span>
                <textarea
                  value={orderNotes}
                  onChange={(event) => setOrderNotes(event.target.value)}
                  rows="4"
                  placeholder="Tell us about the target role, deadline, or anything else that would help us understand your goals."
                />
              </label>

              {orderError && (
                <div className="order-modal-error" role="alert">
                  {orderError}
                </div>
              )}

              <div className="order-modal-bottom">
                <p>
                  {service.accept_orders
                    ? 'Secure payment is not available yet. Order placement is paused until payment can be verified.'
                    : 'This service is not accepting orders right now.'}
                </p>

                <button
                  type="button"
                  className="btn lime"
                  onClick={continueToCheckout}
                  disabled={!service.accept_orders}
                >
                  {service.accept_orders ? 'Continue to checkout ↗' : 'Orders unavailable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            CHECKOUT OVERLAY (PRESERVED)
            ===================================================== */}
        {checkoutOpen && selectedPackage && (
          <div
            className="checkout-overlay"
            style={{ zIndex: 2000 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeCheckout();
            }}
          >
            <div className="checkout-card">
              <div className="checkout-top">
                <div>
                  <span className="order-modal-kicker">ORDER CHECKOUT</span>
                  <h2 id="checkout-title">Complete your order.</h2>
                </div>

                <button
                  type="button"
                  className="order-modal-close"
                  onClick={closeCheckout}
                  aria-label="Close checkout"
                >
                  ×
                </button>
              </div>

              <div className="checkout-summary">
                <div className="checkout-service">
                  <span>SERVICE</span>
                  <strong>{service.name}</strong>
                </div>

                <div className="checkout-package">
                  <span>PACKAGE</span>
                  <strong>{selectedPackage.name}</strong>
                </div>
              </div>

              <div className="checkout-total">
                <span>TOTAL</span>
                <strong>
                  {selectedPackage.currency === 'USD'
                    ? '$'
                    : `${selectedPackage.currency || 'USD'} `}
                  {Number(selectedPackage.price).toFixed(0)}
                </strong>
              </div>

              <div className="checkout-payment-placeholder">
                <span className="checkout-payment-label">PAYMENT STATUS</span>
                <div className="checkout-payment-box">
                  <div>
                    <strong>Payment provider not connected</strong>
                    <p>
                      Order placement is paused. A verified payment must be
                      recorded before an order can be created.
                    </p>
                  </div>
                  <span>↗</span>
                </div>
              </div>

              {orderError && (
                <div className="order-modal-error" role="alert">
                  {orderError}
                </div>
              )}

              <div className="checkout-bottom">
                <p>
                  No order will be created until payment verification is available.
                </p>

                <button
                  type="button"
                  className="btn lime"
                  disabled
                >
                  Order placement unavailable
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export { ServiceDetail };
