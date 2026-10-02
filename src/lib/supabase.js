import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL

const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  url &&
  key &&
  !url.includes('YOUR_PROJECT')
    ? createClient(url, key)
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