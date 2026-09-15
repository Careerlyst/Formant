import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { demoLogin, patch } from '../lib/store'
import { supabase } from '../lib/supabase'


/* =========================================================
   AUTH
========================================================= */

export default function Auth({ signup = false }) {
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)


  /* =======================================================
     SUBMIT
  ======================================================= */

  async function submit(e) {
    e.preventDefault()

    setMessage('')
    setLoading(true)

    const cleanEmail = email.trim()
    const cleanName = name.trim()

    try {

      /* =====================================================
         SUPABASE AUTH
      ===================================================== */

      if (supabase) {

        /* ===================================================
           SIGN UP
        =================================================== */

        if (signup) {

          const {
            data,
            error
          } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                name: cleanName
              }
            }
          })


          /* -----------------------------------------------
             SUPABASE ERROR
          ----------------------------------------------- */

          if (error) {
            setMessage(error.message)
            return
          }


          /* -----------------------------------------------
             EMAIL CONFIRMATION
          ----------------------------------------------- */

          /*
            When Supabase email confirmation is enabled,
            data.session will be null.

            In that case the account was created successfully,
            but the user must confirm their email first.
          */

          if (!data?.session) {
            setMessage(
              'Account created successfully. Please check your email and confirm your account before logging in.'
            )

            return
          }


          /* -----------------------------------------------
             SESSION EXISTS
          ----------------------------------------------- */

          const user = data.user

          const userName =
            user?.user_metadata?.name ||
            cleanName ||
            user?.email?.split('@')[0] ||
            'Client'


          /* -----------------------------------------------
             SYNC LOCAL UI STORE
          ----------------------------------------------- */

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


          /* -----------------------------------------------
             GO TO DASHBOARD
          ----------------------------------------------- */

          nav('/dashboard')

          return
        }


        /* ===================================================
           LOGIN
        =================================================== */

        const {
          data,
          error
        } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password
        })


        /* -----------------------------------------------
           LOGIN ERROR
        ----------------------------------------------- */

        if (error) {
          setMessage(error.message)
          return
        }


        /* -----------------------------------------------
           NO SESSION
        ----------------------------------------------- */

        if (!data?.session) {
          setMessage(
            'Login could not be completed. Please try again.'
          )

          return
        }


        /* -----------------------------------------------
           USER
        ----------------------------------------------- */

        const user = data.user

        const userName =
          user?.user_metadata?.name ||
          user?.email?.split('@')[0] ||
          'Client'


        /* -----------------------------------------------
           SYNC LOCAL UI STORE
        ----------------------------------------------- */

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


        /* -----------------------------------------------
           GO TO DASHBOARD
        ----------------------------------------------- */

        nav('/dashboard')

        return
      }


      /* =====================================================
         DEMO MODE
      ===================================================== */

      demoLogin(
        cleanEmail,
        cleanName || 'Demo Client'
      )

      nav('/dashboard')

    } catch (error) {

      console.error('Authentication error:', error)

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

        <Link
          to="/"
          className="login-logo"
        >
          <Logo />
        </Link>


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
              {signup
                ? 'CREATE ACCOUNT'
                : 'CLIENT LOGIN'}
            </p>


            <h1>
              {signup
                ? 'Build your profile.'
                : 'Welcome back.'}
            </h1>


            <p className="login-description">
              {signup
                ? 'Create your Careerlyst account and start building a stronger professional profile.'
                : 'Sign in to manage your Careerlyst services, projects and professional profile.'}
            </p>

          </div>


          {/* =================================================
             FORM
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


            <form
              className="login-form"
              onSubmit={submit}
            >

              {/* =================================================
                 NAME
              ================================================= */}

              {signup && (
                <div className="login-field">

                  <label htmlFor="name">
                    Full name
                  </label>


                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />

                </div>
              )}


              {/* =================================================
                 EMAIL
              ================================================= */}

              <div className="login-field">

                <label htmlFor="email">
                  Email address
                </label>


                <input
                  id="email"
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
                 PASSWORD
              ================================================= */}

              <div className="login-field">

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
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete={
                      signup
                        ? 'new-password'
                        : 'current-password'
                    }
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
                    ? 'Please wait...'
                    : signup
                      ? 'Create account'
                      : 'Log in'}
                </span>


                <span>
                  ↗
                </span>

              </button>

            </form>


            {/* =================================================
               SWITCH
            ================================================= */}

            <div className="login-switch">

              <span>
                {signup
                  ? 'Already have an account?'
                  : 'New to Careerlyst?'}
              </span>


              <Link
                to={
                  signup
                    ? '/login'
                    : '/signup'
                }
              >

                {signup
                  ? 'Log in'
                  : 'Create an account'}

                <span>
                  ↗
                </span>

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
          CAREERLYST
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

        <Link
          to="/"
          className="login-logo"
        >
          <Logo />
        </Link>


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
              Careerlyst account and we'll help you
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
          CAREERLYST
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

          <Link
            to="/"
            className="login-logo"
          >
            <Logo />
          </Link>

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

          <span>CAREERLYST</span>

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

          <Link
            to="/"
            className="login-logo"
          >
            <Logo />
          </Link>

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
                Your Careerlyst password has been
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

          <span>CAREERLYST</span>

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

          <Link
            to="/"
            className="login-logo"
          >
            <Logo />
          </Link>

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

          <span>CAREERLYST</span>

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

        <Link
          to="/"
          className="login-logo"
        >
          <Logo />
        </Link>

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
              Careerlyst account. Make it strong
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

        <span>CAREERLYST</span>

        <span>
          PROFESSIONAL PROFILE SERVICES
        </span>

        <span>© 2026</span>

      </footer>

    </main>
  )
}