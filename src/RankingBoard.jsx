import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CalendarPicker from './CalendarPicker'
import useProfile from './hooks/useProfile'
import { getDailyAverageLeaderboard, getDailyLeaderboard } from './daily/dailyApi'
import './RankingBoard.css'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)
function dayNumberForDate(date) {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((utcMidnight - EPOCH_UTC) / DAY_MS)
}
function formatDailyDate(dayNumber) {
  return new Date(EPOCH_UTC + dayNumber * DAY_MS).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

const MAX_SIZE = 100

function RankRow({ rank, avatarUrl, username, detail, to }) {
  return (
    <li>
      <Link to={to} className="ranking-row">
        <span className="ranking-row-rank">#{rank}</span>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="ranking-row-avatar" />
        ) : (
          <span className="ranking-row-avatar ranking-row-avatar-fallback">🙂</span>
        )}
        <span className="ranking-row-name">{username || 'Jugador'}</span>
        <span className="ranking-row-detail">{detail}</span>
      </Link>
    </li>
  )
}

function YourRankSummary({ profile, dayRank, dayDetail, avgRank, avgDetail }) {
  if (!profile) return null
  return (
    <div className="ranking-your-summary">
      <div className="ranking-your-summary-item">
        <span className="ranking-your-summary-label">Tu ranking de hoy</span>
        <span className={`ranking-your-summary-value${dayRank ? '' : ' ranking-your-summary-empty'}`}>
          {dayRank ? `#${dayRank} · ${dayDetail}` : 'Todavía no jugaste hoy'}
        </span>
      </div>
      <div className="ranking-your-summary-item">
        <span className="ranking-your-summary-label">Tu ranking histórico</span>
        <span className={`ranking-your-summary-value${avgRank ? '' : ' ranking-your-summary-empty'}`}>
          {avgRank ? `#${avgRank} · ${avgDetail}` : 'Todavía no jugaste'}
        </span>
      </div>
    </div>
  )
}

function LeaderboardSection({ title, extra, items, emptyText, renderDetail, to }) {
  return (
    <section className="ranking-section">
      <div className="ranking-section-header">
        <h3 className="ranking-section-title">{title}</h3>
        {extra}
      </div>

      {items.length === 0 ? (
        <p className="profile-empty-text">{emptyText}</p>
      ) : (
        <div className="ranking-list-scroll">
          <ul className="ranking-list">
            {items.slice(0, MAX_SIZE).map((item, i) => (
              <RankRow
                key={item.key}
                rank={i + 1}
                avatarUrl={item.avatarUrl}
                username={item.username}
                detail={renderDetail(item)}
                to={to(item)}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default function RankingBoard() {
  const { profile } = useProfile()
  const todayDayNumber = dayNumberForDate(new Date())
  const [averages, setAverages] = useState([])
  const [dayNumber, setDayNumber] = useState(todayDayNumber)
  const [dayResults, setDayResults] = useState([])
  const [calendarOpen, setCalendarOpen] = useState(false)

  useEffect(() => {
    getDailyAverageLeaderboard().then(setAverages).catch(console.error)
  }, [])

  useEffect(() => {
    getDailyLeaderboard(dayNumber).then(setDayResults).catch(console.error)
  }, [dayNumber])

  const myAvgRank = profile ? averages.findIndex((a) => a.profileId === profile.id) + 1 : 0
  const myAvgEntry = myAvgRank ? averages[myAvgRank - 1] : null
  const myDayRank = profile ? dayResults.findIndex((r) => r.profile_id === profile.id) + 1 : 0
  const myDayEntry = myDayRank ? dayResults[myDayRank - 1] : null

  return (
    <div className="ranking-board">
      <h2 className="ranking-board-title">🏆 Ranking de jugadores</h2>
      <p className="ranking-subtitle">Solo cuentan las partidas de Mapa del día en modo competitivo.</p>

      <YourRankSummary
        profile={profile}
        dayRank={myDayRank}
        dayDetail={myDayEntry ? `${myDayEntry.total_score} pts` : null}
        avgRank={myAvgRank}
        avgDetail={
          myAvgEntry
            ? `${myAvgEntry.avgScore.toFixed(1)} pts prom. (${myAvgEntry.played} ${myAvgEntry.played === 1 ? 'partida' : 'partidas'})`
            : null
        }
      />

      <LeaderboardSection
        title={dayNumber === todayDayNumber ? 'Ranking de hoy' : formatDailyDate(dayNumber)}
        extra={
          <button type="button" className="primary-btn secondary-btn ranking-day-label" onClick={() => setCalendarOpen(true)}>
            Ver otro día
          </button>
        }
        items={dayResults.map((r) => ({ key: r.id, avatarUrl: r.profile?.avatar_url, username: r.profile?.username, ...r }))}
        emptyText="Nadie jugó en modo competitivo ese día."
        renderDetail={(r) => `${r.total_score} pts`}
        to={(r) => `/mapa-diario/${r.id}`}
      />

      <LeaderboardSection
        title="Mejor promedio (histórico)"
        items={averages.map((a) => ({ key: a.profileId, avatarUrl: a.profile?.avatar_url, username: a.profile?.username, ...a }))}
        emptyText="Todavía nadie jugó en modo competitivo."
        renderDetail={(a) => `${a.avgScore.toFixed(1)} pts prom. (${a.played} ${a.played === 1 ? 'partida' : 'partidas'})`}
        to={(a) => `/jugador/${a.profile?.username}`}
      />

      {calendarOpen && (
        <div className="modal-backdrop" onClick={() => setCalendarOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal">
              <div className="custom-modal-header">
                <span>Elegí una fecha</span>
                <button type="button" className="calendar-close" onClick={() => setCalendarOpen(false)}>
                  ✕
                </button>
              </div>
              <CalendarPicker
                dayNumberForDate={dayNumberForDate}
                todayDayNumber={todayDayNumber}
                onSelectDay={(picked) => {
                  setDayNumber(picked)
                  setCalendarOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
