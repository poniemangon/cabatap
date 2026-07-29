import { useNavigate } from 'react-router-dom'
import { SignUpButton } from '@clerk/clerk-react'

export default function Dashboard({
  isSignedIn,
  onDaily,
  onPractice,
  onOpenArchive,
  onOpenCustom,
  onSpecialOnly,
  onDuel,
  onMultiplayerDuel,
}) {
  const navigate = useNavigate()
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
        <button type="button" className="dashboard-mode-card" onClick={onOpenArchive}>
          <span className="dashboard-mode-icon">📁</span>
          <span className="dashboard-mode-title">Archivo</span>
          <span className="dashboard-mode-desc">Accedé a desafíos diarios anteriores.</span>
        </button>

        <button type="button" className="dashboard-mode-card" onClick={() => navigate('/ranking')}>
          <span className="dashboard-mode-icon">🏆</span>
          <span className="dashboard-mode-title">Ranking de jugadores</span>
          <span className="dashboard-mode-desc">Mejor promedio y tabla del día en modo competitivo.</span>
        </button>

        {isSignedIn && (
          <>
            <button type="button" className="dashboard-mode-card" onClick={onPractice}>
              <span className="dashboard-mode-icon">🎯</span>
              <span className="dashboard-mode-title">Práctica</span>
              <span className="dashboard-mode-desc">Sin límite de tiempo ni puntuación, jugá cuando quieras.</span>
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
            <button type="button" className="dashboard-mode-card" onClick={onDuel}>
              <span className="dashboard-mode-icon">⚔️</span>
              <span className="dashboard-mode-title">Duelo 1 vs 1</span>
              <span className="dashboard-mode-desc">Privado (amigo o link) o random — elegís al entrar.</span>
            </button>
            <button type="button" className="dashboard-mode-card" onClick={onMultiplayerDuel}>
              <span className="dashboard-mode-icon">👥</span>
              <span className="dashboard-mode-title">Duelo multijugador</span>
              <span className="dashboard-mode-desc">Armá una sala abierta por link para varios jugadores.</span>
            </button>
          </>
        )}

        {!isSignedIn && (
          <div className="dashboard-mode-card dashboard-signup-card">
            <span className="dashboard-mode-icon">🔓</span>
            <span className="dashboard-mode-title">Desbloqueá más</span>
            <span className="dashboard-mode-desc">Registrate para acceder a más modos y desafiar otros jugadores.</span>
            <SignUpButton mode="modal">
              <button type="button" className="primary-btn secondary-btn dashboard-signup-card-btn">
                Registrarme
              </button>
            </SignUpButton>
          </div>
        )}
      </div>
    </div>
  )
}
