import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Shared contextual Reply / More actions for client and staff messages. */
export default function MessageActions({ active = null, contextual = false, canReply = true, canEdit, canDelete, onReply, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const wasActiveRef = useRef(Boolean(active));
  const moreAvailable = Boolean(canEdit || canDelete);

  useLayoutEffect(() => {
    if (!open || !menuRef.current || !triggerRef.current) return undefined;
    const updatePosition = () => {
      const menu = menuRef.current;
      const trigger = triggerRef.current;
      if (!menu || !trigger) return;
      const visual = window.visualViewport;
      const viewTop = Math.max(0, visual?.offsetTop || 0);
      const viewBottom = Math.min(window.innerHeight, viewTop + (visual?.height || window.innerHeight));
      const viewLeft = Math.max(0, visual?.offsetLeft || 0);
      const viewRight = Math.min(window.innerWidth, viewLeft + (visual?.width || window.innerWidth));
      const composer = document.querySelector('.messages-composer-area, .admin-messages-composer');
      const composerTop = composer?.getBoundingClientRect().top;
      const safeBottom = Number.isFinite(composerTop) && composerTop > viewTop
        ? Math.min(viewBottom - 8, composerTop - 8)
        : viewBottom - 8;
      const rect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const width = Math.min(menuRect.width || 148, viewRight - viewLeft - 16);
      const height = Math.min(menuRect.height || 96, Math.max(44, safeBottom - viewTop - 16));
      const below = rect.bottom + 4;
      const top = below + height <= safeBottom
        ? below
        : Math.max(viewTop + 8, Math.min(rect.top - height - 4, safeBottom - height));
      const left = Math.max(viewLeft + 8, Math.min(rect.right - width, viewRight - width - 8));
      setMenuStyle({ left, top, width, maxHeight: height });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        items[(index + delta + items.length) % items.length].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        items[event.key === 'Home' ? 0 : items.length - 1].focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    menuRef.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (contextual && wasActiveRef.current && active === false && open) setOpen(false);
    wasActiveRef.current = Boolean(active);
  }, [active, contextual, open]);

  function choose(action) {
    setOpen(false);
    action?.();
    if (action === onDelete) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (!canReply && !moreAvailable) return null;
  return (
    <div className={`message-actions${contextual ? ' is-contextual' : ''}${active ? ' is-active' : ''}`} role="group" aria-label="Actions for this message">
      {active && <span className="sr-only" role="status">Message selected. Reply and available message actions are shown.</span>}
      {canReply && (
        <button className="message-actions-reply" type="button" onClick={() => choose(onReply)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m9 17-5-5 5-5M4 12h9a6 6 0 0 1 6 6v1" /></svg> Reply
        </button>
      )}
      {moreAvailable && (
        <>
          <button
            ref={triggerRef}
            className="message-actions-trigger"
            type="button"
            aria-label="More message actions"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
          </button>
          {open && createPortal(
            <div className="message-actions-menu-portal" role="menu" ref={menuRef} style={menuStyle || undefined}>
              {canEdit && <button type="button" role="menuitem" onClick={() => choose(onEdit)}>Edit</button>}
              {canDelete && <button type="button" role="menuitem" className="is-destructive" onClick={() => choose(onDelete)}>Delete</button>}
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
