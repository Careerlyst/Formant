import React, { useEffect, useState } from 'react';
import { getFallbackProfileAvatar, getProfileAvatar } from '../lib/profileAvatars';

export default function ProfileAvatar({ avatarId, alt = '', className = '', initials = '', decorative = false }) {
  const [failedAvatarIds, setFailedAvatarIds] = useState(() => new Set());
  const requestedAvatar = getProfileAvatar(avatarId);
  const fallbackAvatar = getFallbackProfileAvatar();
  const primaryAvatar = requestedAvatar || fallbackAvatar;
  const avatar = primaryAvatar && !failedAvatarIds.has(primaryAvatar.id)
    ? primaryAvatar
    : requestedAvatar && fallbackAvatar && !failedAvatarIds.has(fallbackAvatar.id)
      ? fallbackAvatar
      : null;
  useEffect(() => setFailedAvatarIds(new Set()), [requestedAvatar?.id]);
  if (!avatar) {
    return <span className={className} aria-hidden={decorative ? 'true' : undefined}>{initials || 'F'}</span>;
  }
  return <img className={className} src={avatar.src} alt={decorative ? '' : (alt || avatar.alt)} loading="lazy" decoding="async" onError={() => setFailedAvatarIds((current) => new Set(current).add(avatar.id))} />;
}
