import { supabase } from '../supabaseClient'

// One row per profile per calendar day (day_number) — upsert so resuming a
// stored session and re-reaching gameOver doesn't error on the unique
// constraint, it just overwrites with the latest attempt.
export async function submitDailyResult({ profileId, dayNumber, results, totalScore }) {
  const { error } = await supabase.from('daily_stats').upsert(
    {
      profile_id: profileId,
      day_number: dayNumber,
      results,
      total_score: totalScore,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,day_number' },
  )
  if (error) throw error
}

export async function listMyDailyStats(profileId, limit = 30) {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('profile_id', profileId)
    .order('day_number', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Public — anyone with the link can view a specific day's attempt, same as
// duel results already work. Joined to the player's username/avatar so the
// page can show whose result it is.
export async function getDailyStatById(id) {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*, profile:profile_id(username, avatar_url)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}
