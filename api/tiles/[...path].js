const MAPTILER_KEY = process.env.MAPTILER_KEY
const ALLOWED_SOURCES = new Set(['v3', 'satellite-v2'])

export default async function handler(req, res) {
  const segments = req.query.path
  if (!segments || segments.length === 0 || !ALLOWED_SOURCES.has(segments[0])) {
    res.status(404).end()
    return
  }

  const upstreamPath = segments.join('/')

  let upstreamRes
  try {
    upstreamRes = await fetch(`https://api.maptiler.com/tiles/${upstreamPath}?key=${MAPTILER_KEY}`)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
    return
  }

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).end()
    return
  }

  if (upstreamPath.endsWith('tiles.json')) {
    const json = await upstreamRes.json()
    const sourceId = segments[0]
    const ext = sourceId === 'satellite-v2' ? 'jpg' : 'pbf'
    json.tiles = [`/api/tiles/${sourceId}/{z}/{x}/{y}.${ext}`]
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
    res.status(200).json(json)
    return
  }

  // Tile content (jpg/pbf) never changes for a given z/x/y, so cache it hard —
  // this is what actually keeps repeat game sessions off the MapTiler quota.
  const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream'
  const buf = Buffer.from(await upstreamRes.arrayBuffer())
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Content-Type', contentType)
  res.status(200).send(buf)
}
