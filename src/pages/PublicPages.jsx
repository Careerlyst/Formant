import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import SkeletonState from '../components/SkeletonState';
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
        .select('id, slug, name, description, starting_price, active, show_on_services_page')
        .eq('active', true)
        .eq('show_on_services_page', true)
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
                FORMANT SERVICES
              </p>

              <h1>
                Career services for
                <br />
                the role you <span>are targeting.</span>
              </h1>

              <p className="services-hero-lede">
                Choose support for your CV, LinkedIn, GitHub, portfolio,
                cover letter or interview preparation. Each service page
                explains what it includes.
              </p>

            </div>


            <div className="services-hero-meta">

              <span className="services-meta-number">
                {String(displayServices.length || 0).padStart(2, '0')}
              </span>

              <p>
                Choose one service or combine related work for the same
                target role.
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
                Choose what
                <br />
                to work on.
              </h2>

            </div>


            <p>
              Each listing shows the service scope and starting price.
            </p>

          </div>


          {/* SERVICE LIST */}

          {loading && <div className="services-loading"><SkeletonState label="Loading services" variant="rows" count={3} /></div>}

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
                NOT SURE WHICH SERVICE FITS?
              </p>

              <h2>
                Start with the role
                <br />
                you are <span>targeting.</span>
              </h2>

            </div>


            <div className="services-cta-action">

              <p>
                Create an account, note the role you are preparing for, and choose services to discuss.
              </p>

              <Link
                className="btn lime"
                to="/signup"
              >
                Create your account
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

export { default as ServiceDetail } from './ServiceDetail';

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
                Compare starting prices for individual services and bundles.
              </p>

            </div>


            <div className="pricing-hero-note">

              <span>
                HOW PRICING WORKS
              </span>

              <p>
                Prices are starting points. Final quotes depend on the service, scope and complexity; we confirm the scope before work begins.
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
              Review what each package includes before choosing.
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


      </main>

      <Footer />
    </>
  );
}

/* =========================================================
   ABOUT
   ========================================================= */

