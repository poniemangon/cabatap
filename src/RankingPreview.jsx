import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyAverageLeaderboard, getDailyLeaderboard } from './daily/dailyApi'
import { getEloLeaderboard } from './duels/duelApi'
import EloBadge, { eloTier } from './EloBadge'
import './RankingPreview.css'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)
function todayDayNumber() {
  const now = new Date()
  const utcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((utcMidnight - EPOCH_UTC) / DAY_MS)
}

const TOP_N = 5

function PreviewList({ title, rows, emptyText, detail, to }) {
  return (
    <div className="ranking-preview-section">
      <h3 className="ranking-preview-section-title">{title}</h3>
      {rows.length === 0 ? (
        <p className="profile-empty-text">{emptyText}</p>
      ) : (
        <ul className="ranking-preview-list">
          {rows.map((r, i) => (
            <li key={r.key}>
              <Link to={to(r)} className="ranking-preview-row">
                <span className="ranking-preview-rank">#{i + 1}</span>
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} alt="" className="ranking-preview-avatar" />
                ) : (
                  <span className="ranking-preview-avatar ranking-preview-avatar-fallback">🙂</span>
                )}
                <span className="ranking-preview-name-wrap">
                  <span className="ranking-preview-name">{r.username || 'Jugador'}</span>
                  <EloBadge elo={r.elo} />
                </span>
                <span className="ranking-preview-score">{detail(r)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function RankingPreview() {
  const [dayRows, setDayRows] = useState([])
  const [avgRows, setAvgRows] = useState([])
  const [eloRows, setEloRows] = useState([])

  useEffect(() => {
    getDailyLeaderboard(todayDayNumber())
      .then((data) => setDayRows(data.slice(0, TOP_N)))
      .catch(console.error)
    getDailyAverageLeaderboard()
      .then((data) => setAvgRows(data.slice(0, TOP_N)))
      .catch(console.error)
    getEloLeaderboard(TOP_N)
      .then(setEloRows)
      .catch(console.error)
  }, [])

  return (
    <div className="ranking-preview-row">
      <div className="ranking-preview">
        <div className="ranking-preview-header">
          <h2 className="ranking-preview-title">🏆 Ranking mapa del día</h2>
          <Link to="/ranking" className="ranking-preview-link">
            Ver ranking completo →
          </Link>
        </div>

        <PreviewList
          title="Top mapa del día de hoy"
          rows={dayRows.map((r) => ({
            key: r.id,
            id: r.id,
            avatarUrl: r.profile?.avatar_url,
            username: r.profile?.username,
            elo: r.profile?.elo,
            total_score: r.total_score,
          }))}
          emptyText="Nadie jugó en modo competitivo hoy todavía."
          detail={(r) => `${r.total_score} pts`}
          to={(r) => `/mapa-diario/${r.id}`}
        />

        <PreviewList
          title="Top mapa del día promedio histórico"
          rows={avgRows.map((a) => ({
            key: a.profileId,
            avatarUrl: a.profile?.avatar_url,
            username: a.profile?.username,
            elo: a.profile?.elo,
            avgScore: a.avgScore,
          }))}
          emptyText="Todavía nadie jugó en modo competitivo."
          detail={(a) => `${Math.round(a.avgScore)} pts prom.`}
          to={(a) => `/jugador/${a.username}`}
        />
      </div>

      <div className="ranking-preview">
        <div className="ranking-preview-header">
          <h2 className="ranking-preview-title">🏅 Ranking de jugadores por ELO</h2>
          <Link to="/ranking" className="ranking-preview-link">
            Ver ranking completo →
          </Link>
        </div>

        <PreviewList
          title="Top ranking ELO"
          rows={eloRows.map((r) => ({ key: r.id, avatarUrl: r.avatar_url, username: r.username, elo: r.elo }))}
          emptyText="Todavía nadie jugó un duelo rankeado."
          detail={(r) => eloTier(r.elo).name}
          to={(r) => `/jugador/${r.username}`}
        />
      </div>
    </div>
  )
}
