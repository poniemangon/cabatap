import { supabase, supabaseUrl, supabaseAnonKey, getCachedAccessToken } from '../supabaseClient'

export async function createDuel({
  challengerId,
  opponentId = null,
  roundIndices,
  barrioIds = null,
  isMultiplayer = false,
  maxPlayers = null,
  matchmaking = false,
  timeLimitSeconds = 8,
}) {
  const { data, error } = await supabase
    .from('duels')
    .insert({
      challenger_id: challengerId,
      opponent_id: isMultiplayer ? null : opponentId,
      round_indices: roundIndices,
      barrio_ids: barrioIds,
      is_multiplayer: isMultiplayer,
      max_players: isMultiplayer ? maxPlayers : null,
      matchmaking,
      time_limit_seconds: timeLimitSeconds,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

const MATCHMAKING_STALE_MS = 2 * 60 * 1000

// Oldest *recent* pending matchmaking entry (created by "Duelo random" with
// no opponent yet), excluding duels I created myself. Separate from private
// "cualquiera (link)" open invites — those are never auto-matched, only
// matchmaking=true rows are. The staleness cutoff matters because matches
// are FIFO by created_at: without it, an entry nobody ever claimed (its
// creator gave up, closed the tab, whatever) sits at the front of the queue
// forever and keeps getting offered to new searchers instead of them
// actually pairing with each other.
export async function findOpenRandomDuel(excludeProfileId) {
  const notStaleSince = new Date(Date.now() - MATCHMAKING_STALE_MS).toISOString()
  const { data, error } = await supabase
    .from('duels')
    .select('*')
    .eq('matchmaking', true)
    .is('opponent_id', null)
    .is('closed_at', null)
    .neq('challenger_id', excludeProfileId)
    .gt('created_at', notStaleSince)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getDuelByCode(inviteCode) {
  const { data, error } = await supabase
    .from('duels')
    .select('*, challenger:challenger_id(id, username), opponent:opponent_id(id, username)')
    .eq('invite_code', inviteCode)
    .maybeSingle()
  if (error) throw error
  return data
}

// 1v1 only: locks in the single opponent slot on an unclaimed invite. Not
// used for multiplayer duels, which have no slot to claim. maybeSingle (not
// single) so losing a claim race — someone else grabbed it first — returns
// null instead of throwing, since the .is('opponent_id', null) guard means
// zero rows match on a lost race.
export async function claimDuel(duelId, profileId) {
  const { data, error } = await supabase
    .from('duels')
    .update({ opponent_id: profileId })
    .eq('id', duelId)
    .is('opponent_id', null)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// Given the duel_results rows for a duel, the single top scorer's
// profile_id, or null if there's a tie for first (or fewer than 2 results).
export function computeWinnerId(results) {
  if (results.length < 2) return null
  const top = Math.max(...results.map((r) => r.total_score))
  const leaders = results.filter((r) => r.total_score === top)
  return leaders.length === 1 ? leaders[0].profile_id : null
}

// Closes a duel and records its winner. maybeSingle: if the duel was already
// closed by the other side (a race between both 1v1 players, or a double
// click on "Cerrar duelo"), the .is('closed_at', null) guard matches zero
// rows and this resolves to null instead of throwing.
export async function closeDuel(duelId, winnerId) {
  const { data, error } = await supabase
    .from('duels')
    .update({ closed_at: new Date().toISOString(), winner_id: winnerId })
    .eq('id', duelId)
    .is('closed_at', null)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// Games played/won/tied, split 1v1 vs multiplayer, for the profile page's
// stats section.
//
// Once a duel is *closed*, winner_id is authoritative — including a forfeit
// win (only one participant ever played, the other never showed up), which
// still has to count as a win even though there's only 1 duel_results row.
// A still-open duel has no winner_id yet, so:
//  - multiplayer falls back to the live leaderboard (same computeWinnerId
//    used when its creator eventually closes it), so a duel you're
//    currently leading counts as won without waiting for that close.
//  - 1v1 (and a multiplayer duel with <2 players so far) can't be resolved
//    either way yet — not a win, not a tie, just skipped.
// A closed duel with winner_id null (only possible once 2+ people played —
// forfeits always name a winner) is a genuine tie, not "unresolved".
export async function getDuelStats(profileId) {
  const { data: myResults, error: myResultsError } = await supabase
    .from('duel_results')
    .select('duel_id')
    .eq('profile_id', profileId)
  if (myResultsError) throw myResultsError
  const duelIds = myResults.map((r) => r.duel_id)
  const stats = { oneVOne: { played: 0, won: 0, tied: 0 }, multi: { played: 0, won: 0, tied: 0 } }
  if (duelIds.length === 0) return stats

  const { data, error } = await supabase
    .from('duels')
    .select('is_multiplayer, winner_id, closed_at, duel_results(profile_id, total_score)')
    .in('id', duelIds)
  if (error) throw error

  for (const duel of data) {
    const bucket = duel.is_multiplayer ? stats.multi : stats.oneVOne
    bucket.played += 1

    let winnerId
    if (duel.closed_at) {
      winnerId = duel.winner_id
    } else {
      if (duel.duel_results.length < 2) continue
      winnerId = computeWinnerId(duel.duel_results)
    }

    if (winnerId === profileId) bucket.won += 1
    else if (winnerId === null) bucket.tied += 1
  }
  return stats
}

export async function submitDuelResult({ duelId, profileId, results, totalScore }) {
  const { data, error } = await supabase
    .from('duel_results')
    .insert({ duel_id: duelId, profile_id: profileId, results, total_score: totalScore })
    .select()
    .single()
  if (error) throw error
  return data
}

// Fire-and-forget insert using fetch's `keepalive` flag instead of the
// normal Supabase client — for the tab-close duel-abandon signal, fired from
// a pagehide/beforeunload handler with no time to await anything. A plain
// client call routinely gets cancelled mid-flight when the tab actually
// closes; keepalive is what browsers specifically support for "let this
// request finish even though the page is going away" (sendBeacon can't be
// used here since it can't set the Authorization header PostgREST/RLS need).
export function submitDuelResultBeacon({ duelId, profileId, results, totalScore }) {
  const token = getCachedAccessToken()
  if (!token) return
  fetch(`${supabaseUrl}/rest/v1/duel_results`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ duel_id: duelId, profile_id: profileId, results, total_score: totalScore }),
  }).catch(() => {})
}

export async function getDuelResults(duelId) {
  const { data, error } = await supabase
    .from('duel_results')
    .select('*, profile:profile_id(id, username)')
    .eq('duel_id', duelId)
    .order('total_score', { ascending: false })
  if (error) throw error
  return data
}

// Only duels where I've already played my own side — matches the profile
// page's "duelos jugados" list, not duels I merely created/claimed. Driven
// off duel_results rather than challenger_id/opponent_id so it also picks up
// multiplayer duels I joined as a third-plus participant (no opponent_id at
// all in that case).
export async function listMyDuels(profileId) {
  const { data: myResults, error: myResultsError } = await supabase
    .from('duel_results')
    .select('duel_id')
    .eq('profile_id', profileId)
  if (myResultsError) throw myResultsError
  const duelIds = myResults.map((r) => r.duel_id)
  if (duelIds.length === 0) return []

  const { data, error } = await supabase
    .from('duels')
    .select(
      `*,
      challenger:challenger_id(id, username),
      opponent:opponent_id(id, username),
      duel_results(profile_id, total_score, completed_at, profile:profile_id(id, username))`,
    )
    .in('id', duelIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
