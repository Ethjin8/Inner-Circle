import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { scoringMiddleware } from './server/scoringHandler.mjs'

// Custom plugin: mount the /api/score handler on the dev server. The handler
// reads ANTHROPIC_API_KEY from process.env (NOT VITE_*) so it stays server-side.
function scoringApiPlugin() {
  return {
    name: 'inner-circle-scoring-api',
    configureServer(server) {
      server.middlewares.use(scoringMiddleware())
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Pull ALL env vars (not just VITE_*) into process.env so the server-side
  // scoring handler can see ANTHROPIC_API_KEY from .env.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  return {
    plugins: [react(), scoringApiPlugin()],
  }
})
