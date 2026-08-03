import { useState } from 'react'
import './BadgeIcon.css'

// Small badge icon shown next to a username; hovering (or tapping on touch)
// enlarges it into a popup with the image, title, and subtext. `badge` is a
// distintivos row ({ image_url, title, text }) or null/undefined, in which
// case nothing renders.
export default function BadgeIcon({ badge, size = 'sm' }) {
  const [open, setOpen] = useState(false)
  if (!badge) return null

  return (
    <span
      className={`badge-icon-wrap badge-icon-${size}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOpen((v) => !v)
      }}
    >
      <img src={badge.image_url} alt={badge.title} className="badge-icon-img" />
      {open && (
        <span className="badge-icon-popup" onClick={(e) => e.stopPropagation()}>
          <img src={badge.image_url} alt={badge.title} className="badge-icon-popup-img" />
          <span className="badge-icon-popup-title">{badge.title}</span>
          {badge.text && <span className="badge-icon-popup-text">{badge.text}</span>}
        </span>
      )}
    </span>
  )
}
