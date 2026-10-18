import React, { useEffect, useState } from 'react';
import PublicNav from '../components/PublicNav';
import Footer from '../components/Footer';
import './legal-privacy.css';

const SECTIONS = [
  { id: 'section-1', num: '01', title: 'Information We Collect' },
  { id: 'section-2', num: '02', title: 'How We Use Information' },
  { id: 'section-3', num: '03', title: 'Access to Client Information' },
  { id: 'section-4', num: '04', title: 'Sharing Information' },
  { id: 'section-5', num: '05', title: 'International Data Transfers' },
  { id: 'section-6', num: '06', title: 'Cookies and Similar Technologies' },
  { id: 'section-7', num: '07', title: 'Notifications & Email Communications' },
  { id: 'section-8', num: '08', title: 'Data Retention' },
  { id: 'section-9', num: '09', title: 'Account and Data Deletion' },
  { id: 'section-10', num: '10', title: 'Privacy Rights' },
  { id: 'section-11', num: '11', title: 'Data Security' },
  { id: 'section-12', num: '12', title: "Children's Privacy & Age Requirements" },
  { id: 'section-13', num: '13', title: 'Third-Party Services & Links' },
  { id: 'section-14', num: '14', title: 'Privacy Policy Updates' },
  { id: 'section-15', num: '15', title: 'Applicable Law and Jurisdiction' },
  { id: 'section-16', num: '16', title: 'Contact Us' }
];

