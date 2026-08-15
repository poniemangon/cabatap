import { supabase } from '../supabaseClient'

// Round results only carry street1/street2/actual (lat, lng), never
// pool_index (see App.jsx's round-result construction) — so a comment has
// to resolve the intersection it's about by matching those back against
// the intersections table. Exact match works fine: `actual` is the same
// [lat, lng] pair copied verbatim from that row when the round was built,
// never recomputed.
export async function findIntersectionPoolIndex({ street1, street2, lat, lng }) {
  let query = supabase.from('intersections').select('pool_index').eq('street1', street1).eq('lat', lat).eq('lng', lng)
  query = street2 ? query.eq('street2', street2) : query.is('street2', null)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data?.pool_index ?? null
}

export async function addComment({ poolIndex, profileId, text }) {
  const { error } = await supabase.from('comments').insert({ pool_index: poolIndex, profile_id: profileId, text })
  if (error) throw error
}
