import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { supabase } from '../lib/supabase';

function getUserName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Account'
  );
}

function getInitials(user) {
  const name = getUserName(user).trim();
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase() || 'U';
}

function getAvatarUrl(user) {
  return (
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    ''
  );
}

export default function PublicNav() {
  const navigate = useNavigate();
  const navRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);

  useEffect(() => {
    let mounted = true;
    let authResolved = false;

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        authResolved = true;

        if (error) {
          console.error('Public navigation auth check failed:', error);
          setSession(null);
        } else {
          setSession(data?.session || null);
        }
      } finally {
        if (mounted) setAuthReady(true);
      }
    }

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;

        // getSession() decides the initial state. Auth events keep it
        // synchronized after initialization without causing a logged-out flash.
        if (!authResolved) return;

        setSession(nextSession);
        setAuthReady(true);
      }
    );

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!navRef.current?.contains(event.target)) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const closeAccount = () => setAccountOpen(false);
  const isAuthenticated = authReady && Boolean(session?.user);
  const user = session?.user;
  const userName = getUserName(user);
  const avatarUrl = getAvatarUrl(user);
  const initials = getInitials(user);

  async function handleLogout() {
    closeAccount();
    closeMenu();

    if (supabase) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout failed:', error);
        return;
      }
    }

    navigate('/login', { replace: true });
  }

  return (
    <header ref={navRef} className={`header ${menuOpen ? 'menu-open' : ''}`}>
      <div className="nav">
        <Logo />

        <nav className="desktop-nav">
          <Link to="/services">Services</Link>
          <a href="/#process">How it works</a>
          <Link to="/pricing">Pricing</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        <div className="nav-actions">
          {authReady && !isAuthenticated && (
            <>
              <Link className="pill lime nav-cta" to="/signup">
                Get Started
                <span>↗</span>
              </Link>

              <Link className="login-link" to="/login">
                Log In
              </Link>
            </>
          )}

          {authReady && isAuthenticated && (
            <div className="account-menu">
              <button
                className="account-avatar-button"
                type="button"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="account-avatar-image" />
                ) : (
                  <span className="account-avatar-initials">{initials}</span>
                )}
              </button>

              {accountOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown-head">
                    <span className="account-dropdown-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="account-avatar-image" />
                      ) : (
                        initials
                      )}
                    </span>
                    <div>
                      <strong>{userName}</strong>
                      <span>{user?.email || ''}</span>
                    </div>
                  </div>

                  <div className="account-dropdown-links">
                    <Link to="/dashboard" role="menuitem" onClick={closeAccount}>
                      Dashboard
                      <span>↗</span>
                    </Link>
                    <Link to="/dashboard/profile" role="menuitem" onClick={closeAccount}>
                      Profile
                      <span>↗</span>
                    </Link>
                    <Link to="/dashboard/settings" role="menuitem" onClick={closeAccount}>
                      Settings
                      <span>↗</span>
                    </Link>
                  </div>

                  <button
                    className="account-dropdown-logout"
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                  >
                    Log Out
                    <span>↗</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
        </button>
      </div>

      <div className="mobile-nav">
        <nav className="mobile-nav-links">
          <Link to="/services" onClick={closeMenu}>
            <span>Services</span>
            <span>↗</span>
          </Link>
          <a href="/#process" onClick={closeMenu}>
            <span>How it works</span>
            <span>↗</span>
          </a>
          <Link to="/pricing" onClick={closeMenu}>
            <span>Pricing</span>
            <span>↗</span>
          </Link>
          <Link to="/about" onClick={closeMenu}>
            <span>About</span>
            <span>↗</span>
          </Link>
          <Link to="/contact" onClick={closeMenu}>
            <span>Contact</span>
            <span>↗</span>
          </Link>
        </nav>

        <div className="mobile-nav-footer">
          {authReady && !isAuthenticated && (
            <>
              <Link className="mobile-profile-button" to="/signup" onClick={closeMenu}>
                Get Started
                <span>↗</span>
              </Link>
              <p>
                Already have an account?{' '}
                <Link to="/login" onClick={closeMenu}>Log In</Link>
              </p>
            </>
          )}

          {authReady && isAuthenticated && (
            <div className="mobile-account-actions">
              <div className="mobile-account-summary">
                <span className="account-dropdown-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="account-avatar-image" />
                  ) : (
                    initials
                  )}
                </span>
                <div>
                  <strong>{userName}</strong>
                  <span>{user?.email || ''}</span>
                </div>
              </div>

              <Link className="mobile-profile-button" to="/dashboard" onClick={closeMenu}>
                Dashboard
                <span>↗</span>
              </Link>

              <div className="mobile-account-links">
                <Link to="/dashboard/profile" onClick={closeMenu}>Profile</Link>
                <Link to="/dashboard/settings" onClick={closeMenu}>Settings</Link>
                <button type="button" onClick={handleLogout}>Log Out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
