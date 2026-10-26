// One-off helper: finds a freely licensed photo for each barrio on Wikimedia
// Commons (the lead image of its Spanish Wikipedia article) and writes
// content/imagenes-barrios.json with the hotlink URL + author/license credit.
// The site build only reads that JSON, so it never depends on Wikipedia being
// up. Re-run to refresh, then review the JSON before committing:
//
//   node scripts/fetch-barrio-images.mjs
//
// An entry can be pinned by hand (set "fijada": true) and won't be replaced.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'content/imagenes-barrios.json')
const UA = 'UbiCABA-content-build/1.0 (https://ubicaba.com)'
const FREE_LICENSE = /^(cc0|cc[ -]by|cc[ -]by-sa|public domain|dominio público|pd)/i

const barrios = JSON.parse(readFileSync(join(ROOT, 'src/data/barrios.json'), 'utf8')).filter((b) => b.comuna > 0)
const current = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${host}: HTTP ${res.status}`)
  return res.json()
}

function stripHtml(s = '') {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

async function leadImage(nombre) {
  for (const title of [`${nombre} (Buenos Aires)`, nombre]) {
    const data = await api('es.wikipedia.org', {
      action: 'query',
      redirects: '1',
      titles: title,
      prop: 'pageimages|extracts',
      piprop: 'name',
      exintro: '1',
      explaintext: '1',
      exsentences: '2',
    })
    const page = data.query?.pages?.[0]
    if (!page || page.missing || !page.pageimage) continue
    if (!/Buenos Aires/i.test(page.extract || '')) continue
    return { file: page.pageimage, article: page.title }
  }
  return null
}

async function commonsInfo(file) {
  const data = await api('commons.wikimedia.org', {
    action: 'query',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1280',
  })
  const info = data.query?.pages?.[0]?.imageinfo?.[0]
  if (!info) return null
  const meta = info.extmetadata || {}
  return {
    url: (info.thumburl || info.url).split('?')[0], // drop Commons' utm_* tracking params
    ancho: info.thumbwidth,
    alto: info.thumbheight,
    pagina: info.descriptionurl,
    autor: /^(unknown author)+$/i.test(stripHtml(meta.Artist?.value)) ? 'Autor desconocido' : stripHtml(meta.Artist?.value) || 'Autor desconocido',
    licencia: stripHtml(meta.LicenseShortName?.value),
    licenciaUrl: meta.LicenseUrl?.value || null,
    descripcion: stripHtml(meta.ImageDescription?.value).slice(0, 200),
  }
}

const result = {}
for (const b of barrios) {
  if (current[b.nombre]?.fijada) {
    result[b.nombre] = current[b.nombre]
    continue
  }
  try {
    const lead = await leadImage(b.nombre)
    const info = lead && (await commonsInfo(lead.file))
    if (!info) {
      console.warn(`– ${b.nombre}: sin imagen`)
      continue
    }
    if (!FREE_LICENSE.test(info.licencia)) {
      console.warn(`– ${b.nombre}: licencia no libre (${info.licencia}), la salteo`)
      continue
    }
    result[b.nombre] = { ...info, articulo: lead.article }
    console.log(`✓ ${b.nombre}: ${lead.file} (${info.licencia})`)
  } catch (e) {
    console.warn(`– ${b.nombre}: ${e.message}`)
    if (current[b.nombre]) result[b.nombre] = current[b.nombre]
  }
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log(`\n${Object.keys(result).length}/${barrios.length} barrios con imagen → content/imagenes-barrios.json`)
