import { useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { registerClerkTokenGetter, setCachedAccessToken } from '../supabaseClient'

const TOKEN_CACHE_REFRESH_MS = 30000

// Keeps the module-level Supabase client (see supabaseClient.js) in sync with
// whatever Clerk session is currently active. Must be mounted once inside
// <ClerkProvider>.
export default function ClerkTokenBridge() {
  const { getToken } = useAuth()

  useEffect(() => {
    registerClerkTokenGetter(() => getToken())
  }, [getToken])

  // Separately keeps a synchronous token cache warm (see supabaseClient.js),
  // since the tab-close forfeit beacon can't await getToken() — by the time
  // that promise resolved, the page could already be gone.
  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      getToken()
        .then((token) => {
          if (!cancelled) setCachedAccessToken(token)
        })
        .catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, TOKEN_CACHE_REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [getToken])

  return null
}
