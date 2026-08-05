import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getDuelById, getDuelResults, computeWinnerId } from '../duels/duelApi'
import EloBadge from '../EloBadge'
import './DuelResultPage.css'

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })
}

export default function DuelResultPage() {
  const { id } = useParams()
  const [duel, setDuel] = useState(null)
  const [results, setResults] = useState([])
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setDuel(null)
    setResults([])
    setNotFound(false)
    setError(null)
    getDuelById(id)
      .then((d) => {
        if (cancelled) return
        if (!d) {
          setNotFound(true)
          return
        }
        setDuel(d)
        return getDuelResults(d.id).then((r) => !cancelled && setResults(r))
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const ranked = [...results].sort((a, b) => b.total_score - a.total_score)
  const winnerId = duel?.closed_at ? duel.winner_id : results.length >= 2 ? computeWinnerId(results) : null

  return (
    <div className="duel-result-page">
      <Link to="/" className="duel-result-back-link">
        ← Volver
      </Link>

      {error ? (
        <p className="duel-result-meta">{error}</p>
      ) : notFound ? (
        <p className="duel-result-meta">No encontramos ese duelo.</p>
      ) : !duel ? (
        <p className="duel-result-meta">Cargando...</p>
      ) : (
        <>
          <header className="duel-result-header">
            <h1 className="duel-result-title">{duel.is_multiplayer ? 'Duelo multijugador' : 'Duelo 1 vs 1'}</h1>
            <p className="duel-result-meta">
              {duel.closed_at ? `Cerrado el ${formatDate(duel.closed_at)}` : 'Todavía en curso'}
              {duel.matchmaking && ' — Rankeado'}
            </p>
          </header>

          {ranked.length === 0 ? (
            <p className="duel-result-meta">Todavía nadie jugó este duelo.</p>
          ) : (
            <ul className="duel-result-list">
              {ranked.map((r, i) => (
                <li key={r.profile_id} className="duel-result-row">
                  <span className="duel-result-rank">#{i + 1}</span>
                  <span className="duel-result-name">
                    {r.profile?.username ? (
                      <Link to={`/jugador/${r.profile.username}`}>{r.profile.username}</Link>
                    ) : (
                      'Jugador'
                    )}{' '}
                    <EloBadge elo={r.profile?.elo} />
                    {r.profile_id === winnerId && ' 🏆'}
                  </span>
                  <span className="duel-result-score">{r.total_score}</span>
                </li>
              ))}
            </ul>
          )}

          {ranked.length >= 2 && duel.closed_at && (
            <p className="duel-result-verdict">
              {winnerId
                ? `🏆 Ganó ${ranked.find((r) => r.profile_id === winnerId)?.profile?.username || 'un jugador'}`
                : 'Empataron'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
