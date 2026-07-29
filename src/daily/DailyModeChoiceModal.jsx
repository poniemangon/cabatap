export default function DailyModeChoiceModal({ onClose, onChooseTranqui, onChooseCompetitivo }) {
  return (
    <div className="custom-modal duel-choice-modal">
      <div className="custom-modal-header">
        <span>Mapa del día</span>
        <button type="button" className="calendar-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <button type="button" className="duel-choice-option" onClick={onChooseTranqui}>
        <span className="duel-choice-icon">🧘</span>
        <span className="duel-choice-text">
          <span className="duel-choice-title">Modo tranqui</span>
          <span className="duel-choice-desc">Sin límite de tiempo, no rankea contra nadie.</span>
        </span>
      </button>

      <button type="button" className="duel-choice-option" onClick={onChooseCompetitivo}>
        <span className="duel-choice-icon">⏱</span>
        <span className="duel-choice-text">
          <span className="duel-choice-title">Modo competitivo</span>
          <span className="duel-choice-desc">8s por ubicación, como un duelo — rankea contra todos hoy.</span>
        </span>
      </button>
    </div>
  )
}