export default function LegalPrivacy() {
  const [activeSection, setActiveSection] = useState('section-1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Active section tracking with IntersectionObserver
  useEffect(() => {
    const observerCallback = (entries) => {
      // Find the first visible intersecting section
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible) {
        setActiveSection(visible.target.id);
      }
    };

    const observerOptions = {
      rootMargin: '-100px 0px -60% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleCopyLink = (id) => {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  const handleSectionClick = (e, id) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.pushState(null, '', `#${id}`);
      setActiveSection(id);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname);
    }
  };

  const currentActiveSectionObj = SECTIONS.find((s) => s.id === activeSection) || SECTIONS[0];

  return (
    <div className="privacy-page">
      <PublicNav />

      <main>
        {/* Hero Section */}
        <section className="privacy-hero-wrap">
          <div className="privacy-hero">
            <span className="privacy-eyebrow">LEGAL &amp; PRIVACY</span>
            <h1 className="privacy-title">Privacy Policy</h1>

            <div className="privacy-meta-bar">
              <div className="privacy-meta-item">
                <span className="privacy-meta-label">Effective Date:</span>
                <span>[To be determined]</span>
              </div>
              <div className="privacy-meta-item">
                <span className="privacy-meta-label">Last Updated:</span>
                <span>[To be determined]</span>
              </div>
              <div className="privacy-meta-item">
                <span className="privacy-meta-badge">Working Policy Draft</span>
              </div>
            </div>

            <aside className="privacy-banner-draft" role="note" aria-label="Draft Notice">
              <svg
                className="privacy-banner-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="privacy-banner-content">
                <h4>Working Policy Draft Notice</h4>
                <p>
                  This document is a working policy draft. It must be reviewed against Formant&apos;s actual features,
                  providers, and applicable legal requirements before publication. References to features or
                  practices that are not yet active describe planned or potential practices, not a statement that they
                  are currently implemented.
                </p>
              </div>
            </aside>
          </div>
        </section>

        {/* Mobile Quick Navigation Strip (<1024px) */}
        <div className="privacy-mobile-nav">
          <button
            type="button"
            className="privacy-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Table of Contents"
          >
            <span className="privacy-mobile-toggle-indicator">
              <span className="privacy-mobile-toggle-tag">{currentActiveSectionObj.num}</span>
              <span>{currentActiveSectionObj.title}</span>
            </span>
            <span
              className={`privacy-mobile-toggle-icon ${mobileMenuOpen ? 'is-open' : ''}`}
              aria-hidden="true"
            >
              ▼
            </span>
          </button>

          {mobileMenuOpen && (
            <div className="privacy-mobile-dropdown">
              <ul className="privacy-toc-list">
                {SECTIONS.map((sec) => (
                  <li key={sec.id}>
                    <a
                      href={`#${sec.id}`}
                      className={`privacy-toc-link ${activeSection === sec.id ? 'is-active' : ''}`}
                      onClick={(e) => handleSectionClick(e, sec.id)}
                    >
                      <span className="privacy-toc-num">{sec.num}</span>
                      <span className="privacy-toc-text">{sec.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main Content & Desktop Sidebar */}
        <div className="privacy-container">
          {/* Desktop Table of Contents Sidebar */}
          <aside className="privacy-sidebar" aria-label="Table of Contents">
            <nav className="privacy-toc-card">
              <div className="privacy-toc-header">
                <span className="privacy-toc-title">Table of Contents</span>
                <span className="privacy-toc-count">16 Sections</span>
              </div>
              <ul className="privacy-toc-list">
                {SECTIONS.map((sec) => (
                  <li key={sec.id}>
                    <a
                      href={`#${sec.id}`}
                      className={`privacy-toc-link ${activeSection === sec.id ? 'is-active' : ''}`}
                      onClick={(e) => handleSectionClick(e, sec.id)}
                    >
                      <span className="privacy-toc-num">{sec.num}</span>
                      <span className="privacy-toc-text">{sec.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          {/* Policy Document Content */}
          <article className="privacy-content">
            {/* Introductory Text */}
            <div className="privacy-intro">
              <p className="lead">
                Formant (&ldquo;Formant,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) is an
                independent brand and is not currently a registered company. This Privacy Policy describes how
                Formant may collect, use, store, disclose, and protect personal information when you visit our
                website, create an account, or use our services.
              </p>
              <p>
                This document is a working policy draft. It must be reviewed against Formant&apos;s actual features,
                providers, and applicable legal requirements before publication. References to features or
                practices that are not yet active describe planned or potential practices, not a statement that they
                are currently implemented.
              </p>
              <p>
                Where applicable law requires consent, Formant will request the required consent separately. Using the
                services does not replace any consent that the law requires.
              </p>
            </div>

            {/* SECTION 1 */}
            <section id="section-1" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">01</span>
                  <h2>1. Information We Collect</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-1' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-1')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 1"
                >
                  {copiedId === 'section-1' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Depending on the features you use and the information you provide, Formant may collect the following
                categories of information.
              </p>

              <div className="privacy-subsection">
                <h3>1.1 Personal and Account Information</h3>
                <ul className="privacy-list">
                  <li className="privacy-list-item">Name and email address</li>
                  <li className="privacy-list-item">Account and profile information</li>
                  <li className="privacy-list-item">Phone number and other contact details, if provided</li>
                  <li className="privacy-list-item">Authentication information needed to create and secure an account</li>
                  <li className="privacy-list-item">
                    Information provided through supported sign-in methods, such as Google Login
                  </li>
                </ul>
              </div>

              <div className="privacy-subsection">
                <h3>1.2 Professional and Career Information</h3>
                <ul className="privacy-list">
                  <li className="privacy-list-item">CVs and resumes</li>
                  <li className="privacy-list-item">Career history and professional experience</li>
                  <li className="privacy-list-item">Education and qualifications</li>
                  <li className="privacy-list-item">LinkedIn, GitHub, portfolio, and other professional links</li>
                  <li className="privacy-list-item">
                    Professional profile details and information submitted for career-related services
                  </li>
                </ul>
              </div>

              <div className="privacy-subsection">
                <h3>1.3 Uploaded Files and Media</h3>
                <ul className="privacy-list">
                  <li className="privacy-list-item">CV and resume documents</li>
                  <li className="privacy-list-item">Portfolio materials</li>
                  <li className="privacy-list-item">Profile photographs</li>
                  <li className="privacy-list-item">
                    Other files and documents you choose to submit through the platform
                  </li>
                </ul>
              </div>

              <div className="privacy-subsection">
                <h3>1.4 Payment and Billing Information</h3>
                <p>
                  If payment features are offered, Formant may retain information needed to manage transactions, such
                  as:
                </p>
                <ul className="privacy-list">
                  <li className="privacy-list-item">Transaction IDs</li>
                  <li className="privacy-list-item">Payment status</li>
                  <li className="privacy-list-item">Payment amounts</li>
                  <li className="privacy-list-item">Payment timestamps</li>
                  <li className="privacy-list-item">Essential billing details</li>
                </ul>
                <p>
                  Formant does not intend to store full card numbers, CVV codes, or other sensitive payment
                  credentials directly. Such credentials are expected to be processed by the selected third-party
                  payment gateway. The payment provider and its relevant data-handling practices will be identified
                  when selected and integrated.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>1.5 Technical and Usage Information</h3>
                <p>
                  Depending on the website features and tools in use, Formant may collect technical and usage
                  information such as:
                </p>
                <ul className="privacy-list">
                  <li className="privacy-list-item">Page views and website interactions</li>
                  <li className="privacy-list-item">Service views and usage patterns</li>
                  <li className="privacy-list-item">Dashboard activity and interactions</li>
                  <li className="privacy-list-item">Device and browser details</li>
                  <li className="privacy-list-item">Login and security logs</li>
                  <li className="privacy-list-item">
                    Technical information needed for operation, troubleshooting, analytics, or security
                  </li>
                </ul>
                <p>The exact information collected will depend on the features and providers actually enabled.</p>
              </div>

              <div className="privacy-subsection">
                <h3>1.6 Other Information</h3>
                <p>
                  We may collect additional information that you voluntarily provide through forms, communications,
                  support requests, or other interactions with Formant.
                </p>
              </div>
            </section>

            {/* SECTION 2 */}
            <section id="section-2" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">02</span>
                  <h2>2. How We Use Information</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-2' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-2')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 2"
                >
                  {copiedId === 'section-2' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>Formant may use information, where relevant to the services and features in use, for purposes such as:</p>

              <ul className="privacy-list">
                <li className="privacy-list-item">
                  <strong>Account management:</strong> Creating, maintaining, and managing user accounts.
                </li>
                <li className="privacy-list-item">
                  <strong>Service delivery:</strong> Providing CV, resume, portfolio, professional profile, and other
                  requested services.
                </li>
                <li className="privacy-list-item">
                  <strong>Project management:</strong> Managing client projects, assigning authorized team members, and
                  communicating project progress.
                </li>
                <li className="privacy-list-item">
                  <strong>Communication:</strong> Sending service-related messages, project updates, order status
                  notifications, and account communications.
                </li>
                <li className="privacy-list-item">
                  <strong>Payment processing:</strong> Processing payments and maintaining necessary transaction or
                  billing records, if payment features are enabled.
                </li>
                <li className="privacy-list-item">
                  <strong>Security:</strong> Protecting accounts, detecting suspicious activity, preventing fraud, and
                  investigating security incidents.
                </li>
                <li className="privacy-list-item">
                  <strong>Website improvement:</strong> Understanding website traffic, interactions, and service usage to
                  improve the platform, where analytics tools are used.
                </li>
                <li className="privacy-list-item">
                  <strong>Notifications:</strong> Delivering browser push notifications or email communications where
                  those features are enabled and any required consent has been obtained.
                </li>
                <li className="privacy-list-item">
                  <strong>Legal compliance:</strong> Meeting applicable legal, regulatory, and legitimate recordkeeping
                  obligations.
                </li>
              </ul>

              <p>
                Formant does not currently use AI tools to process clients&apos; personal information as part of its
                services. If that changes, this policy will be reviewed and updated as appropriate.
              </p>
            </section>

            {/* SECTION 3 */}
            <section id="section-3" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">03</span>
                  <h2>3. Access to Client Information</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-3' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-3')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 3"
                >
                  {copiedId === 'section-3' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>Formant intends to limit access to client information according to role and responsibility.</p>

              <div className="privacy-subsection">
                <h3>3.1 Administrators</h3>
                <p>
                  Authorized Formant administrators may access client CVs, uploaded files, profile information, and
                  project details when necessary for administration, support, project management, security, or
                  service delivery.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>3.2 Project Team Members and Contractors</h3>
                <p>
                  Team members or contractors assigned to a client project may be given access only to information
                  needed to perform their assigned work.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>3.3 Clients</h3>
                <p>
                  Clients may access and manage their own information and projects through the account features made
                  available to them.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>3.4 Unauthorized Access</h3>
                <p>Other clients and unauthorized users are not permitted to access a client&apos;s personal information.</p>
              </div>

              <div className="privacy-callout">
                <span className="privacy-callout-label">Implementation Notice</span>
                <p>
                  These are access-control commitments. The corresponding permissions and database protections must be
                  implemented and tested in the platform. Sensitive information access may be restricted further, and
                  access logs may be maintained where appropriate.
                </p>
              </div>
            </section>

            {/* SECTION 4 */}
            <section id="section-4" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">04</span>
                  <h2>4. Sharing Information</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-4' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-4')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 4"
                >
                  {copiedId === 'section-4' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant may share information with trusted service providers and authorized personnel when necessary
                to operate, maintain, secure, or deliver its services.
              </p>

              <div className="privacy-subsection">
                <h3>4.1 Service Providers</h3>
                <p>Depending on the services enabled, providers may include:</p>
                <ul className="privacy-list">
                  <li className="privacy-list-item">Website hosting and database providers</li>
                  <li className="privacy-list-item">Payment processors</li>
                  <li className="privacy-list-item">Email and notification service providers</li>
                  <li className="privacy-list-item">Analytics providers</li>
                  <li className="privacy-list-item">Other providers needed to operate the platform</li>
                </ul>
              </div>

              <div className="privacy-subsection">
                <h3>4.2 Team Members and Contractors</h3>
                <p>
                  Information may be shared with authorized team members or contractors working on a client&apos;s
                  project, limited to what is needed for their assigned responsibilities.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>4.3 Legal Requirements</h3>
                <p>
                  Formant may disclose information when required by applicable law, regulation, legal obligation, or
                  valid legal request.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>4.4 No Sale of Personal Information</h3>
                <p>Formant will not sell clients&apos; personal information to third parties.</p>
              </div>

              <p className="text-muted">
                Formant aims to share only the information necessary for each specific purpose. The names of providers
                and their relevant privacy practices will be added or linked when the providers are selected and
                integrated.
              </p>
            </section>

            {/* SECTION 5 */}
            <section id="section-5" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">05</span>
                  <h2>5. International Data Transfers</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-5' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-5')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 5"
                >
                  {copiedId === 'section-5' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant may store or process client information in countries where Formant or its service providers
                operate. If international hosting, database, payment, email, or other services are used, information may
                be transferred across national borders.
              </p>
              <p>
                Formant will take appropriate measures to protect personal information and handle international
                transfers in accordance with applicable data protection laws. The countries involved and the safeguards
                available will depend on the providers selected and the applicable legal requirements.
              </p>
            </section>

            {/* SECTION 6 */}
            <section id="section-6" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">06</span>
                  <h2>6. Cookies and Similar Technologies</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-6' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-6')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 6"
                >
                  {copiedId === 'section-6' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant may use cookies and similar technologies, depending on the website features and tools enabled.
              </p>

              <div className="privacy-subsection">
                <h3>6.1 Essential Cookies</h3>
                <p>
                  Essential cookies may support login sessions, authentication, security, and core website
                  functionality.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>6.2 Analytics and Other Non-Essential Cookies</h3>
                <p>
                  If non-essential cookies or similar tracking technologies are used, they may collect information
                  such as page views, device and browser details, interactions, and usage patterns to help understand
                  website use and improve services.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>6.3 Preferences and Consent</h3>
                <p>
                  Where required by law, Formant will obtain consent before using non-essential cookies or similar
                  technologies. Formant intends to provide a way to accept or reject non-essential cookies and manage
                  available preferences. Rejecting non-essential cookies should not prevent access to essential website
                  features.
                </p>
              </div>

              <div className="privacy-callout">
                <span className="privacy-callout-label">Verification Note</span>
                <p>
                  The actual cookie banner, settings, analytics tools, and consent behavior must match this policy before
                  these statements are presented as active practices.
                </p>
              </div>
            </section>

            {/* SECTION 7 */}
            <section id="section-7" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">07</span>
                  <h2>7. Notifications and Email Communications</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-7' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-7')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 7"
                >
                  {copiedId === 'section-7' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                If notification features are enabled, Formant may use browser push notifications and email to
                communicate with clients.
              </p>

              <div className="privacy-subsection">
                <h3>7.1 Browser Push Notifications</h3>
                <p>Potential notification topics include:</p>
                <ul className="privacy-list">
                  <li className="privacy-list-item">Project updates</li>
                  <li className="privacy-list-item">Order status</li>
                  <li className="privacy-list-item">Messages</li>
                  <li className="privacy-list-item">Account and security alerts</li>
                  <li className="privacy-list-item">Promotional offers</li>
                  <li className="privacy-list-item">Announcements</li>
                </ul>
                <p>
                  Clients can manage browser notification permission through their browser settings and may use any
                  notification preferences made available by Formant. Notifications will be sent in accordance with
                  applicable consent requirements.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>7.2 Service-Related Emails</h3>
                <p>
                  Service-related emails may include project updates, order status notifications, account
                  information, security alerts, and other communications needed to provide requested services.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>7.3 Marketing Emails</h3>
                <p>
                  If Formant sends marketing emails, they may cover new features, promotions, offers, and
                  announcements. Marketing emails will include an unsubscribe method where required. Unsubscribing
                  from marketing communications will not stop essential service-related or security messages.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>7.4 Communication Preferences</h3>
                <p>
                  Formant will respect clients&apos; communication preferences and obtain consent where required by
                  applicable law. The available controls and notification categories will depend on the features
                  actually implemented.
                </p>
              </div>
            </section>

            {/* SECTION 8 */}
            <section id="section-8" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">08</span>
                  <h2>8. Data Retention</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-8' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-8')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 8"
                >
                  {copiedId === 'section-8' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant intends to retain personal information only for as long as necessary for the purposes described
                in this policy, subject to legal, regulatory, security, and legitimate transaction-related
                requirements.
              </p>

              <div className="privacy-subsection">
                <h3>8.1 Account, Profile, Project, and Uploaded Information</h3>
                <p>
                  Account, profile, CV, portfolio, project, and uploaded-file information may be retained while an
                  account remains active and until deletion is requested, subject to applicable retention requirements.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>8.2 Login and Security Logs</h3>
                <p>
                  Formant&apos;s intended retention period for login and security logs is up to{' '}
                  <strong>90 days</strong> for security monitoring, fraud prevention, troubleshooting, and incident
                  investigation. Logs may be kept longer when necessary to investigate an incident or comply with
                  legal obligations.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>8.3 Payment and Transaction Records</h3>
                <p>
                  If payment features are used, certain payment, billing, order, and transaction records may be retained
                  when needed for legitimate transaction-related, legal, regulatory, or accounting purposes.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>8.4 Account Deletion and Active-System Removal</h3>
                <p>
                  Formant&apos;s intended process is to remove personal information and uploaded files from active
                  systems within <strong>30 days</strong> of an account deletion or data deletion request, except for
                  information that must be retained for legal, regulatory, or legitimate transaction-related purposes.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>8.5 Backups</h3>
                <p>
                  Formant&apos;s target backup retention period is up to <strong>30 days</strong>. Backup copies may
                  remain until they expire under the backup retention process. Longer retention may be necessary for
                  legal, security, or operational reasons.
                </p>
              </div>

              <div className="privacy-callout">
                <span className="privacy-callout-label">Timelines &amp; Guarantees</span>
                <p>
                  Any information retained after a deletion request will be restricted to the purposes for which it
                  must be kept. These timelines must be confirmed against the actual deletion and backup systems before
                  publication as operational guarantees.
                </p>
              </div>
            </section>

            {/* SECTION 9 */}
            <section id="section-9" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">09</span>
                  <h2>9. Account and Data Deletion</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-9' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-9')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 9"
                >
                  {copiedId === 'section-9' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant intends to provide clients with a way to delete their accounts through the Client Dashboard.
                Availability of this feature should be confirmed in the live platform.
              </p>
              <p>When an account or data deletion request is received, Formant&apos;s intended process is to:</p>
              <ul className="privacy-list">
                <li className="privacy-list-item">
                  Remove personal information and uploaded files from active systems within 30 days, except where
                  retention is required.
                </li>
                <li className="privacy-list-item">
                  Retain only records necessary for legal, regulatory, security, or legitimate transaction-related
                  purposes.
                </li>
                <li className="privacy-list-item">
                  Handle remaining backup copies according to the backup retention policy.
                </li>
                <li className="privacy-list-item">
                  Restrict retained information to the specific purposes for which it must be kept.
                </li>
              </ul>
              <p>
                Deleting an account may affect access to ongoing projects, account features, and related services.
                Where active orders or transactions exist, some records may need to be retained to complete or
                document those transactions.
              </p>
            </section>

            {/* SECTION 10 */}
            <section id="section-10" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">10</span>
                  <h2>10. Privacy Rights</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-10' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-10')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 10"
                >
                  {copiedId === 'section-10' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Depending on your location and applicable law, you may have rights concerning your personal
                information.
              </p>

              <div className="privacy-subsection">
                <h3>10.1 Right to Access</h3>
                <p>
                  You may request access to personal information held by Formant and, where applicable, a copy of that
                  information.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>10.2 Right to Rectification</h3>
                <p>You may request correction of inaccurate or incomplete personal information.</p>
              </div>

              <div className="privacy-subsection">
                <h3>10.3 Right to Erasure</h3>
                <p>
                  You may request deletion of personal information and uploaded files, subject to applicable legal and
                  retention requirements.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>10.4 Right to Data Portability</h3>
                <p>
                  Where applicable, you may request a copy of your personal information in a commonly used,
                  structured, and machine-readable format.
                </p>
              </div>

              <div className="privacy-subsection">
                <h3>10.5 Making a Request</h3>
                <p>
                  Formant intends to establish a dedicated contact method for privacy-related requests. Requests will
                  be handled in accordance with applicable data protection laws. The contact details will be added when
                  the official business email address is established.
                </p>
              </div>

              <p className="text-muted">
                Other rights, exceptions, and response time limits may apply under the laws relevant to your location.
              </p>
            </section>

            {/* SECTION 11 */}
            <section id="section-11" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">11</span>
                  <h2>11. Data Security</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-11' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-11')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 11"
                >
                  {copiedId === 'section-11' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant plans to implement appropriate technical and organizational measures to protect personal
                information against unauthorized access, disclosure, alteration, or destruction.
              </p>

              <p>Planned or potential measures may include:</p>
              <ul className="privacy-list">
                <li className="privacy-list-item">HTTPS encryption for data transmission</li>
                <li className="privacy-list-item">Secure authentication</li>
                <li className="privacy-list-item">
                  Role-based access control for administrators, team members, and clients
                </li>
                <li className="privacy-list-item">
                  Database protections, including Supabase Row Level Security (RLS), where applicable
                </li>
                <li className="privacy-list-item">Restricted access to sensitive information</li>
                <li className="privacy-list-item">Monitoring of suspicious activity</li>
                <li className="privacy-list-item">Access logging</li>
                <li className="privacy-list-item">Regular security reviews and improvements</li>
              </ul>

              <p>
                These measures are subject to implementation and verification. This section should be updated if the
                platform&apos;s actual security practices differ from these plans.
              </p>
              <p>No method of transmission or storage can be guaranteed to be completely secure.</p>
            </section>

            {/* SECTION 12 */}
            <section id="section-12" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">12</span>
                  <h2>12. Children&apos;s Privacy and Age Requirements</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-12' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-12')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 12"
                >
                  {copiedId === 'section-12' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant does not currently specify a minimum age requirement for accessing or using its services.
                Individuals of any age may use the services, subject to applicable laws and age-related requirements
                in their jurisdiction.
              </p>
              <p>
                Formant is committed to protecting the privacy of users, including children and minors. Where required
                by applicable law, appropriate parental or guardian consent will be obtained before collecting or
                processing a minor&apos;s personal information.
              </p>
              <p>
                If Formant becomes aware that personal information has been collected or processed in violation of
                applicable children&apos;s privacy laws, it will take appropriate steps to address the issue, including
                deleting the information where legally required.
              </p>
              <p className="text-muted">
                This approach must be reviewed against the laws of the countries in which Formant offers its services
                before publication.
              </p>
            </section>

            {/* SECTION 13 */}
            <section id="section-13" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">13</span>
                  <h2>13. Third-Party Services and External Links</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-13' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-13')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 13"
                >
                  {copiedId === 'section-13' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant may integrate third-party services for authentication, hosting, database operations, payment
                processing, email delivery, notifications, analytics, and other platform functions.
              </p>
              <p>
                Third-party providers may process information under their own terms and privacy policies. When you
                interact with a third-party service or follow an external link, that provider&apos;s terms and privacy
                practices may apply.
              </p>
              <p className="text-muted">
                The specific providers used by Formant will be identified or linked as they are selected and integrated.
              </p>
            </section>

            {/* SECTION 14 */}
            <section id="section-14" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">14</span>
                  <h2>14. Privacy Policy Updates</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-14' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-14')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 14"
                >
                  {copiedId === 'section-14' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                Formant may update this Privacy Policy to reflect changes in its services, data-handling practices,
                or applicable legal requirements.
              </p>
              <p>
                Formant intends to notify clients of policy updates through email and dashboard notifications. The
                policy page will show a revised &ldquo;Last Updated&rdquo; date.
              </p>
              <p>
                Where required by law, Formant will obtain additional consent or provide clients with an opportunity
                to review and accept significant changes before they take effect.
              </p>
              <p>
                The effect of continued use after an update will be determined in accordance with applicable law and
                any consent requirements.
              </p>
              <p className="text-muted">
                The effective date and last-updated date will be displayed on the policy page once determined.
              </p>
            </section>

            {/* SECTION 15 */}
            <section id="section-15" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">15</span>
                  <h2>15. Applicable Law and Jurisdiction</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-15' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-15')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 15"
                >
                  {copiedId === 'section-15' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <div className="privacy-callout">
                <p>
                  <strong>Provisional section:</strong> Formant will handle personal information in accordance with
                  applicable data protection and privacy laws. The specific governing law and jurisdiction for this
                  policy have not yet been determined and will be stated after Formant&apos;s relevant legal and
                  operational requirements are reviewed.
                </p>
              </div>
            </section>

            {/* SECTION 16 */}
            <section id="section-16" className="privacy-section">
              <div className="privacy-section-head">
                <div className="privacy-section-head-title">
                  <span className="privacy-section-number">16</span>
                  <h2>16. Contact Us</h2>
                </div>
                <button
                  type="button"
                  className={`privacy-anchor-btn ${copiedId === 'section-16' ? 'copied' : ''}`}
                  onClick={() => handleCopyLink('section-16')}
                  title="Copy link to this section"
                  aria-label="Copy link to section 16"
                >
                  {copiedId === 'section-16' ? 'Link copied!' : '# Link'}
                </button>
              </div>

              <p>
                If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your
                personal data, you may contact Formant through its official business email address.
              </p>
              <p>
                The official business email will serve as the primary contact channel for support inquiries,
                privacy-related requests, and data protection matters. Formant will review and respond to requests in
                accordance with applicable data protection laws.
              </p>

              <div className="privacy-callout">
                <p>
                  <strong>Official Business Email:</strong> [To be added]
                </p>
              </div>
            </section>

            {/* Concluding Draft Advisory Box */}
            <div className="privacy-disclaimer-box" role="note">
              <span className="privacy-disclaimer-badge">Advisory Notice</span>
              <p className="privacy-disclaimer-text">
                This document is a working draft and is not legal advice. Before publication, confirm that its
                statements match the live platform and review it for the laws applicable to Formant and its users.
              </p>
            </div>
          </article>
        </div>
      </main>

      {/* Floating Back to Top Button */}
      <button
        type="button"
        className={`privacy-back-top ${showBackToTop ? 'is-visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
      >
        <span aria-hidden="true">↑</span>
        <span>Back to top</span>
      </button>

      <Footer />
    </div>
  );
}
