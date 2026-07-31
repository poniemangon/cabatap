import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProfileByUsername } from '../friends/friendsApi'
import { listMyDuels, getDuelStats } from '../duels/duelApi'
import { listMyDailyStats } from '../daily/dailyApi'
import EloBadge from '../EloBadge'
import './ProfilePage.css'

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

// Read-only, third-party view — reuses the exact same duel/daily queries the
// owner's own profile page uses. That's deliberate: RLS already scopes what
// a non-participant can see (multiplayer duels are public, 1v1 ones aren't),
// so calling the same functions here naturally shows only what's actually
// visible to whoever's looking, no separate "public" logic needed.
function PublicDuelRow({ duel }) {
  const ranked = [...duel.duel_results].sort((a, b) => b.total_score - a.total_score)
  if (duel.is_multiplayer) {
    return (
      <li className="profile-duel-row">
        <span className="profile-duel-opponent">Duelo multijugador</span>
        <span className="profile-duel-score">
          {ranked.map((r) => `${r.profile?.username || 'Jugador'}: ${r.total_score}`).join(' · ')}
        </span>
      </li>
    )
  }
  const [a, b] = ranked
  return (
    <li className="profile-duel-row">
      <span className="profile-duel-opponent">
        {a?.profile?.username || 'Jugador'} <EloBadge elo={a?.profile?.elo} /> vs{' '}
        {b?.profile?.username || 'esperando rival'} <EloBadge elo={b?.profile?.elo} />
      </span>
      <span className="profile-duel-score">{b ? `${a.total_score} — ${b.total_score}` : `${a.total_score}`}</span>
    </li>
  )
}

export default function PublicProfilePage() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [duels, setDuels] = useState([])
  const [dailyStats, setDailyStats] = useState([])
  const [stats, setStats] = useState({
    oneVOne: { played: 0, won: 0, tied: 0 },
    multi: { played: 0, won: 0, tied: 0 },
  })

  useEffect(() => {
    let cancelled = false
    setProfile(null)
    setNotFound(false)
    getProfileByUsername(username)
      .then((p) => {
        if (cancelled) return
        if (!p) {
          setNotFound(true)
          return
        }
        setProfile(p)
        listMyDuels(p.id).then((d) => !cancelled && setDuels(d)).catch(console.error)
        getDuelStats(p.id).then((s) => !cancelled && setStats(s)).catch(console.error)
        listMyDailyStats(p.id).then((d) => !cancelled && setDailyStats(d)).catch(console.error)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setNotFound(true)
      })
    return () => {
      cancelled = true
    }
  }, [username])

  // Tranqui and competitivo save as separate daily_stats rows for the same
  // day_number — collapse to one card per day, preferring competitivo when
  // both exist (see ProfilePage.jsx's identical dedupedDailyStats).
  const dedupedDailyStats = useMemo(() => {
    const byDay = new Map()
    for (const d of dailyStats) {
      const existing = byDay.get(d.day_number)
      if (!existing || (d.timed && !existing.timed)) byDay.set(d.day_number, d)
    }
    return [...byDay.values()].sort((a, b) => b.day_number - a.day_number)
  }, [dailyStats])

  return (
    <div className="profile-page">
      <Link to="/" className="profile-back-link">
        ← Volver
      </Link>

      {notFound ? (
        <p className="profile-empty-text">No encontramos a ese jugador.</p>
      ) : !profile ? (
        <p className="profile-empty-text">Cargando...</p>
      ) : (
        <>
          <header className="profile-header">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="profile-avatar" />
            ) : (
              <span className="profile-avatar profile-avatar-fallback">🙂</span>
            )}
            <h1 className="profile-username">
              {profile.username} <EloBadge elo={profile.elo} />
            </h1>
          </header>

          <section className="profile-section">
            <h2 className="profile-section-title">Estadísticas</h2>
            <div className="profile-stats-grid">
              <div className="profile-stat-card">
                <div className="profile-stat-title">1 vs 1</div>
                <div className="profile-stat-numbers">
                  <span>{stats.oneVOne.played} jugados</span>
                  <span>{stats.oneVOne.won} ganados</span>
                  <span>{stats.oneVOne.tied} empatados</span>
                </div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-title">Multijugador</div>
                <div className="profile-stat-numbers">
                  <span>{stats.multi.played} jugados</span>
                  <span>{stats.multi.won} ganados</span>
                  <span>{stats.multi.tied} empatados</span>
                </div>
              </div>
            </div>
            <p className="profile-empty-text" style={{ marginTop: 10 }}>
              Los duelos 1 vs 1 privados no son visibles para otros jugadores — estas estadísticas solo cuentan lo
              que es público (duelos multijugador).
            </p>
          </section>

          <section className="profile-section">
            <h2 className="profile-section-title">Duelos jugados</h2>
            {duels.length === 0 ? (
              <p className="profile-empty-text">No hay duelos públicos para mostrar.</p>
            ) : (
              <ul className="profile-duel-list">
                {duels.map((d) => (
                  <PublicDuelRow key={d.id} duel={d} />
                ))}
              </ul>
            )}
          </section>

          <section className="profile-section">
            <h2 className="profile-section-title">Mapas diarios jugados</h2>
            {dedupedDailyStats.length === 0 ? (
              <p className="profile-empty-text">Todavía no jugó ningún mapa diario.</p>
            ) : (
              <ul className="profile-duel-list">
                {dedupedDailyStats.map((d) => (
                  <li
                    key={d.id}
                    className="profile-duel-row profile-duel-row-clickable"
                    onClick={() => navigate(`/mapa-diario/${d.id}`)}
                  >
                    <span className="profile-duel-opponent">
                      {formatDailyDate(d.day_number)}
                      {d.timed && <span className="daily-mode-tag daily-mode-tag-timed">⏱ Competitivo</span>}
                    </span>
                    <span className="profile-duel-score">{d.total_score} pts</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
