import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ResultsMap from '../ResultsMap'
import { getDailyStatById } from '../daily/dailyApi'
import './DailyResultPage.css'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)
function formatDailyDate(dayNumber) {
  return new Date(EPOCH_UTC + dayNumber * DAY_MS).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatStreets(street1, street2) {
  return street2 ? `${street1} y ${street2}` : street1
}

export default function DailyResultPage() {
  const { id } = useParams()
  const [stat, setStat] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getDailyStatById(id)
      .then((data) => {
        if (cancelled) return
        if (!data) setError('No encontramos ese resultado.')
        else setStat(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="daily-result-page">
      <Link to="/" className="daily-result-back-link">
        ← Volver
      </Link>

      {error ? (
        <p className="daily-result-meta">{error}</p>
      ) : !stat ? (
        <p className="daily-result-meta">Cargando...</p>
      ) : (
        <>
          <header className="daily-result-header">
            {stat.profile?.avatar_url ? (
              <img src={stat.profile.avatar_url} alt="" className="daily-result-avatar" />
            ) : (
              <span className="daily-result-avatar daily-result-avatar-fallback">🙂</span>
            )}
            <div>
              <h1 className="daily-result-username">{stat.profile?.username || 'Jugador'}</h1>
              <p className="daily-result-meta">
                {formatDailyDate(stat.day_number)} — {stat.total_score} pts —{' '}
                <span className={`daily-mode-tag${stat.timed ? ' daily-mode-tag-timed' : ''}`}>
                  {stat.timed ? '⏱ Competitivo' : '🧘 Tranqui'}
                </span>
              </p>
            </div>
          </header>

          <div className="daily-result-map">
            <ResultsMap results={stat.results} pendingGuess={null} clickEnabled={false} onPick={() => {}} />
          </div>

          <ul className="daily-result-breakdown">
            {stat.results.map((r, i) => (
              <li key={i} className="daily-result-row">
                <span className="daily-result-row-streets">
                  R{i + 1}: {formatStreets(r.street1, r.street2)}
                </span>
                <span className="daily-result-row-detail">
                  {r.distance == null ? 'Sin respuesta' : `${Math.round(r.distance)} m`} — {r.points} pts
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
