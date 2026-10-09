/**
 * The graph key — a small, toggleable legend so anyone can READ the map cold,
 * with REAL paint samples (the exact dash patterns, widths, and inks the
 * canvas draws — never CSS approximations). It stays LIGHT by decoding only
 * what the map can't teach on its own: what dash says (Sources) and what
 * width says (Source strength).
 *
 * Hovering a line row lights every matching line on the map — the same
 * brightness-only `.g-edge-hi` class the canvas hover uses (law 2), applied
 * to live DOM so the key never re-renders the graph. Closed by default to a
 * single "?" button so it never competes with the map.
 *
 * Ported from app/src/containers/Explorer/graph/Legend.tsx. Its chrome was
 * styled-components over tokens; here the same values are Tailwind over the
 * same `--core-*` tokens (the prototype has no styled-components product code).
 * Changes, all to fit what this graph draws: the Nodes rows list only the kinds
 * on the map (the app lists all five), the line lookups are scoped to this
 * canvas (`rootRef`) so two graphs can't light each other, and the Keys rows
 * drop shift-click select and the lasso, which are not ported.
 */
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'

import { IconActionButton, Kbd } from '@/core'

import { EDGE_INK, HUBGRAY, KIND, KIND_NOUN, KIND_ORDER } from '../constants'
import type { KybEdge, KybNode } from '../types'
import { STRENGTH_WIDTH, strengthTier, type Strength } from './Edges'

/** dash = sourcing, nothing else (dashFor's exact patterns); "Context" is the
 *  same word the app's panel hub tag uses — one vocabulary across surfaces */
const SOURCE_ROWS: {
  key: string
  ink: string
  width: number
  dash?: string
  label: string
}[] = [
  { key: 'confirmed', ink: EDGE_INK.control, width: 2, label: 'Confirmed' },
  {
    key: 'unconfirmed',
    ink: EDGE_INK.record,
    width: 2,
    dash: '2 5',
    label: 'Unconfirmed'
  },
  { key: 'context', ink: HUBGRAY, width: 1.1, dash: '1 8', label: 'Context' }
]

/** width = corroboration (STRENGTH_WIDTH's exact strokes) */
const STRENGTH_ROWS: [Strength, string][] = [
  ['weak', '1 source'],
  ['moderate', '2 sources'],
  ['strong', '3+ sources']
]

/** sentence case, no tracking — a key section names itself in the same quiet
 *  caption grammar as the cards */
const Label = ({ children }: { children: ReactNode }) => (
  <div className="mb-1 mt-3 font-normal text-[var(--core-color-text-muted)]">{children}</div>
)

const Row = ({ children, ...rest }: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <div className="flex min-h-5 items-center gap-2" {...rest}>
    {children}
  </div>
)

/** the exact stroke the canvas draws, as a 26px sample */
function Sample({ ink, width = 2, dash }: { ink: string; width?: number; dash?: string }) {
  return (
    <svg aria-hidden="true" height={9} style={{ flex: '0 0 auto' }} width={26}>
      <line stroke={ink} strokeDasharray={dash} strokeWidth={width} x1={1} x2={25} y1={4.5} y2={4.5} />
    </svg>
  )
}

/** brightness-only lighting of matching lines, on live DOM (the Hover.tsx
 *  discipline) — cleared on leave, close, graph change, and unmount */
function useRowLight(edges: readonly KybEdge[], rootRef?: RefObject<HTMLElement | null>) {
  const lit = useRef<Element[]>([])
  const clear = () => {
    for (const el of lit.current) el.classList.remove('g-edge-hi')
    lit.current = []
  }
  // a graph swap invalidates the lit elements — clear on change and unmount
  useEffect(() => clear, [edges])
  const light = (ids: readonly string[] | undefined) => {
    clear()
    const root: ParentNode = rootRef?.current ?? document
    for (const id of ids ?? []) {
      const el = root.querySelector(`.react-flow__edge[data-id="${CSS.escape(id)}"]`)
      if (el) {
        el.classList.add('g-edge-hi')
        lit.current.push(el)
      }
    }
  }
  return { light, clear }
}

