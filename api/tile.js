const MAPTILER_KEY = process.env.MAPTILER_KEY
const EXT_BY_SOURCE = { v3: 'pbf', 'satellite-v2': 'jpg' }

export default async function handler(req, res) {
  const { source, z, x, y } = req.query
  const ext = EXT_BY_SOURCE[source]
  if (!ext || !z || !x || !y) {
    res.status(404).end()
    return
  }

  let upstreamRes
  try {
    upstreamRes = await fetch(`https://api.maptiler.com/tiles/${source}/${z}/${x}/${y}.${ext}?key=${MAPTILER_KEY}`)
  } catch {
    res.status(502).json({ error: 'upstream fetch failed' })
    return
  }

  if (!upstreamRes.ok) {
    res.status(upstreamRes.status).end()
    return
  }

  // Tile content never changes for a given z/x/y, so cache it hard — this is
  // what actually keeps repeat game sessions off the MapTiler quota.
  const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream'
  const buf = Buffer.from(await upstreamRes.arrayBuffer())
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader('Content-Type', contentType)
  res.status(200).send(buf)
}
