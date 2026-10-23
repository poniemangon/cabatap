import { useEffect, useRef } from 'react'
import './AdSlot.css'

const CLIENT = 'ca-pub-9821179304696982'
const DEFAULT_SLOT = '7030234704' // "ubicaba ads" display unit
const SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`

// The AdSense script is no longer loaded globally (index.html) — Auto ads were
// placing ads on the game/map, loading and login screens, which AdSense flags
// as "ads on screens without publisher content". It's loaded on demand here,
// so only pages that render an <AdSlot> (content pages) ever pull it in.
function ensureScript() {
  if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return
  const s = document.createElement('script')
  s.async = true
  s.src = SCRIPT_SRC
  s.crossOrigin = 'anonymous'
  document.head.appendChild(s)
}

// Only render this below real, already-loaded content — never on a loading,
// error or empty state.
export default function AdSlot({ slot = DEFAULT_SLOT }) {
  const insRef = useRef(null)

  useEffect(() => {
    const ins = insRef.current
    // StrictMode runs effects twice in dev; pushing twice on the same <ins> throws.
    if (!ins || ins.dataset.adsbygoogleStatus || ins.dataset.pushed) return
    ins.dataset.pushed = '1'
    ensureScript()
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch (e) {
      console.error(e)
    }
  }, [])

  if (!slot) return null

  return (
    <div className="ad-slot">
      <span className="ad-slot-label">Publicidad</span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}
