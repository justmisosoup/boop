import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { AlbersUsa } from '@visx/geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

import type { MetaChipTone } from '@/core'

import { STATE_NAMES } from '../../lib/states'
import { cn } from '../../utils/twUtils'

const WIDTH = 960
const HEIGHT = 560
/** Room right of the coast for the small states' pins. */
const MAP_RIGHT = 850
/** States too small to click on the map: each gets a pin off the coast, north to south. */
const SMALL = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']
const PIN_X = 900
const PIN_TOP = 130
const PIN_STEP = 30

type StatesTopology = Topology<{ states: GeometryCollection<{ name: string }> }>
type StateFeature = ReturnType<typeof statesOf>[number]

const CODE_BY_NAME = new Map(Object.entries(STATE_NAMES).map(([code, name]) => [name, code]))

const statesOf = (topology: StatesTopology) => feature(topology, topology.objects.states).features

/** Every state as one object to fit the projection to. d3 fits a collection as
 *  readily as a feature; the visx prop is typed for the feature alone. */
const allStates = (states: StateFeature[]) =>
  ({ type: 'FeatureCollection', features: states }) as unknown as StateFeature

// The US Census state shapes (us-atlas, copied to `public/`), fetched once.
let cachedStates: StateFeature[] | null = null

/** A filed state, as the map needs it. */
export type MappedFiling = {
  state: string
  tone: MetaChipTone
  label: string
  tooltip: ReactNode
}

const fillOf = (tone: MetaChipTone, on: boolean) =>
  on ? `var(--core-color-status-${tone}-fg)` : `var(--core-color-status-${tone}-bg)`

/** A city registration, as a pin on its state. */
export type CityPin = {
  key: string
  state: string
  /** The city, [longitude, latitude]; without it the pin stands on the state's centre. */
  lngLat?: [number, number]
  tone: MetaChipTone
  label: string
  tooltip: ReactNode
  open: boolean
  onPick: () => void
}

/** Lucide's map pin, 24 units square, its point at (12, 22). */
const PIN_PATH =
  'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'

/**
 * The state filings on a map of the country, each state in its own shape and
 * its filing's tone; the open one drawn solid. States too small to pick get a
 * pin off the coast, joined to the state by a line.
 */
