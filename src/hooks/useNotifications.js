import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import {
  deleteNotification as deleteNotificationRow,
  listNotifications,
  markNotificationsRead,
  pruneOldNotifications,
  subscribeToNotifications,
} from '../notifications/notificationsApi'

const TOAST_DURATION_MS = 6000

export default function useNotifications(profile) {
  const [notifications, setNotifications] = useState([])
  const [toasts, setToasts] = useState([])

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
      setToasts((prev) => [...prev, row])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== row.id))
      }, TOAST_DURATION_MS)
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
  // pruneOld (below) and listNotifications' own 1-day prune as backstops for
  // ones never clicked.
  const deleteNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    deleteNotificationRow(id).catch(console.error)
  }, [])

  // Called when the notifications panel closes — prunes anything older than
  // a day, both locally (so the list doesn't show stale rows next open) and
  // server-side.
  const pruneOld = useCallback(() => {
    if (!profile?.id) return
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    setNotifications((prev) => prev.filter((n) => new Date(n.created_at).getTime() >= oneDayAgo))
    pruneOldNotifications(profile.id).catch(console.error)
  }, [profile?.id])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, markAllRead, deleteNotification, pruneOld, toasts, dismissToast }
}
