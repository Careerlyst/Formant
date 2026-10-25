import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import AvatarPickerDialog from '../components/AvatarPickerDialog';
import ProfileAvatar from '../components/ProfileAvatar';
import { supabase } from '../lib/supabase';
import { fetchProfile, saveOwnProfileAvatar } from '../lib/profileRepository';
import { clearPendingAvatarSelection, getPendingAvatarSelection, getProfileAvatar } from '../lib/profileAvatars';
import { load, patch } from '../lib/store';

function destinationFor(user, from) {
  const path = from?.pathname;
  if (typeof path === 'string' && path.startsWith('/') && !path.startsWith('/admin') && path !== '/onboarding/avatar') {
    return `${path}${from.search || ''}${from.hash || ''}`;
  }
  return user?.user_metadata?.careerlyst_assessment_completed === true ? '/dashboard' : '/assessment';
}

export default function AvatarOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const savedAvatar = getProfileAvatar(profile?.avatar_id);
  const selectedAvatar = getProfileAvatar(selectedAvatarId);
  const initials = useMemo(() => {
    const words = String(profile?.name || user?.email || 'Client').split(/[\s@]+/).filter(Boolean);
    return words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase() : String(words[0] || 'C').slice(0, 2).toUpperCase();
  }, [profile?.name, user?.email]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      setLoading(true);
      setError('');
      try {
        let currentUser;
        let currentProfile;
        if (supabase) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          currentUser = data?.session?.user;
          if (!currentUser) throw new Error('Your sign-in session was not found. Please sign in again.');
          currentProfile = await fetchProfile(currentUser.id);
        } else {
          const current = load();
          currentUser = current.user;
          currentProfile = current.profile;
          if (!currentUser) throw new Error('Sign in before choosing your avatar.');
        }
        if (!currentProfile) throw new Error('Your account profile is not available yet. Please try again shortly or contact Formant support.');
        if (!active) return;
        setUser(currentUser);
        setProfile(currentProfile);
        if (getProfileAvatar(currentProfile.avatar_id)) {
          clearPendingAvatarSelection();
          navigate(destinationFor(currentUser, location.state?.from), { replace: true });
          return;
        }
        const pending = getPendingAvatarSelection(currentUser.email);
        const metadataAvatar = getProfileAvatar(currentUser.user_metadata?.formant_avatar_id);
        setSelectedAvatarId(pending?.avatarId || metadataAvatar?.id || null);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Your profile could not be loaded. Please retry.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [attempt, location.state, navigate]);

  async function saveAvatar() {
    if (!selectedAvatar || saving) return;
    setSaving(true);
    setError('');
    try {
      const updated = supabase
        ? { ...(profile || {}), ...(await saveOwnProfileAvatar(selectedAvatar.id)) }
        : (patch((current) => ({ ...current, profile: { ...(current.profile || {}), avatar_id: selectedAvatar.id } })), { ...profile, avatar_id: selectedAvatar.id });
      setProfile(updated);
      patch((current) => ({ ...current, profile: { ...(current.profile || {}), ...updated, avatar_id: selectedAvatar.id } }));
      clearPendingAvatarSelection();
      window.dispatchEvent(new CustomEvent('careerlyst-profile-updated', { detail: { userId: user.id, avatarId: selectedAvatar.id, name: updated.name } }));
      navigate(destinationFor(user, location.state?.from), { replace: true });
    } catch (saveError) {
      setError(saveError?.message || 'Your avatar was not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="avatar-onboarding-page">
      <header className="avatar-onboarding-header"><Logo /></header>
      <section className="avatar-onboarding-card" aria-labelledby="avatar-onboarding-title">
        <p className="eyebrow">ACCOUNT SETUP</p>
        <h1 id="avatar-onboarding-title">Choose your Formant avatar</h1>
        <p className="avatar-onboarding-copy">Select an illustrated profile image to finish setting up your account. You can change it later from My Profile.</p>
        {error && <p className="profile-avatar-picker-error" role="alert">{error}</p>}
        {!loading && !profile && error && <button type="button" className="btn" onClick={() => setAttempt((value) => value + 1)}>Retry profile check</button>}
        {loading ? <p role="status">Loading your account…</p> : (
          <>
            <div className="avatar-onboarding-selected">
              {selectedAvatar ? <ProfileAvatar avatarId={selectedAvatar.id} decorative initials={initials} /> : <span aria-hidden="true">{initials}</span>}
              <div><strong>{selectedAvatar ? `Avatar ${String(selectedAvatar.id).padStart(3, '0')}` : 'No avatar selected'}</strong><span>{savedAvatar ? 'Current saved avatar' : 'Required before continuing'}</span></div>
              <button type="button" className="btn" onClick={() => setPickerOpen(true)}>{selectedAvatar ? 'Change choice' : 'Choose avatar'}</button>
            </div>
            <button type="button" className="btn dark avatar-onboarding-continue" onClick={saveAvatar} disabled={!selectedAvatar || saving}>{saving ? 'Saving…' : 'Save and continue'}</button>
          </>
        )}
      </section>
      <AvatarPickerDialog
        open={pickerOpen}
        selectedAvatarId={selectedAvatarId}
        onSelectedChange={setSelectedAvatarId}
        onSave={() => setPickerOpen(false)}
        onCancel={() => setPickerOpen(false)}
        saveLabel="Use this avatar"
        title="Choose your avatar"
        description="Only approved Formant avatars can be used on your profile."
      />
    </main>
  );
}
