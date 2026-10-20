import React, { useEffect, useState } from 'react';
import './skeleton-state.css';

const DEFAULT_COUNTS = {
  cards: 3,
  rows: 4,
  table: 5,
  messages: 4,
  metrics: 4,
  services: 4,
  profile: 1,
  form: 1,
  inline: 1,
  thread: 4
};

function SkeletonItem({ variant, index = 0 }) {
  if (variant === 'metrics') {
    return <div className="formant-skeleton-metric"><i /><i /><i /></div>;
  }

  if (variant === 'profile' || variant === 'form') {
    return (
      <div className={`formant-skeleton-${variant}-shape`}>
        {variant === 'profile' && <i className="formant-skeleton-avatar" />}
        <div className="formant-skeleton-copy">
          <i className="formant-skeleton-line is-medium" />
          <i className="formant-skeleton-line is-short" />
          {variant === 'form' && <>
            <span className="formant-skeleton-field"><i /><i /></span>
            <span className="formant-skeleton-field"><i /><i /></span>
            <span className="formant-skeleton-field"><i /><i /></span>
          </>}
        </div>
      </div>
    );
  }

  if (variant === 'cards' || variant === 'services') {
    return <div className="formant-skeleton-card"><i className="formant-skeleton-media" /><i className="formant-skeleton-line is-medium" /><i className="formant-skeleton-line" /><i className="formant-skeleton-line is-short" /></div>;
  }

  if (variant === 'messages') {
    return <div className="formant-skeleton-message"><i className="formant-skeleton-avatar" /><div className="formant-skeleton-copy"><i className="formant-skeleton-line is-medium" /><i className="formant-skeleton-line" /></div></div>;
  }

  if (variant === 'thread') {
    return <div className={`formant-skeleton-bubble${index % 2 ? ' is-outgoing' : ''}`}><i /><i /></div>;
  }

  if (variant === 'table') {
    return <div className="formant-skeleton-table-row"><i className="formant-skeleton-line is-medium" /><i className="formant-skeleton-line is-short" /><i className="formant-skeleton-line is-short" /></div>;
  }

  return <div className="formant-skeleton-row"><div className="formant-skeleton-copy"><i className="formant-skeleton-line is-medium" /><i className="formant-skeleton-line" /></div><i className="formant-skeleton-line is-short formant-skeleton-trailing" /></div>;
}

export default function SkeletonState({ label = 'Loading content', variant = 'rows', count = DEFAULT_COUNTS[variant] || 4, className = '' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className={`formant-skeleton-state formant-skeleton-state--${variant}${className ? ` ${className}` : ''}`} role="status" aria-label={label} aria-busy="true">
      <span className="formant-skeleton-sr-only">{label}</span>
      <div className="formant-skeleton-layout" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => <SkeletonItem key={index} variant={variant} index={index} />)}
      </div>
    </div>
  );
}
