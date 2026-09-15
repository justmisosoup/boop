import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import { analysePlugin } from './scripts/analyse-endpoint'
import { insightsPlugin } from './scripts/insights-endpoint'

export default defineConfig(({ mode }) => {
  // Read server-side only. These names are deliberately NOT prefixed VITE_, so
  // nothing here is bundled into client code.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.MIDDESK_API_KEY = env.MIDDESK_API_KEY

  return {
    plugins: [react(), analysePlugin(), insightsPlugin()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { port: 3000 }
  }
})
