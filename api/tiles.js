const MAPTILER_KEY = process.env.MAPTILER_KEY
const ALLOWED_SOURCES = new Set(['v3', 'satellite-v2'])

export default async function handler(req, res) {
  const { source } = req.query
  if (!ALLOWED_SOURCES.has(source)) {
    res.status(404).end()
    return
  }

  let upstreamRes
  try {
    upstreamRes = await fetch(`https://api.maptiler.com/tiles/${source}/tiles.json?key=${MAPTILER_KEY}`)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
    return
  }

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).end()
    return
  }

  const json = await upstreamRes.json()
  // Flat query-param template — MapLibre does plain string substitution of
  // {z}/{x}/{y}, so it works the same whether they sit in the path or query.
  json.tiles = [`/api/tile?source=${source}&z={z}&x={x}&y={y}`]

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
  res.status(200).json(json)
}
