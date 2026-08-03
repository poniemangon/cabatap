import { useState } from 'react'
import './DailyWinBadge.css'

// Star shown next to a username for players who've won at least one daily
// map. A corner number appears once they've won more than one; hovering (or
// tapping on touch) pops up "Este jugador ganó X mapas del día."
export default function DailyWinBadge({ count }) {
  const [open, setOpen] = useState(false)
  if (!count || count < 1) return null

  return (
    <span
      className="daily-win-badge-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOpen((v) => !v)
      }}
    >
      <span className="daily-win-badge-star">⭐</span>
      {count > 1 && <span className="daily-win-badge-count">{count}</span>}
      {open && (
        <span className="daily-win-badge-popup" onClick={(e) => e.stopPropagation()}>
          Este jugador ganó {count} {count === 1 ? 'mapa' : 'mapas'} del día
        </span>
      )}
    </span>
  )
}