export const StateFilingsMap = ({
  filings,
  selected,
  open,
  onPick,
  cities = []
}: {
  filings: MappedFiling[]
  selected?: string
  open: boolean
  onPick: (state: string) => void
  /** City registrations, each a pin on its state. */
  cities?: CityPin[]
}) => {
  const [states, setStates] = useState(cachedStates)

  useEffect(() => {
    if (cachedStates) return
    let active = true
    fetch('/states-10m.json')
      .then((res) => res.json() as Promise<StatesTopology>)
      .then((topology) => {
        cachedStates = statesOf(topology)
        if (active) setStates(cachedStates)
      })
      .catch(() => {
        // No shapes: the filings are still in the list and grid views.
      })
    return () => {
      active = false
    }
  }, [])

  if (!states)
    return (
      <div className="aspect-[960/560] w-full max-w-[720px] animate-pulse rounded-control bg-[var(--core-color-surface-subtle)]" />
    )

  const byState = new Map(filings.map((f) => [f.state, f]))
  const onKey = (e: KeyboardEvent, state: string) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onPick(state)
  }
  const interactive = (f: MappedFiling) => ({
    role: 'radio' as const,
    'aria-checked': open && selected === f.state,
    'aria-label': f.label,
    tabIndex: 0,
    onClick: () => onPick(f.state),
    onKeyDown: (e: KeyboardEvent) => onKey(e, f.state),
    className: 'cursor-pointer outline-none focus-visible:[stroke-width:2.5]'
  })
  const withTooltip = (f: { state: string; tooltip: ReactNode }, element: ReactNode, key = f.state) => (
    <RadixTooltip.Root key={key} delayDuration={200}>
      <RadixTooltip.Trigger asChild>{element}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          sideOffset={6}
          collisionPadding={10}
          className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
        >
          {f.tooltip}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  )

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="block h-auto w-full max-w-[720px]"
      role="radiogroup"
      aria-label="State filings"
    >
      <AlbersUsa<StateFeature>
        data={states}
        fitExtent={[
          [
            [8, 8],
            [MAP_RIGHT, HEIGHT - 8]
          ],
          allStates(states)
        ]}
      >
        {({ features, projection }) => {
          const small: Array<{ f: MappedFiling; centroid: [number, number] }> = []
          const centroids = new Map<string, [number, number]>()
          const shapes = features.map(({ feature: shape, path, centroid }) => {
            const code = CODE_BY_NAME.get(shape.properties?.name ?? '') ?? ''
            centroids.set(code, centroid)
            const filing = byState.get(code)
            if (filing && SMALL.includes(code)) small.push({ f: filing, centroid })
            const d = path ?? ''
            if (!filing)
              return (
                <path
                  key={code || d.slice(0, 12)}
                  d={d}
                  fill="var(--core-color-surface-subtle)"
                  stroke="var(--core-color-border-default)"
                  strokeWidth={0.75}
                />
              )
            const on = open && selected === code
            return withTooltip(
              filing,
              <path
                d={d}
                fill={fillOf(filing.tone, on)}
                stroke={`var(--core-color-status-${filing.tone}-border)`}
                strokeWidth={on ? 1.75 : 1}
                {...interactive(filing)}
              />
            )
          })
          const pins = SMALL.map((code) => small.find((s) => s.f.state === code))
            .filter((s): s is { f: MappedFiling; centroid: [number, number] } => Boolean(s))
            .map(({ f, centroid }, i) => {
              const y = PIN_TOP + i * PIN_STEP
              const on = open && selected === f.state
              return (
                <g key={`pin-${f.state}`}>
                  <line
                    x1={centroid[0]}
                    y1={centroid[1]}
                    x2={PIN_X - 18}
                    y2={y}
                    stroke="var(--core-color-border-strong)"
                    strokeWidth={0.75}
                    aria-hidden="true"
                  />
                  <circle
                    cx={centroid[0]}
                    cy={centroid[1]}
                    r={2}
                    fill="var(--core-color-text-secondary)"
                    aria-hidden="true"
                  />
                  {withTooltip(
                    f,
                    <g {...interactive(f)} className={cn(interactive(f).className)}>
                      <rect
                        x={PIN_X - 18}
                        y={y - 10}
                        width={36}
                        height={20}
                        rx={6}
                        fill={fillOf(f.tone, on)}
                        stroke={`var(--core-color-status-${f.tone}-border)`}
                        strokeWidth={on ? 1.75 : 1}
                      />
                      <text
                        x={PIN_X}
                        y={y}
                        dy="0.35em"
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill={
                          on
                            ? 'var(--core-color-surface-card)'
                            : `var(--core-color-status-${f.tone}-fg)`
                        }
                      >
                        {f.state}
                      </text>
                    </g>
                  )}
                </g>
              )
            })
          /* Each city registration, a pin standing on its city — or, for a
             city with no coordinates, on its state's centre, side by side where
             one state holds several. */
          const cityPins = cities.map((c) => {
            const onCity = c.lngLat ? (projection(c.lngLat) as [number, number] | null) : null
            const at = onCity ?? centroids.get(c.state)
            if (!at) return null
            const same = cities.filter((x) => x.state === c.state && !x.lngLat)
            const nudge = onCity ? 0 : (same.indexOf(c) - (same.length - 1) / 2) * 16
            const fg = `var(--core-color-status-${c.tone}-fg)`
            return withTooltip(
              c,
              <g
                role="button"
                aria-label={c.label}
                aria-pressed={c.open}
                tabIndex={0}
                onClick={c.onPick}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  c.onPick()
                }}
                className="cursor-pointer outline-none focus-visible:[stroke-width:2.5]"
                transform={`translate(${at[0] + nudge - 12} ${at[1] - 22})`}
              >
                <path
                  d={PIN_PATH}
                  fill={c.open ? fg : 'var(--core-color-surface-card)'}
                  stroke={fg}
                  strokeWidth={2}
                />
                <circle
                  cx={12}
                  cy={10}
                  r={3}
                  fill={c.open ? 'var(--core-color-surface-card)' : fg}
                />
              </g>,
              `city-${c.key}`
            )
          })
          return (
            <g>
              {shapes}
              {pins}
              {cityPins}
            </g>
          )
        }}
      </AlbersUsa>
    </svg>
  )
}
