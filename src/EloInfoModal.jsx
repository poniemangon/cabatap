import { TIERS, EloTierIcon } from './EloBadge'

function rangeLabel(tier) {
  return tier.max === Infinity ? `${tier.min}+` : `${tier.min} - ${tier.max - 1}`
}

export default function EloInfoModal({ onClose }) {
  return (
    <div className="custom-modal duel-choice-modal">
      <div className="custom-modal-header">
        <span>¿Qué es ese número al lado de tu nombre?</span>
        <button type="button" className="calendar-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <p className="duel-setup-hint">
        Es tu puntaje ELO: un ranking que sube y baja con los resultados de Duelo rankeado, y define quién es el más
        capo de todos.
      </p>

      <ul className="elo-info-list">
        {TIERS.map((tier) => (
          <li key={tier.name} className="elo-info-row">
            <span className={`elo-badge elo-info-tier ${tier.className}`}>
              <EloTierIcon />
              {tier.name}
            </span>
            <span className="elo-info-range">{rangeLabel(tier)}</span>
          </li>
        ))}
      </ul>

      <button type="button" className="primary-btn start-custom-btn" onClick={onClose}>
        Entendido
      </button>
    </div>
  )
}
