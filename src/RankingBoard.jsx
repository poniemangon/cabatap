import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CalendarPicker from './CalendarPicker'
import BadgeIcon from './badges/BadgeIcon'
import { getBadgesForProfiles } from './badges/badgesApi'
import DailyWinBadge from './daily/DailyWinBadge'
import { getDailyWinCountsForProfiles } from './daily/dailyWinsApi'
import EloBadge, { eloTier } from './EloBadge'
import EloInfoIcon from './EloInfoIcon'
import useProfile from './hooks/useProfile'
import { getDailyAverageLeaderboard, getDailyLeaderboard } from './daily/dailyApi'
import { getEloLeaderboard } from './duels/duelApi'
import './RankingBoard.css'

const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)
function dayNumberForDate(date) {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((utcMidnight - EPOCH_UTC) / DAY_MS)
}
function formatDailyDate(dayNumber) {
  return new Date(EPOCH_UTC + dayNumber * DAY_MS).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}

const MAX_SIZE = 100

function RankRow({ rank, avatarUrl, username, elo, badge, dailyWinCount, detail, to }) {
  const [imgFailed, setImgFailed] = useState(false)
  return (
    <li>
      <Link to={to} className="ranking-row">
        <span className="ranking-row-rank">#{rank}</span>
        {avatarUrl && !imgFailed ? (
          <img src={avatarUrl} alt="" className="ranking-row-avatar" onError={() => setImgFailed(true)} />
        ) : (
          <span className="ranking-row-avatar ranking-row-avatar-fallback">🙂</span>
        )}
        <span className="ranking-row-name">
          <span className="ranking-row-username">{username || 'Jugador'}</span>
          <BadgeIcon badge={badge} />
          <DailyWinBadge count={dailyWinCount} />
          <EloBadge elo={elo} />
        </span>
        <span className="ranking-row-detail">{detail}</span>
      </Link>
    </li>
  )
}

function RankSummaryItem({ label, rank, detail, emptyText }) {
  return (
    <div className="ranking-your-summary-item">
      <span className="ranking-your-summary-label">{label}</span>
      <span className={`ranking-your-summary-value${rank ? '' : ' ranking-your-summary-empty'}`}>
        {rank ? `#${rank} · ${detail}` : emptyText}
      </span>
    </div>
  )
}

function YourRankSummary({ profile, children }) {
  if (!profile) return null
  return <div className="ranking-your-summary">{children}</div>
}

