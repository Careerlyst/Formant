import React from 'react';
import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import { services } from '../lib/store';

export default function Home() {
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
                A STRONGER YOU. A BRIGHTER TOMORROW.
              </p>

              <h1>
                Get ready for
                <br />
                the role <span>you want.</span>
              </h1>

              <p className="lede">
                Resume, LinkedIn, GitHub, portfolio and interview preparation —
                prepared as one coherent professional profile.
              </p>

              <div className="actions">
                <Link className="btn lime" to="/signup">
                  Start your profile <span>↗</span>
                </Link>

                <a className="watch" href="#process">
                  <span>▶</span>
                  See how it works
                </a>
              </div>

              <p className="micro">
                <i />
                Built by career experts. Designed around your target role.
              </p>
            </div>

            <div className="hero-art">
              <img
                src="/assets/hero-illustration.png"
                alt="Careerlyst career preparation illustration"
              />
            </div>

          </div>
        </section>


        {/* =========================
            HOW IT WORKS
        ========================== */}
        <section className="process-section" id="process">

          <div className="process-intro">

            <div className="process-heading">
              <p className="eyebrow">
                HOW IT WORKS
              </p>

              <h2>
                A clearer process for a
                <br />
                <span>stronger profile.</span>
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
                  Start with your direction.
                </h3>

                <p>
                  Tell us the role, industry and opportunity you're preparing
                  for. We start with where you want to go—not just where
                  you've been.
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
                  We shape the profile.
                </h3>

                <p>
                  Our career experts turn your experience into focused,
                  role-specific materials that work together as one profile.
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
                  Review. Refine. Receive.
                </h3>

                <p>
                  Give feedback, request revisions and receive the finished
                  work through your Careerlyst account.
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
        {/* =========================
    SERVICES
========================== */}
<section className="home-services">

  <div className="home-services-heading">
    <div>
      <span className="service-label">SERVICES</span>

      <h2>
        Everything you need
        <br />
        to <span>look ready.</span>
      </h2>
    </div>

    <p>
      Practical career support designed around the role
      you want next.
    </p>
  </div>


  <div className="home-services-grid">

    {/* 01 — Resume */}
    <Link
      to="/services/resume"
      className="career-service-card light-card"
    >
      <div className="career-card-top">
        <span>01</span>
        <span className="career-card-arrow">↗</span>
      </div>

      <div className="career-card-title">
        <span>Resume / CV</span>
      </div>

      <div className="career-visual resume-visual">
        <div className="resume-paper">
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div className="resume-circle"></div>
        <div className="resume-line"></div>
      </div>

      <div className="career-card-bottom">
        <span>Focused for your target role</span>
        <span>Learn more ↗</span>
      </div>
    </Link>


    {/* 02 — LinkedIn */}
    <Link
      to="/services/linkedin"
      className="career-service-card dark-card"
    >
      <div className="career-card-top">
        <span>02</span>
        <span className="career-card-arrow">↗</span>
      </div>

      <div className="career-card-title">
        <span>LinkedIn</span>
      </div>

      <div className="career-visual linkedin-visual">
        <div className="linkedin-window">
          <b></b>
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div className="linkedin-dot"></div>
      </div>

      <div className="career-card-bottom">
        <span>Position your experience clearly</span>
        <span>Learn more ↗</span>
      </div>
    </Link>


    {/* 03 — GitHub */}
    <Link
      to="/services/github"
      className="career-service-card dark-card"
    >
      <div className="career-card-top">
        <span>03</span>
        <span className="career-card-arrow">↗</span>
      </div>

      <div className="career-card-title">
        <span>GitHub</span>
      </div>

      <div className="career-visual github-visual">
        <div className="github-box">
          <span>&lt;/&gt;</span>
        </div>
        <div className="github-lines">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>

      <div className="career-card-bottom">
        <span>Make your technical work clearer</span>
        <span>Learn more ↗</span>
      </div>
    </Link>


    {/* 04 — Portfolio */}
    <Link
      to="/services/portfolio"
      className="career-service-card light-card"
    >
      <div className="career-card-top">
        <span>04</span>
        <span className="career-card-arrow">↗</span>
      </div>

      <div className="career-card-title">
        <span>Portfolio</span>
      </div>

      <div className="career-visual portfolio-visual">
        <div className="portfolio-window">
          <b></b>
          <i></i>
          <i></i>
        </div>
        <div className="portfolio-orbit"></div>
      </div>

      <div className="career-card-bottom">
        <span>Turn your work into a stronger story</span>
        <span>Learn more ↗</span>
      </div>
    </Link>


    {/* 05 — Cover Letter */}
    <Link
      to="/services/cover-letter"
      className="career-service-card light-card"
    >
      <div className="career-card-top">
        <span>05</span>
        <span className="career-card-arrow">↗</span>
      </div>

      <div className="career-card-title">
        <span>Cover Letter</span>
      </div>

      <div className="career-visual letter-visual">
        <div className="letter-paper">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <div className="letter-star">✦</div>
      </div>

      <div className="career-card-bottom">
        <span>Relevant, specific and role-focused</span>
        <span>Learn more ↗</span>
      </div>
    </Link>


    {/* 06 — Interview */}
    <Link
      to="/services/interview-preparation"
      className="career-service-card dark-card"
    >
      <div className="career-card-top">
        <span>06</span>
        <span className="career-card-arrow">↗</span>
      </div>

      <div className="career-card-title">
        <span>Interview Preparation</span>
      </div>

      <div className="career-visual interview-visual">
        <div className="interview-person">
          <b></b>
          <i></i>
        </div>
        <div className="interview-bubble">
          ?
        </div>
        <div className="interview-line"></div>
      </div>

      <div className="career-card-bottom">
        <span>Prepare for the conversation</span>
        <span>Learn more ↗</span>
      </div>
    </Link>

  </div>


  <div className="home-services-footer">
    <Link to="/services">
      Explore all services <span>→</span>
    </Link>
  </div>

</section>

       <section className="profile-statement">

  <div className="profile-statement-inner">

    <div className="profile-statement-label">
      <span>NOT ANOTHER TEMPLATE.</span>
    </div>

    <div className="profile-statement-grid">

      <h2>
        Your professional profile
        <br />
        deserves a <span>point of view.</span>
      </h2>

      <div className="profile-statement-side">

        <p>
          Careerlyst is intentionally small. We limit active
          projects so every client gets focused attention.
        </p>

        <Link
          className="profile-statement-link"
          to="/signup"
        >
          <span>Start your profile</span>
          <span>↗</span>
        </Link>

      </div>

    </div>

  </div>

</section>

        {/* =========================
            CURRENT AVAILABILITY
        ========================== */}
        <section className="availability-section">

  <div className="availability-inner">

    <div className="availability-top">
      <span className="availability-label">
        CURRENT AVAILABILITY
      </span>

      <span className="availability-status">
        ● LIMITED CAPACITY
      </span>
    </div>

    <div className="availability-grid">

      <div className="availability-heading">
        <h2>
          Limited
          <br />
          <span>by design.</span>
        </h2>
      </div>

      <div className="availability-content">

        <p className="availability-description">
          We work on a small number of projects at a time.
          When capacity is full, new orders join the queue —
          so every project still gets the attention it deserves.
        </p>

        <div className="availability-capacity">

          <div>
            <span className="capacity-label">
              ACTIVE PROJECTS
            </span>

            <strong>2 / 2</strong>
          </div>

          <div className="capacity-line">
            <span></span>
          </div>

          <p>
            Currently at capacity. New projects can join the queue.
          </p>

        </div>

        <Link
          className="availability-link"
          to="/signup"
        >
          <span>Join the queue</span>
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