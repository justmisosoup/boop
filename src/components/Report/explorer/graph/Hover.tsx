// Ported verbatim from app/src/containers/Explorer/graph/Hover.tsx
/**
 * The graph system — the hover engine (kernel).
 *
 * THE HOVER LAW (learned the hard way): hover changes BRIGHTNESS — never the
 * geometry of the world, never text, never the camera. It is driven entirely by
 * CSS classes toggled on live DOM (zero React re-render), and it fires off
 * `mousemove`, never `mouseover` — so a click-glide that slides the map under a
 * still cursor cannot sweep a wave of brightness across it (the navigation
 * "flash"). While the camera travels, hover stays silent.
 *
 * Contract with the marks: a node's wrapper is `.g-node[data-gid="<id>"]`; a
 * sidebar row that mirrors a node is `[data-connid="<id>"]`; edges are the
 * native `.react-flow__edge[data-id="<id>"]`.
 */
import { useEffect, useRef, type MutableRefObject } from 'react'

/** A neighbor to bloom when a node is pointed at: the node and the edge to it.
 *  The mode's `neighbors` fn should already exclude context it doesn't want lit
 *  (e.g. a shared filing agent / industry hub). */
export interface HoverNeighbor {
  nodeId: string
  edgeId: string
}

/** Lazily-built id → element cache, scoped to a root and validated on read
 *  (React keeps DOM nodes stable across data changes, so hits are the norm;
 *  a remounted element re-queries once). Kills the document-wide selector
 *  scan per neighbor per hover stop — the review's scale hazard #5. */
function makeElementCache(
  selectorOf: (id: string) => string,
  rootOf: () => ParentNode
) {
  const cache = new Map<string, Element>()
  return (id: string): Element | null => {
    const hit = cache.get(id)
    if (hit && hit.isConnected) return hit
    const el = rootOf().querySelector(selectorOf(id))
    if (el) cache.set(id, el)
    else cache.delete(id)
    return el
  }
}

/**
 * The bloom, by DIFF. Toggles, on the node you point at: itself lifts (.g-hovs);
 * its first-degree neighbors come forward (.g-nbr) and their lines brighten in
 * the native edge layer below the marks (.g-edge-hi); the matching sidebar row
 * highlights (.g-row-hi). The bloom moves by diff, never teardown-and-rebuild:
 * consecutive stops are each other's neighbors, so sliding the hover between
 * them lets shared elements KEEP their classes (remove+instant-re-add restarts
 * the transition and the neighborhood visibly pulses). A hover-null lingers a
 * beat before clearing, so crossing a gap (A → null → B) never tears it down.
 *
 * `rootRef` scopes every query to this graph's canvas so two mounted graphs can
 * never cross-light each other; the sidebar row lookup stays document-level by
 * design (the panel lives outside the canvas element).
 */
export function CanvasHover({
  hoverId,
  neighbors,
  bloom = true,
  rootRef
}: {
  hoverId: string | null
  neighbors: (id: string) => HoverNeighbor[]
  /** false = only the pointed-at node lifts (no neighborhood bloom) */
  bloom?: boolean
  /** the canvas element — scopes node/edge lookups (leave unset for document) */
  rootRef?: MutableRefObject<HTMLElement | null>
}) {
  const marked = useRef(new Map<Element, Set<string>>())
  const lingerTimer = useRef(0)
  const lookups = useRef<{
    node: (id: string) => Element | null
    edge: (id: string) => Element | null
    row: (id: string) => Element | null
  } | null>(null)
  if (!lookups.current) {
    const root = () => rootRef?.current ?? document
    lookups.current = {
      node: makeElementCache(
        id => `.g-node[data-gid="${CSS.escape(id)}"]`,
        root
      ),
      edge: makeElementCache(
        id => `.react-flow__edge[data-id="${CSS.escape(id)}"]`,
        root
      ),
      row: makeElementCache(
        id => `[data-connid="${CSS.escape(id)}"]`,
        () => document
      )
    }
  }

  useEffect(() => {
    const apply = (want: Map<Element, Set<string>>) => {
      for (const [el, owned] of marked.current) {
        const keep = want.get(el)
        for (const cls of owned) if (!keep?.has(cls)) el.classList.remove(cls)
      }
      for (const [el, classes] of want)
        for (const cls of classes) el.classList.add(cls)
      marked.current = want
    }
    window.clearTimeout(lingerTimer.current)
    if (!hoverId) {
      lingerTimer.current = window.setTimeout(() => apply(new Map()), 120)
      return
    }
    const lk = lookups.current
    if (!lk) return
    const { node, edge, row } = lk
    const want = new Map<Element, Set<string>>()
    const mark = (el: Element | null, cls: string) => {
      if (!el) return
      let s = want.get(el)
      if (!s) want.set(el, (s = new Set()))
      s.add(cls)
    }
    mark(node(hoverId), 'g-hovs')
    mark(row(hoverId), 'g-row-hi')
    if (bloom) {
      for (const nb of neighbors(hoverId)) {
        const nel = node(nb.nodeId)
        if (!nel || nel.classList.contains('g-em-hidden')) continue // never lift the fog
        mark(nel, 'g-nbr')
        mark(edge(nb.edgeId), 'g-edge-hi')
      }
    }
    apply(want)
  }, [hoverId, neighbors, bloom])

  useEffect(
    () => () => {
      window.clearTimeout(lingerTimer.current)
      for (const [el, owned] of marked.current)
        for (const cls of owned) el.classList.remove(cls)
      marked.current = new Map()
    },
    []
  )
  return null
}

/**
 * The pointer discipline for the canvas element. Returns handlers to spread on
 * the canvas div and an `overCanvas` ref (whether the pointer is on the map —
 * used by sidebar-peek cameras that must never steer the ground under a cursor
 * that's on it). Hover keys off `mousemove` (never `mouseover`) and is silenced
 * while `busy` is set (the camera is mid-glide). Deduped in here — callers get
 * one call per actual hover change.
 */
export function useHoverPointer({
  enabled = true,
  busy,
  onHover
}: {
  /** false while replaying / disabled — the pointer won't set hover */
  enabled?: boolean
  /** camera-busy ref: while true, the map is gliding and hover stays quiet */
  busy: MutableRefObject<boolean>
  onHover: (id: string | null) => void
}) {
  const overCanvas = useRef(false)
  const last = useRef<string | null>(null)
  const set = (id: string | null) => {
    if (id === last.current) return // dedupe: mousemove fires constantly
    last.current = id
    onHover(id)
  }
  const handlers = {
    onMouseEnter: () => {
      overCanvas.current = true
    },
    onMouseMove: (e: React.MouseEvent) => {
      overCanvas.current = true
      if (!enabled || busy.current) return
      const el = (e.target as HTMLElement).closest<HTMLElement>(
        '.g-node[data-gid]'
      )
      set(el?.getAttribute('data-gid') ?? null)
    },
    onMouseLeave: () => {
      overCanvas.current = false
      if (enabled) set(null)
    }
  }
  return { handlers, overCanvas }
}
