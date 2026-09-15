import React, { useEffect, useState } from 'react';
import './Preloader.css';

/**
 * Careerlyst premium web preloader.
 *
 * Drop <Preloader /> next to your app root in main.jsx.
 * It automatically fades out once the initial loading window is complete.
 */
export default function Preloader({
  eyebrow = 'CAREER SERVICES, REFINED',
  slogan = 'Move with clarity.',
  subline = 'Your next chapter starts here.',
  brand = 'Careerlyst',
  duration = 1900,
}) {
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLeaving(true), Math.max(500, duration - 420));
    const hideTimer = window.setTimeout(() => setHidden(true), Math.max(900, duration));

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [duration]);

  if (hidden) return null;

  return (
    <div
      className={`preloader ${leaving ? 'preloader--leaving' : ''}`}
      aria-label="Loading Careerlyst"
      role="status"
    >
      <div className="preloader__glow preloader__glow--one" />
      <div className="preloader__glow preloader__glow--two" />

      <div className="preloader__inner">
        <p className="preloader__eyebrow">{eyebrow}</p>

        <div className="preloader__copy">
          <p className="preloader__slogan">{slogan}</p>
          <p className="preloader__subline">{subline}</p>
        </div>

        <h1 className="preloader__brand">
          <span className="preloader__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {brand}
        </h1>
      </div>

      <div className="preloader__progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
