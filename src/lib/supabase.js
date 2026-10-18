import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL

const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

const AUTH_REQUEST_TIMEOUT_MS = 15_000

async function fetchWithAuthTimeout(input, init = {}) {
  const baseUrl = url?.replace(/\/$/, '')
  const requestUrl = input instanceof Request ? input.url : String(input)
  if (!baseUrl || !requestUrl.startsWith(`${baseUrl}/auth/v1/`)) {
    return fetch(input, init)
  }

  const requestSignal = init.signal || (input instanceof Request ? input.signal : undefined)
  const controller = new AbortController()
  let timedOut = false
  const abortWithRequest = () => controller.abort(requestSignal?.reason)
  if (requestSignal?.aborted) {
    abortWithRequest()
  } else {
    requestSignal?.addEventListener('abort', abortWithRequest, { once: true })
  }

  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, AUTH_REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(
        'Authentication request timed out. Check that the local Supabase Auth service is running, then try again.'
      )
      timeoutError.name = 'AuthRequestTimeoutError'
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    requestSignal?.removeEventListener('abort', abortWithRequest)
  }
}

export const supabase =
  url &&
  key &&
  !url.includes('YOUR_PROJECT')
    ? createClient(url, key, { global: { fetch: fetchWithAuthTimeout } })
    : null

export const isSupabaseConfigured =
  Boolean(supabase)

// Handle session persistence when "Remember me" is not enabled
if (typeof window !== 'undefined' && supabase) {
  try {
    const rememberMe = localStorage.getItem('formant_remember_me')
    const sessionActive = sessionStorage.getItem('formant_session_active')
    if (rememberMe === 'false' && !sessionActive) {
      supabase.auth.signOut().catch(() => {})
    }
  } catch (e) {
    // Ignore storage access errors in restricted contexts
  }
}
