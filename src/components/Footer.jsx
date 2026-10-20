import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const SOCIAL_LINKS = [
  { label: 'Facebook', href: '' },
  { label: 'LinkedIn', href: '' },
  { label: 'Instagram', href: '' }
];



export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  function toggleSection(section) {
    setOpenSection((current) =>
      current === section ? null : section
    );
  }

  function handleHowItWorksClick(event) {
    if (window.location.pathname === '/') {
      event.preventDefault();
      const target =
        document.getElementById('how-it-works') ||
        document.getElementById('process');

      if (target) {
        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start'
        });
      }

      if (window.location.hash !== '#process') {
        window.history.pushState(null, '', '#process');
      }
    }
  }

  function handleNewsletterSubmit(event) {
    event.preventDefault();

    const email = newsletterEmail.trim();

    if (!email) {
      setNewsletterMessage('Please enter your email address.');
      return;
    }

    setNewsletterLoading(true);
    setNewsletterMessage('');

    const subject = encodeURIComponent(
      'Formant Newsletter Subscription'
    );

    const body = encodeURIComponent(
      `Please subscribe this email to Formant updates:\n\n${email}\n\nInterests: Career tips, product updates, promotions.`
    );

    window.location.href =
      `mailto:hello@careerlyst.com?subject=${subject}&body=${body}`;

    setNewsletterLoading(false);
    setNewsletterMessage(
      'Your email client will open so you can confirm the subscription request.'
    );
  }

  function renderSocials() {
    return (
      <div className="footer-socials" aria-label="Formant social links">
        {SOCIAL_LINKS.map((social) =>
          social.href ? (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.label}
            >
              {social.label}
            </a>
          ) : (
            <span
              key={social.label}
              className="footer-social footer-social-pending"
              title={`${social.label} link will be added when the official profile URL is available.`}
              aria-label={`${social.label} profile link pending`}
            >
              {social.label}
            </span>
          )
        )}
      </div>
    );
  }

  function renderSection(title, key, children) {
    const isOpen = openSection === key;

    return (
      <div className={`footer-section ${isOpen ? 'is-open' : ''}`}>
        <button
          id={`footer-toggle-${key}`}
          type="button"
          className="footer-section-toggle"
          aria-expanded={isOpen}
          aria-controls={`footer-section-${key}`}
          onClick={() => toggleSection(key)}
        >
          <span>{title}</span>
          <span className="footer-section-icon" aria-hidden="true">
            {isOpen ? '−' : '+'}
          </span>
        </button>

        <div
          id={`footer-section-${key}`}
          className="footer-section-content"
          role="region"
          aria-labelledby={`footer-toggle-${key}`}
        >
          <div className="footer-section-links">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <footer className="careerlyst-footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand">
            <Logo />

            <p>
              CV, profile and interview support for your next role.
            </p>

            {renderSocials()}
          </div>

          <div className="footer-links">
            <div className="footer-column footer-column-desktop">
              <b>Explore</b>
              <Link to="/services">Services</Link>
              <a href="/#process" onClick={handleHowItWorksClick}>How it works</a>
              <Link to="/pricing">Pricing</Link>
              <Link to="/about">About</Link>
            </div>

            <div className="footer-column footer-column-desktop">
              <b>Career</b>
              <Link to="/services">Career services</Link>
              <Link to="/services">CV &amp; Resume</Link>
              <Link to="/services">Career development</Link>
            </div>

            <div className="footer-column footer-column-desktop">
              <b>Support</b>
              <Link to="/contact">Contact</Link>
              <a href="mailto:hello@careerlyst.com">
                Email
              </a>
            </div>
          </div>

          <div className="footer-mobile-sections">
            {renderSection(
              'Explore',
              'explore',
              <>
                <Link to="/services">Services</Link>
                <a href="/#process" onClick={handleHowItWorksClick}>How it works</a>
                <Link to="/pricing">Pricing</Link>
                <Link to="/about">About</Link>
              </>
            )}

            {renderSection(
              'Career',
              'career',
              <>
                <Link to="/services">Career services</Link>
                <Link to="/services">CV &amp; Resume</Link>
                <Link to="/services">Career development</Link>
              </>
            )}

            {renderSection(
              'Support',
              'support',
              <>
                <Link to="/contact">Contact</Link>
                <a href="mailto:hello@careerlyst.com">
                  Email
                </a>
              </>
            )}
          </div>
        </div>

        <div className="footer-newsletter">
          <div className="footer-newsletter-copy">
            <span className="footer-eyebrow">STAY AHEAD</span>

            <h2>
              Want Formant
              <br />
              updates?
            </h2>

            <p>
              Request career tips and product updates. Your email app will open with a prefilled message for you to review and send.
            </p>
          </div>

          <form
            className="footer-newsletter-form"
            onSubmit={handleNewsletterSubmit}
          >
            <label htmlFor="footer-newsletter-email">
              Email address
            </label>

            <div className="footer-newsletter-row">
              <input
                id="footer-newsletter-email"
                type="email"
                value={newsletterEmail}
                onChange={(event) => {
                  setNewsletterEmail(event.target.value);
                  setNewsletterMessage('');
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />

              <button
                type="submit"
                disabled={newsletterLoading}
              >
                {newsletterLoading ? 'Please wait…' : 'Request updates'}
                <span aria-hidden="true">↗</span>
              </button>
            </div>

            <small>
              Submitting opens your email app with a message to hello@careerlyst.com. Nothing is sent until you review and send it.
            </small>

            {newsletterMessage && (
              <p
                className="footer-newsletter-message"
                role="status"
              >
                {newsletterMessage}
              </p>
            )}
          </form>
        </div>

        <div className="footer-bottom">
          <span>© 2026 Formant</span>

          <span className="footer-legal">
            <Link to="/privacy">Privacy</Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms">Terms</Link>
            <span aria-hidden="true">·</span>
            <Link to="/refund">Refunds</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
