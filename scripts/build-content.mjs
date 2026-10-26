// Generates the static, crawlable content pages of ubicaba.com from content/:
//
//   content/paginas/*.html  → /<slug>            (cómo se juega, FAQ, términos…)
//   content/guias/*.md      → /guias/<slug>      (+ hub at /guias)
//   content/barrios/*.md    → /barrios/<slug>    (+ hub at /barrios)
//   + public/sitemap.xml
//
// Output goes to public/ (gitignored) so Vite copies it into dist as-is —
// these pages are plain HTML, readable by Google without running the SPA.
// Runs before `vite` and `vite build` (predev/prebuild). Any broken internal
// link, missing barrio guide or malformed front matter fails the build, so a
// bad page can't be deployed.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'content')
const PUBLIC = join(ROOT, 'public')
const SITE = 'https://ubicaba.com'
const AD_CLIENT = 'ca-pub-9821179304696982'
const AD_SLOT = '7030234704'
const MIN_WORDS = 250

// Routes served by the SPA (index.html) that content pages may link to.
const SPA_ROUTES = new Set(['/', '/ranking'])

const errors = []
const warnings = []

// ---------- helpers ----------

function parseFrontMatter(raw, file) {
  const m = raw.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!m) {
    errors.push(`${file}: falta el bloque --- de front matter`)
    return { data: {}, body: raw }
  }
  const data = {}
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue
    const idx = line.indexOf(':')
    if (idx === -1) {
      errors.push(`${file}: línea de front matter inválida: "${line}"`)
      continue
    }
    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (/^-?\d+$/.test(value)) value = Number(value)
    data[key] = value
  }
  return { data, body: m[2] }
}

