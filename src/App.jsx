import { useCallback, useEffect, useMemo, useState } from 'react'
import ResultsMap from './ResultsMap'
import MenuArchive from './MenuArchive'
import intersectionsPool from './data/intersections.json'
import './App.css'

const TOTAL_ROUNDS = 5
const SHARE_DOMAIN = 'https://cabatap.vercel.app'
const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function haversineMeters(a, b) {
  const R = 6371000
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// 100 - (distance - 60) / 30, clamped to [0, 100].
function scoreForDistance(distanceMeters) {
  const score = 100 - Math.floor((distanceMeters - 60) / 30)
  return Math.min(100, Math.max(0, score))
}

function dayNumberForDate(date) {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor((utcMidnight - EPOCH_UTC) / DAY_MS)
}

// The pool is a fixed, pre-shuffled order (baked in at data-generation time), so
// slicing consecutive windows of TOTAL_ROUNDS gives a stable daily rotation with
// zero repeats until the whole pool has been used once.
function indicesForDay(dayNumber, poolLength) {
  const cycleLength = Math.floor(poolLength / TOTAL_ROUNDS)
  const cyclePos = ((dayNumber % cycleLength) + cycleLength) % cycleLength
  const start = cyclePos * TOTAL_ROUNDS
  return Array.from({ length: TOTAL_ROUNDS }, (_, i) => start + i)
}

function pickRandomIndices(poolLength, n) {
  const indices = Array.from({ length: poolLength }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, n)
}

function parseShareIndices(poolLength) {
  const raw = new URLSearchParams(window.location.search).get('share')
  if (!raw) return null
  const parts = raw.split('-')
  if (parts.length !== TOTAL_ROUNDS) return null
  const indices = parts.map((p) => Number(p) - 1)
  const valid = indices.every((i) => Number.isInteger(i) && i >= 0 && i < poolLength)
  return valid ? indices : null
}

function scoreEmoji(points) {
  if (points === 100) return '🎯'
  if (points >= 90) return '🔥'
  if (points >= 80) return '🏆'
  if (points >= 60) return '👍'
  if (points >= 40) return '🤙'
  if (points >= 20) return '😛'
  return '😂'
}

function buildShareText(shareLink, results, totalScore) {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const emojiLine = results.map((r) => `${r.points}${scoreEmoji(r.points)}`).join(' ')
  return `${shareLink}\n${dateStr}\n${emojiLine}\nFinal score: ${totalScore}`
}

function shareIndicesToUrl(indices) {
  return `/?share=${indices.map((i) => i + 1).join('-')}`
}

function App() {
  const [roundIndices, setRoundIndices] = useState(() => {
    const fromShare = parseShareIndices(intersectionsPool.length)
    if (fromShare) return fromShare
    return indicesForDay(dayNumberForDate(new Date()), intersectionsPool.length)
  })
  const [gameMode, setGameMode] = useState(() => (parseShareIndices(intersectionsPool.length) ? 'linked' : 'daily'))
  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState('guessing') // 'guessing' | 'revealed' | 'gameOver'
  const [results, setResults] = useState([]) // {street1, street2, guess, actual, distance, points}
  const [shareCopied, setShareCopied] = useState(false)
  const [menuCopied, setMenuCopied] = useState(false)

  const rounds = useMemo(() => roundIndices.map((i) => intersectionsPool[i]), [roundIndices])
  const shareLink = useMemo(() => `${SHARE_DOMAIN}${shareIndicesToUrl(roundIndices)}`, [roundIndices])
  const resultShareLink = gameMode === 'daily' ? SHARE_DOMAIN : shareLink

  const current = rounds[roundIndex]
  const totalScore = useMemo(() => results.reduce((s, r) => s + r.points, 0), [results])

  const handlePick = useCallback(
    (pos) => {
      if (phase !== 'guessing') return
      const actual = [current.lat, current.lng]
      const distance = haversineMeters(pos, actual)
      const points = scoreForDistance(distance)
      setResults((prev) => [
        ...prev,
        { street1: current.street1, street2: current.street2, guess: pos, actual, distance, points },
      ])
      setPhase('revealed')
    },
    [phase, current],
  )

  useEffect(() => {
    if (phase !== 'revealed') return
    const timer = setTimeout(() => {
      setRoundIndex((i) => {
        if (i + 1 >= TOTAL_ROUNDS) {
          setPhase('gameOver')
          return i
        }
        setPhase('guessing')
        return i + 1
      })
    }, 5000)
    return () => clearTimeout(timer)
  }, [phase])

  const startGame = (indices, mode, { copyInvite } = {}) => {
    setRoundIndices(indices)
    setGameMode(mode)
    setRoundIndex(0)
    setResults([])
    setShareCopied(false)
    setPhase('guessing')
    window.history.replaceState(null, '', mode === 'daily' ? '/' : shareIndicesToUrl(indices))

    if (copyInvite) {
      const text = `Unite a mi partida en el link ${SHARE_DOMAIN}${shareIndicesToUrl(indices)}`
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setMenuCopied(true)
          setTimeout(() => setMenuCopied(false), 2000)
        })
        .catch(() => {})
    }
  }

  const handleRestart = () => {
    startGame(pickRandomIndices(intersectionsPool.length, TOTAL_ROUNDS), 'linked')
  }

  const handleShare = async () => {
    const text = buildShareText(resultShareLink, results, totalScore)
    try {
      await navigator.clipboard.writeText(text)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // clipboard not available; ignore
    }
  }

  const handlePractice = () => {
    startGame(pickRandomIndices(intersectionsPool.length, TOTAL_ROUNDS), 'linked')
  }

  const handleSelectArchiveDay = (dayNumber) => {
    startGame(indicesForDay(dayNumber, intersectionsPool.length), 'linked', { copyInvite: true })
  }

  const handleDaily = () => {
    startGame(indicesForDay(dayNumberForDate(new Date()), intersectionsPool.length), 'daily')
  }

  const menu = (
    <>
      <MenuArchive
        dayNumberForDate={dayNumberForDate}
        todayDayNumber={dayNumberForDate(new Date())}
        onDaily={handleDaily}
        onPractice={handlePractice}
        onSelectDay={handleSelectArchiveDay}
      />
      {menuCopied && <span className="menu-copied">¡Link copiado!</span>}
    </>
  )

  if (phase === 'gameOver') {
    return (
      <div className="app">
        <header className="hud">
          <div className="hud-row">
            <span className="round-label">¡Juego terminado!</span>
            {menu}
            <span className="score-label">Puntaje final: {totalScore} / {TOTAL_ROUNDS * 100}</span>
          </div>
        </header>

        <div className="map-wrap">
          <ResultsMap results={results} clickEnabled={false} onPick={() => {}} />
        </div>

        <footer className="controls controls-gameover">
          <ul className="breakdown">
            {results.map((r, i) => (
              <li key={i}>
                <span className="breakdown-streets">
                  R{i + 1}: {r.street1} y {r.street2}
                </span>
                <span className="breakdown-detail">
                  {Math.round(r.distance)} m — {r.points} pts
                </span>
              </li>
            ))}
          </ul>
          <div className="gameover-actions">
            <button className="primary-btn secondary-btn" onClick={handleShare}>
              {shareCopied ? '¡Copiado!' : 'Compartir resultado'}
            </button>
            <button className="primary-btn" onClick={handleRestart}>
              Jugar de nuevo
            </button>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="hud">
        <div className="hud-row">
          <span className="round-label">Ronda {roundIndex + 1} / {TOTAL_ROUNDS}</span>
          {menu}
          <span className="score-label">Puntaje: {totalScore}</span>
        </div>
        <div className="prompt">
          Encontrá: <strong>{current.street1}</strong> y <strong>{current.street2}</strong>
        </div>
      </header>

      <div className="map-wrap">
        <ResultsMap results={results} clickEnabled={phase === 'guessing'} onPick={handlePick} />
      </div>

      <footer className="controls">
        {phase === 'guessing' && (
          <span className="hint">Tocá el mapa para marcar dónde creés que está la esquina</span>
        )}
        {phase === 'revealed' && (
          <span className="result">
            Te equivocaste por {Math.round(results[roundIndex].distance)} m — {results[roundIndex].points} pts
          </span>
        )}
      </footer>
    </div>
  )
}

export default App
