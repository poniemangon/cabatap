import { supabase } from '../supabaseClient'

// One row per profile per calendar day per mode (day_number + timed) —
// upsert so resuming a stored session and re-reaching gameOver doesn't
// error on the unique constraint, it just overwrites with the latest
// attempt. Tranqui and competitivo are tracked separately, so playing both
// the same day keeps both results.
export async function submitDailyResult({ profileId, dayNumber, results, totalScore, timed = false }) {
  const { error } = await supabase.from('daily_stats').upsert(
    {
      profile_id: profileId,
      day_number: dayNumber,
      results,
      total_score: totalScore,
      timed,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,day_number,timed' },
  )
  if (error) throw error
}

// Today's competitivo leaderboard — everyone's timed attempt for this
// day_number, best score first. Used both to show a rank on the gameOver
// screen and could back a dedicated leaderboard view later.
export async function getDailyLeaderboard(dayNumber) {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('*, profile:profile_id(username, avatar_url)')
    .eq('day_number', dayNumber)
    .eq('timed', true)
    .order('total_score', { ascending: false })
  if (error) throw error
  return data
}

// All-time best-average leaderboard — every competitivo (timed) row ever
// played, aggregated per player. Tranqui never counts here since it never
// ranks. Small-scale aggregation done client-side, same style as the rest
// of this app's stats (see duelApi.js's getDuelStats).
export async function getDailyAverageLeaderboard() {
  const { data, error } = await supabase
    .from('daily_stats')
    .select('profile_id, total_score, profile:profile_id(username, avatar_url)')
    .eq('timed', true)
  if (error) throw error

  const byProfile = new Map()
  for (const row of data) {
    const entry = byProfile.get(row.profile_id) || {
      profileId: row.profile_id,
      profile: row.profile,
      played: 0,
      totalScore: 0,
    }
    entry.played += 1
    entry.totalScore += row.total_score
    byProfile.set(row.profile_id, entry)
  }
  return [...byProfile.values()]
    .map((e) => ({ ...e, avgScore: e.totalScore / e.played }))
    .sort((a, b) => b.avgScore - a.avgScore)
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
