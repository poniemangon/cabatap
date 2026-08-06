import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'

const SESSION_KEY = 'ubicaba-analytics-session'
const HEARTBEAT_MS = 45000

// Stable per-browser id, signed-in or not — same trust model as any
// tracking-pixel analytics (no auth binding, see 0031_analytics.sql).
function getSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function heartbeat(sessionId) {
  // first_seen_at is deliberately omitted from the payload — its column
  // default only applies on the initial insert, so upserting only
  // last_seen_at here never clobbers it on repeat heartbeats.
  supabase
    .from('analytics_sessions')
    .upsert({ id: sessionId, last_seen_at: new Date().toISOString() })
    .then(({ error }) => error && console.error(error))
}

function logPageview(sessionId, path) {
  supabase
    .from('analytics_pageviews')
    .insert({ session_id: sessionId, path })
    .then(({ error }) => error && console.error(error))
}

// Renders nothing — mounted once at the router root so it survives every
// route change and can watch location for pageview logging.
export default function Analytics() {
  const location = useLocation()

  useEffect(() => {
    const sessionId = getSessionId()
    if (!sessionId) return
    heartbeat(sessionId)
    const interval = setInterval(() => heartbeat(sessionId), HEARTBEAT_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const sessionId = getSessionId()
    if (!sessionId) return
    logPageview(sessionId, location.pathname)
  }, [location.pathname])

  return null
}
