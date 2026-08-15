import './PickIntersectionModal.css'

function formatStreets(street1, street2) {
  return street2 ? `${street1} y ${street2}` : street1
}

// Alternate entry point into AddCommentModal for players who'd rather not
// hunt for the right map pin — lists every round as a plain clickable row,
// picking one behaves exactly like clicking that round's actual-location
// marker would.
export default function PickIntersectionModal({ rounds, onPick, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="custom-modal pick-intersection-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-header">
          <span>¿Sobre qué esquina?</span>
          <button type="button" className="calendar-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <ul className="pick-intersection-list">
          {rounds.map((r, i) => (
            <li key={i}>
              <button type="button" className="pick-intersection-item" onClick={() => onPick(r)}>
                <span className="pick-intersection-round">R{i + 1}</span>
                <span className="pick-intersection-street">{formatStreets(r.street1, r.street2)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
