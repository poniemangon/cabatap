export default function Dashboard({ onDaily, onPractice, onOpenArchive, onOpenCustom, onSpecialOnly }) {
  return (
    <div className="dashboard">
      <div className="dashboard-daily-card">
        <div className="dashboard-daily-eyebrow">Desafío diario</div>
        <h1 className="dashboard-daily-title">Mapa del día</h1>
        <p className="dashboard-daily-text">
          5 esquinas nuevas cada día. Todos juegan la misma partida — comparala con tus amigos.
        </p>
        <button type="button" className="primary-btn dashboard-daily-btn" onClick={onDaily}>
          Jugar ahora
        </button>
      </div>

      <div className="dashboard-grid">
        <button type="button" className="dashboard-mode-card" onClick={onPractice}>
          <span className="dashboard-mode-icon">🎯</span>
          <span className="dashboard-mode-title">Práctica</span>
          <span className="dashboard-mode-desc">Sin límite de tiempo ni puntuación, jugá cuando quieras.</span>
        </button>
        <button type="button" className="dashboard-mode-card" onClick={onOpenArchive}>
          <span className="dashboard-mode-icon">📁</span>
          <span className="dashboard-mode-title">Archivo</span>
          <span className="dashboard-mode-desc">Accedé a desafíos diarios anteriores.</span>
        </button>
        <button type="button" className="dashboard-mode-card" onClick={onOpenCustom}>
          <span className="dashboard-mode-icon">⚙️</span>
          <span className="dashboard-mode-title">Personalizada</span>
          <span className="dashboard-mode-desc">Elegí barrios específicos para jugar.</span>
        </button>
        <button type="button" className="dashboard-mode-card dashboard-mode-card-special" onClick={onSpecialOnly}>
          <span className="dashboard-mode-icon">✨</span>
          <span className="dashboard-mode-title">
            Especiales <span className="menu-item-eyebrow">En desarrollo</span>
          </span>
          <span className="dashboard-mode-desc">Solo ubicaciones únicas: monumentos, lugares históricos y más.</span>
        </button>
      </div>
    </div>
  )
}
