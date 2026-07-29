export default function DuelChoiceModal({ onClose, onChoosePrivate, onChooseRandom }) {
  return (
    <div className="custom-modal duel-choice-modal">
      <div className="custom-modal-header">
        <span>Duelo 1 vs 1</span>
        <button type="button" className="calendar-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <button type="button" className="duel-choice-option" onClick={onChoosePrivate}>
        <span className="duel-choice-icon">🔒</span>
        <span className="duel-choice-text">
          <span className="duel-choice-title">Duelo privado</span>
          <span className="duel-choice-desc">Elegí un amigo o compartí un link, y elegí los barrios.</span>
        </span>
      </button>

      <button type="button" className="duel-choice-option" onClick={onChooseRandom}>
        <span className="duel-choice-icon">🎲</span>
        <span className="duel-choice-text">
          <span className="duel-choice-title">Duelo random</span>
          <span className="duel-choice-desc">Te empareja al instante con alguien más buscando rival.</span>
        </span>
      </button>
    </div>
  )
}
