import { useMemo, useState } from 'react'

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

export default function CustomGamePicker({ barrios, barrioCounts, onStart, onClose }) {
  // Special (comuna 0) locations get their own dedicated "solo especiales"
  // entry point in the menu, so they're excluded from this picker entirely.
  const normalBarrios = useMemo(() => barrios.filter((b) => b.comuna !== 0), [barrios])

  const [selected, setSelected] = useState(() => new Set())

  const grouped = useMemo(() => {
    const byComuna = new Map()
    for (const b of normalBarrios) {
      if (!byComuna.has(b.comuna)) byComuna.set(b.comuna, [])
      byComuna.get(b.comuna).push(b)
    }
    return [...byComuna.entries()].sort((a, b) => a[0] - b[0])
  }, [normalBarrios])

  const toggleBarrio = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected = selected.size === normalBarrios.length
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(normalBarrios.map((b) => b.barrio_id)))
  }

  const availableCount = normalBarrios.reduce(
    (sum, b) => (selected.has(b.barrio_id) ? sum + (barrioCounts.get(b.barrio_id) || 0) : sum),
    0,
  )
  const canStart = availableCount >= 5

  return (
    <div className="custom-modal">
      <div className="custom-modal-header">
        <span>Partida personalizada</span>
        <button type="button" className="calendar-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <button type="button" className="deselect-all-btn" onClick={toggleAll}>
        {allSelected ? 'Destildar todos los barrios' : 'Seleccionar todos los barrios'}
      </button>

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
                  style={{
                    '--comuna-color': comunaColor(comuna),
                  }}
                  onClick={() => toggleBarrio(b.barrio_id)}
                >
                  {b.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="primary-btn start-custom-btn" disabled={!canStart} onClick={() => onStart([...selected])}>
        {canStart ? 'Comenzar' : 'Elegí al menos un barrio para comenzar'}
      </button>
    </div>
  )
}
