import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { demoLogin, patch } from '../lib/store'
import { supabase } from '../lib/supabase'

/* =========================================================
   RESEND LINK COMPONENT
========================================================= */

function ResendLink({ email }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState({ text: "", type: "" });

  useEffect(() => {
    if (timeLeft > 0) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleResend = async () => {
    if (!email) return;
    setIsLoading(true);
    setStatus({ text: "", type: "" });

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      setStatus({ text: error.message, type: "error" });
    } else {
      setStatus({ text: "Confirmation link resent successfully!", type: "success" });
      setCanResend(false);
      setTimeLeft(30);
    }
    setIsLoading(false);
  };

  return (
    <div style={{ marginTop: 'var(--space-4, 16px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2, 8px)', fontSize: 'var(--font-body-sm, 12px)', fontFamily: "'DM Sans', sans-serif", color: 'var(--muted, #6d7069)' }}>
        <span>Didn't receive the link?</span>

        {canResend ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={isLoading}
            style={{
              padding: '4px 12px',
              borderRadius: '2px', 
              border: '1px solid var(--line, #deded5)', 
              background: 'var(--paper, #fff)',
              color: 'var(--ink, #11120f)',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: 'none',
              transition: 'background 180ms ease'
            }}
          >
            {isLoading ? "Sending..." : "Resend"}
          </button>
        ) : (
          <span>
            Resend in <strong style={{ color: 'var(--ink, #11120f)' }}>{timeLeft}s</strong>
          </span>
        )}
      </div>

      {status.text && (
        <p style={{
          marginTop: 'var(--space-2, 8px)',
          fontSize: 'var(--font-sm, 11px)', 
          color: status.type === 'error' ? 'var(--danger, #b94a48)' : 'var(--green, #8fb61c)',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: '500'
        }}>
          {status.text}
        </p>
      )}
    </div>
  );
}


/* =========================================================
   AUTH
========================================================= */