export function KybLegend({
  edges = [],
  nodes = [],
  nodeById = {},
  rootRef
}: {
  /** the drawn world's edges — powers hover-a-row → light those lines */
  edges?: readonly KybEdge[]
  /** the drawn world's nodes — the Nodes rows list the kinds present */
  nodes?: readonly KybNode[]
  nodeById?: Record<string, KybNode>
  /** the canvas the lines live in */
  rootRef?: RefObject<HTMLElement | null>
}) {
  const [open, setOpen] = useState(false)
  const { light, clear } = useRowLight(edges, rootRef)

  const kinds = useMemo(() => {
    const present = new Set(nodes.map(n => n.bundle?.memberKind ?? n.kind))
    return KIND_ORDER.filter(k => present.has(k))
  }, [nodes])

  // which lines each row describes, by the SAME resolution the paint uses
  // (a hub tie renders as context whatever its kind, so it matches only there)
  const rowIds = useMemo(() => {
    const ids = new Map<string, string[]>()
    const push = (key: string, id: string) => {
      const list = ids.get(key)
      if (list) list.push(id)
      else ids.set(key, [id])
    }
    for (const e of edges) {
      if (nodeById[e.from]?.hub || nodeById[e.to]?.hub) {
        push('source:context', e.id)
        continue
      }
      push(e.unconfirmed ? 'source:unconfirmed' : 'source:confirmed', e.id)
      push(`strength:${strengthTier(e.evidence?.length ?? 1)}`, e.id)
    }
    return ids
  }, [edges, nodeById])

  /** a row that lights its lines on the map — quiet hover wash, no cursor
   *  change (it's a lens, not a control) */
  const LightRow = ({ rowKey, children }: { rowKey: string; children: ReactNode }) => (
    <div
      className="-mx-1.5 flex min-h-5 items-center gap-2 rounded-control px-1.5 hover:bg-[var(--core-color-state-hover-bg)]"
      onMouseEnter={() => light(rowIds.get(rowKey))}
      onMouseLeave={clear}
    >
      {children}
    </div>
  )

  return (
    <div className="pointer-events-none absolute bottom-3.5 left-3.5 top-3.5 z-[5] flex flex-col items-start [&>*]:pointer-events-auto">
      {!open ? (
        <IconActionButton
          aria-label="Show the graph key"
          className="!rounded-full"
          size="compact"
          variant="secondary"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">?</span>
        </IconActionButton>
      ) : (
        <div
          role="group"
          aria-label="Graph key"
          // the card fits the canvas it floats on: never taller than the map
          className="max-h-full w-[232px] overflow-y-auto rounded-popover border border-[var(--core-color-border-default)] bg-[var(--core-color-surface-default)] px-3.5 pb-3.5 pt-3 text-caption text-[var(--core-color-text-primary)] shadow-elevation-popover"
        >
          <div className="mb-0.5 flex items-center justify-between font-semibold">
            <span>Key</span>
            <IconActionButton
              aria-label="Hide the graph key"
              size="compact"
              variant="quiet"
              onClick={() => {
                clear()
                setOpen(false)
              }}
            >
              <X aria-hidden="true" size={14} strokeWidth={1.75} />
            </IconActionButton>
          </div>

          <Label>Nodes</Label>
          {kinds.map(kind => (
            <Row key={kind}>
              <span
                aria-hidden="true"
                className="size-2.5 flex-none rounded-full"
                style={{ background: KIND[kind].ink }}
              />
              <span>{KIND_NOUN[kind]}</span>
            </Row>
          ))}

          <Label>Sources</Label>
          {SOURCE_ROWS.map(row => (
            <LightRow key={row.key} rowKey={`source:${row.key}`}>
              <Sample dash={row.dash} ink={row.ink} width={row.width} />
              <span>{row.label}</span>
            </LightRow>
          ))}

          <Label>Source strength</Label>
          {STRENGTH_ROWS.map(([tier, label]) => (
            <LightRow key={tier} rowKey={`strength:${tier}`}>
              <Sample ink={EDGE_INK.control} width={STRENGTH_WIDTH[tier]} />
              <span>{label}</span>
            </LightRow>
          ))}

          <Label>Keys</Label>
          <div className="flex flex-col gap-1 text-[var(--core-color-text-secondary)]">
            <span>
              <Kbd>Click</Kbd> travel
            </span>
            <span>
              <Kbd>Hover</Kbd> peek
            </span>
            <span>
              <Kbd>Esc</Kbd> home
            </span>
            <span>
              <Kbd>←</Kbd> <Kbd>→</Kbd> history
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
