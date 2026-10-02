import React, { useEffect, useState } from 'react';
import './Preloader.css';

/**
 * Formant premium web preloader.
 *
 * Drop <Preloader /> next to your app root in main.jsx.
 * It automatically fades out once the initial loading window is complete.
 */
export default function Preloader({
  eyebrow = 'CAREER SERVICES, REFINED',
  slogan = 'Move with clarity.',
  subline = 'Your next chapter starts here.',
  brand = 'Formant',
  duration = 1500,
}) {
  const [leaving, setLeaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Prevent background scrolling while preloader is active
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Synchronized bottom-to-top slide timing
    const SLIDE_DURATION_MS = prefersReducedMotion ? 180 : 580;
    const targetDuration = prefersReducedMotion ? Math.min(duration, 350) : duration;
    const exitDelay = Math.max(200, targetDuration - SLIDE_DURATION_MS);
    const completeDelay = exitDelay + SLIDE_DURATION_MS;

    const exitTimer = window.setTimeout(() => {
      setLeaving(true);
    }, exitDelay);

    // When the bottom-to-top slide is 100% complete, restore body scroll and unmount
    const completeTimer = window.setTimeout(() => {
      document.body.style.overflow = originalOverflow;
      setHidden(true);
    }, completeDelay);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [duration]);

  if (hidden) return null;

  return (
    <div
      className={`preloader ${leaving ? 'preloader--leaving' : ''}`}
      aria-label="Loading Formant"
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
          <img
            src="/assets/formant-symbol.svg"
            alt=""
            aria-hidden="true"
            className="preloader__symbol preloader__mark"
            width="540"
            height="510"
          />
          {brand}
        </h1>
      </div>

      <div className="preloader__progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
