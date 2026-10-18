import { useCallback, useEffect, useRef } from 'react';

/** Track the visual viewport only while a mobile conversation is active. */
export function useMessageViewport(rootRef, active) {
  const baselineHeightRef = useRef(null);
  const pageScrollRef = useRef(0);
  const keyboardOpenRef = useRef(false);

  const handleComposerFocus = useCallback(() => {
    if (typeof window === 'undefined') return;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    if (!keyboardOpenRef.current) {
      baselineHeightRef.current = Math.max(viewportHeight, window.innerHeight);
      pageScrollRef.current = window.scrollY;
    }
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !active || typeof window === 'undefined') return undefined;
    const viewport = window.visualViewport;
    let blurTimer = 0;
    let restoreTimer = 0;
    baselineHeightRef.current = Math.max(viewport?.height || window.innerHeight, window.innerHeight);

    const restoreNormalViewport = () => {
      keyboardOpenRef.current = false;
      root.style.removeProperty('--messages-visible-height');
      const baseline = baselineHeightRef.current;
      baselineHeightRef.current = Math.max(viewport?.height || window.innerHeight, window.innerHeight);
      if (baseline != null && Math.abs(window.scrollY - pageScrollRef.current) > 2) {
        window.cancelAnimationFrame(restoreTimer);
        restoreTimer = window.requestAnimationFrame(() => window.scrollTo(0, pageScrollRef.current));
      }
    };

    const updateViewport = () => {
      const height = viewport?.height || window.innerHeight;
      const baseline = baselineHeightRef.current || height;
      if (height < baseline - 120) {
        keyboardOpenRef.current = true;
        root.style.setProperty('--messages-visible-height', `${Math.round(height)}px`);
      } else if (keyboardOpenRef.current && height >= baseline - 80) {
        restoreNormalViewport();
      } else if (!keyboardOpenRef.current) {
        baselineHeightRef.current = Math.max(height, window.innerHeight);
      }
    };

    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        const focusedComposer = root.contains(document.activeElement)
          && document.activeElement.matches?.('.messages-composer-textarea, .admin-messages-composer textarea');
        if (!focusedComposer) restoreNormalViewport();
      }, 160);
    };

    const onOrientationChange = () => {
      window.setTimeout(() => {
        if (!keyboardOpenRef.current) {
          baselineHeightRef.current = Math.max(viewport?.height || window.innerHeight, window.innerHeight);
          root.style.removeProperty('--messages-visible-height');
        }
        updateViewport();
      }, 120);
    };

    updateViewport();
    root.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', onOrientationChange);
    window.addEventListener('pageshow', updateViewport);
    return () => {
      window.clearTimeout(blurTimer);
      window.cancelAnimationFrame(restoreTimer);
      root.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', onOrientationChange);
      window.removeEventListener('pageshow', updateViewport);
      root.style.removeProperty('--messages-visible-height');
      baselineHeightRef.current = null;
      keyboardOpenRef.current = false;
    };
  }, [active, rootRef]);

  return handleComposerFocus;
}
