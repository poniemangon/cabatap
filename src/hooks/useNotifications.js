import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  deleteNotification as deleteNotificationRow,
  listNotifications,
  markNotificationsRead,
  subscribeToNotifications,
} from '../notifications/notificationsApi'

export default function useNotifications(profile) {
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!profile) {
      setNotifications([])
      return
    }
    let cancelled = false
    listNotifications(profile.id)
      .then((rows) => {
        if (!cancelled) setNotifications(rows)
      })
      .catch(console.error)

    const channel = subscribeToNotifications(profile.id, (row) => {
      setNotifications((prev) => [row, ...prev])
    })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // profile?.id (not profile) so a same-user object with a new reference
    // (Clerk/useProfile re-render churn) doesn't tear down and rebuild the
    // realtime channel unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const markAllRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    markNotificationsRead(unreadIds).catch(console.error)
  }, [notifications])

  // Notifications are dismissed by deleting them outright, not just marking
  // read — clicking one (to act on it) is the main way they go away, with
  // listNotifications' 1-day prune as the backstop for ones never clicked.
  const deleteNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    deleteNotificationRow(id).catch(console.error)
  }, [])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, markAllRead, deleteNotification }
}
