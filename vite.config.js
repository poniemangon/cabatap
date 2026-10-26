import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mirrors the vercel.json rewrites in dev: clean URLs like /guias/palermo or
// /terminos serve the static HTML that scripts/build-content.mjs wrote into
// public/, instead of falling through to the SPA.
function staticContentPages() {
  return {
    name: 'static-content-pages',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url.split('?')[0].replace(/\/$/, '')
        if (!path || path.includes('.')) return next()
        for (const candidate of [`${path}.html`, `${path}/index.html`]) {
          if (existsSync(join(server.config.publicDir, candidate))) {
            req.url = candidate
            break
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), staticContentPages()],
})
