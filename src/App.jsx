import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXTwitter, faInstagram } from '@fortawesome/free-brands-svg-icons'
import ResultsMap from './ResultsMap'
import MenuArchive from './MenuArchive'
import intersectionsPool from './data/intersections.json'
import barriosData from './data/barrios.json'
import './App.css'

const TOTAL_ROUNDS = 5
const SHARE_DOMAIN = 'https://ubicaba.com'
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

// <=50m: 100 pts. Beyond 50m: -1 pt every 66m.
function scoreForDistance(distanceMeters) {
  if (distanceMeters <= 50) return 100
  return Math.max(0, 100 - Math.floor((distanceMeters - 50) / 66))
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

function shuffleSample(arr, n) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

function pickRandomIndices(poolLength, n) {
  return shuffleSample(
    Array.from({ length: poolLength }, (_, i) => i),
    n,
  )
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

// A share link is only treated as a custom (barrio-filtered) game if: the share
// indices are valid, the barrios= ids all exist, AND every one of the 5 rounds'
// actual barrio_id is among those requested barrios. Otherwise it degrades to a
// normal shared/practice link (share indices still used, barrios= ignored).
function parseCustomShareBarrios(indices, pool, barrios) {
  const raw = new URLSearchParams(window.location.search).get('barrios')
  if (!raw || !indices) return null
  const barrioIds = raw.split('-').map(Number)
  const validIds = barrioIds.length > 0 && barrioIds.every((id) => barrios.some((b) => b.barrio_id === id))
  if (!validIds) return null
  const barrioIdSet = new Set(barrioIds)
  const allRoundsMatch = indices.every((i) => barrioIdSet.has(pool[i]?.barrio_id))
  return allRoundsMatch ? barrioIds : null
}

function formatStreets(street1, street2) {
  return street2 ? `${street1} y ${street2}` : street1
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

function buildShareText(shareLink, results, totalScore, modeLine, dateLine) {
  const emojiLine = results.map((r) => `${r.points}${scoreEmoji(r.points)}`).join(' ')
  const datePart = dateLine ? `\n${dateLine}` : ''
  return `${shareLink}\n${modeLine}${datePart}\n${emojiLine}\nFinal score: ${totalScore}`
}

function shareIndicesToUrl(indices, barrioIds) {
  const base = `/?share=${indices.map((i) => i + 1).join('-')}`
  return barrioIds && barrioIds.length ? `${base}&barrios=${barrioIds.join('-')}` : base
}

const SESSION_STORAGE_KEY = 'ubicaba-game-session'

function loadStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function sameIndices(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
}

// Resolves what game *should* be showing right now from the URL/daily rotation,
// then checks sessionStorage: if it matches that same game, resume its progress
// (round index, phase, results) instead of restarting from scratch — so a page
// refresh keeps you on the results screen if you'd already finished.
function getInitialGame() {
  const fromShare = parseShareIndices(intersectionsPool.length)
  let fresh
  if (fromShare) {
    const barrioIds = parseCustomShareBarrios(fromShare, intersectionsPool, barriosData)
    fresh = barrioIds
      ? { roundIndices: fromShare, gameMode: 'custom', customBarrioIds: barrioIds }
      : { roundIndices: fromShare, gameMode: 'linked', customBarrioIds: [] }
  } else {
    fresh = {
      roundIndices: indicesForDay(dayNumberForDate(new Date()), intersectionsPool.length),
      gameMode: 'daily',
      customBarrioIds: [],
    }
  }

  const stored = loadStoredSession()
  if (stored && stored.gameMode === fresh.gameMode && sameIndices(stored.roundIndices, fresh.roundIndices)) {
    return {
      roundIndices: stored.roundIndices,
      gameMode: stored.gameMode,
      customBarrioIds: stored.customBarrioIds || [],
      roundIndex: stored.roundIndex ?? 0,
      phase: stored.phase ?? 'guessing',
      results: stored.results ?? [],
    }
  }

  return { ...fresh, roundIndex: 0, phase: 'guessing', results: [] }
}

function App() {
  const [roundIndices, setRoundIndices] = useState(() => getInitialGame().roundIndices)
  const [gameMode, setGameMode] = useState(() => getInitialGame().gameMode)
  const [customBarrioIds, setCustomBarrioIds] = useState(() => getInitialGame().customBarrioIds)
  const [roundIndex, setRoundIndex] = useState(() => getInitialGame().roundIndex)
  const [phase, setPhase] = useState(() => getInitialGame().phase) // 'guessing' | 'revealed' | 'gameOver'
  const [results, setResults] = useState(() => getInitialGame().results) // {street1, street2, guess, actual, distance, points}
  const [shareCopied, setShareCopied] = useState(false)
  const [menuCopied, setMenuCopied] = useState(false)
  const [socialsOpen, setSocialsOpen] = useState(false)

  const customBarrioNames = useMemo(
    () => barriosData.filter((b) => customBarrioIds.includes(b.barrio_id)).map((b) => b.nombre),
    [customBarrioIds],
  )

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ roundIndices, gameMode, customBarrioIds, roundIndex, phase, results }),
      )
    } catch {
      // sessionStorage unavailable (private browsing, etc.); ignore
    }
  }, [roundIndices, gameMode, customBarrioIds, roundIndex, phase, results])

  const rounds = useMemo(() => roundIndices.map((i) => intersectionsPool[i]), [roundIndices])
  const shareLink = useMemo(
    () => `${SHARE_DOMAIN}${shareIndicesToUrl(roundIndices, gameMode === 'custom' ? customBarrioIds : undefined)}`,
    [roundIndices, gameMode, customBarrioIds],
  )
  const resultShareLink = gameMode === 'daily' ? SHARE_DOMAIN : shareLink

  const barrioCounts = useMemo(() => {
    const counts = new Map()
    for (const it of intersectionsPool) {
      counts.set(it.barrio_id, (counts.get(it.barrio_id) || 0) + 1)
    }
    return counts
  }, [])

  const current = rounds[roundIndex]
  const totalScore = useMemo(() => results.reduce((s, r) => s + r.points, 0), [results])

  const currentBarrio = useMemo(
    () => barriosData.find((b) => b.barrio_id === current?.barrio_id),
    [current],
  )
  const isSpecial = currentBarrio?.comuna === 0

  const [specialImageOpen, setSpecialImageOpen] = useState(false)

  useEffect(() => {
    if (isSpecial && current?.image_url) {
      setSpecialImageOpen(true)
      const timer = setTimeout(() => setSpecialImageOpen(false), 4000)
      return () => clearTimeout(timer)
    }
    setSpecialImageOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

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

  const startGame = (indices, mode, { copyInvite, barrioIds = [] } = {}) => {
    setRoundIndices(indices)
    setGameMode(mode)
    setCustomBarrioIds(barrioIds)
    setRoundIndex(0)
    setResults([])
    setShareCopied(false)
    setPhase('guessing')
    const urlBarrioIds = mode === 'custom' ? barrioIds : undefined
    window.history.replaceState(null, '', mode === 'daily' ? '/' : shareIndicesToUrl(indices, urlBarrioIds))

    if (copyInvite) {
      const text = `Unite a mi partida en el link ${SHARE_DOMAIN}${shareIndicesToUrl(indices, urlBarrioIds)}`
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
    let modeLine
    let dateLine = null
    if (gameMode === 'daily') {
      modeLine = 'Partida del día'
      dateLine = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    } else if (gameMode === 'custom') {
      modeLine = `Partida personalizada - solo barrios de ${customBarrioNames.join(', ')}`
    } else {
      modeLine = 'Modo práctica'
    }
    const text = buildShareText(resultShareLink, results, totalScore, modeLine, dateLine)
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

  const handleStartCustom = (selectedBarrioIds) => {
    const selectedSet = new Set(selectedBarrioIds)
    const candidateIndices = []
    intersectionsPool.forEach((it, i) => {
      if (selectedSet.has(it.barrio_id)) candidateIndices.push(i)
    })
    startGame(shuffleSample(candidateIndices, TOTAL_ROUNDS), 'custom', { barrioIds: selectedBarrioIds })
  }

  const menu = (
    <>
      <MenuArchive
        dayNumberForDate={dayNumberForDate}
        todayDayNumber={dayNumberForDate(new Date())}
        onDaily={handleDaily}
        onPractice={handlePractice}
        onSelectDay={handleSelectArchiveDay}
        barrios={barriosData}
        barrioCounts={barrioCounts}
        onStartCustom={handleStartCustom}
      />
      {menuCopied && <span className="menu-copied">¡Link copiado!</span>}
    </>
  )

  const credits = (
    <div className="credits-bar">
      Hecho por{' '}
      <button type="button" className="credits-link" onClick={() => setSocialsOpen(true)}>
        @poniemangon
      </button>{' '}
      - mandame un mensaje si querés que te haga una página o tenés sugerencias
      {socialsOpen && (
        <div className="modal-backdrop" onClick={() => setSocialsOpen(false)}>
          <div className="socials-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <span>Mis redes</span>
              <button type="button" className="calendar-close" onClick={() => setSocialsOpen(false)}>
                ✕
              </button>
            </div>
            <a
              className="social-option"
              href="https://x.com/poniemangon"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSocialsOpen(false)}
            >
              <FontAwesomeIcon icon={faXTwitter} /> Twitter
            </a>
            <a
              className="social-option"
              href="https://www.instagram.com/poniemangon"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSocialsOpen(false)}
            >
              <FontAwesomeIcon icon={faInstagram} /> Instagram
            </a>
          </div>
        </div>
      )}
    </div>
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
                  R{i + 1}: {formatStreets(r.street1, r.street2)}
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
        {credits}
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
        {isSpecial && <div className="eyebrow">Ubicación especial</div>}
        <div className="prompt">
          Encontrá: <strong className={isSpecial ? 'special' : ''}>{current.street1}</strong>
          {current.street2 && (
            <>
              {' '}
              y <strong className={isSpecial ? 'special' : ''}>{current.street2}</strong>
            </>
          )}
          {isSpecial && current.image_url && !specialImageOpen && (
            <button type="button" className="special-image-reopen" onClick={() => setSpecialImageOpen(true)}>
              👁 Ver imagen
            </button>
          )}
        </div>
      </header>

      {isSpecial && current.image_url && specialImageOpen && (
        <div className="modal-backdrop" onClick={() => setSpecialImageOpen(false)}>
          <div className="special-image-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="calendar-close" onClick={() => setSpecialImageOpen(false)}>
              ✕
            </button>
            <img src={current.image_url} alt={current.street1} />
          </div>
        </div>
      )}

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
      {credits}
    </div>
  )
}

export default App