/*
  Password Strength Evaluator
  Evaluates password against standard security criteria:
  - Length (minimum 8 for good security; Supabase requires 6)
  - Lowercase letter (a-z)
  - Uppercase letter (A-Z)
  - Numeric digit (0-9)
  - Special symbol (!@#$%^&*, etc.)
*/
export function evaluatePasswordStrength(password = '') {
  const requirements = [
    { id: 'length', label: '8+ characters', met: password.length >= 8 },
    { id: 'lowercase', label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { id: 'uppercase', label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'number', label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { id: 'symbol', label: 'Special symbol', met: /[^A-Za-z0-9]/.test(password) }
  ];

  if (!password) {
    return { score: 0, label: '', color: '', requirements };
  }

  const metCount = requirements.filter((r) => r.met).length;

  let score = 1;
  let label = 'Weak';
  let color = 'var(--danger, #b94a48)';

  if (password.length >= 6 && metCount >= 2) {
    score = 2;
    label = 'Fair';
    color = '#d97706'; // warm amber
  }
  if (password.length >= 8 && metCount >= 4) {
    score = 3;
    label = 'Good';
    color = '#84cc16'; // lime-green
  }
  if (password.length >= 10 && metCount === 5) {
    score = 4;
    label = 'Strong';
    color = 'var(--lime, #c7f72f)';
  }

  return { score, label, color, requirements };
}

/*
  Send users to the lead assessment until they complete it.
  Completed users can go directly to the dashboard.
*/
function getPostAuthPath(user) {
  const completed =
    user?.user_metadata?.careerlyst_assessment_completed === true

  return completed ? '/dashboard' : '/assessment'
}

export default function Auth({ signup = false }) {
  const nav = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')

  const [rememberMe, setRememberMe] = useState(true)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error') // 'error' | 'success'
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Track authentication method: 'select' (choice view) | 'email' (form view)
  const [authMethod, setAuthMethod] = useState('select')

  // Track unverified email to show the dedicated verification screen
  const [unverifiedEmail, setUnverifiedEmail] = useState(null)

  // Reset method selection and clear messages when switching between login and signup
  useEffect(() => {
    setAuthMethod('select')
    setMessage('')
    setUnverifiedEmail(null)
  }, [signup])

  // Field touched states for inline validation
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
    terms: false
  })

  /* =======================================================
     REMEMBER ME & LOCAL STORAGE PERSISTENCE
  ======================================================= */
  useEffect(() => {
    if (!signup) {
      try {
        const rememberedEmail = localStorage.getItem('formant_remembered_email')
        const rememberedPref = localStorage.getItem('formant_remember_me')
        if (rememberedEmail) {
          setEmail(rememberedEmail)
        }
        if (rememberedPref !== null) {
          setRememberMe(rememberedPref === 'true')
        }
      } catch (err) {
        // Storage access fallback
      }
    }
  }, [signup])

  /* =======================================================
     GOOGLE OAUTH ERROR & AUTH STATE LISTENERS
  ======================================================= */
  useEffect(() => {
    // 1. Check for errors passed in navigation state
    if (location.state?.error) {
      setMessage(location.state.error)
      setMessageType('error')
      return
    }

    // 2. Check for OAuth error params in URL query or hash
    const searchParams = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
    )

    const errorDesc =
      searchParams.get('error_description') ||
      hashParams.get('error_description')
    const errorCode =
      searchParams.get('error') || hashParams.get('error')

    if (errorDesc || errorCode) {
      let friendlyMsg =
        errorDesc || 'Google sign-in could not be completed.'
      if (errorCode === 'access_denied') {
        friendlyMsg = 'Google sign-in was cancelled.'
      }
      setMessage(friendlyMsg)
      setMessageType('error')
    }
  }, [location.state])

  useEffect(() => {
    if (!supabase) return

    // Listen for SIGNED_IN event in case of OAuth direct return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user
          const userName =
            user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.email?.split('@')[0] ||
            'Client'

          patch((current) => ({
            ...current,
            user: {
              ...(current.user || {}),
              email: user.email,
              name: userName
            },
            profile: {
              ...(current.profile || {}),
              email: user.email,
              name: userName
            }
          }))

          nav(getPostAuthPath(user), { replace: true })
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [nav])

  /* =======================================================
     GOOGLE OAUTH SIGN IN
  ======================================================= */
  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return
    setMessage('')
    setGoogleLoading(true)

    try {
      if (!supabase) {
        setMessage('Google authentication requires Supabase to be configured.')
        setMessageType('error')
        setGoogleLoading(false)
        return
      }

      try {
        sessionStorage.setItem('formant_session_active', 'true')
      } catch (storageErr) {
        // Ignore restricted storage
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      })

      if (error) {
        setMessage(error.message || 'Failed to initiate Google sign-in.')
        setMessageType('error')
        setGoogleLoading(false)
      }
    } catch (err) {
      console.error('Google sign-in error:', err)
      setMessage(err?.message || 'Something went wrong with Google sign-in.')
      setMessageType('error')
      setGoogleLoading(false)
    }
  }

  /* =======================================================
     DERIVED VALIDATION STATE
  ======================================================= */
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailInvalid = email.length > 0 && !emailRegex.test(email.trim())
  const emailEmpty = email.trim().length === 0
  const emailError = (touched.email && emailEmpty)
    ? 'Email address is required.'
    : (touched.email && emailInvalid)
      ? 'Please enter a valid email address.'
      : ''

  const nameError = (signup && touched.name && name.trim().length === 0)
    ? 'Full name is required.'
    : ''

  const passwordEmpty = password.length === 0
  const passwordTooShort = password.length > 0 && password.length < 6
  const passwordError = (touched.password && passwordEmpty)
    ? 'Password is required.'
    : (touched.password && passwordTooShort)
      ? 'Password must be at least 6 characters.'
      : ''

  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== password
  const confirmEmpty = confirmPassword.length === 0
  const confirmError = (signup && touched.confirmPassword && confirmEmpty)
    ? 'Please confirm your password.'
    : (signup && touched.confirmPassword && confirmMismatch)
      ? 'Passwords do not match.'
      : ''

  const termsError = (signup && touched.terms && !termsAccepted)
    ? 'You must accept the Terms & Conditions and Privacy Policy.'
    : ''

  const passwordStrength = evaluatePasswordStrength(password)

  /* =======================================================
     SUBMIT
  ======================================================= */
  async function submit(e) {
    e.preventDefault()

    if (loading) return

    // Mark fields as touched
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
      terms: true
    })

    const cleanEmail = email.trim()
    const cleanName = name.trim()

    // Validate inputs
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setMessage('Please enter a valid email address.')
      setMessageType('error')
      return
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      setMessageType('error')
      return
    }

    if (signup) {
      if (!cleanName) {
        setMessage('Please enter your full name.')
        setMessageType('error')
        return
      }

      if (password !== confirmPassword) {
        setMessage('Passwords do not match.')
        setMessageType('error')
        return
      }

      if (!termsAccepted) {
        setMessage('Please agree to the Terms & Conditions and Privacy Policy.')
        setMessageType('error')
        return
      }
    }

    setMessage('')
    setLoading(true)
    setUnverifiedEmail(null)

    try {
      /* =====================================================
         SUPABASE AUTH
      ===================================================== */
      if (supabase) {
        if (signup) {
          const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                name: cleanName
              }
            }
          })

          if (error) {
            setMessage(error.message)
            setMessageType('error')
            return
          }

          if (!data?.session) {
            setMessage(
              'Account created successfully. Please check your email to activate your account.'
            )
            setMessageType('success')
            setUnverifiedEmail(cleanEmail)
            return
          }

          const user = data.user
          const userName =
            user?.user_metadata?.name ||
            cleanName ||
            user?.email?.split('@')[0] ||
            'Client'

          patch((current) => ({
            ...current,
            user: {
              ...(current.user || {}),
              email: user?.email || cleanEmail,
              name: userName
            },
            profile: {
              ...(current.profile || {}),
              email: user?.email || cleanEmail,
              name: userName
            }
          }))

          nav(getPostAuthPath(user))
          return
        }

        // LOGIN
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        })

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            setMessage('Please confirm your email address before logging in.')
            setMessageType('error')
            setUnverifiedEmail(cleanEmail)
          } else {
            setMessage('Invalid login credentials — check your email or password.')
            setMessageType('error')
          }
          return
        }

        if (!data?.session) {
          setMessage('Login could not be completed. Please try again.')
          setMessageType('error')
          return
        }

        // Apply Remember Me preference
        try {
          if (rememberMe) {
            localStorage.setItem('formant_remembered_email', cleanEmail)
            localStorage.setItem('formant_remember_me', 'true')
            sessionStorage.setItem('formant_session_active', 'true')
          } else {
            localStorage.removeItem('formant_remembered_email')
            localStorage.setItem('formant_remember_me', 'false')
            sessionStorage.setItem('formant_session_active', 'true')
          }
        } catch (storageErr) {
          // Ignore restricted storage
        }

        const user = data.user
        const userName =
          user?.user_metadata?.name ||
          user?.email?.split('@')[0] ||
          'Client'

        patch((current) => ({
          ...current,
          user: {
            ...(current.user || {}),
            email: user?.email || cleanEmail,
            name: userName
          },
          profile: {
            ...(current.profile || {}),
            email: user?.email || cleanEmail,
            name: userName
          }
        }))

        nav(getPostAuthPath(user))
        return
      }

      /* =====================================================
         DEMO MODE
      ===================================================== */
      demoLogin(
        cleanEmail,
        cleanName || 'Demo Client'
      )
      nav('/assessment')

    } catch (error) {
      console.error('Authentication error:', error)
      setMessage(
        error?.message || 'Something went wrong. Please try again.'
      )
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  /* =========================================================
     UI
  ========================================================= */
  return (
    <main className="login-page">

      {/* =====================================================
         HEADER
      ===================================================== */}
      <header className="login-header">
        <Logo className="login-logo" />

        <button
          type="button"
          className="login-close"
          aria-label="Close"
          onClick={() => nav('/')}
        >
          <span />
          <span />
        </button>
      </header>

      {/* =====================================================
         CONTENT
      ===================================================== */}
      <section className="login-content">
        <div className="login-container">

          {/* =================================================
             INTRO
          ================================================= */}
          <div className="login-intro">
            <p className="login-eyebrow">
              {signup ? 'CREATE ACCOUNT' : 'CLIENT LOGIN'}
            </p>

            <h1>
              {signup ? 'Create your account' : 'Welcome back'}
            </h1>

            <p className="login-description">
              {signup
                ? (authMethod === 'email'
                    ? 'Enter your details to create your Formant account.'
                    : "Choose how you'd like to get started with Formant.")
                : (authMethod === 'email'
                    ? 'Sign in to manage your Formant services, projects and professional profile.'
                    : "Choose how you'd like to sign in to Formant.")}
            </p>

            <div className="auth-editorial-note">
              <span className="auth-editorial-label">
                {signup ? 'A coherent career presence' : 'Your professional workspace'}
              </span>
              <p className="auth-editorial-text">
                {signup
                  ? 'Formant unifies your resume, LinkedIn, portfolio, and career story into one authoritative professional profile — built to help your work stand out with clarity.'
                  : 'Sign in to manage your active career projects, review your documents, and stay aligned with your career goals.'}
              </p>
            </div>
          </div>

          {/* =================================================
             FORM WRAP
          ================================================= */}
          <div className="login-form-wrap">

            {/* -------------------------------------------------
               DEMO NOTICE
            ------------------------------------------------- */}
            {!supabase && (
              <div className="login-demo">
                <span />
                <p>
                  Demo mode is active because Supabase
                  credentials are not available to the app.
                </p>
              </div>
            )}

            {/* =================================================
               EMAIL CONFIRMATION VIEW
            ================================================= */}
            {unverifiedEmail ? (
              <div className="auth-verification-view">
                <div className="auth-verification-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>

                <h2>Check your email</h2>

                <p className="auth-verification-desc">
                  We sent a confirmation link to:
                </p>

                <div className="auth-email-pill">
                  {unverifiedEmail}
                </div>

                <p className="auth-verification-sub">
                  Please click the link in your email to verify your account and get started. If you don't see it, check your spam or junk folder.
                </p>

                <ResendLink email={unverifiedEmail} />

                <div className="auth-verification-actions">
                  <button
                    type="button"
                    className="auth-link-button"
                    onClick={() => {
                      setUnverifiedEmail(null)
                      setMessage('')
                    }}
                  >
                    ← Return to {signup ? 'sign up' : 'login'}
                  </button>
                </div>
              </div>
            ) : authMethod === 'select' ? (
              <div className="auth-methods-container">
                <div className="auth-method-header">
                  <h2>{signup ? 'Get started your way' : 'Sign in to your account'}</h2>
                  <p>
                    {signup
                      ? 'Choose your preferred signup method to begin building your profile.'
                      : 'Select your preferred method to access your Formant workspace.'}
                  </p>
                </div>

                {/* FIRST OPTION — EMAIL */}
                <button
                  type="button"
                  className="auth-method-card auth-method-email"
                  onClick={() => {
                    setAuthMethod('email')
                    setMessage('')
                  }}
                >
                  <div className="auth-method-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>

                  <div className="auth-method-content">
                    <span className="auth-method-title">
                      {signup ? 'Sign up with email' : 'Log in with email'}
                    </span>
                    <span className="auth-method-sub">
                      Use your email address and password
                    </span>
                  </div>

                  <span className="auth-method-arrow" aria-hidden="true">
                    →
                  </span>
                </button>

                {/* DIVIDER */}
                <div className="login-divider" role="separator" aria-label="or continue with Google">
                  <span>or</span>
                </div>

                {/* SECOND OPTION — GOOGLE */}
                <button
                  type="button"
                  className="auth-method-card auth-method-google"
                  onClick={handleGoogleSignIn}
                  disabled={loading || googleLoading}
                  aria-label="Continue with Google"
                >
                  <div className="auth-method-icon google-icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </div>

                  <div className="auth-method-content">
                    <span className="auth-method-title">
                      {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                    </span>
                    <span className="auth-method-sub">
                      Quick, secure access with your Google account
                    </span>
                  </div>

                  <span className="auth-method-arrow" aria-hidden="true">
                    ↗
                  </span>
                </button>
              </div>
            ) : (
              <div className="auth-email-flow">
                <button
                  type="button"
                  className="auth-back-to-methods"
                  onClick={() => {
                    setAuthMethod('select')
                    setMessage('')
                  }}
                  aria-label="Return to method selection"
                >
                  <span aria-hidden="true">←</span> Choose another method
                </button>

                <div className="auth-method-header in-form">
                  <h2>{signup ? 'Sign up with email' : 'Log in with email'}</h2>
                  <p>
                    {signup
                      ? 'Enter your name, email, and password to create your account.'
                      : 'Enter your email address and password to access your dashboard.'}
                  </p>
                </div>

                <form
                  className="login-form"
                  onSubmit={submit}
                  noValidate
                >
                {/* =================================================
                   NAME (SIGNUP ONLY)
                ================================================= */}
                {signup && (
                  <div className={`login-field ${nameError ? 'has-error' : ''}`}>
                    <label htmlFor="name">
                      Full name
                    </label>

                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        if (message) setMessage('')
                      }}
                      onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                      placeholder="Your name"
                      autoComplete="name"
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={nameError ? 'name-error' : undefined}
                      required
                    />

                    {nameError && (
                      <p id="name-error" className="login-field-error" role="alert">
                        {nameError}
                      </p>
                    )}
                  </div>
                )}

                {/* =================================================
                   EMAIL
                ================================================= */}
                <div className={`login-field ${emailError ? 'has-error' : ''}`}>
                  <label htmlFor="email">
                    Email address
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (message) setMessage('')
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? 'email-error' : undefined}
                    required
                  />

                  {emailError && (
                    <p id="email-error" className="login-field-error" role="alert">
                      {emailError}
                    </p>
                  )}
                </div>

                {/* =================================================
                   PASSWORD
                ================================================= */}
                <div className={`login-field ${passwordError ? 'has-error' : ''}`}>
                  <div className="login-label-row">
                    <label htmlFor="password">
                      Password
                    </label>

                    {!signup && (
                      <Link to="/forgot-password">
                        Forgot password?
                      </Link>
                    )}
                  </div>

                  <div className="login-password">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (message) setMessage('')
                      }}
                      onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                      placeholder={signup ? 'Create a secure password' : 'Enter your password'}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      minLength={6}
                      aria-invalid={Boolean(passwordError)}
                      aria-describedby={passwordError ? 'password-error' : undefined}
                      required
                    />

                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((val) => !val)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {passwordError && (
                    <p id="password-error" className="login-field-error" role="alert">
                      {passwordError}
                    </p>
                  )}

                  {/* =============================================
                     PASSWORD STRENGTH METER (SIGNUP ONLY)
                  ============================================= */}
                  {signup && password.length > 0 && (
                    <div className="password-strength-container" aria-live="polite">
                      <div className="password-strength-header">
                        <span className="password-strength-title">Password strength:</span>
                        <span
                          className="password-strength-label"
                          style={{ color: passwordStrength.color }}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>

                      <div className="password-strength-meter" aria-hidden="true">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={`password-strength-segment ${
                              step <= passwordStrength.score ? 'active' : ''
                            }`}
                            style={{
                              backgroundColor:
                                step <= passwordStrength.score
                                  ? passwordStrength.color
                                  : undefined
                            }}
                          />
                        ))}
                      </div>

                      <ul className="password-strength-rules">
                        {passwordStrength.requirements.map((req) => (
                          <li
                            key={req.id}
                            className={`password-rule-item ${req.met ? 'met' : ''}`}
                          >
                            <span className="password-rule-icon" aria-hidden="true">
                              {req.met ? '✓' : '•'}
                            </span>
                            <span>{req.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* =================================================
                   CONFIRM PASSWORD (SIGNUP ONLY)
                ================================================= */}
                {signup && (
                  <div className={`login-field ${confirmError ? 'has-error' : ''}`}>
                    <label htmlFor="confirm-password">
                      Confirm password
                    </label>

                    <div className="login-password">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          if (message) setMessage('')
                        }}
                        onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
                        placeholder="Re-enter your password"
                        autoComplete="new-password"
                        minLength={6}
                        aria-invalid={Boolean(confirmError)}
                        aria-describedby={confirmError ? 'confirm-error' : undefined}
                        required
                      />

                      <button
                        type="button"
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        aria-pressed={showConfirmPassword}
                        onClick={() => setShowConfirmPassword((val) => !val)}
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    {confirmError && (
                      <p id="confirm-error" className="login-field-error" role="alert">
                        {confirmError}
                      </p>
                    )}
                  </div>
                )}

                {/* =================================================
                   REMEMBER ME (LOGIN ONLY)
                ================================================= */}
                {!signup && (
                  <div className="login-checkbox-field">
                    <label className="login-checkbox-label">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="login-checkbox-input"
                      />
                      <span className="login-checkbox-custom" aria-hidden="true" />
                      <span className="login-checkbox-text">
                        Remember me on this device
                      </span>
                    </label>
                  </div>
                )}

                {/* =================================================
                   TERMS & CONDITIONS (SIGNUP ONLY)
                ================================================= */}
                {signup && (
                  <div className="login-checkbox-field">
                    <label className="login-checkbox-label">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => {
                          setTermsAccepted(e.target.checked)
                          setTouched((prev) => ({ ...prev, terms: true }))
                          if (message) setMessage('')
                        }}
                        className="login-checkbox-input"
                        required
                      />
                      <span className="login-checkbox-custom" aria-hidden="true" />
                      <span className="login-checkbox-text">
                        I agree to the{' '}
                        <Link to="/terms" target="_blank" rel="noopener noreferrer">
                          Terms & Conditions
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                          Privacy Policy
                        </Link>
                      </span>
                    </label>

                    {termsError && (
                      <p className="login-field-error" role="alert">
                        {termsError}
                      </p>
                    )}
                  </div>
                )}

                {/* =================================================
                   SUBMIT
                ================================================= */}
                <button
                  type="submit"
                  className="login-submit"
                  disabled={loading}
                >
                  <span>
                    {loading
                      ? 'Please wait...'
                      : signup
                        ? 'Create account'
                        : 'Log in'}
                  </span>

                  <span>↗</span>
                </button>
              </form>
            </div>
          )}

            {/* =================================================
               SWITCH
            ================================================= */}
            <div className="login-switch">
              <span>
                {signup
                  ? 'Already have an account?'
                  : 'New to Formant?'}
              </span>

              <Link
                to={signup ? '/login' : '/signup'}
                onClick={() => {
                  setMessage('')
                  setUnverifiedEmail(null)
                  setAuthMethod('select')
                }}
              >
                {signup ? 'Log in' : 'Create an account'}
                <span>↗</span>
              </Link>
            </div>

          </div>
        </div>
      </section>



      {/* =====================================================
         FOOTER
      ===================================================== */}

      <footer className="login-footer">

        <span>
          FORMANT
        </span>

        <span>
          PROFESSIONAL PROFILE SERVICES
        </span>

        <span>
          © 2026
        </span>

      </footer>

    </main>
  )
}



