import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'

const BA_CENTER_LNGLAT = [-58.4025, -34.5975]
const MAX_BOUNDS_LNGLAT = [
  [-58.55, -34.72],
  [-58.3, -34.5],
]

function createDot(bg, border) {
  const el = document.createElement('div')
  el.style.width = '16px'
  el.style.height = '16px'
  el.style.borderRadius = '50%'
  el.style.background = bg
  el.style.border = `2px solid ${border}`
  el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2)'
  return el
}

function createActualMarkerEl(label) {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.alignItems = 'center'
  wrap.style.gap = '2px'

  const tag = document.createElement('div')
  tag.textContent = label
  tag.className = 'round-tooltip'
  wrap.appendChild(tag)
  wrap.appendChild(createDot('#ef4444', '#b91c1c'))
  return wrap
}

export default function ResultsMap({ results, clickEnabled, onPick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const clickEnabledRef = useRef(clickEnabled)
  const onPickRef = useRef(onPick)
  const [loaded, setLoaded] = useState(false)

  clickEnabledRef.current = clickEnabled
  onPickRef.current = onPick

  useEffect(() => {
    let cancelled = false

    async function init() {
      const res = await fetch('/api/style')
      const style = await res.json()
      if (cancelled) return

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: BA_CENTER_LNGLAT,
        zoom: 13,
        minZoom: 11,
        maxZoom: 19,
      })
      map.setMaxBounds(MAX_BOUNDS_LNGLAT)
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left')

      map.on('load', () => {
        if (cancelled) return
        map.addSource('guess-lines', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id: 'guess-lines-halo',
          type: 'line',
          source: 'guess-lines',
          paint: { 'line-color': '#000000', 'line-width': 6, 'line-opacity': 0.35, 'line-blur': 1 },
        })
        map.addLayer({
          id: 'guess-lines-layer',
          type: 'line',
          source: 'guess-lines',
          paint: { 'line-color': '#ffffff', 'line-width': 3.5 },
        })
        setLoaded(true)
      })

      map.on('click', (e) => {
        if (!clickEnabledRef.current) return
        onPickRef.current([e.lngLat.lat, e.lngLat.lng])
      })

      mapRef.current = map
    }

    init()

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const features = results.map((r, i) => {
      const guessMarker = new maplibregl.Marker({ element: createDot('#3b82f6', '#1d4ed8') })
        .setLngLat([r.guess[1], r.guess[0]])
        .addTo(map)
      const actualMarker = new maplibregl.Marker({ element: createActualMarkerEl(`R${i + 1}`), anchor: 'bottom' })
        .setLngLat([r.actual[1], r.actual[0]])
        .addTo(map)
      markersRef.current.push(guessMarker, actualMarker)

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [r.guess[1], r.guess[0]],
            [r.actual[1], r.actual[0]],
          ],
        },
        properties: {},
      }
    })

    map.getSource('guess-lines')?.setData({ type: 'FeatureCollection', features })
  }, [results, loaded])

  return <div ref={containerRef} className="map" />
}
