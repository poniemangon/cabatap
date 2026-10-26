import RankingPreview from './RankingPreview'

export default function Dashboard({
  isSignedIn,
  onDaily,
  onPractice,
  onOpenArchive,
  onOpenCustom,
  onSpecialOnly,
  onDuel,
  onMultiplayerDuel,
  onOpenAuth,
}) {
  return (
    <div className="dashboard">
      <div className="dashboard-columns">
        <div className="dashboard-daily-card">
          <div className="dashboard-daily-eyebrow">Desafío diario</div>
          <h1 className="dashboard-daily-title">Mapa del día</h1>
          <p className="dashboard-daily-text">
            5 esquinas nuevas cada día, en los mismos barrios para todos — comparala con tus amigos.
          </p>
          <button type="button" className="primary-btn dashboard-daily-btn" onClick={onDaily}>
            Jugar ahora
          </button>
        </div>

        <RankingPreview />

        <div className="dashboard-grid">
          <button type="button" className="dashboard-mode-card" onClick={onOpenArchive}>
            <span className="dashboard-mode-icon">📁</span>
            <span className="dashboard-mode-title">Archivo</span>
            <span className="dashboard-mode-desc">Desafíos diarios (modo tranqui) anteriores.</span>
          </button>
          <button type="button" className="dashboard-mode-card" onClick={onPractice}>
            <span className="dashboard-mode-icon">🎯</span>
            <span className="dashboard-mode-title">Práctica</span>
            <span className="dashboard-mode-desc">Igual que el mapa del día</span>
          </button>
          <button type="button" className="dashboard-mode-card" onClick={onOpenCustom}>
            <span className="dashboard-mode-icon">⚙️</span>
            <span className="dashboard-mode-title">Personalizada</span>
            <span className="dashboard-mode-desc">Elegí barrios específicos para jugar.</span>
          </button>
          <button type="button" className="dashboard-mode-card dashboard-mode-card-special" onClick={onSpecialOnly}>
            <span className="dashboard-mode-icon">✨</span>
            <span className="dashboard-mode-title">Especiales</span>
            <span className="dashboard-mode-desc">Solo ubicaciones únicas: monumentos, lugares históricos y más.</span>
          </button>

          {isSignedIn && (
            <>
              <button type="button" className="dashboard-mode-card" onClick={onDuel}>
                <span className="dashboard-mode-icon">🏅</span>
                <span className="dashboard-mode-title">Duelo rankeado</span>
                <span className="dashboard-mode-desc">Emparejamiento instantáneo — afecta tu ELO.</span>
              </button>
              <button type="button" className="dashboard-mode-card" onClick={onMultiplayerDuel}>
                <span className="dashboard-mode-icon">🔒</span>
                <span className="dashboard-mode-title">Duelo privado</span>
                <span className="dashboard-mode-desc">1 vs 1 con amigos o multijugador — no afecta tu ELO.</span>
              </button>
            </>
          )}

          {!isSignedIn && (
            <div className="dashboard-mode-card dashboard-signup-card">
              <span className="dashboard-mode-icon">🔓</span>
              <span className="dashboard-mode-title">Desbloqueá más</span>
              <span className="dashboard-mode-desc">
                Registrate para acceder a más modos y desafiar otros jugadores.
              </span>
              <button type="button" className="primary-btn secondary-btn dashboard-signup-card-btn" onClick={onOpenAuth}>
                Registrarme
              </button>
            </div>
          )}
        </div>

        {/* Plain <a>: the guides are static HTML pages outside the SPA (scripts/build-content.mjs). */}
        <section className="dashboard-guides">
          <h2 className="dashboard-guides-title">Aprendé a ubicarte en la Ciudad</h2>
          <p className="dashboard-guides-text">
            Guías para conocer Buenos Aires y sumar más puntos: cómo funciona la numeración, las avenidas que te
            ordenan el mapa, los lugares emblemáticos y una guía para cada uno de los 48 barrios.
          </p>
          <div className="dashboard-guides-links">
            <a href="/guias/como-orientarse-en-buenos-aires">Cómo orientarse en Buenos Aires</a>
            <a href="/guias/avenidas-de-buenos-aires">Las avenidas que te ubican</a>
            <a href="/guias/lugares-emblematicos-de-buenos-aires">Lugares emblemáticos</a>
            <a href="/guias/consejos-para-sumar-puntos">Consejos para sumar puntos</a>
            <a href="/barrios">Los 48 barrios</a>
          </div>
        </section>
      </div>
    </div>
  )
}
