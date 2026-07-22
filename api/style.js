const MAPTILER_KEY = process.env.MAPTILER_KEY

export default async function handler(req, res) {
  let upstreamRes
  try {
    upstreamRes = await fetch(`https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
    return
  }

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).end()
    return
  }

  const style = await upstreamRes.json()

  // MapLibre resolves vector tile requests inside a worker, which can't
  // resolve relative URLs — so these must be absolute, not just "/api/...".
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const origin = `${proto}://${req.headers.host}`

  // Point each source at our own tiles.json proxy (flat, query-param based —
  // nested dynamic routes like /api/tiles/[...path] 404'd in production).
  for (const source of Object.values(style.sources || {})) {
    const match = source.url?.match(/\/tiles\/([^/]+)\/tiles\.json/)
    if (match) source.url = `${origin}/api/tiles?source=${match[1]}`
  }

  // Street/place labels stay hidden in the game map; filtering here (instead
  // of client-side) means the cached response is already label-free.
  style.layers = (style.layers || []).filter((l) => l.type !== 'symbol')

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.status(200).json(style)
}