export function About() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadServices() {
      if (!supabase) {
        if (mounted) {
          setServices(fallbackServices);
          setServicesLoading(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from('services')
        .select('id, slug, name, description, active, show_on_services_page')
        .eq('active', true)
        .eq('show_on_services_page', true)
        .order('created_at', { ascending: true });

      if (!mounted) return;

      if (queryError) {
        console.error('About services load error:', queryError);
        setServicesError('We could not load services right now.');
        setServices([]);
      } else {
        setServices(data || []);
      }

      setServicesLoading(false);
    }

    loadServices();

    return () => {
      mounted = false;
    };
  }, []);

  const approachPrinciples = [
    {
      number: '01',
      title: 'Personalized support',
      text: 'Guidance shaped around your needs and goals.'
    },
    {
      number: '02',
      title: 'Practical feedback',
      text: 'Clear, useful input to help you improve how you present your experience.'
    },
    {
      number: '03',
      title: 'Open communication',
      text: 'A welcoming space to ask questions and talk through what feels unclear.'
    },
    {
      number: '04',
      title: 'Transparent expectations',
      text: 'Clear information about what a service includes and what to expect.'
    }
  ];

  const displayServices = services
    .map((service) => ({
      ...service,
      routeId: service.slug || (!supabase ? service.id : ''),
      description: service.description || service.desc || ''
    }))
    .filter((service) => service.routeId && service.name);

  return (
    <>
      <PublicNav />

      <main className="about-page">

        {/* HERO */}
        <section className="about-hero">
          <div className="about-hero-inner">

            <div className="about-hero-copy">
              <p className="eyebrow">ABOUT FORMANT</p>

              <h1>
                You have the experience.
                <br />
                <span>Let’s help you show it.</span>
              </h1>

              <p className="about-hero-lede">
                Your CV, portfolio, and professional profiles should reflect what you can
                actually do. Formant helps you present your experience more clearly, work
                through the things you’re unsure about, and take your next step with greater
                confidence.
              </p>

              <Link className="btn lime about-hero-cta" to="/services">
                Explore our services <span aria-hidden="true">↗</span>
              </Link>
            </div>

            <div className="about-hero-art" aria-hidden="true">
              <img
                className="about-hero-art-image"
                src="/assets/Friendly%20Team%20Workspace%20Illustration.png"
                alt=""
              />
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
              Doing the work is one thing.
              <span> Showing it is another.</span>
            </h2>

            <div className="about-intro-text">
              <p>
                You might have skills but struggle to put them into a strong CV. You might
                want a portfolio but not know where to start. Or perhaps you’re unsure
                whether your LinkedIn or GitHub profile really represents you.
              </p>

              <p>
                And when an interview comes around, that uncertainty can follow you into
                the room. You don’t need to have everything figured out before asking for help.
              </p>
            </div>
          </div>
        </section>


        {/* OUR PURPOSE */}
        <section className="about-statement">
          <div className="about-statement-inner">
            <div className="about-purpose-content">
              <p className="eyebrow">THE FORMANT STANDARD</p>

              <h2>
                A clearer way to present
                <br />
                your <span>professional self.</span>
              </h2>

              <div className="about-purpose-copy">
                <p>
                  A CV, profile or portfolio should do more than list titles and dates. It
                  should make your skills, decisions and contribution easier to understand.
                </p>
                <p>
                  We help you decide what to emphasize and organize it for the role or
                  opportunity you are preparing for.
                </p>
              </div>
            </div>
            <img
              className="about-purpose-illustration"
              src="/assets/Confident%20Professional%20Portfolio%20Illustration.png"
              alt="A professional holding a portfolio, surrounded by examples of career documents and creative work."
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>


        {/* WHAT WE DO */}
        <section className="about-work">
          <div className="about-work-inner">

            <div className="about-work-label">
              <p className="eyebrow">SERVICES</p>
              <span>02</span>
            </div>

            <div className="about-work-content">
              <h2>
                Support for the parts
                <br />
                you’re <span>figuring out.</span>
              </h2>

              <p>
                You don’t need the same kind of help at every stage. Start with the area
                you want to improve.
              </p>

              {servicesLoading ? (
                <SkeletonState label="Loading services" variant="services" count={3} className="about-services-status" />
              ) : servicesError ? (
                <p className="about-services-status" role="status">
                  We could not load the service list. <Link to="/services">View services</Link>
                </p>
              ) : displayServices.length === 0 ? (
                <p className="about-services-status" role="status">
                  No services are available to display right now. <Link to="/services">View services</Link>
                </p>
              ) : (
                <div className="about-services-list">
                  {displayServices.map((service) => (
                    <Link
                      className="about-service-link"
                      key={service.id || service.routeId}
                      to={`/services/${service.routeId}`}
                    >
                      <span className="about-service-link-copy">
                        <strong>{service.name}</strong>
                        {service.description && <span>{service.description}</span>}
                      </span>
                      <span className="about-service-link-arrow" aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        </section>


        {/* APPROACH */}
        <section className="about-team">
          <div className="about-team-inner">

            <div className="about-team-copy">
              <p className="eyebrow">HOW WE WORK</p>

              <h2>
                Good support starts
                <br />
                <span>with a conversation.</span>
              </h2>
            </div>

            <div className="about-team-text">
              <p>
                We start with the role or opportunity you have in mind, then agree which
                materials and services to focus on.
              </p>

              <ul className="about-approach-list">
                {approachPrinciples.map((item) => (
                  <li key={item.number}>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </section>


        {/* PRINCIPLES */}
        <section className="about-principles">
          <div className="about-section-head">
            <div>
              <p className="eyebrow">OUR PRINCIPLES</p>
              <h2>Honest about the work.<br /><span>Serious about the quality.</span></h2>
            </div>

            <p>
              We won’t promise you a guaranteed job, a perfect interview, or an overnight
              transformation. What we can focus on is helping you present yourself more
              clearly, providing practical support, and being transparent about what our
              services include.
            </p>
          </div>

        </section>


        {/* CTA */}
        <section className="about-cta">
          <div className="about-cta-inner">

            <div>
              <p className="eyebrow">READY WHEN YOU ARE</p>

              <h2>
                Want to compare
                <br />
                the <span>options?</span>
              </h2>
            </div>

            <div className="about-cta-action">
              <p>
                Review each service’s scope and starting price, then choose what you want to discuss.
              </p>

              <Link className="btn light" to="/services">
                Explore services <span>→</span>
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
                Preparing for a role?
                <br />
                <span>Tell us what you need.</span>
              </h1>

              <p className="contact-hero-lede">
                Send a short enquiry about your target role and the support you need.
                Select any services you would like to discuss.
              </p>
            </div>

            <div className="contact-hero-meta">
              <span>01</span>
              <p>
                Send an enquiry; we’ll follow up about your request.
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
                Tell us about
                <br />
                your project.
              </h2>
            </div>

            <p>
              Select one or more services. Add context in the message field below.
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
                  Describe what you are preparing for and what kind of support you need.
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
                Choose the support
                <br />
                for your <span>next role.</span>
              </h2>
            </div>

            <Link
              className="btn light"
              to="/signup"
            >
              Create your account
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
            FORMANT
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
            Formant may collect account, project, payment and
            communication information necessary to provide purchased
            services.
          </p>


          <h2>
            Contact
          </h2>

          <p>
            For questions about this policy, contact your Formant team.
          </p>

        </section>

      </main>

      <Footer />
    </>
  );
}
