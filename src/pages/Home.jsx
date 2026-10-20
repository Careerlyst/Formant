import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { load } from '../lib/store';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import { services } from '../lib/store';
import { FeaturedShowcase } from './Showcase';

const serviceDescriptions = Object.fromEntries(
  services.map(({ id, desc }) => [id, desc])
);

function PublicHome({ user = null, profileName = '' }) {
  const firstName =
    profileName?.split(' ')[0] ||
    user?.user_metadata?.name?.split(' ')[0] ||
    user?.user_metadata?.full_name?.split(' ')[0] ||
    user?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';

  const [heroIllustration, setHeroIllustration] = useState(() =>
    document.documentElement.dataset.theme === 'dark'
      ? '/assets/hero-illustration-dark.png'
      : '/assets/hero-illustration.png'
  );

  useEffect(() => {
    const root = document.documentElement;

    const updateHeroIllustration = () => {
      setHeroIllustration(
        root.dataset.theme === 'dark'
          ? '/assets/hero-illustration-dark.png'
          : '/assets/hero-illustration.png'
      );
    };

    updateHeroIllustration();

    const observer = new MutationObserver(updateHeroIllustration);

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <PublicNav />

      <main>
        {/* =========================
            HERO
        ========================== */}
        <section className="hero">
          <div className="hero-grid">

            <div className="hero-copy">
              <p className="eyebrow">
                {user ? 'YOUR FORMANT. YOUR NEXT MOVE.' : 'CAREER MATERIALS FOR YOUR NEXT ROLE'}
              </p>

              <h1>
                {user ? (
                  <>
                    Welcome back,
                    <br />
                    <span>{firstName}.</span>
                  </>
                ) : (
                  <>
                    Present your experience
                    <br />
                    for the role <span>you want.</span>
                  </>
                )}
              </h1>

              <p className="lede">
                {user
                  ? 'Manage your profile, review current projects and choose another service.'
                  : 'Get help preparing the documents, profiles and interview materials for your job search.'}
              </p>

              <div className="actions">
                <Link className="btn lime" to={user ? '/services' : '/signup'}>
                  {user ? 'Browse services' : 'Create your account'} <span>↗</span>
                </Link>

                <a className="watch" href="#process">
                  <span>▶</span>
                  See how it works
                </a>
              </div>

              <p className="micro">
                <i />
                {user
                  ? 'Choose one service or bring several into the same career story.'
                  : 'Built by career experts. Designed around your target role.'}
              </p>
            </div>

            <div className="hero-art">
              <img
                src={heroIllustration}
                alt="Formant career preparation illustration"
              />
            </div>

          </div>
        </section>


        {/* =========================
            HOW IT WORKS
        ========================== */}
        <section className="process-section" id="process">
          <div id="how-it-works" style={{ position: 'relative', top: '-80px', visibility: 'hidden' }} />

          <div className="process-intro">

            <div className="process-heading">
              <p className="eyebrow">
                HOW IT WORKS
              </p>

              <h2>
                A three-step process{' '}
                <br />
                <span>from brief to delivery.</span>
              </h2>
            </div>

            <div className="process-index">
              <span>PROCESS</span>
              <strong>01 — 03</strong>
            </div>

          </div>


          <div className="process-list">

            {/* STEP 01 */}
            <div className="process-item">

              <div className="process-number">
                01
              </div>

              <div className="process-content">
                <h3>
                  Tell us what you are aiming for.
                </h3>

                <p>
                  Share the role, industry or opportunity you are preparing
                  for, and tell us where you need support.
                </p>
              </div>

              <div className="process-mark">
                ↗
              </div>

            </div>


            {/* STEP 02 */}
            <div className="process-item">

              <div className="process-number">
                02
              </div>

              <div className="process-content">
                <h3>
                  Choose the materials to work on.
                </h3>

                <p>
                  We tailor the services you choose to the role or opportunity
                  you are preparing for.
                </p>
              </div>

              <div className="process-mark">
                ↗
              </div>

            </div>


            {/* STEP 03 */}
            <div className="process-item">

              <div className="process-number">
                03
              </div>

              <div className="process-content">
                <h3>
                  Review your work with us.
                </h3>

                <p>
                  Use your Formant account to share feedback, request
                  revisions and receive the finished files.
                </p>
              </div>

              <div className="process-mark">
                ↗
              </div>

            </div>

          </div>

        </section>


        {/* =========================
            SERVICES
        ========================== */}
        <section className="home-services" aria-labelledby="home-services-title">
          <div className="home-services-heading">
            <div>
              <span className="service-label">SERVICES</span>
              <h2 id="home-services-title">
                Career support,
                <br />
                for the role <span>ahead.</span>
              </h2>
            </div>
            <p>
              Choose one service or combine several around the role you are targeting.
            </p>
          </div>

          <div className="home-services-grid">
            <Link to="/services/resume" className="career-service-card light-card">
              <div className="career-card-top"><span aria-hidden="true">01</span></div>
              <div className="career-card-main">
                <div className="career-card-copy">
                  <h3 className="career-card-title">Resume / CV</h3>
                  <p className="career-card-description">{serviceDescriptions.resume}</p>
                </div>
                <div className="career-visual resume-visual" aria-hidden="true">
                  <div className="resume-paper"><i></i><i></i><i></i><i></i></div>
                </div>
              </div>
              <span className="career-card-cta">Learn more <span aria-hidden="true">↗</span></span>
            </Link>

            <Link to="/services/linkedin" className="career-service-card light-card is-text-led">
              <div className="career-card-top"><span aria-hidden="true">02</span></div>
              <div className="career-card-main is-text-led">
                <div className="career-card-copy">
                  <h3 className="career-card-title">LinkedIn</h3>
                  <p className="career-card-description">{serviceDescriptions.linkedin}</p>
                </div>
              </div>
              <span className="career-card-cta">Learn more <span aria-hidden="true">↗</span></span>
            </Link>

            <Link to="/services/github" className="career-service-card light-card">
              <div className="career-card-top"><span aria-hidden="true">03</span></div>
              <div className="career-card-main">
                <div className="career-card-copy">
                  <h3 className="career-card-title">GitHub</h3>
                  <p className="career-card-description">{serviceDescriptions.github}</p>
                </div>
                <div className="career-visual github-visual" aria-hidden="true">
                  <div className="github-box"><span>&lt;/&gt;</span></div>
                  <div className="github-lines"><i></i><i></i><i></i></div>
                </div>
              </div>
              <span className="career-card-cta">Learn more <span aria-hidden="true">↗</span></span>
            </Link>

            <Link to="/services/portfolio" className="career-service-card light-card">
              <div className="career-card-top"><span aria-hidden="true">04</span></div>
              <div className="career-card-main">
                <div className="career-card-copy">
                  <h3 className="career-card-title">Portfolio</h3>
                  <p className="career-card-description">{serviceDescriptions.portfolio}</p>
                </div>
                <div className="career-visual portfolio-visual" aria-hidden="true">
                  <div className="portfolio-window"><b></b><i></i><i></i></div>
                </div>
              </div>
              <span className="career-card-cta">Learn more <span aria-hidden="true">↗</span></span>
            </Link>

            <Link to="/services/cover-letter" className="career-service-card light-card is-text-led">
              <div className="career-card-top"><span aria-hidden="true">05</span></div>
              <div className="career-card-main is-text-led">
                <div className="career-card-copy">
                  <h3 className="career-card-title">Cover Letter</h3>
                  <p className="career-card-description">{serviceDescriptions.cover}</p>
                </div>
              </div>
              <span className="career-card-cta">Learn more <span aria-hidden="true">↗</span></span>
            </Link>

            <Link to="/services/interview-preparation" className="career-service-card light-card">
              <div className="career-card-top"><span aria-hidden="true">06</span></div>
              <div className="career-card-main">
                <div className="career-card-copy">
                  <h3 className="career-card-title">Interview Preparation</h3>
                  <p className="career-card-description">{serviceDescriptions.interview}</p>
                </div>
                <div className="career-visual interview-visual" aria-hidden="true">
                  <div className="interview-note"><b>Q&amp;A</b><i></i><i></i></div>
                </div>
              </div>
              <span className="career-card-cta">Learn more <span aria-hidden="true">↗</span></span>
            </Link>
          </div>

          <div className="home-services-footer">
            <Link to="/services">Explore all services <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <FeaturedShowcase />

        {user && (
          <section className="client-home-context">
            <div className="client-home-context-inner">
              <div className="client-home-context-heading">
                <span>YOUR FORMANT</span>
                <h2>
                  Projects and
                  <br />
                  <span>conversations, together.</span>
                </h2>
              </div>

              <div className="client-home-context-copy">
                <p>
                  Review active projects, open conversations and check service updates from your account.
                </p>

                <div className="client-home-context-links">
                  <Link to="/dashboard">Overview <span>↗</span></Link>
                  <Link to="/dashboard/orders">My orders <span>↗</span></Link>
                  <Link to="/dashboard/messages">Messages <span>↗</span></Link>
                </div>
              </div>
            </div>
          </section>
        )}

       <section className="profile-statement">

  <div className="profile-statement-inner">

    <div className="profile-statement-label">
      <span>NOT ANOTHER TEMPLATE.</span>
    </div>

    <div className="profile-statement-grid">

      <h2>
        Make your experience
        <br />
        <span>easy to follow.</span>
      </h2>

      <div className="profile-statement-side">

        <p>
          Formant is intentionally small. We limit active
          projects so every client gets focused attention.
        </p>

        <Link
          className="profile-statement-link"
          to="/signup"
        >
          <span>Create your account</span>
          <span>↗</span>
        </Link>

      </div>

    </div>

  </div>

</section>

        {/* =========================
            OUR APPROACH
        ========================== */}
        <section className="availability-section">

  <div className="availability-inner">

    <div className="availability-top">
      <span className="availability-label">
        OUR APPROACH
      </span>

      <span className="availability-status">
        CAREER-FOCUSED SUPPORT
      </span>
    </div>

    <div className="availability-grid">

      <div className="availability-heading">
        <h2>
          Choose
          <br />
          <span>where to start.</span>
        </h2>
      </div>

      <div className="availability-content">

        <p className="availability-description">
          Review each service’s scope and starting price.
        </p>

        <Link
          className="availability-link"
          to="/services"
        >
          <span>Compare services</span>
          <span>↗</span>
        </Link>

      </div>

    </div>

  </div>

</section>

      </main>

      <Footer />
    </>
  );
}

export default function Home() {
  const [session, setSession] = useState(null);
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    let mounted = true;
    let subscription = null;

    async function resolveSession() {
      if (!supabase) {
        const localState = load();
        if (mounted) {
          setSession(localState.user ? { user: localState.user } : null);
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error('Home auth session check failed:', error);
      }

      setSession(data?.session || null);
    }

    resolveSession();

    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession || null);
      });
      subscription = data?.subscription;
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const userId = session?.user?.id;
    if (!supabase || !userId) {
      setProfileName('');
      return () => { mounted = false; };
    }
    setProfileName('');
    const refreshName = () => supabase.from('profiles').select('name').eq('id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.error('Home profile name load failed:', error);
        setProfileName(data?.name || '');
      });
    const onProfileUpdated = (event) => {
      if (!event.detail?.userId || event.detail.userId === userId) {
        setProfileName(event.detail?.name || '');
        void refreshName();
      }
    };
    void refreshName();
    window.addEventListener('careerlyst-profile-updated', onProfileUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('careerlyst-profile-updated', onProfileUpdated);
    };
  }, [session?.user?.id]);

  return <PublicHome user={session?.user || null} profileName={profileName} />;
}