/* =========================================================
   FORGOT PASSWORD
========================================================= */

export function Forgot() {

  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)


  /* =======================================================
     SUBMIT RESET REQUEST
  ======================================================= */

  async function submit(e) {

    e.preventDefault()

    setMessage('')
    setLoading(true)

    const cleanEmail = email.trim()


    try {

      /* =====================================================
         SUPABASE
      ===================================================== */

      if (supabase) {

        const {
          error
        } = await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/reset-password`
          }
        )


        /* -----------------------------------------------
           ERROR
        ----------------------------------------------- */

        if (error) {
          setMessage(error.message)
          return
        }


        /* -----------------------------------------------
           SUCCESS
        ----------------------------------------------- */

        setMessage(
          'If an account exists for this email, a password reset link has been sent. Please check your inbox.'
        )

        return
      }


      /* =====================================================
         DEMO MODE
      ===================================================== */

      setMessage(
        'Supabase is not connected. Please check your VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY settings.'
      )

    } catch (error) {

      console.error(
        'Password reset error:',
        error
      )

      setMessage(
        error?.message ||
        'Something went wrong. Please try again.'
      )

    } finally {

      setLoading(false)

    }
  }


  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="login-page">

      {/* =====================================================
         HEADER
      ===================================================== */}

      <header className="login-header">

        <Logo className="login-logo" />


        <button
          type="button"
          className="login-close"
          aria-label="Close"
          onClick={() => nav('/')}
        >
          <span />
          <span />
        </button>

      </header>


      {/* =====================================================
         CONTENT
      ===================================================== */}

      <section className="login-content">

        <div className="login-container">

          {/* =================================================
             INTRO
          ================================================= */}

          <div className="login-intro">

            <p className="login-eyebrow">
              ACCOUNT RECOVERY
            </p>


            <h1>
              Reset your password.
            </h1>


            <p className="login-description">
              Enter the email connected to your
              Formant account and we'll help you
              get back in.
            </p>

          </div>


          {/* =================================================
             FORM
          ================================================= */}

          <div className="login-form-wrap">

            <form
              className="login-form"
              onSubmit={submit}
            >

              <div className="login-field">

                <label htmlFor="reset-email">
                  Email address
                </label>


                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />

              </div>


              {/* =================================================
                 MESSAGE
              ================================================= */}

              {message && (
                <div className="login-message">
                  {message}
                </div>
              )}


              {/* =================================================
                 SUBMIT
              ================================================= */}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >

                <span>
                  {loading
                    ? 'Sending...'
                    : 'Send reset link'}
                </span>


                <span>
                  ↗
                </span>

              </button>

            </form>


            {/* =================================================
               BACK
            ================================================= */}

            <Link
              className="login-back"
              to="/login"
            >
              ← Back to login
            </Link>

          </div>

        </div>

      </section>


      {/* =====================================================
         FOOTER
      ===================================================== */}

      <footer className="login-footer">

        <span>
          FORMANT
        </span>

        <span>
          PROFESSIONAL PROFILE SERVICES
        </span>

        <span>
          © 2026
        </span>

      </footer>

    </main>
  )
}
export function ResetPassword() {
  const nav = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const [sessionReady, setSessionReady] = useState(false)
  const [success, setSuccess] = useState(false)

  const [error, setError] = useState('')


  /* =========================================================
     CHECK RESET URL + RECOVERY SESSION
  ========================================================= */

  useEffect(() => {
    let mounted = true

    async function initializeRecovery() {

      /* -------------------------------------------------------
         1. CHECK SUPABASE ERROR IN URL HASH
      ------------------------------------------------------- */

      const hash = window.location.hash

      if (hash && hash.includes('error=')) {

        const hashParams = new URLSearchParams(
          hash.substring(1)
        )

        const errorCode =
          hashParams.get('error_code')

        const errorDescription =
          hashParams.get('error_description')


        if (
          errorCode === 'otp_expired' ||
          errorCode === 'access_denied' ||
          errorDescription
        ) {

          if (!mounted) return

          setSessionReady(false)

          setError(
            'This password reset link is invalid or has expired.'
          )

          setLoading(false)

          /*
            Remove the Supabase error hash from the URL.
            This makes the URL clean and prevents the same
            error from being processed again.
          */

          window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}`
          )

          return
        }
      }


      /* -------------------------------------------------------
         2. SUPABASE CONFIG CHECK
      ------------------------------------------------------- */

      if (!supabase) {

        if (!mounted) return

        setError(
          'Password recovery is currently unavailable. Please try again later.'
        )

        setLoading(false)

        return
      }


      /* -------------------------------------------------------
         3. CHECK CURRENT SESSION
      ------------------------------------------------------- */

      try {

        const {
          data,
          error: sessionError
        } = await supabase.auth.getSession()

        if (!mounted) return


        if (sessionError) {

          setError(
            'We could not verify this password reset link.'
          )

          setLoading(false)

          return
        }


        if (!data?.session?.user) {

          setSessionReady(false)

          setError(
            'This password reset link is invalid or has expired.'
          )

          setLoading(false)

          return
        }


        /* Valid recovery session */

        setSessionReady(true)
        setError('')
        setLoading(false)

      } catch (err) {

        console.error(
          'Recovery session check failed:',
          err
        )

        if (!mounted) return

        setSessionReady(false)

        setError(
          'This password reset link is invalid or has expired.'
        )

        setLoading(false)
      }
    }


    initializeRecovery()


    /* =========================================================
       4. LISTEN FOR PASSWORD RECOVERY EVENT
    ========================================================= */

    let subscription = null

    if (supabase) {

      const {
        data
      } = supabase.auth.onAuthStateChange(
        (event, session) => {

          if (!mounted) return


          if (
            event === 'PASSWORD_RECOVERY' &&
            session?.user
          ) {

            setSessionReady(true)
            setError('')
            setLoading(false)

          }
        }
      )

      subscription = data?.subscription
    }


    return () => {

      mounted = false

      if (subscription) {
        subscription.unsubscribe()
      }

    }

  }, [])


  /* =========================================================
     UPDATE PASSWORD
  ========================================================= */

  async function handleSubmit(e) {

    e.preventDefault()

    setError('')


    /* -------------------------------------------------------
       VALID RECOVERY SESSION REQUIRED
    ------------------------------------------------------- */

    if (!sessionReady) {

      setError(
        'This password reset link is invalid or has expired. Please request a new one.'
      )

      return
    }


    /* -------------------------------------------------------
       PASSWORD LENGTH
    ------------------------------------------------------- */

    if (password.length < 6) {

      setError(
        'Password must be at least 6 characters.'
      )

      return
    }


    /* -------------------------------------------------------
       PASSWORD MATCH
    ------------------------------------------------------- */

    if (password !== confirmPassword) {

      setError(
        'Passwords do not match.'
      )

      return
    }


    if (!supabase) {

      setError(
        'Password recovery is currently unavailable. Please try again later.'
      )

      return
    }


    setUpdating(true)


    try {

      const {
        error: updateError
      } = await supabase.auth.updateUser({
        password
      })


      if (updateError) {

        setError(updateError.message)

        return
      }


      /* -----------------------------------------------------
         PASSWORD UPDATED
      ----------------------------------------------------- */

      setSuccess(true)


      /*
        End the temporary recovery session.
        The user will sign in normally using the new password.
      */

      await supabase.auth.signOut()

    } catch (err) {

      console.error(
        'Password update error:',
        err
      )

      setError(
        err?.message ||
        'Something went wrong. Please try again.'
      )

    } finally {

      setUpdating(false)

    }
  }


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {

    return (
      <main className="login-page">

        <header className="login-header">

          <Logo className="login-logo" />

          <button
            type="button"
            className="login-close"
            aria-label="Close"
            onClick={() => nav('/')}
          >
            <span />
            <span />
          </button>

        </header>


        <section className="login-content">

          <div className="login-container">

            <div className="login-intro">

              <p className="login-eyebrow">
                ACCOUNT RECOVERY
              </p>

              <h1>
                Checking your link.
              </h1>

              <p className="login-description">
                Please wait while we securely verify
                your password reset request.
              </p>

            </div>


            <div className="login-form-wrap">

              <div className="reset-loading">

                <span className="reset-spinner" />

                <span>
                  Verifying reset link...
                </span>

              </div>

            </div>

          </div>

        </section>


        <footer className="login-footer">

          <span>FORMANT</span>

          <span>
            PROFESSIONAL PROFILE SERVICES
          </span>

          <span>© 2026</span>

        </footer>

      </main>
    )
  }


  /* =========================================================
     SUCCESS
  ========================================================= */

  if (success) {

    return (
      <main className="login-page">

        <header className="login-header">

          <Logo className="login-logo" />

          <button
            type="button"
            className="login-close"
            aria-label="Close"
            onClick={() => nav('/')}
          >
            <span />
            <span />
          </button>

        </header>


        <section className="login-content">

          <div className="login-container">

            <div className="login-intro">

              <p className="login-eyebrow">
                PASSWORD UPDATED
              </p>

              <h1>
                You're all set.
              </h1>

              <p className="login-description">
                Your Formant password has been
                updated successfully. Sign in with
                your new password to continue.
              </p>

            </div>


            <div className="login-form-wrap">

              <div className="reset-success">

                <div className="reset-success-icon">
                  ✓
                </div>

                <p className="reset-success-label">
                  SECURITY UPDATED
                </p>

                <h2>
                  Your account is ready.
                </h2>

                <p>
                  Your password has been updated
                  successfully. You can now sign in
                  with your new password.
                </p>

                <Link
                  to="/login"
                  className="login-submit reset-login-button"
                >
                  <span>
                    Continue to login
                  </span>

                  <span>↗</span>

                </Link>

              </div>

            </div>

          </div>

        </section>


        <footer className="login-footer">

          <span>FORMANT</span>

          <span>
            PROFESSIONAL PROFILE SERVICES
          </span>

          <span>© 2026</span>

        </footer>

      </main>
    )
  }


  /* =========================================================
     INVALID / EXPIRED LINK
  ========================================================= */

  if (!sessionReady) {

    return (
      <main className="login-page">

        <header className="login-header">

          <Logo className="login-logo" />

          <button
            type="button"
            className="login-close"
            aria-label="Close"
            onClick={() => nav('/')}
          >
            <span />
            <span />
          </button>

        </header>


        <section className="login-content">

          <div className="login-container">

            <div className="login-intro">

              <p className="login-eyebrow">
                ACCOUNT RECOVERY
              </p>

              <h1>
                This link has expired.
              </h1>

              <p className="login-description">
                For your security, password reset
                links expire after a limited amount
                of time. Request a new link to
                continue.
              </p>

            </div>


            <div className="login-form-wrap">

              <div className="reset-expired">

                <div className="reset-expired-icon">
                  !
                </div>

                <div className="reset-expired-copy">

                  <strong>
                    Reset link unavailable
                  </strong>

                  <p>
                    {error ||
                      'This password reset link is invalid or has expired.'}
                  </p>

                </div>

              </div>


              <Link
                to="/forgot-password"
                className="login-submit reset-login-button"
              >
                <span>
                  Request a new reset link
                </span>

                <span>↗</span>

              </Link>


              <Link
                className="login-back"
                to="/login"
              >
                ← Back to login
              </Link>

            </div>

          </div>

        </section>


        <footer className="login-footer">

          <span>FORMANT</span>

          <span>
            PROFESSIONAL PROFILE SERVICES
          </span>

          <span>© 2026</span>

        </footer>

      </main>
    )
  }


  /* =========================================================
     VALID RESET SESSION → PASSWORD FORM
  ========================================================= */

  return (
    <main className="login-page">

      <header className="login-header">

        <Logo className="login-logo" />

        <button
          type="button"
          className="login-close"
          aria-label="Close"
          onClick={() => nav('/')}
        >
          <span />
          <span />
        </button>

      </header>


      <section className="login-content">

        <div className="login-container">

          <div className="login-intro">

            <p className="login-eyebrow">
              ACCOUNT RECOVERY
            </p>

            <h1>
              Create a new password.
            </h1>

            <p className="login-description">
              Choose a new password for your
              Formant account. Make it strong
              and unique.
            </p>

          </div>


          <div className="login-form-wrap">

            <form
              className="login-form"
              onSubmit={handleSubmit}
            >

              <div className="login-field">

                <label htmlFor="new-password">
                  New password
                </label>

                <div className="login-password">

                  <input
                    id="new-password"
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) => !value
                      )
                    }
                  >
                    {showPassword
                      ? 'Hide'
                      : 'Show'}
                  </button>

                </div>

              </div>


              <div className="login-field">

                <label htmlFor="confirm-password">
                  Confirm new password
                </label>

                <div className="login-password">

                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(
                        e.target.value
                      )
                    }
                    placeholder="Enter your new password again"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (value) => !value
                      )
                    }
                  >
                    {showConfirmPassword
                      ? 'Hide'
                      : 'Show'}
                  </button>

                </div>

              </div>


              {error && (
                <div className="login-message login-error">
                  {error}
                </div>
              )}


              <button
                type="submit"
                className="login-submit"
                disabled={updating}
              >

                <span>
                  {updating
                    ? 'Updating...'
                    : 'Update password'}
                </span>

                <span>↗</span>

              </button>

            </form>


            <Link
              className="login-back"
              to="/login"
            >
              ← Back to login
            </Link>

          </div>

        </div>

      </section>


      <footer className="login-footer">

        <span>FORMANT</span>

        <span>
          PROFESSIONAL PROFILE SERVICES
        </span>

        <span>© 2026</span>

      </footer>

    </main>
  )
}


