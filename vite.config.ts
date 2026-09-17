import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { defineConfig, loadEnv } from 'vite'

import { analysePlugin } from './scripts/analyse-endpoint'
import { assessmentsPlugin } from './scripts/assessments-endpoint'
import { insightsPlugin } from './scripts/insights-endpoint'

export default defineConfig(({ mode }) => {
  // Read server-side only. These names are deliberately NOT prefixed VITE_, so
  // nothing here is bundled into client code.
  const env = loadEnv(mode, process.cwd(), '')
  process.env.MIDDESK_API_KEY = env.MIDDESK_API_KEY

  return {
    plugins: [
      // The design system imports icons as `import { ReactComponent } from
      // '...svg'` — the SVGR convention webpack handles natively and Vite does
      // not. Configured for the named export so the clone works unmodified.
      svgr({ svgrOptions: { exportType: 'named' }, include: '**/*.svg' }),
      react(), analysePlugin(), assessmentsPlugin(), insightsPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // `Attribute.tsx` and `LegacyDrawer.tsx` import icon SVGs by deep path
        // (`ionicons/dist/ionicons/svg/ios-close.svg`). The package declares an
        // `exports` map that refuses deep specifiers, so resolve straight to the
        // files instead. The dashboard's own bundler config does the equivalent.
        'ionicons/dist/ionicons/svg': fileURLToPath(
          new URL('./node_modules/ionicons/dist/ionicons/svg', import.meta.url)
        )
      }
    },
    server: { port: 3000 }
  }
})
