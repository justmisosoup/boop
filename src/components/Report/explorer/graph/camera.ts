// Ported verbatim from app/src/containers/Explorer/graph/camera.ts
/**
 * The graph system — the camera (kernel).
 *
 * The world holds still; the camera travels. On every focus change this glides
 * the viewport to frame `framing(focusId)`, with a van Wijk breath-out arc on a
 * long hop (rise over the midpoint, then land) and a hard reduced-motion path.
 * It holds a `busy` ref for the whole flight so the hover engine stays silent
 * while the ground moves (anti-flash). Bespoke cameras — replayed journeys,
 * sidebar-hover peeks — live in the mode and reuse settle/dur.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import type { Bounds } from './layout'

export const REDUCED =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Reduced motion: every glide shortens to one gentle constant — never a snap. */
export const dur = (ms: number) => (REDUCED ? 220 : ms)

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Camera animations are frame-driven and can stall in throttled windows — never
 *  let a stalled glide wedge the logic that awaits it. */
export const settle = (p: Promise<unknown>, ms: number) =>
  Promise.race([p, sleep(ms)])

const centerOf = (b: Bounds) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2
})

/**
 * THE SIDEBAR PEEK — the one hover that may move the camera, and only from the
 * PANEL (a sidebar hover is a considered point, not a sweep; canvas hover stays
 * brightness-only — the hover law). Ported from the Explorer: a DWELL so
 * skimming the list doesn't whip the camera, LINEAR flights (the smooth arc's
 * zoom-dip flashes labels), the busy gate held through the flight, and an
 * overCanvas guard so the ground never moves under a pointer that's on it.
 * Letting go inside the panel drifts back to the stage frame.
 */
export function useSidebarPeek({
  hoverId,
  hoverFrom,
  framing,
  homeFraming,
  canvasSelector,
  busy,
  overCanvas,
  enabled = true,
  dwell = 160
}: {
  hoverId: string | null
  hoverFrom?: { readonly current: 'panel' | 'canvas' }
  /** frame for the peeked node (null = this node doesn't peek) */
  framing: (id: string) => Bounds | null
  /** the stage frame to drift home to on release */
  homeFraming: () => Bounds | null
  canvasSelector: string
  busy: MutableRefObject<boolean>
  overCanvas: MutableRefObject<boolean>
  enabled?: boolean
  dwell?: number
}) {
  const rf = useReactFlow()
  const timer = useRef(0)
  const peeked = useRef(false)
  const flight = useRef(0)
  useEffect(() => {
    if (!enabled) {
      peeked.current = false
      return
    }
    window.clearTimeout(timer.current)
    const from = hoverFrom?.current
    const canvasEl = () => document.querySelector(canvasSelector)
    const fly = (b: Bounds, ms: number, cap: number) => {
      // tokened: an overlapping flight must not un-silence hover when the FIRST
      // flight settles — only the latest flight may clear the busy gate
      const t = ++flight.current
      busy.current = true
      canvasEl()?.classList.add('g-busy')
      void settle(
        rf.fitBounds(b, {
          duration: dur(ms),
          interpolate: 'linear',
          padding: 0.12
        }),
        cap
      ).finally(() => {
        if (flight.current !== t) return
        busy.current = false
        canvasEl()?.classList.remove('g-busy')
      })
    }
    if (hoverId && from === 'panel') {
      timer.current = window.setTimeout(() => {
        if (overCanvas.current) return // the pointer took the map — don't steer under it
        const b = framing(hoverId)
        if (!b) return
        peeked.current = true
        fly(b, 480, 830)
      }, dwell)
    } else if (!hoverId && from === 'panel' && peeked.current) {
      // let go inside the panel without a click — drift back to the stage frame
      timer.current = window.setTimeout(() => {
        if (overCanvas.current) return
        peeked.current = false
        const b = homeFraming()
        if (b) fly(b, 560, 910)
      }, 280)
    } else if (hoverId && from === 'canvas') {
      // the pointer is engaged with the map where it stands — the peek ends here
      peeked.current = false
    }
    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverId, enabled])
}