function readDir(dir, ext) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith(ext) && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const file = join(dir, f)
      const { data, body } = parseFrontMatter(readFileSync(file, 'utf8'), `content/${dir.split(/[\\/]/).pop()}/${f}`)
      return { slug: f.slice(0, -ext.length), file: f, data, body }
    })
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function wordCount(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

function requireFields(page, kind, fields) {
  for (const f of fields) {
    if (page.data[f] === undefined || page.data[f] === '') errors.push(`content/${kind}/${page.file}: falta "${f}"`)
  }
}

function loadEnv() {
  const env = { ...process.env }
  const file = join(ROOT, '.env')
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

// ---------- game data ----------

// The live pool lives in Supabase; src/data/*.json is the seed it started
// from. Prefer live data so the "En UbiCABA" numbers match the game, but
// never fail the build over it.
async function fetchAll(env, table, select, order) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${table}?select=${select}&order=${order}`, {
      headers: {
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        Range: `${from}-${from + 999}`,
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

async function loadGameData() {
  const env = loadEnv()
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    try {
      const [barrios, intersections] = await Promise.all([
        fetchAll(env, 'barrios', 'barrio_id,nombre,comuna', 'barrio_id'),
        fetchAll(env, 'intersections', 'street1,street2,lat,lng,barrio_id', 'pool_index'),
      ])
      if (barrios.length && intersections.length) {
        let rounds = null
        try {
          const [daily, duels] = await Promise.all([
            fetchAll(env, 'daily_stats', 'results', 'id'),
            fetchAll(env, 'duel_results', 'results', 'id'),
          ])
          rounds = [...daily, ...duels].flatMap((r) => (Array.isArray(r.results) ? r.results : []))
        } catch (e) {
          warnings.push(`No se pudieron leer las partidas (${e.message}); las páginas salen sin estadísticas de precisión`)
        }
        return { barrios, intersections, rounds, source: 'Supabase' }
      }
    } catch (e) {
      warnings.push(`No se pudo leer Supabase (${e.message}); uso src/data/*.json`)
    }
  }
  return {
    barrios: JSON.parse(readFileSync(join(ROOT, 'src/data/barrios.json'), 'utf8')),
    intersections: JSON.parse(readFileSync(join(ROOT, 'src/data/intersections.json'), 'utf8')),
    rounds: null,
    source: 'src/data',
  }
}

// Per-barrio accuracy across every saved round (daily maps + duels). A
// round's barrio is found through its actual coordinates, falling back to
// the street pair. Rounds with no answer (distance null) count as answered
// with 0 points but are left out of the distance figures.
const MIN_ROUNDS_FOR_STATS = 30
function accuracyByBarrio(intersections, rounds) {
  if (!rounds) return new Map()
  const key = (lat, lng) => `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`
  const byCoords = new Map()
  const byStreets = new Map()
  for (const it of intersections) {
    byCoords.set(key(it.lat, it.lng), it.barrio_id)
    byStreets.set(`${it.street1}|${it.street2 ?? ''}`, it.barrio_id)
  }
  const acc = new Map()
  for (const r of rounds) {
    const barrioId =
      (Array.isArray(r.actual) ? byCoords.get(key(r.actual[0], r.actual[1])) : undefined) ??
      byStreets.get(`${r.street1}|${r.street2 ?? ''}`)
    if (barrioId == null) continue
    const a = acc.get(barrioId) || { rounds: 0, points: 0, perfect: 0, distances: [] }
    a.rounds++
    a.points += r.points || 0
    if (typeof r.distance === 'number') {
      a.distances.push(r.distance)
      if (r.distance <= 50) a.perfect++
    }
    acc.set(barrioId, a)
  }
  const stats = new Map()
  for (const [id, a] of acc) {
    if (a.rounds < MIN_ROUNDS_FOR_STATS || !a.distances.length) continue
    const d = a.distances.sort((x, y) => x - y)
    stats.set(id, {
      rounds: a.rounds,
      avgPoints: a.points / a.rounds,
      avgDistance: d.reduce((s, x) => s + x, 0) / d.length,
      medianDistance: d[Math.floor(d.length / 2)],
      perfectPct: (a.perfect / a.rounds) * 100,
    })
  }
  return stats
}

const fmtInt = (n) => Math.round(n).toLocaleString('es-AR')
const fmtDec = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const fmtDistance = (m) => (m >= 1000 ? `${fmtDec(m / 1000)} km` : `${fmtInt(m)} m`)

// ---------- template ----------

const CSS = readFileSync(join(CONTENT, '_estilos.css'), 'utf8')

const NAV = [
  ['/guias', 'Guías'],
  ['/barrios', 'Barrios'],
  ['/como-se-juega', 'Cómo se juega'],
  ['/preguntas-frecuentes', 'Preguntas frecuentes'],
]

const FOOTER = [
  ['/guias', 'Guías'],
  ['/barrios', 'Barrios'],
  ['/como-se-juega', 'Cómo se juega'],
  ['/preguntas-frecuentes', 'Preguntas frecuentes'],
  ['/terminos', 'Términos y condiciones'],
  ['/privacidad', 'Política de privacidad'],
  ['/', 'Jugar a UbiCABA'],
]

const AD_BLOCK = `<div class="ad">
<span class="ad-label">Publicidad</span>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}" crossorigin="anonymous"></script>
<ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="${AD_SLOT}" data-ad-format="auto" data-full-width-responsive="true"></ins>
<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`

function renderPage({ path, title, description, body, breadcrumbs = [], ads = true, jsonLd = [], updated }) {
  const url = SITE + path
  const crumbsHtml = breadcrumbs.length
    ? `<nav class="crumbs" aria-label="Ruta"><a href="/">Inicio</a>${breadcrumbs
        .map(([href, label]) => (href ? ` › <a href="${href}">${escapeHtml(label)}</a>` : ` › <span>${escapeHtml(label)}</span>`))
        .join('')}</nav>`
    : ''
  const ld = [...jsonLd]
  if (breadcrumbs.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [['/', 'Inicio'], ...breadcrumbs].map(([href, label], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: label,
        ...(href ? { item: SITE + href } : { item: url }),
      })),
    })
  }
  const fullTitle = `${title} — UbiCABA`
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="UbiCABA" />
<meta property="og:locale" content="es_AR" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${escapeHtml(fullTitle)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
${CSS.trim()}
</style>
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<script data-goatcounter="https://ubicaba.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</head>
<body>
<header class="site">
<div class="site-inner">
<a class="brand" href="/">ubi<span>CABA</span></a>
<nav class="site-nav">${NAV.map(([href, label]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
<a class="play" href="/">Jugar</a>
</div>
</header>
<main>
${crumbsHtml}
${body.trim()}
${updated ? `<p class="upd">Última revisión: ${escapeHtml(updated)}</p>` : ''}
${ads ? AD_BLOCK : ''}
</main>
<footer class="site">
<nav>${FOOTER.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>
<p>UbiCABA es un juego independiente hecho por <a href="https://x.com/poniemangon" rel="noopener">@poniemangon</a>. Mapas: Esri, OpenFreeMap y © colaboradores de OpenStreetMap.</p>
</footer>
</body>
</html>
`
}

function articleLd({ title, description, path, updated }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    inLanguage: 'es-AR',
    mainEntityOfPage: SITE + path,
    ...(updated ? { dateModified: updated } : {}),
    author: { '@type': 'Person', name: 'poniemangon', url: 'https://x.com/poniemangon' },
    publisher: { '@type': 'Organization', name: 'UbiCABA', url: SITE },
  }
}

// ---------- build ----------

const outputs = new Map() // path → html

function emit(path, html) {
  if (outputs.has(path)) errors.push(`Ruta duplicada: ${path}`)
  outputs.set(path, html)
}

function outFile(path) {
  if (path === '/guias' || path === '/barrios') return join(PUBLIC, path.slice(1), 'index.html')
  return join(PUBLIC, `${path.slice(1)}.html`)
}

const game = await loadGameData()
const barrioRows = game.barrios.filter((b) => b.comuna > 0).sort((a, b) => a.comuna - b.comuna || a.nombre.localeCompare(b.nombre, 'es'))
const barrioByName = new Map(barrioRows.map((b) => [b.nombre, b]))
const realBarrioIds = new Set(barrioRows.map((b) => b.barrio_id))
// Special locations (comuna 0) aren't a barrio — keep them out of the ranking.
const accuracy = new Map([...accuracyByBarrio(game.intersections, game.rounds)].filter(([id]) => realBarrioIds.has(id)))
// 1 = hardest (lowest average points).
const difficultyRank = new Map(
  [...accuracy.entries()].sort((a, b) => a[1].avgPoints - b[1].avgPoints).map(([id], i) => [id, i + 1]),
)
const images = existsSync(join(CONTENT, 'imagenes-barrios.json'))
  ? JSON.parse(readFileSync(join(CONTENT, 'imagenes-barrios.json'), 'utf8'))
  : {}

function figure(img, alt) {
  if (!img) return ''
  const license = img.licenciaUrl ? `<a href="${escapeHtml(img.licenciaUrl)}" rel="noopener license">${escapeHtml(img.licencia)}</a>` : escapeHtml(img.licencia)
  return `<figure class="hero">
<img src="${escapeHtml(img.url)}" alt="${escapeHtml(alt)}"${img.ancho ? ` width="${img.ancho}" height="${img.alto}"` : ''} loading="eager" decoding="async" referrerpolicy="no-referrer" />
<figcaption>Foto: ${escapeHtml(img.autor)} · ${license} · vía <a href="${escapeHtml(img.pagina)}" rel="noopener">Wikimedia Commons</a></figcaption>
</figure>`
}

// Static pages (cómo se juega, FAQ, términos, privacidad).
const paginas = readDir(join(CONTENT, 'paginas'), '.html')
for (const p of paginas) {
  requireFields(p, 'paginas', ['titulo', 'descripcion'])
  emit(`/${p.slug}`, renderPage({ path: `/${p.slug}`, title: p.data.titulo, description: p.data.descripcion, body: p.body, ads: p.data.anuncios !== false }))
}

// Guides.
const guias = readDir(join(CONTENT, 'guias'), '.md').sort((a, b) => (a.data.orden ?? 99) - (b.data.orden ?? 99))
for (const g of guias) {
  requireFields(g, 'guias', ['titulo', 'descripcion', 'orden'])
}
for (const g of guias) {
  const path = `/guias/${g.slug}`
  let html = marked.parse(g.body)
  if (g.data.comunas) html = html.replace('<p>{{tabla-comunas}}</p>', comunasTable())
  if (wordCount(html) < MIN_WORDS) warnings.push(`content/guias/${g.file}: solo ${wordCount(html)} palabras (mínimo sugerido ${MIN_WORDS})`)
  const others = guias.filter((o) => o !== g)
  const body = `<article>
<h1>${escapeHtml(g.data.titulo)}</h1>
<p class="lead">${escapeHtml(g.data.descripcion)}</p>
${html}
</article>
<section class="related">
<h2>Seguí leyendo</h2>
<ul>${others.map((o) => `<li><a href="/guias/${o.slug}">${escapeHtml(o.data.titulo)}</a></li>`).join('')}<li><a href="/barrios">Guías de los 48 barrios</a></li></ul>
</section>`
  emit(
    path,
    renderPage({
      path,
      title: g.data.titulo,
      description: g.data.descripcion,
      body,
      updated: g.data.actualizado,
      breadcrumbs: [['/guias', 'Guías'], [null, g.data.titulo]],
      jsonLd: [articleLd({ title: g.data.titulo, description: g.data.descripcion, path, updated: g.data.actualizado })],
    }),
  )
}

// Barrio guides.
const barrioPages = readDir(join(CONTENT, 'barrios'), '.md')
const barrioPageByName = new Map()
for (const p of barrioPages) {
  requireFields(p, 'barrios', ['nombre', 'descripcion'])
  const row = barrioByName.get(p.data.nombre)
  if (!row) errors.push(`content/barrios/${p.file}: "${p.data.nombre}" no es un barrio de la base`)
  else if (p.slug !== slugify(p.data.nombre)) errors.push(`content/barrios/${p.file}: el archivo debería llamarse ${slugify(p.data.nombre)}.md`)
  else barrioPageByName.set(p.data.nombre, p)
}
for (const b of barrioRows) {
  if (!barrioPageByName.has(b.nombre)) errors.push(`Falta la guía del barrio ${b.nombre} (content/barrios/${slugify(b.nombre)}.md)`)
}

function streetStats(barrioId) {
  const counts = new Map()
  let total = 0
  for (const it of game.intersections) {
    if (it.barrio_id !== barrioId) continue
    total++
    for (const s of [it.street1, it.street2]) if (s) counts.set(s, (counts.get(s) || 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).slice(0, 10)
  return { total, top }
}

function comunasTable() {
  const byComuna = new Map()
  for (const b of barrioRows) byComuna.set(b.comuna, [...(byComuna.get(b.comuna) || []), b])
  return `<table class="comunas"><thead><tr><th>Comuna</th><th>Barrios</th></tr></thead><tbody>${[...byComuna.entries()]
    .map(
      ([c, bs]) =>
        `<tr><td>${c}</td><td>${bs.map((b) => `<a href="/barrios/${slugify(b.nombre)}">${escapeHtml(b.nombre)}</a>`).join(', ')}</td></tr>`,
    )
    .join('')}</tbody></table>`
}

function difficultyTable() {
  if (!accuracy.size) return ''
  const rows = [...accuracy.entries()]
    .map(([id, s]) => [barrioRows.find((b) => b.barrio_id === id), s])
    .filter(([b]) => b)
    .sort((a, b) => a[1].avgPoints - b[1].avgPoints)
  const total = rows.reduce((n, [, s]) => n + s.rounds, 0)
  return `<h2>¿Qué barrios cuestan más?</h2>
<p>Ranking armado con <strong>${fmtInt(total)} respuestas</strong> reales de jugadores de UbiCABA, del barrio con menos puntos promedio al que tiene más.</p>
<div class="table-wrap"><table class="ranking"><thead><tr><th>#</th><th>Barrio</th><th>Puntos prom.</th><th>Distancia mediana</th><th>Perfectas</th></tr></thead><tbody>${rows
    .map(
      ([b, s], i) =>
        `<tr><td>${i + 1}</td><td><a href="/barrios/${slugify(b.nombre)}">${escapeHtml(b.nombre)}</a></td><td>${fmtDec(s.avgPoints)}</td><td>${fmtDistance(s.medianDistance)}</td><td>${fmtInt(s.perfectPct)}%</td></tr>`,
    )
    .join('')}</tbody></table></div>`
}

const orderedBarrioPages =barrioRows.map((b) => barrioPageByName.get(b.nombre)).filter(Boolean)
for (const [i, p] of orderedBarrioPages.entries()) {
  const row = barrioByName.get(p.data.nombre)
  const path = `/barrios/${p.slug}`
  const html = marked.parse(p.body)
  if (wordCount(html) < MIN_WORDS) warnings.push(`content/barrios/${p.file}: solo ${wordCount(html)} palabras (mínimo sugerido ${MIN_WORDS})`)
  const { total, top } = streetStats(row.barrio_id)
  const stats = accuracy.get(row.barrio_id)
  const sameComuna = barrioRows.filter((b) => b.comuna === row.comuna && b !== row)
  const prev = orderedBarrioPages[i - 1]
  const next = orderedBarrioPages[i + 1]
  const title = `${p.data.nombre}: guía del barrio`
  const name = escapeHtml(p.data.nombre)
  const statsHtml = stats
    ? `<h3>¿Qué tan bien lo conocen los jugadores?</h3>
<div class="stats">
<div><strong>${fmtDistance(stats.avgDistance)}</strong><span>distancia promedio</span></div>
<div><strong>${fmtDistance(stats.medianDistance)}</strong><span>distancia mediana</span></div>
<div><strong>${fmtDec(stats.avgPoints)}</strong><span>puntos promedio (de 100)</span></div>
<div><strong>${fmtInt(stats.perfectPct)}%</strong><span>aciertos perfectos (≤ 50 m)</span></div>
</div>
<p>Calculado sobre <strong>${fmtInt(stats.rounds)} respuestas</strong> en mapas del día y duelos. Ordenando los ${accuracy.size} barrios del más difícil al más fácil según los puntos promedio, ${name} está en el <strong>puesto ${difficultyRank.get(row.barrio_id)}</strong> (mirá el <a href="/barrios">ranking completo</a>). La mediana muestra el error de un jugador típico: el promedio sube mucho con las respuestas que caen en la otra punta de la Ciudad.</p>`
    : ''
  const body = `<article>
<h1>${name}</h1>
<p class="lead">${escapeHtml(p.data.descripcion)}</p>
${figure(
  images[p.data.nombre],
  p.data.imagenAlt ||
    (images[p.data.nombre]?.url.includes('.svg') ? `Mapa de ubicación de ${p.data.nombre} en la Ciudad de Buenos Aires` : `Vista de ${p.data.nombre}, Buenos Aires`),
)}
<ul class="facts">
<li><strong>Comuna:</strong> ${row.comuna}</li>
${sameComuna.length ? `<li><strong>Comparte comuna con:</strong> ${sameComuna.map((b) => `<a href="/barrios/${slugify(b.nombre)}">${escapeHtml(b.nombre)}</a>`).join(', ')}</li>` : '<li><strong>Es el único barrio de su comuna.</strong></li>'}
</ul>
${html}
${
  total
    ? `<section class="in-game">
<h2>${name} en UbiCABA</h2>
<p>El juego tiene <strong>${fmtInt(total)} esquinas</strong> de ${name}. Estas son las calles que más aparecen, así que conviene tenerlas ubicadas:</p>
<ul class="streets">${top.map(([s, n]) => `<li>${escapeHtml(s)} <span>${n}</span></li>`).join('')}</ul>
${statsHtml}
<p>Para practicar solo este barrio, entrá al juego, elegí <strong>Personalizada</strong> y marcá ${name}.</p>
</section>`
    : ''
}
</article>
<nav class="pager">${prev ? `<a href="/barrios/${prev.slug}">← ${escapeHtml(prev.data.nombre)}</a>` : '<span></span>'}<a href="/barrios">Todos los barrios</a>${next ? `<a href="/barrios/${next.slug}">${escapeHtml(next.data.nombre)} →</a>` : '<span></span>'}</nav>`
  emit(
    path,
    renderPage({
      path,
      title,
      description: p.data.descripcion,
      body,
      updated: p.data.actualizado,
      breadcrumbs: [['/barrios', 'Barrios'], [null, p.data.nombre]],
      jsonLd: [articleLd({ title, description: p.data.descripcion, path, updated: p.data.actualizado })],
    }),
  )
}

// Hubs.
emit(
  '/guias',
  renderPage({
    path: '/guias',
    title: 'Guías para ubicarte en Buenos Aires',
    description: 'Guías para conocer y recorrer la Ciudad de Buenos Aires: cómo funciona la numeración, las avenidas, las comunas, los lugares emblemáticos y los 48 barrios.',
    breadcrumbs: [[null, 'Guías']],
    body: `<h1>Guías para ubicarte en Buenos Aires</h1>
<p class="lead">Lo que conviene saber para moverte por la Ciudad y para sumar más puntos en UbiCABA: cómo se numeran las calles, qué avenidas te sirven de referencia, cómo se organizan las comunas y qué hay en cada barrio.</p>
<ul class="cards">${guias
      .map((g) => `<li><a href="/guias/${g.slug}"><strong>${escapeHtml(g.data.titulo)}</strong><span>${escapeHtml(g.data.descripcion)}</span></a></li>`)
      .join('')}<li><a href="/barrios"><strong>Los 48 barrios</strong><span>Una guía por barrio: historia, lugares, calles y avenidas clave.</span></a></li></ul>`,
  }),
)

{
  const byComuna = new Map()
  for (const p of orderedBarrioPages) {
    const c = barrioByName.get(p.data.nombre).comuna
    byComuna.set(c, [...(byComuna.get(c) || []), p])
  }
  emit(
    '/barrios',
    renderPage({
      path: '/barrios',
      title: 'Los 48 barrios de Buenos Aires',
      description: 'Guía de los 48 barrios de la Ciudad de Buenos Aires, ordenados por comuna: historia, lugares emblemáticos, calles y avenidas para ubicarte.',
      breadcrumbs: [[null, 'Barrios']],
      body: `<h1>Los 48 barrios de Buenos Aires</h1>
<p class="lead">La Ciudad Autónoma de Buenos Aires tiene 48 barrios oficiales, agrupados en 15 comunas. Cada guía cuenta un poco de la historia del barrio, sus lugares más conocidos y las calles que te sirven de referencia para encontrarlo en el mapa.</p>
<p>¿No sabés qué es una comuna? Lo explicamos en <a href="/guias/comunas-de-buenos-aires">Las 15 comunas de Buenos Aires</a>.</p>
${difficultyTable()}
${[...byComuna.entries()]
  .map(
    ([c, ps]) => `<h2>Comuna ${c}</h2>
<ul class="cards">${ps.map((p) => `<li><a href="/barrios/${p.slug}"><strong>${escapeHtml(p.data.nombre)}</strong><span>${escapeHtml(p.data.descripcion)}</span></a></li>`).join('')}</ul>`,
  )
  .join('\n')}`,
    }),
  )
}

// ---------- validation ----------

const knownPaths = new Set([...outputs.keys(), ...SPA_ROUTES])
for (const [path, html] of outputs) {
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue
    const clean = href.split(/[?#]/)[0].replace(/\/$/, '') || '/'
    if (knownPaths.has(clean) || existsSync(join(PUBLIC, clean.slice(1)))) continue
    errors.push(`${path}: link roto a ${href}`)
  }
}

for (const w of warnings) console.warn(`⚠ ${w}`)
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e}`)
  console.error(`\nbuild-content: ${errors.length} error(es); no se generaron las páginas.`)
  process.exit(1)
}

// ---------- write ----------

for (const dir of ['guias', 'barrios']) rmSync(join(PUBLIC, dir), { recursive: true, force: true })
for (const [path, html] of outputs) {
  const file = outFile(path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

const sitemapPaths = ['/', '/ranking', ...outputs.keys()]
writeFileSync(
  join(PUBLIC, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPaths.map((p) => `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc></url>`).join('\n')}
</urlset>
`,
)

console.log(`build-content: ${outputs.size} páginas generadas (datos de ${game.source}).`)
