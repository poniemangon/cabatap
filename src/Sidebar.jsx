export default function Sidebar({
  onDaily,
  onPractice,
  onOpenArchive,
  onOpenCustom,
  onSpecialOnly,
  currentScore,
  bestSessionScore,
  avgAccuracy,
}) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <button type="button" className="sidebar-nav-item" onClick={onDaily}>
          <span className="sidebar-nav-icon">🗺️</span> Mapa del día
        </button>
        <button type="button" className="sidebar-nav-item" onClick={onPractice}>
          <span className="sidebar-nav-icon">🎯</span> Práctica
        </button>
        <button type="button" className="sidebar-nav-item" onClick={onOpenArchive}>
          <span className="sidebar-nav-icon">📁</span> Archivo
        </button>
        <button type="button" className="sidebar-nav-item" onClick={onOpenCustom}>
          <span className="sidebar-nav-icon">⚙️</span> Personalizada
        </button>
        <button type="button" className="sidebar-nav-item sidebar-nav-item-special" onClick={onSpecialOnly}>
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
  )
}