export function useTravel({
  focusId,
  framing,
  canvasSelector,
  busy,
  deps = [],
  padding,
  enabled = true
}: {
  /** the node to frame; null = the resting frame */
  focusId: string | null
  /** (focusId | null) → the bounds to fit, or null to stay put */
  framing: (focusId: string | null) => Bounds | null
  /** the canvas element (to measure viewport size) */
  canvasSelector: string
  /** shared with the hover pointer: true for the whole flight */
  busy: MutableRefObject<boolean>
  /** extra deps that should re-run the framing (a filter, a ready flag) */
  deps?: unknown[]
  /** fitBounds padding (fraction); omit for RF's default */
  padding?: number
  enabled?: boolean
}) {
  const rf = useReactFlow()
  const token = useRef(0)
  const first = useRef(true)
  useEffect(() => {
    if (!enabled) return
    const t = ++token.current
    busy.current = true
    // anti-flash law #2's CSS side: canvas :hover has mouseover semantics, so a
    // glide slides the map under a still cursor and lights marks one by one.
    // The busy CLASS makes every mark pointer-inert for the flight's duration
    // (the JS hover is already silenced by the busy ref).
    const canvasEl = document.querySelector(canvasSelector)
    canvasEl?.classList.add('g-busy')
    // the very first frame has nothing to animate FROM — land it instantly, so
    // the opening view is composed the moment it paints (and never stalls in a
    // backgrounded tab, where camera animations freeze). Later moves glide.
    const instant = first.current
    first.current = false
    const run = async () => {
      const b = framing(focusId)
      if (!b) return
      const opts = padding !== undefined ? { padding } : {}
      if (instant) {
        rf.fitBounds(b, { duration: 0, ...opts })
        return
      }
      const el = document.querySelector(canvasSelector) as HTMLElement | null
      const w = el?.clientWidth ?? 1000
      const h = el?.clientHeight ?? 700
      // where the camera looks now, in world coords, vs. where it's going
      const vp = rf.getViewport()
      const cx = (w / 2 - vp.x) / vp.zoom
      const cy = (h / 2 - vp.y) / vp.zoom
      const target = centerOf(b)
      const dist = Math.hypot(target.x - cx, target.y - cy)
      if (dist > 1200 && vp.zoom > 0.62 && !REDUCED) {
        // long hop only: breathe out over the midpoint, then land — the map-app
        // arc. A gentle 0.58 so the map stays readable through it.
        await settle(
          rf.setCenter((target.x + cx) / 2, (target.y + cy) / 2, {
            zoom: 0.58,
            duration: 340
          }),
          600
        )
        if (token.current !== t) return
      }
      const ms = dur(Math.min(640, 340 + dist * 0.2))
      await settle(rf.fitBounds(b, { duration: ms, ...opts }), ms + 310)
    }
    void run().finally(() => {
      if (token.current === t) {
        busy.current = false
        canvasEl?.classList.remove('g-busy')
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, enabled, ...deps])
}

/**
 * THE REFIT — one calm recompose when the stage itself changes shape (the
 * sidebar resizes or opens/closes), debounced so a train of commits (held
 * arrow keys, an open/close slide) settles exactly once. A recompose is an
 * adjustment, not a hop: it flies LINEAR (the peek's recipe, never the travel
 * arc) and holds `busy` so hover stays silent (law 2).
 *
 * Before flying it re-syncs React Flow's stored dimensions from the DOM — RF
 * only remeasures via its ResizeObserver / window-resize, so a same-window
 * layout change (a drawer drag) can race a stale size; measuring here makes
 * the fit correct everywhere, and is a no-op when RF already caught up.
 */
export function useRefit({
  watch,
  framing,
  canvasSelector,
  busy,
  enabled = true,
  delay = 260
}: {
  /** refit (debounced) whenever this value changes — e.g. the sidebar width */
  watch: unknown
  /** the stage frame to recompose to (fresh at fire time) */
  framing: () => Bounds | null
  canvasSelector: string
  busy: MutableRefObject<boolean>
  enabled?: boolean
  /** debounce, ms — long enough to outlast the drawer's open/close slide */
  delay?: number
}) {
  const rf = useReactFlow()
  const store = useStoreApi()
  // the framing closure goes stale across the debounce window (a travel could
  // land meanwhile) — read it through a ref so the refit frames the present
  const framingRef = useRef(framing)
  framingRef.current = framing
  // refit only on a real change of the watched value — never on mount, an
  // `enabled` flip, or a StrictMode re-run (all re-run the effect with the
  // same value)
  const prev = useRef(watch)
  const timer = useRef(0)

  useEffect(() => {
    if (!enabled || prev.current === watch) return undefined
    prev.current = watch

    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const b = framingRef.current()
      if (!b) return
      const canvasEl = document.querySelector(canvasSelector)
      if (
        canvasEl instanceof HTMLElement &&
        canvasEl.clientWidth > 0 &&
        canvasEl.clientHeight > 0
      ) {
        store.setState({
          width: canvasEl.clientWidth,
          height: canvasEl.clientHeight
        })
      }
      busy.current = true
      canvasEl?.classList.add('g-busy')
      void settle(
        rf.fitBounds(b, {
          duration: dur(320),
          interpolate: 'linear',
          padding: 0.12
        }),
        630
      ).finally(() => {
        busy.current = false
        canvasEl?.classList.remove('g-busy')
      })
    }, delay)

    return () => window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, enabled])
}
