import { useState } from 'react'
import { addComment, findIntersectionPoolIndex } from './commentsApi'
import './AddCommentModal.css'

function formatStreets(street1, street2) {
  return street2 ? `${street1} y ${street2}` : street1
}

// Shared by both places a duel result map is shown (App.jsx's in-game
// gameOver view, reached from notifications, and DuelResultPage.jsx,
// reached from a profile's duel history) — round is whichever result entry
// the clicked actual-location marker belongs to.
export default function AddCommentModal({ round, profile, onClose }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      const poolIndex = await findIntersectionPoolIndex({
        street1: round.street1,
        street2: round.street2,
        lat: round.actual[0],
        lng: round.actual[1],
      })
      if (poolIndex == null) throw new Error('No encontramos esta esquina en la base de datos.')
      await addComment({ poolIndex, profileId: profile.id, text: text.trim() })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="custom-modal add-comment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="custom-modal-header">
          <span>Agregar comentario/sugerencia</span>
          <button type="button" className="calendar-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="add-comment-subtitle">{formatStreets(round.street1, round.street2)}</p>

        {sent ? (
          <>
            <p className="add-comment-success">¡Gracias! Tu comentario fue enviado.</p>
            <button type="button" className="primary-btn add-comment-submit" onClick={onClose}>
              Cerrar
            </button>
          </>
        ) : !profile ? (
          <p className="add-comment-subtitle">Necesitás una cuenta para comentar.</p>
        ) : (
          <form className="add-comment-form" onSubmit={handleSubmit}>
            <textarea
              className="add-comment-textarea"
              placeholder="Contanos qué está mal o qué se puede mejorar de esta esquina..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              maxLength={1000}
              required
            />
            {error && <p className="add-comment-error">{error}</p>}
            <div className="add-comment-actions">
              <button type="button" className="primary-btn secondary-btn" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="primary-btn add-comment-submit" disabled={saving || !text.trim()}>
                {saving ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
