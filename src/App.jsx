import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXTwitter, faInstagram } from '@fortawesome/free-brands-svg-icons'
import ResultsMap from './ResultsMap'
import MenuArchive from './MenuArchive'
import { fetchAllRows } from './supabaseClient'
import './App.css'

const TOTAL_ROUNDS = 5
const SHARE_DOMAIN = 'https://ubicaba.com'
const DAY_MS = 24 * 60 * 60 * 1000
const EPOCH_UTC = Date.UTC(2024, 0, 1)

// The daily/archive rotation is pinned to this fixed count, NOT the live pool
// size. The pool now grows over time (special locations added via the admin
// panel), and if the cycle length tracked that live count, every new row would
// reshuffle which corners map to which past/future day. Anything at index
// DAILY_CYCLE_POOL_SIZE or beyond simply never participates in the daily
// cycle — it's still fully reachable via practice mode, custom-barrio games,
// and direct share links, exactly like the original static-JSON behavior.
const DAILY_CYCLE_POOL_SIZE = 4000

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

// The first DAILY_CYCLE_POOL_SIZE rows are a fixed, pre-shuffled order (baked
// in when the dataset was generated), so slicing consecutive windows of
// TOTAL_ROUNDS gives a stable daily rotation with zero repeats until that
// portion of the pool has been used once.
function indicesForDay(dayNumber) {
  const cycleLength = Math.floor(DAILY_CYCLE_POOL_SIZE / TOTAL_ROUNDS)
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

// Picks n rounds from the given candidate indices. If there are fewer than n
// candidates (e.g. a barrio with only 1-4 locations so far), it fills the
// remaining rounds by repeating random picks from that same small pool rather
// than refusing to start.
function sampleRoundIndices(candidates, n) {
  if (candidates.length === 0) return []
  if (candidates.length >= n) return shuffleSample(candidates, n)
  const result = shuffleSample(candidates, candidates.length)
  while (result.length < n) {
    result.push(candidates[Math.floor(Math.random() * candidates.length)])
  }
  return result
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

function isAllSpecialSelection(barrioIds, barrios) {
  if (!barrioIds || barrioIds.length === 0 || !barrios) return false
  return barrioIds.every((id) => barrios.find((b) => b.barrio_id === id)?.comuna === 0)
}

function App() {
  const [pool, setPool] = useState(null)
  const [barrios, setBarrios] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  const [roundIndices, setRoundIndices] = useState([])
  const [gameMode, setGameMode] = useState('daily')
  const [customBarrioIds, setCustomBarrioIds] = useState([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [phase, setPhase] = useState('guessing') // 'guessing' | 'revealed' | 'gameOver'
  const [results, setResults] = useState([]) // {street1, street2, guess, actual, distance, points}
  const [shareCopied, setShareCopied] = useState(false)
  const [menuCopied, setMenuCopied] = useState(false)
  const [specialSuggestOpen, setSpecialSuggestOpen] = useState(false)
  const [socialsOpen, setSocialsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [poolRows, barrioRows] = await Promise.all([
          fetchAllRows('intersections', 'street1, street2, lat, lng, barrio_id, image_url', 'pool_index'),
          fetchAllRows('barrios', '*', 'barrio_id'),
        ])
        if (cancelled) return
        setPool(poolRows)
        setBarrios(barrioRows)
      } catch (e) {
        if (!cancelled) setLoadError(e.message)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pool || !barrios || initialized) return

    const fromShare = parseShareIndices(pool.length)
    let fresh
    if (fromShare) {
      const barrioIds = parseCustomShareBarrios(fromShare, pool, barrios)
      fresh = barrioIds
        ? { roundIndices: fromShare, gameMode: 'custom', customBarrioIds: barrioIds }
        : { roundIndices: fromShare, gameMode: 'linked', customBarrioIds: [] }
    } else {
      fresh = {
        roundIndices: indicesForDay(dayNumberForDate(new Date())),
        gameMode: 'daily',
        customBarrioIds: [],
      }
    }

    const stored = loadStoredSession()
    const isResume = stored && stored.gameMode === fresh.gameMode && sameIndices(stored.roundIndices, fresh.roundIndices)
    const initial = isResume
      ? {
          roundIndices: stored.roundIndices,
          gameMode: stored.gameMode,
          customBarrioIds: stored.customBarrioIds || [],
          roundIndex: stored.roundIndex ?? 0,
          phase: stored.phase ?? 'guessing',
          results: stored.results ?? [],
        }
      : { ...fresh, roundIndex: 0, phase: 'guessing', results: [] }

    setRoundIndices(initial.roundIndices)
    setGameMode(initial.gameMode)
    setCustomBarrioIds(initial.customBarrioIds)
    setRoundIndex(initial.roundIndex)
    setPhase(initial.phase)
    setResults(initial.results)
    if (!isResume && initial.gameMode === 'custom' && isAllSpecialSelection(initial.customBarrioIds, barrios)) {
      setSpecialSuggestOpen(true)
    }
    setInitialized(true)
  }, [pool, barrios, initialized])

  const isReady = !!pool && !!barrios && initialized

  const customBarrioNames = useMemo(
    () => (barrios ? barrios.filter((b) => customBarrioIds.includes(b.barrio_id)).map((b) => b.nombre) : []),
    [barrios, customBarrioIds],
  )

  useEffect(() => {
    if (!isReady) return
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ roundIndices, gameMode, customBarrioIds, roundIndex, phase, results }),
      )
    } catch {
      // sessionStorage unavailable (private browsing, etc.); ignore
    }
  }, [isReady, roundIndices, gameMode, customBarrioIds, roundIndex, phase, results])

  const rounds = useMemo(() => (pool ? roundIndices.map((i) => pool[i]) : []), [pool, roundIndices])
  const shareLink = useMemo(
    () => `${SHARE_DOMAIN}${shareIndicesToUrl(roundIndices, gameMode === 'custom' ? customBarrioIds : undefined)}`,
    [roundIndices, gameMode, customBarrioIds],
  )
  const resultShareLink = gameMode === 'daily' ? SHARE_DOMAIN : shareLink

  const barrioCounts = useMemo(() => {
    const counts = new Map()
    if (!pool) return counts
    for (const it of pool) {
      counts.set(it.barrio_id, (counts.get(it.barrio_id) || 0) + 1)
    }
    return counts
  }, [pool])

  const current = rounds[roundIndex]
  const totalScore = useMemo(() => results.reduce((s, r) => s + r.points, 0), [results])

  const currentBarrio = useMemo(
    () => barrios?.find((b) => b.barrio_id === current?.barrio_id),
    [barrios, current],
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
    setSpecialSuggestOpen(mode === 'custom' && isAllSpecialSelection(barrioIds, barrios))
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
    startGame(pickRandomIndices(pool.length, TOTAL_ROUNDS), 'linked')
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
    startGame(pickRandomIndices(pool.length, TOTAL_ROUNDS), 'linked')
  }

  const handleSelectArchiveDay = (dayNumber) => {
    startGame(indicesForDay(dayNumber), 'linked', { copyInvite: true })
  }

  const handleDaily = () => {
    startGame(indicesForDay(dayNumberForDate(new Date())), 'daily')
  }

  const handleStartCustom = (selectedBarrioIds) => {
    const selectedSet = new Set(selectedBarrioIds)
    const candidateIndices = []
    pool.forEach((it, i) => {
      if (selectedSet.has(it.barrio_id)) candidateIndices.push(i)
    })
    startGame(sampleRoundIndices(candidateIndices, TOTAL_ROUNDS), 'custom', { barrioIds: selectedBarrioIds })
  }

  const handleSpecialOnly = () => {
    const specialBarrioIds = barrios.filter((b) => b.comuna === 0).map((b) => b.barrio_id)
    handleStartCustom(specialBarrioIds)
  }

  if (loadError) {
    return (
      <div className="app">
        <div className="loading-screen">No se pudo cargar el juego: {loadError}</div>
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="app">
        <div className="loading-screen">Cargando...</div>
      </div>
    )
  }

  const menu = (
    <>
      <MenuArchive
        dayNumberForDate={dayNumberForDate}
        todayDayNumber={dayNumberForDate(new Date())}
        onDaily={handleDaily}
        onPractice={handlePractice}
        onSelectDay={handleSelectArchiveDay}
        barrios={barrios}
        barrioCounts={barrioCounts}
        onStartCustom={handleStartCustom}
        onSpecialOnly={handleSpecialOnly}
      />
      {menuCopied && <span className="menu-copied">¡Link copiado!</span>}
    </>
  )

  const specialSuggestPopup = specialSuggestOpen && (
    <div className="modal-backdrop" onClick={() => setSpecialSuggestOpen(false)}>
      <div className="socials-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <span>Atención</span>
          <button type="button" className="calendar-close" onClick={() => setSpecialSuggestOpen(false)}>
            ✕
          </button>
        </div>
        <p className="special-suggest-text">
          Actualmente en desarrollo, mandame sugerencias de lugares{' '}
          <a
            href="https://x.com/poniemangon/status/2079606489325482234?s=20"
            target="_blank"
            rel="noopener noreferrer"
          >
            a este tuit
          </a>
        </p>
      </div>
    </div>
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

      {specialSuggestPopup}

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
