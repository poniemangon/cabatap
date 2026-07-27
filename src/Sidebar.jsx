export default function Sidebar({
  onDaily,
  onPractice,
  onOpenArchive,
  onOpenCustom,
  onSpecialOnly,
  currentScore,
  bestSessionScore,
  avgAccuracy,
  mobileOpen,
  onClose,
}) {
  const withClose = (fn) => () => {
    fn()
    onClose?.()
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <nav className="sidebar-nav">
          <button type="button" className="sidebar-nav-item" onClick={withClose(onDaily)}>
            <span className="sidebar-nav-icon">🗺️</span> Mapa del día
          </button>
          <button type="button" className="sidebar-nav-item" onClick={withClose(onPractice)}>
            <span className="sidebar-nav-icon">🎯</span> Práctica
          </button>
          <button type="button" className="sidebar-nav-item" onClick={withClose(onOpenArchive)}>
            <span className="sidebar-nav-icon">📁</span> Archivo
          </button>
          <button type="button" className="sidebar-nav-item" onClick={withClose(onOpenCustom)}>
            <span className="sidebar-nav-icon">⚙️</span> Personalizada
          </button>
          <button
            type="button"
            className="sidebar-nav-item sidebar-nav-item-special"
            onClick={withClose(onSpecialOnly)}
          >
            <span className="sidebar-nav-icon">✨</span> Especiales
            <span className="menu-item-eyebrow">En desarrollo</span>
          </button>
        </nav>

        <div className="sidebar-stats">
          <div className="sidebar-stats-title">Stats de sesión</div>
          <div className="sidebar-stat-row">
            <span>Puntaje actual</span>
            <strong>{currentScore}</strong>
          </div>
          <div className="sidebar-stat-row">
            <span>Mejor puntaje</span>
            <strong>{bestSessionScore}</strong>
          </div>
          <div className="sidebar-stat-row">
            <span>Precisión</span>
            <strong>{Math.round(avgAccuracy * 100)}%</strong>
          </div>
        </div>
      </aside>
    </>
  )
}
