import { useEffect, useState } from 'react'
import { getLogrosForProfile } from './logrosApi'
import './LogrosStrip.css'

function LogroItem({ logro }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="logro-item"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation()
        setOpen((v) => !v)
      }}
    >
      {logro.image_url ? (
        <img src={logro.image_url} alt="" className="logro-item-icon" />
      ) : (
        <span className="logro-item-icon logro-item-icon-fallback">🏅</span>
      )}
      <span className="logro-item-title">{logro.title}</span>
      {open && (
        <div className="logro-item-popup" onClick={(e) => e.stopPropagation()}>
          {logro.image_url ? (
            <img src={logro.image_url} alt="" className="logro-item-popup-img" />
          ) : (
            <span className="logro-item-icon logro-item-icon-fallback logro-item-popup-img">🏅</span>
          )}
          <span className="logro-item-popup-title">{logro.title}</span>
          {logro.text && <span className="logro-item-popup-text">{logro.text}</span>}
        </div>
      )}
    </div>
  )
}

export default function LogrosStrip({ profileId }) {
  const [logros, setLogros] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profileId) return
    setLoading(true)
    getLogrosForProfile(profileId)
      .then(setLogros)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [profileId])

  if (loading) return null
  if (logros.length === 0) return <p className="profile-empty-text">Todavía no desbloqueaste ningún logro.</p>

  return (
    <div className="logros-strip">
      {logros.map((l) => (
        <LogroItem key={l.id} logro={l} />
      ))}
    </div>
  )
}
