import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../supabaseClient'

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g')

export function slugifyUsername(raw) {
  const base = (raw || 'jugador')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9_]+/g, '')
  return base || 'jugador'
}

// Looks up the profile row for this Clerk user, creating one on first
// sign-in with a username derived from whatever Clerk gives us. Retries with
// a random numeric suffix on a username collision (unique constraint), since
// there's no username editor yet to resolve it interactively.
async function ensureProfile(user) {
  const { data: existing, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', user.id)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing

  const base = slugifyUsername(user.username || user.firstName || user.fullName)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
    const { data, error } = await supabase
      .from('profiles')
      .insert({ clerk_user_id: user.id, username: candidate, avatar_url: user.imageUrl })
      .select()
      .single()
    if (!error) return data
    if (error.code !== '23505') throw error
  }
  throw new Error('No se pudo generar un username disponible')
}

export default function useProfile() {
  const { isLoaded, isSignedIn, user } = useUser()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setProfile(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    ensureProfile(user)
      .then((p) => {
        if (!cancelled) setProfile(p)
      })
      .catch((e) => {
        console.error('No se pudo sincronizar el perfil', e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, user])

  const updateUsername = useCallback(
    async (newUsername) => {
      if (!profile) throw new Error('No profile loaded')
      const { data, error } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', profile.id)
        .select()
        .single()
      if (error) throw error
      setProfile(data)
      return data
    },
    [profile],
  )

  return { profile, loading, updateUsername }
}
