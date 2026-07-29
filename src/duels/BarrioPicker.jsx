import { useMemo } from 'react'

const COMUNA_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
]

function comunaColor(comuna) {
  return COMUNA_COLORS[(comuna - 1) % COMUNA_COLORS.length]
}

// Shared by DuelSetupModal (private) and MultiplayerDuelSetupModal — both
// need the same "pick barrios, grouped by comuna, empty = cualquiera" UI.
export default function BarrioPicker({ barrios, selected, onToggle }) {
  const normalBarrios = useMemo(() => barrios.filter((b) => b.comuna !== 0), [barrios])

  const grouped = useMemo(() => {
    const byComuna = new Map()
    for (const b of normalBarrios) {
      if (!byComuna.has(b.comuna)) byComuna.set(b.comuna, [])
      byComuna.get(b.comuna).push(b)
    }
    return [...byComuna.entries()].sort((a, b) => a[0] - b[0])
  }, [normalBarrios])

  return (
    <>
      <div className="duel-setup-label">Barrios (vacío = cualquiera)</div>
      <div className="barrios-scroll">
        {grouped.map(([comuna, list]) => (
          <div key={comuna} className="comuna-group">
            <div className="comuna-label" style={{ color: comunaColor(comuna) }}>
              Comuna {comuna}
            </div>
            <div className="barrio-chips">
              {list.map((b) => (
                <button
                  type="button"
                  key={b.barrio_id}
                  className={`barrio-chip${selected.has(b.barrio_id) ? ' selected' : ''}`}
                  style={{ '--comuna-color': comunaColor(comuna) }}
                  onClick={() => onToggle(b.barrio_id)}
                >
                  {b.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
