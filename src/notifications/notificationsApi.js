import { supabase } from '../supabaseClient'

// Notifications don't stick around: deleted on click (see deleteNotification)
// or, failing that, once they're a day old. There's no scheduled job for the
// latter, so it's pruned opportunistically here, every time the list loads.
export async function listNotifications(profileId) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await supabase.from('notifications').delete().eq('profile_id', profileId).lt('created_at', oneDayAgo)

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data
}

export async function markNotificationsRead(ids) {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function deleteNotification(id) {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw error
}

export async function notifyFriendRequest(addresseeProfileId, fromUsername) {
  const { error } = await supabase.from('notifications').insert({
    profile_id: addresseeProfileId,
    type: 'friend_request',
    data: { from_username: fromUsername },
  })
  if (error) throw error
}

// One row per participant of a just-closed duel (excluding whoever triggered
// the close, who doesn't need to be told their own action happened).
export async function notifyDuelCompleted(duelId, participantProfileIds, { inviteCode, isMultiplayer }) {
  if (participantProfileIds.length === 0) return
  const rows = participantProfileIds.map((profileId) => ({
    profile_id: profileId,
    type: 'duel_completed',
    duel_id: duelId,
    data: { invite_code: inviteCode, is_multiplayer: isMultiplayer },
  }))
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) throw error
}

// Subscribes to live inserts for this profile's notifications. Returns the
// channel — pass it to supabase.removeChannel() on cleanup/unmount.
export function subscribeToNotifications(profileId, onInsert) {
  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profileId}` },
      (payload) => onInsert(payload.new),
    )
    .subscribe()
  return channel
}