/* =========================================================
   AUTH CALLBACK (OAUTH REDIRECT HANDLER)
========================================================= */

export function AuthCallback() {
  const nav = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function handleAuthCallback() {
      try {
        if (!supabase) {
          throw new Error('Supabase client is not available.')
        }

        // 1. Inspect URL parameters for OAuth errors
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(
          window.location.hash.startsWith('#')
            ? window.location.hash.slice(1)
            : window.location.hash
        )

        const errorDesc =
          searchParams.get('error_description') ||
          hashParams.get('error_description')
        const errorCode =
          searchParams.get('error') || hashParams.get('error')

        if (errorDesc || errorCode) {
          const userMsg =
            errorCode === 'access_denied'
              ? 'Google sign-in was cancelled.'
              : errorDesc || 'Failed to complete Google authentication.'
          throw new Error(userMsg)
        }

        // 2. Obtain session (Supabase client auto-detects code or access token in URL)
        let { data: { session }, error: sessionError } =
          await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        let activeUser = session?.user

        // 3. Fallback: If session not immediate, try PKCE exchange if code exists
        if (!activeUser) {
          const code = searchParams.get('code')
          if (code && typeof supabase.auth.exchangeCodeForSession === 'function') {
            try {
              const { data, error: exchangeError } =
                await supabase.auth.exchangeCodeForSession(code)
              if (!exchangeError && data?.session?.user) {
                activeUser = data.session.user
              }
            } catch (exchangeErr) {
              console.warn('PKCE exchange fallback notice:', exchangeErr)
            }
          }
        }

        // 4. Fallback: Wait briefly on onAuthStateChange for session resolution
        if (!activeUser) {
          activeUser = await new Promise((resolve) => {
            let finished = false
            const timeout = setTimeout(() => {
              if (!finished) {
                finished = true
                sub?.subscription?.unsubscribe()
                resolve(null)
              }
            }, 5000)

            const { data: sub } = supabase.auth.onAuthStateChange(
              (event, nextSession) => {
                if (
                  (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
                  nextSession?.user
                ) {
                  if (!finished) {
                    finished = true
                    clearTimeout(timeout)
                    sub?.subscription?.unsubscribe()
                    resolve(nextSession.user)
                  }
                }
              }
            )
          })
        }

        if (!activeUser) {
          throw new Error(
            'Could not verify your Google authentication session. Please try logging in again.'
          )
        }

        // 5. Derive profile display name
        const user = activeUser
        const userName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Client'

        // 6. Safe non-blocking profile name sync if not set
        // The handle_new_user trigger creates the public.profiles row.
        // We only update name if permitted; never block login on failures.
        try {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle()

          if (existingProfile && !existingProfile.name && userName) {
            await supabase
              .from('profiles')
              .update({ name: userName })
              .eq('id', user.id)
          }
        } catch (profileErr) {
          console.warn('Profile name sync notice:', profileErr)
        }

        // 7. Update local reactive store
        patch((current) => ({
          ...current,
          user: {
            ...(current.user || {}),
            email: user.email,
            name: userName
          },
          profile: {
            ...(current.profile || {}),
            email: user.email,
            name: userName
          }
        }))

        // Mark session active in storage
        try {
          sessionStorage.setItem('formant_session_active', 'true')
        } catch (e) {
          // Ignore
        }

        if (!isMounted) return

        // 8. Redirect user to destination
        const destination = getPostAuthPath(user)
        nav(destination, { replace: true })
      } catch (err) {
        console.error('Google auth callback error:', err)
        if (isMounted) {
          setError(
            err?.message || 'Authentication could not be completed. Please try again.'
          )
        }
      }
    }

    handleAuthCallback()

    return () => {
      isMounted = false
    }
  }, [nav])

  return (
    <main className="login-page">
      <header className="login-header">
        <Logo className="login-logo" />
        <button
          type="button"
          className="login-close"
          aria-label="Close"
          onClick={() => nav('/login')}
        >
          <span />
          <span />
        </button>
      </header>

      <section className="login-content">
        <div className="login-container">
          <div className="auth-callback-card">
            {error ? (
              <>
                <div className="auth-callback-icon error" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>

                <h2>Authentication Failed</h2>

                <p className="auth-callback-desc">
                  {error}
                </p>

                <div className="auth-callback-actions">
                  <Link
                    to="/login"
                    className="login-submit"
                    style={{ textDecoration: 'none' }}
                  >
                    <span>Return to login</span>
                    <span>↗</span>
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="auth-callback-spinner" aria-hidden="true" />

                <h2>Verifying authentication</h2>

                <p className="auth-callback-desc">
                  Connecting your Google profile to Formant. This will take just a moment...
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="login-footer">
        <span>FORMANT</span>
        <span>PROFESSIONAL PROFILE SERVICES</span>
        <span>© 2026</span>
      </footer>
    </main>
  )
}