import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyLeaderboard } from './daily/dailyApi'
import './RankingPreview.css'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)
function todayDayNumber() {
  const now = new Date()
  const utcMidnight = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((utcMidnight - EPOCH_UTC) / DAY_MS)
}

export default function RankingPreview() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    getDailyLeaderboard(todayDayNumber())
      .then((data) => setRows(data.slice(0, 10)))
      .catch(console.error)
  }, [])

  return (
    <div className="ranking-preview">
      <div className="ranking-preview-header">
        <h2 className="ranking-preview-title">🏆 Top 10 de hoy</h2>
        <Link to="/ranking" className="ranking-preview-link">
          Ver ranking completo →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="profile-empty-text">Nadie jugó en modo competitivo hoy todavía.</p>
      ) : (
        <ul className="ranking-preview-list">
          {rows.map((r, i) => (
            <li key={r.id}>
              <Link to={`/mapa-diario/${r.id}`} className="ranking-preview-row">
                <span className="ranking-preview-rank">#{i + 1}</span>
                {r.profile?.avatar_url ? (
                  <img src={r.profile.avatar_url} alt="" className="ranking-preview-avatar" />
                ) : (
                  <span className="ranking-preview-avatar ranking-preview-avatar-fallback">🙂</span>
                )}
                <span className="ranking-preview-name">{r.profile?.username || 'Jugador'}</span>
                <span className="ranking-preview-score">{r.total_score} pts</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
