import { useRef, useState } from 'react'
import { TIERS, EloTierIcon } from './EloBadge'

const HIDE_DELAY_MS = 300
const ELO_WIKI_URL = 'https://es.wikipedia.org/wiki/Sistema_de_puntuaci%C3%B3n_Elo'
const TOOLTIP_WIDTH = 260

function rangeLabel(tier) {
  return tier.max === Infinity ? `${tier.min}+` : `${tier.min} - ${tier.max - 1}`
}

// Same hover-with-grace-period pattern as RankStatus's sidebar "i" tooltip
// (see that file for why it's explicit JS state instead of pure CSS :hover).
// Positioned via getBoundingClientRect + fixed coordinates (same trick as
// Sidebar's notification panel) instead of a CSS-anchored absolute box —
// this icon trails a heading whose wrap point varies with card width, so a
// fixed left/right anchor overflows the viewport in one context or the
// other. Clamping in JS keeps it on-screen everywhere it's used.
export default function EloInfoIcon() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const hideTimeoutRef = useRef(null)
  const iconRef = useRef(null)

  const cancelHide = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
  }

  const show = () => {
    cancelHide()
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 8,
        left: Math.min(Math.max(rect.right - TOOLTIP_WIDTH, 8), window.innerWidth - TOOLTIP_WIDTH - 8),
      })
    }
    setOpen(true)
  }

  const scheduleHide = () => {
    cancelHide()
    hideTimeoutRef.current = setTimeout(() => setOpen(false), HIDE_DELAY_MS)
  }

  return (
    <span
      className="elo-info-icon-wrap"
      ref={iconRef}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={scheduleHide}
    >
      <span className="rank-status-info" aria-hidden="true">
        i
      </span>
      {open && (
        <span
          className="elo-info-icon-tooltip elo-info-icon-tooltip-open"
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
        >
          <span className="elo-info-icon-tooltip-title">¿Qué es el ELO?</span>
          <p>
            El ELO es un sistema de rankeo para determinar quién es el más capo.{' '}
            <a href={ELO_WIKI_URL} target="_blank" rel="noopener noreferrer">
              Más info acá
            </a>
            .
          </p>
          <ul className="elo-info-list">
            {TIERS.map((tier) => (
              <li key={tier.name} className="elo-info-row">
                <span className={`elo-badge elo-info-tier ${tier.className}`}>
                  <EloTierIcon />
                  {tier.name}
                </span>
                <span className="elo-info-range">{rangeLabel(tier)}</span>
              </li>
            ))}
          </ul>
        </span>
      )}
    </span>
  )
}
