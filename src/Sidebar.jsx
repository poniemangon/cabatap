import { useRef, useState } from 'react'
import { SignInButton } from '@clerk/clerk-react'

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (seconds < 60) return 'ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function notificationText(n) {
  if (n.type === 'friend_request') return `${n.data?.from_username || 'Alguien'} te envió una solicitud de amistad`
  if (n.type === 'duel_completed') return 'Tu duelo terminó — ver resultado'
  return 'Notificación'
}

export default function Sidebar({
  onGoHome,
  onDuel,
  onMultiplayerDuel,
  duelInProgress,
  onOpenProfile,
  isSignedIn,
  profile,
  clerkUser,
  mobileOpen,
  onClose,
  notifications = [],
  unreadCount = 0,
  onOpenNotifications,
  onNotificationClick,
  onDeleteNotification,
}) {
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [notifPanelPos, setNotifPanelPos] = useState({ top: 0, left: 0 })
  const bellRef = useRef(null)

  const withClose = (fn) => () => {
    fn()
    onClose?.()
  }

  // Fixed positioning (not absolute inside .sidebar, which clips overflow-x)
  // anchored to the bell's actual on-screen spot, so the panel always shows
  // fully inside the viewport instead of getting cut off by the sidebar.
  const toggleNotifPanel = () => {
    const opening = !notifPanelOpen
    if (opening && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      const panelWidth = 260
      setNotifPanelPos({
        top: rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - panelWidth - 12),
      })
    }
    setNotifPanelOpen(opening)
    if (opening) onOpenNotifications?.()
  }

  const handleNotificationClick = (n) => {
    setNotifPanelOpen(false)
    onNotificationClick?.(n)
    onDeleteNotification?.(n.id)
    onClose?.()
  }

  const displayName = profile?.username || clerkUser?.fullName || 'Jugador'

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        {isSignedIn && (
          <div className="sidebar-top-row">
            <button type="button" className="sidebar-profile-row" onClick={withClose(onOpenProfile)}>
              {clerkUser?.imageUrl ? (
                <img src={clerkUser.imageUrl} alt="" className="sidebar-profile-avatar" />
              ) : (
                <span className="sidebar-profile-avatar sidebar-profile-avatar-fallback">🙂</span>
              )}
              <span className="sidebar-profile-info">
                <span className="sidebar-profile-name">{displayName}</span>
                <span className="sidebar-profile-link">Ver perfil</span>
              </span>
            </button>

            <div className="sidebar-bell-wrap">
              <button type="button" ref={bellRef} className="sidebar-bell-btn" onClick={toggleNotifPanel}>
                🔔
                {unreadCount > 0 && <span className="sidebar-bell-badge">{unreadCount}</span>}
              </button>
              {notifPanelOpen && (
                <>
                  <div className="sidebar-notif-backdrop" onClick={() => setNotifPanelOpen(false)} />
                  <div
                    className="sidebar-notif-panel"
                    style={{ top: notifPanelPos.top, left: notifPanelPos.left }}
                  >

                    {notifications.length === 0 ? (
                      <p className="sidebar-notif-empty">Todavía no tenés notificaciones.</p>
                    ) : (
                      <ul className="sidebar-notif-list">
                        {notifications.map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              className={`sidebar-notif-row${n.read_at ? '' : ' sidebar-notif-row-unread'}`}
                              onClick={() => handleNotificationClick(n)}
                            >
                              <span className="sidebar-notif-text">{notificationText(n)}</span>
                              <span className="sidebar-notif-time">{timeAgo(n.created_at)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <button type="button" className="sidebar-nav-item" onClick={withClose(onGoHome)}>
            <span className="sidebar-nav-icon">🏠</span> Inicio
          </button>
          {isSignedIn && (
            <button
              type="button"
              className="sidebar-nav-item"
              disabled={duelInProgress}
              onClick={withClose(onDuel)}
            >
              <span className="sidebar-nav-icon">⚔️</span> Duelo 1 vs 1
            </button>
          )}
          {isSignedIn && (
            <button
              type="button"
              className="sidebar-nav-item"
              disabled={duelInProgress}
              onClick={withClose(onMultiplayerDuel)}
            >
              <span className="sidebar-nav-icon">👥</span> Duelo multijugador
            </button>
          )}
        </nav>

        {!isSignedIn && (
          <SignInButton mode="modal">
            <button type="button" className="primary-btn sidebar-signup-btn">
              Iniciar sesión
            </button>
          </SignInButton>
        )}
      </aside>
    </>
  )
}
