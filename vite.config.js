// vite.config.js
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { scoringMiddleware } from './server/scoringHandler.mjs'
import { chatMiddleware } from './server/chatHandler.mjs'

// Custom plugin: mount /api/score and /api/chat on the dev server. Handlers
// read API keys from process.env (NOT VITE_*) so they stay server-side.
function apiPlugin() {
  return {
    name: 'inner-circle-api',
    configureServer(server) {
      server.middlewares.use(scoringMiddleware())
      server.middlewares.use(chatMiddleware())
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Pull ALL env vars (not just VITE_*) into process.env so server-side
  // handlers can see ANTHROPIC_API_KEY and VOYAGE_API_KEY from .env.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    plugins: [react(), apiPlugin()],
  }
})
