import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// `vite dev` has no concept of Vercel's /api serverless functions — it just
// serves those files' raw source as text, which is why the map proxy 404s
// (or returns JS source instead of JSON) locally but works once deployed.
// This plugin runs the same handler files directly in the dev server so
// local dev doesn't need `vercel dev` or a second key for the client bundle.
function apiDevMiddleware() {
  const routes = {
    '/api/style': './api/style.js',
    '/api/tiles': './api/tiles.js',
    '/api/tile': './api/tile.js',
  }

  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const modulePath = routes[req.url.split('?')[0]]
        if (!modulePath) return next()

        const { default: handler } = await server.ssrLoadModule(modulePath)
        const url = new URL(req.url, 'http://localhost')
        req.query = Object.fromEntries(url.searchParams)
        req.headers['x-forwarded-proto'] = 'http'

        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.setHeader = res.setHeader.bind(res)
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        res.send = (body) => res.end(body)

        try {
          await handler(req, res)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite only auto-exposes VITE_-prefixed vars (and only to client code) —
  // the api/*.js handlers read process.env.MAPTILER_KEY directly, same as
  // they will on Vercel, so it has to be loaded onto process.env by hand here.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.MAPTILER_KEY = env.MAPTILER_KEY

  return {
    plugins: [react(), apiDevMiddleware()],
  }
})
