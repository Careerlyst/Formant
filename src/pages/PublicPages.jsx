import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import { services as fallbackServices } from '../lib/store';
import { supabase } from '../lib/supabase';


/* =========================================================
   SERVICES
   ========================================================= */

export function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadServices() {
      if (!supabase) {
        if (mounted) {
          setServices(fallbackServices);
          setLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from('services')
        .select('id, slug, name, description, starting_price, active')
        .eq('active', true)
        .order('created_at', { ascending: true });

      if (!mounted) return;

      if (queryError) {
        console.error('Services load error:', queryError);
        setError('We could not load our services right now.');
        setServices([]);
      } else {
        setServices(data || []);
      }

      setLoading(false);
    }

    loadServices();

    return () => {
      mounted = false;
    };
  }, []);

  const displayServices = services.map((service) => ({
    ...service,
    id: service.slug,
    desc: service.description || '',
    price: service.starting_price != null
      ? `$${Number(service.starting_price).toFixed(0)}`
      : 'Custom'
  }));

  return (
    <>
      <PublicNav />

      <main className="services-page">

        {/* =====================================================
            SERVICES HERO
            ===================================================== */}

        <section className="services-hero">

          <div className="services-hero-inner">

            <div className="services-hero-copy">

              <p className="eyebrow">
                CAREERLYST SERVICES
              </p>

              <h1>
                Build the professional
                <br />
                profile your <span>role</span> expects.
              </h1>

              <p className="services-hero-lede">
                Choose what you need to move forward. Every service is
                prepared around your target role, experience and goals —
                not pulled from a template.
              </p>

            </div>


            <div className="services-hero-meta">

              <span className="services-meta-number">
                {String(displayServices.length || 0).padStart(2, '0')}
              </span>

              <p>
                Core services designed to make your
                professional profile clearer, stronger
                and more consistent.
              </p>

            </div>

          </div>

        </section>


        {/* =====================================================
            SERVICE CATALOGUE
            ===================================================== */}

        <section className="services-catalogue">

          <div className="services-catalogue-head">

            <div>

              <p className="eyebrow">
                WHAT WE DO
              </p>

              <h2>
                One profile.
                <br />
                Every important piece.
              </h2>

            </div>


            <p>
              Start with one service or combine several.
              We keep the work connected so your professional
              story stays consistent across every platform.
            </p>

          </div>


          {/* SERVICE LIST */}

          {loading && (
            <div className="services-loading" role="status">
              Loading services…
            </div>
          )}

          {!loading && error && (
            <div className="services-loading services-error" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && displayServices.length === 0 && (
            <div className="services-loading">
              No services are currently available.
            </div>
          )}

          {!loading && !error && displayServices.length > 0 && (
          <div className="services-list">

            {displayServices.map((s, i) => (

              <Link
                className="service-row"
                to={`/services/${s.id}`}
                key={s.id}
              >

                {/* Number */}

                <div className="service-row-number">
                  {String(i + 1).padStart(2, '0')}
                </div>


                {/* Main information */}

                <div className="service-row-main">

                  <div className="service-row-title">

                    <h3>
                      {s.name}
                    </h3>

                    <span className="service-row-arrow">
                      ↗
                    </span>

                  </div>


                  <p>
                    {s.desc}
                  </p>

                </div>


                {/* Price */}

                <div className="service-row-price">

                  <span>
                    Starting from
                  </span>

                  <strong>
                    {s.price}
                  </strong>

                </div>

              </Link>

            ))}

          </div>
          )}

        </section>


        {/* =====================================================
            SERVICES CTA
            ===================================================== */}

        <section className="services-cta">

          <div className="services-cta-inner">

            <div>

              <p className="eyebrow">
                NOT SURE WHERE TO START?
              </p>

              <h2>
                Tell us the role
                <br />
                you're <span>targeting.</span>
              </h2>

            </div>


            <div className="services-cta-action">

              <p>
                We'll help you understand which services
                make the most sense for your application.
              </p>

              <Link
                className="btn lime"
                to="/signup"
              >
                Start your profile
                <span>→</span>
              </Link>

            </div>

          </div>

        </section>

      </main>

      <Footer />
    </>
  );
}


/* =========================================================
   SERVICE DETAIL
   ========================================================= */

