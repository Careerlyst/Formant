import React, { Component } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PublicNav from './PublicNav';
import Footer from './Footer';
import './error-experience.css';

const REQUEST_COPY = {
  connection: {
    title: 'We couldn’t connect.',
    body: 'Check your internet connection, then try again.'
  },
  service: {
    title: 'This service is taking a break.',
    body: 'We couldn’t complete that request just now. Please try again shortly.'
  },
  request: {
    title: 'We couldn’t complete that request.',
    body: 'Please try again. If the problem continues, return to the homepage.'
  },
  unexpected: {
    title: 'Something didn’t work as expected.',
    body: 'Please try again, or return to the homepage.'
  }
};

export function RequestProblem({ kind = 'unexpected', onRetry, className = '', headingLevel = 'h2' }) {
  const copy = REQUEST_COPY[kind] || REQUEST_COPY.unexpected;
  const Heading = headingLevel;
  return (
    <section className={`formant-request-problem ${className}`} role="alert" aria-live="assertive">
      <span className="formant-error-eyebrow">A MOMENTARY PAUSE</span>
      <Heading>{copy.title}</Heading>
      <p>{copy.body}</p>
      <div className="formant-error-actions">
        {onRetry && <button className="formant-error-primary" type="button" onClick={onRetry}>Try again</button>}
        <Link className="formant-error-secondary" to="/">Go to homepage</Link>
      </div>
    </section>
  );
}

export function PageNotFound() {
  const navigate = useNavigate();
  const canGoBack = window.history.length > 1;
  return (
    <div className="formant-error-page">
      <PublicNav />
      <main className="formant-error-main" id="main-content">
        <section className="formant-error-card" aria-labelledby="formant-404-title">
          <span className="formant-error-eyebrow">404 · PAGE NOT FOUND</span>
          <h1 id="formant-404-title">That page isn’t here.</h1>
          <p>The address may be incorrect, or the page may have moved. Let’s get you back on track.</p>
          <div className="formant-error-actions">
            <Link className="formant-error-primary" to="/">Go to Homepage</Link>
            <button className="formant-error-secondary" type="button" onClick={() => canGoBack ? navigate(-1) : navigate('/')}>Go Back</button>
          </div>
          <nav className="formant-error-links" aria-label="Suggested pages">
            <Link to="/services">Services</Link>
            <Link to="/showcase">Showcase</Link>
            <Link to="/about">About Formant</Link>
          </nav>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function UnexpectedErrorPage() {
  return (
    <div className="formant-error-page">
      <PublicNav />
      <main className="formant-error-main" id="main-content">
        <section className="formant-error-card" role="alert" aria-labelledby="formant-error-title">
          <span className="formant-error-eyebrow">TEMPORARY SERVICE ISSUE</span>
          <h1 id="formant-error-title">Something went wrong.</h1>
          <p>We couldn’t display this page just now. You can try again or return to the homepage.</p>
          <div className="formant-error-actions">
            <button className="formant-error-primary" type="button" onClick={() => window.location.reload()}>Try again</button>
            <Link className="formant-error-secondary" to="/">Go to Homepage</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

class ApplicationErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Keep diagnostics useful without logging component props, request data, or tokens.
    console.error('Formant page rendering failed:', error?.name || 'Error');
  }

  render() {
    return this.state.failed ? <UnexpectedErrorPage /> : this.props.children;
  }
}

export function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <ApplicationErrorBoundary key={`${location.key}:${location.pathname}${location.search}${location.hash}`}>{children}</ApplicationErrorBoundary>;
}
