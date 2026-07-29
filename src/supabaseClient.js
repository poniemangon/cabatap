import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Clerk is the identity provider (Supabase configured with Clerk as a Third
// Party Auth source), so the Supabase client doesn't manage its own session —
// it just asks Clerk for the current session token on every request. Signed
// out (or before ClerkTokenBridge mounts), this resolves to null and Supabase
// falls back to the anon role, which is what keeps pool/barrios reads public.
let getClerkToken = () => Promise.resolve(null)

export function registerClerkTokenGetter(fn) {
  getClerkToken = fn
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: () => getClerkToken(),
})

// A synchronously-readable cache of the last-known Clerk token, kept warm by
// ClerkTokenBridge. Needed for the tab-close "duel forfeit" beacon (see
// duelApi.js's submitDuelResultBeacon) — that fires from a pagehide/
// beforeunload handler, which can't usefully await Clerk's async getToken()
// since the page may already be gone by the time it resolves.
let cachedAccessToken = null

export function setCachedAccessToken(token) {
  cachedAccessToken = token
}

export function getCachedAccessToken() {
  return cachedAccessToken
}

// PostgREST caps a single request at 1000 rows by default; loop with .range()
// to pull the full table regardless of how large it grows.
export async function fetchAllRows(table, columns, orderBy) {
  const PAGE = 1000
  let all = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    all = all.concat(data)
    if (data.length < PAGE) break
  }
  return all
}