function LeaderboardSection({ title, extra, items, emptyText, renderDetail, to, badges, dailyWinCounts }) {
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
                elo={item.elo}
                badge={badges?.get(item.profileId)}
                dailyWinCount={dailyWinCounts?.get(item.profileId)}
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
  const [eloRows, setEloRows] = useState([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [badges, setBadges] = useState(new Map())
  const [dailyWinCounts, setDailyWinCounts] = useState(new Map())

  useEffect(() => {
    getDailyAverageLeaderboard().then(setAverages).catch(console.error)
  }, [])

  useEffect(() => {
    getDailyLeaderboard(dayNumber).then(setDayResults).catch(console.error)
  }, [dayNumber])

  useEffect(() => {
    getEloLeaderboard().then(setEloRows).catch(console.error)
  }, [])

  useEffect(() => {
    const ids = [
      ...dayResults.map((r) => r.profile_id),
      ...averages.map((a) => a.profileId),
      ...eloRows.map((r) => r.id),
    ]
    if (ids.length === 0) return
    getBadgesForProfiles(ids).then(setBadges).catch(console.error)
    getDailyWinCountsForProfiles(ids).then(setDailyWinCounts).catch(console.error)
  }, [dayResults, averages, eloRows])

  const myAvgRank = profile ? averages.findIndex((a) => a.profileId === profile.id) + 1 : 0
  const myAvgEntry = myAvgRank ? averages[myAvgRank - 1] : null
  const myDayRank = profile ? dayResults.findIndex((r) => r.profile_id === profile.id) + 1 : 0
  const myDayEntry = myDayRank ? dayResults[myDayRank - 1] : null
  const myEloRank = profile ? eloRows.findIndex((r) => r.id === profile.id) + 1 : 0
  const myEloEntry = myEloRank ? eloRows[myEloRank - 1] : null

  return (
    <div className="ranking-page-cards">
      <div className="ranking-board">
        <h2 className="ranking-board-title">🏆 Ranking mapa del día</h2>
        <p className="ranking-subtitle">Solo cuentan las partidas de Mapa del día en modo competitivo.</p>

        <YourRankSummary profile={profile}>
          <RankSummaryItem
            label="Tu ranking de hoy"
            rank={myDayRank}
            detail={myDayEntry ? `${myDayEntry.total_score} pts` : null}
            emptyText="Todavía no jugaste hoy"
          />
          <RankSummaryItem
            label="Tu ranking histórico"
            rank={myAvgRank}
            detail={
              myAvgEntry
                ? `${Math.round(myAvgEntry.avgScore)} pts prom. (${myAvgEntry.played} ${myAvgEntry.played === 1 ? 'partida' : 'partidas'})`
                : null
            }
            emptyText="Todavía no jugaste"
          />
        </YourRankSummary>

        <LeaderboardSection
          title={dayNumber === todayDayNumber ? 'Top mapa del día de hoy' : formatDailyDate(dayNumber)}
          extra={
            <button type="button" className="primary-btn secondary-btn ranking-day-label" onClick={() => setCalendarOpen(true)}>
              Ver otro día
            </button>
          }
          items={dayResults.map((r) => ({
            key: r.id,
            profileId: r.profile_id,
            avatarUrl: r.profile?.avatar_url,
            username: r.profile?.username,
            elo: r.profile?.ranked_games_played > 0 ? r.profile?.elo : null,
            ...r,
          }))}
          emptyText="Nadie jugó en modo competitivo ese día."
          renderDetail={(r) => `${r.total_score} pts`}
          to={(r) => `/mapa-diario/${r.id}`}
          badges={badges}
          dailyWinCounts={dailyWinCounts}
        />

        <LeaderboardSection
          title="Top mapa del día promedio histórico"
          items={averages.map((a) => ({
            key: a.profileId,
            profileId: a.profileId,
            avatarUrl: a.profile?.avatar_url,
            username: a.profile?.username,
            elo: a.profile?.ranked_games_played > 0 ? a.profile?.elo : null,
            ...a,
          }))}
          emptyText="Todavía nadie jugó en modo competitivo."
          renderDetail={(a) => `${Math.round(a.avgScore)} pts prom. (${a.played} ${a.played === 1 ? 'partida' : 'partidas'})`}
          to={(a) => `/jugador/${a.profile?.username}`}
          badges={badges}
          dailyWinCounts={dailyWinCounts}
        />
      </div>

      <div className="ranking-board">
        <h2 className="ranking-board-title">
          🏅 Ranking de jugadores por ELO <EloInfoIcon />
        </h2>
        <p className="ranking-subtitle">Solo cuenta el resultado de Duelo rankeado.</p>

        <YourRankSummary profile={profile}>
          <RankSummaryItem
            label="Tu ranking ELO"
            rank={myEloRank}
            detail={myEloEntry ? `${myEloEntry.elo} (${eloTier(myEloEntry.elo).name})` : null}
            emptyText="Sin ranking todavía"
          />
        </YourRankSummary>

        <LeaderboardSection
          title="Top ranking ELO"
          items={eloRows.map((r) => ({ key: r.id, profileId: r.id, avatarUrl: r.avatar_url, username: r.username, elo: r.elo }))}
          emptyText="Todavía nadie jugó un duelo rankeado."
          renderDetail={(r) => eloTier(r.elo).name}
          to={(r) => `/jugador/${r.username}`}
          badges={badges}
          dailyWinCounts={dailyWinCounts}
        />
      </div>

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
