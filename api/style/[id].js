const MAPTILER_KEY = process.env.MAPTILER_KEY
const ALLOWED_STYLES = new Set(['hybrid'])

export default async function handler(req, res) {
  const { id } = req.query

  if (!ALLOWED_STYLES.has(id)) {
    res.status(404).end()
    return
  }

  let upstreamRes
  try {
    upstreamRes = await fetch(`https://api.maptiler.com/maps/${id}/style.json?key=${MAPTILER_KEY}`)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
    return
  }

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).end()
    return
  }

  const style = await upstreamRes.json()

  // Point each source at our own tile proxy instead of MapTiler directly, so
  // the actual tile requests (the ones that count against the API quota) get
  // cached at the edge instead of hitting MapTiler on every game load.
  for (const source of Object.values(style.sources || {})) {
    const match = source.url?.match(/\/tiles\/([^/]+)\/tiles\.json/)
    if (match) source.url = `/api/tiles/${match[1]}/tiles.json`
  }

  // Street/place labels stay hidden in the game map; filtering here (instead
  // of client-side) means the cached response is already label-free.
  style.layers = (style.layers || []).filter((l) => l.type !== 'symbol')

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.status(200).json(style)
}
