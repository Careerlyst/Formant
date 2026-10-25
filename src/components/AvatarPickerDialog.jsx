import React, { useEffect, useRef, useState } from 'react';
import {
  PROFILE_AVATAR_AGE_CATEGORIES,
  getProfileAvatar,
  getProfileAvatarsByAgeCategory
} from '../lib/profileAvatars';
import './avatar-picker.css';

export default function AvatarPickerDialog({
  open,
  selectedAvatarId,
  onSelectedChange,
  onSave,
  onCancel,
  saving = false,
  error = '',
  saveLabel = 'Save avatar',
  cancelLabel = 'Cancel',
  saveDisabled = false,
  title = 'Choose an avatar',
  description = 'Choose one of the illustrated portraits in the Formant library.'
}) {
  const dialogRef = useRef(null);
  const gridRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [imagesFailed, setImagesFailed] = useState(() => new Set());
  const [imagesReady, setImagesReady] = useState(() => new Set());
  const [ageCategory, setAgeCategory] = useState('all');
  const visibleAvatars = getProfileAvatarsByAgeCategory(ageCategory);

  useEffect(() => {
    if (!open) return undefined;
    setAgeCategory('all');
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      const selected = gridRef.current?.querySelector('[aria-selected="true"]');
      (selected || gridRef.current?.querySelector('[role="option"]'))?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel?.();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled])') || []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      || !event.target.matches('[role="option"]')) return;
    const options = Array.from(gridRef.current?.querySelectorAll('[role="option"]') || []);
    const index = options.indexOf(event.target);
    const columns = Math.max(1, getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length);
    const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
    event.preventDefault();
    options[Math.max(0, Math.min(options.length - 1, index + offset))]?.focus();
  }

  return (
    <div className="profile-avatar-picker-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onCancel?.();
    }}>
      <section
        ref={dialogRef}
        className="profile-avatar-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-avatar-picker-title"
        onKeyDown={handleKeyDown}
      >
        <header className="profile-avatar-picker-header">
          <div>
            <h2 id="profile-avatar-picker-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="profile-avatar-picker-close" onClick={onCancel} disabled={saving} aria-label="Close avatar picker">×</button>
        </header>

        {error && <div className="profile-avatar-picker-error" role="alert">{error}</div>}

        <div className="profile-avatar-age-filters" role="group" aria-label="Filter avatars by age group">
          {PROFILE_AVATAR_AGE_CATEGORIES.map((category) => {
            const count = getProfileAvatarsByAgeCategory(category.id).length;
            return (
              <button
                type="button"
                key={category.id}
                className="profile-avatar-age-filter"
                aria-pressed={ageCategory === category.id}
                aria-label={`${category.label}, ${count} ${count === 1 ? 'avatar' : 'avatars'}`}
                onClick={() => setAgeCategory(category.id)}
              >
                <span>{category.label}</span>
                <span className="profile-avatar-age-filter-count" aria-hidden="true">{count}</span>
              </button>
            );
          })}
        </div>

        <div
          ref={gridRef}
          className="profile-avatar-picker-grid"
          role={visibleAvatars.length ? 'listbox' : undefined}
          aria-label={visibleAvatars.length ? 'Approved Formant avatars' : undefined}
        >
          {visibleAvatars.map((avatar) => (
            <button
              type="button"
              key={avatar.id}
              className={`profile-avatar-option ${selectedAvatarId === avatar.id ? 'is-selected' : ''}`}
              role="option"
              aria-selected={selectedAvatarId === avatar.id}
              aria-label={`Avatar ${String(avatar.id).padStart(3, '0')}: ${avatar.alt}`}
              onClick={() => onSelectedChange?.(avatar.id)}
            >
              {!imagesFailed.has(avatar.id) ? (
                <img
                  src={avatar.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={imagesReady.has(avatar.id) ? 'is-ready' : ''}
                  onLoad={() => setImagesReady((current) => new Set(current).add(avatar.id))}
                  onError={() => setImagesFailed((current) => new Set(current).add(avatar.id))}
                />
              ) : <span className="profile-avatar-missing" aria-hidden="true">Image unavailable</span>}
              <span>Avatar {String(avatar.id).padStart(3, '0')}</span>
            </button>
          ))}
          {visibleAvatars.length === 0 && (
            <p className="profile-avatar-age-empty" role="status">No avatars are categorized in this age group. Choose All to view the full library.</p>
          )}
        </div>

        <footer className="profile-avatar-picker-footer">
          <span aria-live="polite">{getProfileAvatar(selectedAvatarId) ? `Avatar ${String(selectedAvatarId).padStart(3, '0')} selected` : 'Choose an avatar to continue'}</span>
          <div>
            <button type="button" className="profile-btn-cancel" onClick={onCancel} disabled={saving}>{cancelLabel}</button>
            <button type="button" className="profile-btn-save" onClick={onSave} disabled={saving || saveDisabled || !getProfileAvatar(selectedAvatarId)}>
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
