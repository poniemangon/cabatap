// Auto-shown once per browser session to signed-in visitors (see App.jsx's
// ELO_INFO_SESSION_KEY effect) — a running author's-note announcement, not
// the ELO explainer (that's EloInfoIcon's hover tooltip on the ranking
// pages). Update the text here when there's something new to call out.
export default function EloInfoModal({ onClose }) {
  return (
    <div className="custom-modal duel-choice-modal">
      <div className="custom-modal-header">
        <span>Nota de autor</span>
        <button type="button" className="calendar-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <p className="duel-setup-hint">
        Ahora el mapa del día es con ubicaciones random dentro de los mismos barrios.
      </p>

      <button type="button" className="primary-btn start-custom-btn" onClick={onClose}>
        Entendido
      </button>
    </div>
  )
}
