/**
 * `import { ReactComponent } from './icon.svg'` — the SVGR named export
 * `vite.config.ts` configures, as the dashboard's webpack build provides it.
 * Vite's own client types declare only the default (the URL).
 */
declare module '*.svg' {
  import type { FC, SVGProps } from 'react'
  export const ReactComponent: FC<SVGProps<SVGSVGElement>>
}