export function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadService() {
      if (!supabase) {
        const fallback = fallbackServices.find(
          (item) => item.id === id || item.slug === id
        ) || fallbackServices[0];

        if (mounted) {
          setService(fallback ? {
            ...fallback,
            slug: fallback.slug || fallback.id,
            description: fallback.description || fallback.desc || '',
            starting_price: fallback.starting_price ?? null
          } : null);
          setLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from('services')
        .select('id, slug, name, description, starting_price, active')
        .eq('slug', id)
        .eq('active', true)
        .maybeSingle();

      if (!mounted) return;

      if (queryError) {
        console.error('Service detail load error:', queryError);
        setError('We could not load this service right now.');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('This service could not be found.');
        setLoading(false);
        return;
      }

      const { data: packageData, error: packageError } = await supabase
        .from('service_packages')
        .select('id, name, description, price, currency, active, sort_order')
        .eq('service_id', data.id)
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (!mounted) return;

      if (packageError) {
        console.error('Service packages load error:', packageError);
        setError('We could not load the packages for this service.');
        setLoading(false);
        return;
      }

      setService(data);
      setPackages(packageData || []);
      setLoading(false);
    }

    loadService();

    return () => {
      mounted = false;
    };
  }, [id]);

  function openPackage(pkg) {
    setOrderError('');
    setOrderNotes('');
    setOrderSuccess(null);
    setSelectedPackage(pkg);
  }

  function closePackage() {
    if (ordering) return;
    setSelectedPackage(null);
    setOrderError('');
    setCheckoutOpen(false);
  }

  function continueToCheckout() {
    if (!selectedPackage || !service) return;
    setOrderError('');
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    if (ordering) return;
    setCheckoutOpen(false);
    setOrderError('');
  }

  async function handleCreateOrder() {
    if (!selectedPackage || !service) return;

    setOrdering(true);
    setOrderError('');

    try {
      if (!supabase) {
        navigate(
          `/signup?service=${encodeURIComponent(service.slug)}&package=${encodeURIComponent(selectedPackage.id)}`
        );
        return;
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.user) {
        navigate(
          `/signup?service=${encodeURIComponent(service.slug)}&package=${encodeURIComponent(selectedPackage.id)}`
        );
        return;
      }

      /*
       * Order creation goes through a database function rather than a
       * browser-side capacity check. This keeps queue assignment and the
       * 2-active-project limit server-controlled.
       */
      const { data, error: createError } = await supabase.rpc(
        'create_careerlyst_order',
        {
          p_service_name: service.name,
          p_package_name: selectedPackage.name,
          p_total: Number(selectedPackage.price),
          p_currency: selectedPackage.currency || 'USD',
          p_client_notes: orderNotes.trim() || null
        }
      );

      if (createError) {
        console.error('Order creation error:', createError);

        if (
          createError.message?.includes('create_careerlyst_order') ||
          createError.code === '42883'
        ) {
          throw new Error(
            'Order system is not connected yet. Run the Careerlyst order SQL migration in Supabase, then try again.'
          );
        }

        throw new Error(
          createError.message || 'We could not create your order right now.'
        );
      }

      const createdOrder = Array.isArray(data) ? data[0] : data;

      setOrderSuccess({
        id: createdOrder?.id,
        status: createdOrder?.status || 'pending',
        queue_position: createdOrder?.queue_position ?? null
      });
      setSelectedPackage(null);
      setOrderNotes('');
    } catch (err) {
      setOrderError(
        err?.message || 'We could not create your order right now.'
      );
    } finally {
      setOrdering(false);
    }
  }

  if (loading) {
    return (
      <>
        <PublicNav />
        <main>
          <section className="page-hero split">
            <div>
              <p className="eyebrow">CAREERLYST SERVICE</p>
              <h1>Loading…</h1>
              <p>Preparing the service details for you.</p>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  if (error || !service) {
    return (
      <>
        <PublicNav />
        <main>
          <section className="page-hero split">
            <div>
              <p className="eyebrow">CAREERLYST SERVICE</p>
              <h1>Service unavailable.</h1>
              <p>{error || 'This service could not be found.'}</p>
              <Link className="btn lime" to="/services">
                Back to services ↗
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </>
    );
  }

  const fallbackDescription = service.description || '';
  const startingPrice =
    service.starting_price != null
      ? `$${Number(service.starting_price).toFixed(0)}`
      : 'Custom';

  return (
    <>
      <PublicNav />

      <main>
        <section className="page-hero split">
          <div>
            <p className="eyebrow">CAREERLYST SERVICE</p>

            <h1>{service.name}</h1>

            <p>{fallbackDescription}</p>

            <a
              className="btn lime"
              href="#packages"
              onClick={(event) => {
                if (packages.length === 0) return;
                event.preventDefault();
                document.getElementById('packages')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
              }}
            >
              Choose a package ↘
            </a>
          </div>

          <div className="detail-note">
            <span>What you'll get</span>

            <ul>
              <li>Target-role focused recommendations</li>
              <li>Human review from our career team</li>
              <li>Clear revision process</li>
              <li>Final files delivered in your account</li>
            </ul>

            <div className="service-detail-price">
              <small>Starting from</small>
              <strong>{startingPrice}</strong>
            </div>
          </div>
        </section>

        {packages.length > 0 && (
          <section
            className="service-packages-section"
            id="packages"
          >
            <div className="service-packages-head">
              <div>
                <p className="eyebrow">CHOOSE YOUR PACKAGE</p>
                <h2>Pick the level of support you need.</h2>
              </div>

              <p>
                Every package starts from the same target-role focused,
                human-reviewed approach.
              </p>
            </div>

            <div className="service-packages-grid">
              {packages.map((pkg) => (
                <article className="service-package-card" key={pkg.id}>
                  <div>
                    <span className="service-package-index">
                      {String(pkg.sort_order).padStart(2, '0')}
                    </span>

                    <h3>{pkg.name}</h3>
                    <p>{pkg.description}</p>
                  </div>

                  <div className="service-package-bottom">
                    <strong>
                      {pkg.currency === 'USD' ? '$' : `${pkg.currency} `}
                      {Number(pkg.price).toFixed(0)}
                    </strong>

                    <button
                      type="button"
                      className="service-package-link service-package-button"
                      onClick={() => openPackage(pkg)}
                    >
                      Choose package ↗
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {orderSuccess && (
          <div className="order-success-overlay" role="dialog" aria-modal="true">
            <div className="order-success-card">
              <span className="order-modal-kicker">ORDER RECEIVED</span>

              <div className="order-success-mark">✓</div>

              <h2>
                Your project is
                <br />
                <span>in the system.</span>
              </h2>

              <p>
                We’ve received your {service.name} — {orderSuccess.status === 'queued'
                  ? 'it has been placed in the queue.'
                  : 'we’ll review the project and take it from here.'}
              </p>

              {orderSuccess.queue_position != null && (
                <div className="order-queue-note">
                  <span>QUEUE POSITION</span>
                  <strong>#{orderSuccess.queue_position}</strong>
                </div>
              )}

              <div className="order-success-actions">
                <Link className="btn lime" to="/dashboard/orders">
                  View my orders ↗
                </Link>

                <Link className="order-text-link" to="/dashboard">
                  Back to dashboard
                </Link>
              </div>
            </div>
          </div>
        )}

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
                  <h2 id="order-confirmation-title">
                    Ready to start?
                  </h2>
                </div>

                <button
                  type="button"
                  className="order-modal-close"
                  onClick={closePackage}
                  disabled={ordering}
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
                      : `${selectedPackage.currency} `}
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
                  placeholder="Tell us about the role, deadline, or anything else that would help us understand the project."
                  disabled={ordering}
                />
              </label>

              {orderError && (
                <div className="order-modal-error" role="alert">
                  {orderError}
                </div>
              )}

              <div className="order-modal-bottom">
                <p>
                  Your order will appear in your Careerlyst dashboard.
                  Payment can be completed through the payment step once
                  your order is confirmed.
                </p>

                <button
                  type="button"
                  className="btn lime"
                  onClick={continueToCheckout}
                  disabled={ordering}
                >
                  Continue to payment ↗
                </button>
              </div>
            </div>
          </div>
        )}

        {checkoutOpen && selectedPackage && (
          <div
            className="checkout-overlay"
            style={{ zIndex: 2000 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeCheckout();
              }
            }}
          >
            <div className="checkout-card">
              <div className="checkout-top">
                <div>
                  <span className="order-modal-kicker">SECURE CHECKOUT</span>
                  <h2 id="checkout-title">Complete your order.</h2>
                </div>

                <button
                  type="button"
                  className="order-modal-close"
                  onClick={closeCheckout}
                  disabled={ordering}
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
                    : `${selectedPackage.currency} `}
                  {Number(selectedPackage.price).toFixed(0)}
                </strong>
              </div>

              <div className="checkout-payment-placeholder">
                <span className="checkout-payment-label">
                  PAYMENT METHOD
                </span>

                <div className="checkout-payment-box">
                  <div>
                    <strong>Secure online payment</strong>
                    <p>
                      You’ll be redirected to our secure payment provider
                      to complete your purchase.
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
                  Your order will only be confirmed after successful payment.
                </p>

                <button
                  type="button"
                  className="btn lime"
                  onClick={() =>
                    setOrderError(
                      'Payment is not connected yet. The checkout interface is ready for the payment integration step.'
                    )
                  }
                >
                  Pay{' '}
                  {selectedPackage.currency === 'USD'
                    ? '$'
                    : `${selectedPackage.currency} `}
                  {Number(selectedPackage.price).toFixed(0)}
                  {' ↗'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

/* =========================================================
   PRICING
   ========================================================= */

export function Pricing() {
  const plans = [
    {
      name: 'Resume',
      price: 'From $19',
      description: 'A focused, role-specific resume built around the opportunity you want.',
      tag: 'ESSENTIAL',
    },
    {
      name: 'Job Profile',
      price: 'From $49',
      description: 'Resume + LinkedIn aligned around one clear target role.',
      tag: 'MOST REQUESTED',
      featured: true,
    },
    {
      name: 'Tech Profile',
      price: 'From $79',
      description: 'Resume + GitHub + portfolio direction for technical candidates.',
      tag: 'FOR TECH ROLES',
    },
    {
      name: 'Interview Ready',
      price: 'From $99',
      description: 'Profile preparation + targeted interview practice for your next opportunity.',
      tag: 'FULL PREP',
    },
  ];

  return (
    <>
      <PublicNav />

      <main className="pricing-page">

        {/* =====================================================
            PRICING HERO
            ===================================================== */}

        <section className="pricing-hero">

          <div className="pricing-hero-inner">

            <div className="pricing-hero-copy">

              <p className="eyebrow">
                PRICING
              </p>

              <h1>
                Clear starting points.
                <br />
                <span>Serious</span> work.
              </h1>

              <p className="pricing-hero-lede">
                Start with the service you need, or build a more
                complete professional profile across multiple services.
                Every project is scoped around your goals.
              </p>

            </div>


            <div className="pricing-hero-note">

              <span>
                HOW PRICING WORKS
              </span>

              <p>
                Prices shown are starting points. Your final quote
                depends on the service, scope and complexity of the work.
              </p>

            </div>

          </div>

        </section>


        {/* =====================================================
            PRICING PLANS
            ===================================================== */}

        <section className="pricing-section">

          <div className="pricing-section-head">

            <div>
              <p className="eyebrow">
                STARTING POINTS
              </p>

              <h2>
                Choose the level
                <br />
                of support you need.
              </h2>
            </div>

            <p>
              Not sure which option fits? Start your profile and
              we'll help you choose the right combination for your
              target role.
            </p>

          </div>


          <div className="pricing-list">

            {plans.map((plan, index) => (

              <div
                className={`pricing-plan ${plan.featured ? 'featured' : ''}`}
                key={plan.name}
              >

                <div className="pricing-plan-number">
                  {String(index + 1).padStart(2, '0')}
                </div>


                <div className="pricing-plan-main">

                  <div className="pricing-plan-top">

                    <span className="pricing-plan-tag">
                      {plan.tag}
                    </span>

                    {plan.featured && (
                      <span className="pricing-featured">
                        MOST REQUESTED
                      </span>
                    )}

                  </div>

                  <h3>
                    {plan.name}
                  </h3>

                  <p>
                    {plan.description}
                  </p>

                </div>


                <div className="pricing-plan-side">

                  <span>
                    Starting from
                  </span>

                  <strong>
                    {plan.price}
                  </strong>

                  <Link
                    className="pricing-plan-link"
                    to="/signup"
                  >
                    Get started
                    <span>↗</span>
                  </Link>

                </div>

              </div>

            ))}

          </div>

        </section>


        {/* =====================================================
            CUSTOM PROJECT
            ===================================================== */}

        <section className="pricing-custom">

          <div className="pricing-custom-inner">

            <div>

              <p className="eyebrow">
                CUSTOM PROJECTS
              </p>

              <h2>
                Need something
                <br />
                more <span>specific?</span>
              </h2>

            </div>


            <div className="pricing-custom-copy">

              <p>
                Some projects don't fit neatly into a package.
                If you need a custom portfolio, a broader profile
                strategy or several services working together,
                we'll scope the work with you first.
              </p>

              <Link
                className="btn light"
                to="/contact"
              >
                Discuss your project
                <span>→</span>
              </Link>

            </div>

          </div>

        </section>


        {/* =====================================================
            PRICING NOTE
            ===================================================== */}

        <section className="pricing-note">

          <div className="pricing-note-inner">

            <span>
              A NOTE ON SCOPE
            </span>

            <p>
              Every project is different. Starting prices help you
              understand the range, but the final scope is confirmed
              before work begins.
            </p>

          </div>

        </section>

      </main>

      <Footer />
    </>
  );
}

/* =========================================================
   ABOUT
   ========================================================= */

export function About() {
  const principles = [
    {
      number: '01',
      title: 'Clarity over clutter',
      text: 'Every part of your professional profile should have a reason to exist. We remove noise and make the strongest parts easier to see.'
    },
    {
      number: '02',
      title: 'Built around the role',
      text: 'A strong profile is not generic. We shape the work around the role, opportunity and direction you are actually pursuing.'
    },
    {
      number: '03',
      title: 'One coherent story',
      text: 'Your resume, LinkedIn, GitHub, portfolio and interview preparation should feel connected — not like separate pieces made at different times.'
    }
  ];

  return (
    <>
      <PublicNav />

      <main className="about-page">

        {/* HERO */}
        <section className="about-hero">
          <div className="about-hero-inner">

            <div className="about-hero-copy">
              <p className="eyebrow">ABOUT CAREERLYST</p>

              <h1>
                Your career deserves
                <br />
                <span>better preparation.</span>
              </h1>

              <p className="about-hero-lede">
                Careerlyst helps students, job seekers and professionals
                build a clearer, stronger and more credible professional
                profile — before the opportunity arrives.
              </p>
            </div>

            <div className="about-hero-meta">
              <span>OUR APPROACH</span>
              <p>
                Thoughtful strategy. Sharp positioning.
                Human review. No unnecessary complexity.
              </p>
            </div>

          </div>
        </section>


        {/* INTRO */}
        <section className="about-intro">
          <div className="about-intro-label">
            <span>01</span>
            <span>WHY WE EXIST</span>
          </div>

          <div className="about-intro-content">
            <h2>
              Good experience isn't enough
              <span> if nobody can see it.</span>
            </h2>

            <div className="about-intro-text">
              <p>
                You can have the skills, the education and the ambition —
                and still struggle to communicate what makes you valuable.
              </p>

              <p>
                Careerlyst exists to solve that gap. We turn scattered
                experience into a professional profile that is easier to
                understand, easier to trust and better aligned with the
                opportunity you want.
              </p>
            </div>
          </div>
        </section>


        {/* DARK STATEMENT */}
        <section className="about-statement">
          <div className="about-statement-inner">
            <p className="eyebrow">THE CAREERLYST STANDARD</p>

            <h2>
              Less noise.
              <br />
              More <span>signal.</span>
            </h2>

            <p>
              We believe career documents should not simply look polished.
              They should make the right information impossible to miss.
            </p>
          </div>
        </section>


        {/* PRINCIPLES */}
        <section className="about-principles">
          <div className="about-section-head">
            <div>
              <p className="eyebrow">WHAT WE BELIEVE</p>
              <h2>
                A better way to
                <br />
                prepare.
              </h2>
            </div>

            <p>
              Our work is guided by a few simple principles.
              They keep every project focused on what actually matters.
            </p>
          </div>

          <div className="about-principles-list">
            {principles.map((item) => (
              <div className="about-principle" key={item.number}>
                <span className="about-principle-number">
                  {item.number}
                </span>

                <div className="about-principle-content">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>

                <span className="about-principle-arrow">↗</span>
              </div>
            ))}
          </div>
        </section>


        {/* WHAT WE DO */}
        <section className="about-work">
          <div className="about-work-inner">

            <div className="about-work-label">
              <p className="eyebrow">WHAT WE WORK ON</p>
              <span>02</span>
            </div>

            <div className="about-work-content">
              <h2>
                From the first impression
                <br />
                to the <span>final conversation.</span>
              </h2>

              <p>
                Careerlyst brings the important parts of your professional
                presence into one direction — from your resume and LinkedIn
                profile to GitHub, portfolio and interview preparation.
              </p>

              <div className="about-work-tags">
                <span>Resume / CV</span>
                <span>LinkedIn</span>
                <span>GitHub</span>
                <span>Portfolio</span>
                <span>Cover Letter</span>
                <span>Interview Prep</span>
              </div>
            </div>

          </div>
        </section>


        {/* TEAM */}
        <section className="about-team">
          <div className="about-team-inner">

            <div className="about-team-copy">
              <p className="eyebrow">HOW WE WORK</p>

              <h2>
                Small team.
                <br />
                <span>Serious attention.</span>
              </h2>
            </div>

            <div className="about-team-text">
              <p>
                Careerlyst is intentionally focused. Rather than treating
                career preparation like a high-volume template service,
                we keep the work selective and hands-on.
              </p>

              <p>
                That means each project gets thoughtful attention,
                clear communication and a professional standard from
                beginning to delivery.
              </p>
            </div>

          </div>
        </section>


        {/* CTA */}
        <section className="about-cta">
          <div className="about-cta-inner">

            <div>
              <p className="eyebrow">READY WHEN YOU ARE</p>

              <h2>
                Build a profile
                <br />
                that <span>moves you forward.</span>
              </h2>
            </div>

            <div className="about-cta-action">
              <p>
                Tell us where you want to go.
                We'll help you prepare for it.
              </p>

              <Link className="btn light" to="/signup">
                Start your profile <span>→</span>
              </Link>
            </div>

          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}


/* =========================================================
   CONTACT
   ========================================================= */


const SERVICE_OPTIONS = [
  'Resume / CV',
  'LinkedIn',
  'GitHub',
  'Portfolio',
  'Cover Letter',
  'Interview Preparation',
];

export function Contact() {
  const [selectedServices, setSelectedServices] = useState([]);
  const [serviceOpen, setServiceOpen] = useState(false);
  const serviceRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        serviceRef.current &&
        !serviceRef.current.contains(event.target)
      ) {
        setServiceOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const toggleService = (service) => {
    setSelectedServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service]
    );
  };

  const serviceLabel =
    selectedServices.length === 0
      ? 'Select services'
      : selectedServices.length === 1
        ? selectedServices[0]
        : `${selectedServices.length} services selected`;

  return (
    <>
      <PublicNav />

      <main className="contact-page">

        {/* HERO */}
        <section className="contact-hero">
          <div className="contact-hero-inner">

            <div className="contact-hero-copy">
              <p className="eyebrow">CONTACT</p>

              <h1>
                Have a goal?
                <br />
                <span>Let’s work towards it.</span>
              </h1>

              <p className="contact-hero-lede">
                Tell us what you are working towards and where you need help.
                We’ll take a look and guide you towards the right service.
              </p>
            </div>

            <div className="contact-hero-meta">
              <span>01</span>
              <p>
                Start with a short project enquiry.
                No commitment required.
              </p>
            </div>

          </div>
        </section>


        {/* CONTACT SECTION */}
        <section className="contact-section">

          <div className="contact-section-head">
            <div>
              <p className="eyebrow">PROJECT ENQUIRY</p>

              <h2>
                Let’s understand
                <br />
                what you need.
              </h2>
            </div>

            <p>
              Choose everything you would like help with.
              You can select more than one service.
            </p>
          </div>


          <div className="contact-grid">

            {/* DETAILS */}
            <div className="contact-details">

              <div className="contact-detail-block">
                <span>GENERAL ENQUIRIES</span>

                <a href="mailto:hello@careerlyst.com">
                  hello@careerlyst.com
                </a>
              </div>

              <div className="contact-detail-block">
                <span>RESPONSE TIME</span>

                <p>
                  We usually respond within
                  1–2 business days.
                </p>
              </div>

              <div className="contact-detail-block">
                <span>NOT SURE?</span>

                <p>
                  That’s okay. Tell us about your
                  situation and we’ll help you figure
                  out where to start.
                </p>
              </div>

            </div>


            {/* FORM */}
            <div className="contact-form-card">

              <div className="contact-form-top">
                <span>01</span>
                <p>YOUR PROJECT</p>
              </div>

              <form>

                {/* NAME */}
                <div className="contact-field">
                  <label htmlFor="contact-name">
                    Your name
                  </label>

                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    placeholder="Your full name"
                    required
                  />
                </div>


                {/* EMAIL */}
                <div className="contact-field">
                  <label htmlFor="contact-email">
                    Email address
                  </label>

                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    required
                  />
                </div>


                {/* CUSTOM MULTI SELECT */}
                <div
                  className="contact-field"
                  ref={serviceRef}
                >
                  <label>
                    What can we help with?
                  </label>

                  <div className="service-select">

                    <button
                      type="button"
                      className={`service-select-trigger ${
                        serviceOpen ? 'is-open' : ''
                      } ${
                        selectedServices.length
                          ? 'has-value'
                          : ''
                      }`}
                      onClick={() =>
                        setServiceOpen((open) => !open)
                      }
                      aria-expanded={serviceOpen}
                    >
                      <span>
                        {serviceLabel}
                      </span>

                      <span
                        className={`service-select-chevron ${
                          serviceOpen ? 'rotate' : ''
                        }`}
                      >
                        ↓
                      </span>
                    </button>


                    {serviceOpen && (
                      <div className="service-select-menu">

                        <div className="service-select-heading">
                          <span>
                            SELECT SERVICES
                          </span>

                          {selectedServices.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedServices([])
                              }
                            >
                              Clear
                            </button>
                          )}
                        </div>


                        <div className="service-options">

                          {SERVICE_OPTIONS.map(
                            (service, index) => {

                              const selected =
                                selectedServices.includes(
                                  service
                                );

                              return (
                                <button
                                  type="button"
                                  key={service}
                                  className={`service-option ${
                                    selected
                                      ? 'selected'
                                      : ''
                                  }`}
                                  onClick={() =>
                                    toggleService(service)
                                  }
                                >

                                  <span className="service-option-number">
                                    {String(index + 1).padStart(
                                      2,
                                      '0'
                                    )}
                                  </span>

                                  <span className="service-option-name">
                                    {service}
                                  </span>

                                  <span className="service-option-check">
                                    {selected ? '✓' : ''}
                                  </span>

                                </button>
                              );
                            }
                          )}

                        </div>

                      </div>
                    )}

                  </div>


                  {/* Hidden field for form submission */}
                  <input
                    type="hidden"
                    name="services"
                    value={selectedServices.join(', ')}
                  />

                  <p className="contact-field-hint">
                    Select one or more services.
                  </p>
                </div>


                {/* MESSAGE */}
                <div className="contact-field">
                  <label htmlFor="contact-message">
                    Tell us about your project
                  </label>

                  <textarea
                    id="contact-message"
                    name="message"
                    rows="6"
                    placeholder="What are you working towards?"
                  />
                </div>


                {/* SUBMIT */}
                <button
                  type="submit"
                  className="contact-submit"
                >
                  <span>Send enquiry</span>
                  <span>→</span>
                </button>

              </form>

            </div>

          </div>

        </section>


        {/* CTA */}
        <section className="contact-closing">
          <div className="contact-closing-inner">

            <div>
              <p className="eyebrow">READY WHEN YOU ARE</p>

              <h2>
                Build a profile
                <br />
                that moves you <span>forward.</span>
              </h2>
            </div>

            <Link
              className="btn light"
              to="/signup"
            >
              Start your profile
              <span>→</span>
            </Link>

          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}
/* =========================================================
   LEGAL
   ========================================================= */

export function Legal({ type }) {

  const title =
    type === 'privacy'
      ? 'Privacy Policy'
      : type === 'terms'
        ? 'Terms of Service'
        : 'Refund Policy';


  return (
    <>
      <PublicNav />

      <main>

        <section className="page-hero">

          <p className="eyebrow">
            CAREERLYST
          </p>

          <h1>
            {title}
          </h1>

          <p>
            Starter policy page. Replace this with your final
            jurisdiction-specific legal text before launch.
          </p>

        </section>


        <section className="section legal">

          <h2>
            Overview
          </h2>

          <p>
            This page is a product placeholder and should be reviewed
            by a qualified professional before public launch.
          </p>


          <h2>
            Information and communication
          </h2>

          <p>
            Careerlyst may collect account, project, payment and
            communication information necessary to provide purchased
            services.
          </p>


          <h2>
            Contact
          </h2>

          <p>
            For questions about this policy, contact your Careerlyst team.
          </p>

        </section>

      </main>

      <Footer />
    </>
  );
}