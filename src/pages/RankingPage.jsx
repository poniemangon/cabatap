import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CalendarPicker from '../CalendarPicker'
import useProfile from '../hooks/useProfile'
import { getDailyAverageLeaderboard, getDailyLeaderboard } from '../daily/dailyApi'
import './RankingPage.css'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)
function dayNumberForDate(date) {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((utcMidnight - EPOCH_UTC) / DAY_MS)
}
function formatDailyDate(dayNumber) {
  return new Date(EPOCH_UTC + dayNumber * DAY_MS).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

const PAGE_SIZE = 10
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

function YourRankCard({ rank, avatarUrl, username, detail }) {
  if (!rank) {
    return <p className="ranking-your-card ranking-your-card-empty">Todavía no jugaste el modo competitivo acá.</p>
  }
  return (
    <div className="ranking-your-card">
      <span className="ranking-row-rank">#{rank}</span>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="ranking-row-avatar" />
      ) : (
        <span className="ranking-row-avatar ranking-row-avatar-fallback">🙂</span>
      )}
      <span className="ranking-row-name">{username || 'Vos'}</span>
      <span className="ranking-row-detail">{detail}</span>
    </div>
  )
}

function LeaderboardSection({ title, extra, items, emptyText, limit, onExpand, myRank, myDetail, profile, renderDetail, to }) {
  return (
    <section className="ranking-section">
      <div className="ranking-section-header">
        <h2 className="ranking-section-title">{title}</h2>
        {extra}
      </div>

      {profile && <YourRankCard rank={myRank} avatarUrl={profile.avatar_url} username={profile.username} detail={myDetail} />}

      {items.length === 0 ? (
        <p className="profile-empty-text">{emptyText}</p>
      ) : (
        <>
          <ul className="ranking-list">
            {items.slice(0, limit).map((item, i) => (
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
          {items.length > limit && limit < MAX_SIZE && (
            <button type="button" className="primary-btn secondary-btn ranking-expand-btn" onClick={onExpand}>
              Ver top {MAX_SIZE}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default function RankingPage() {
  const { profile } = useProfile()
  const todayDayNumber = dayNumberForDate(new Date())
  const [averages, setAverages] = useState([])
  const [dayNumber, setDayNumber] = useState(todayDayNumber)
  const [dayResults, setDayResults] = useState([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [avgLimit, setAvgLimit] = useState(PAGE_SIZE)
  const [dayLimit, setDayLimit] = useState(PAGE_SIZE)

  useEffect(() => {
    getDailyAverageLeaderboard().then(setAverages).catch(console.error)
  }, [])

  useEffect(() => {
    setDayLimit(PAGE_SIZE)
    getDailyLeaderboard(dayNumber).then(setDayResults).catch(console.error)
  }, [dayNumber])

  const myAvgRank = profile ? averages.findIndex((a) => a.profileId === profile.id) + 1 : 0
  const myAvgEntry = myAvgRank ? averages[myAvgRank - 1] : null
  const myDayRank = profile ? dayResults.findIndex((r) => r.profile_id === profile.id) + 1 : 0
  const myDayEntry = myDayRank ? dayResults[myDayRank - 1] : null

  return (
    <div className="ranking-page">
      <Link to="/" className="ranking-back-link">
        ← Volver
      </Link>

      <h1 className="ranking-title">Ranking de jugadores</h1>
      <p className="ranking-subtitle">Solo cuentan las partidas de Mapa del día en modo competitivo.</p>

      <LeaderboardSection
        title={dayNumber === todayDayNumber ? 'Ranking de hoy' : formatDailyDate(dayNumber)}
        extra={
          <button type="button" className="primary-btn secondary-btn ranking-day-label" onClick={() => setCalendarOpen(true)}>
            Ver otro día
          </button>
        }
        items={dayResults.map((r) => ({ key: r.id, avatarUrl: r.profile?.avatar_url, username: r.profile?.username, ...r }))}
        emptyText="Nadie jugó en modo competitivo ese día."
        limit={dayLimit}
        onExpand={() => setDayLimit(MAX_SIZE)}
        myRank={myDayRank}
        myDetail={myDayEntry ? `${myDayEntry.total_score} pts` : null}
        profile={profile}
        renderDetail={(r) => `${r.total_score} pts`}
        to={(r) => `/mapa-diario/${r.id}`}
      />

      <LeaderboardSection
        title="Mejor promedio (histórico)"
        items={averages.map((a) => ({ key: a.profileId, avatarUrl: a.profile?.avatar_url, username: a.profile?.username, ...a }))}
        emptyText="Todavía nadie jugó en modo competitivo."
        limit={avgLimit}
        onExpand={() => setAvgLimit(MAX_SIZE)}
        myRank={myAvgRank}
        myDetail={myAvgEntry ? `${myAvgEntry.avgScore.toFixed(1)} pts prom. (${myAvgEntry.played} ${myAvgEntry.played === 1 ? 'partida' : 'partidas'})` : null}
        profile={profile}
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
