import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { AlbersUsa } from '@visx/geo'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'

import { ActionButton, type MetaChipTone } from '@/core'

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
  /** The city, and the location's own address: several locations in one city share a pin. */
  city: string
  address?: string
  /** Open (a live registration) rather than closed. */
  active: boolean
  /** Each distinct address the registration covers — one registration can
   *  span several — with its point, where there is one, and whether it is open. */
  places?: Array<{ address: string; point?: [number, number]; active: boolean }>
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
  zoom: zoomProp,
  onZoom,
  cities = []
}: {
  /** The city zoomed into, by `state|city`, or none — held by the caller, so
   *  the list beside can follow it and back it out. */
  zoom?: string | null
  onZoom?: (city: string | null) => void
  filings: MappedFiling[]
  selected?: string
  open: boolean
  onPick: (state: string) => void
  /** City registrations, each a pin on its state. */
  cities?: CityPin[]
}) => {
  const [states, setStates] = useState(cachedStates)
  /** A city zoomed into, by `state|city`: its locations on a street map. */
  const [zoomState, setZoomRaw] = useState<string | null>(null)
  const zoom = zoomProp !== undefined ? zoomProp : zoomState
  const setZoom = (next: string | null) => {
    setZoomRaw(next)
    onZoom?.(next)
  }

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

  const zoomed = zoom ? cities.filter((c) => `${c.state}|${c.city}` === zoom) : []
  if (zoomed.length) return <CityZoom locations={zoomed} onBack={() => setZoom(null)} />

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
          // A filed state big enough to hold its code carries it on its shape;
          // the small ones have it on their pin off the coast.
          const codes: Array<{ code: string; at: [number, number]; tone: MetaChipTone; on: boolean }> = []
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
            if (!SMALL.includes(code)) codes.push({ code, at: centroid, tone: filing.tone, on })
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
          /* Each city's registrations, one pin standing on the city — or, for
             a city with no coordinates, on its state's centre, side by side where
             one state holds several. A city with several locations (Andytown's
             fourteen in San Francisco) is one pin, counted, with how many are
             open and how many closed beside it: every location stacked on one
             point showed only the last drawn, and one closed pin said the
             business was closed there. Its list of locations is the click. */
          const byCity = new Map<string, CityPin[]>()
          for (const c of cities) byCity.set(`${c.state}|${c.city}`, [...(byCity.get(`${c.state}|${c.city}`) ?? []), c])
          const cityGroups = [...byCity.values()]
          const cityPins = cityGroups.map((group) => {
            const c = group[0]
            const onCity = c.lngLat ? (projection(c.lngLat) as [number, number] | null) : null
            const at = onCity ?? centroids.get(c.state)
            if (!at) return null
            const same = cityGroups.filter((g) => g[0].state === c.state && !g[0].lngLat)
            const nudge = onCity ? 0 : (same.indexOf(group) - (same.length - 1) / 2) * 16
            // Counted by address: a registration can cover several locations,
            // and several registrations can share one.
            const placesOf = (pins: CityPin[]) => {
              const by = new Map<string, boolean>()
              for (const x of pins)
                for (const pl of x.places ?? [{ address: x.address ?? x.key, active: x.active }])
                  by.set(pl.address, (by.get(pl.address) ?? false) || pl.active)
              return [...by.values()]
            }
            const places = placesOf(group)
            const opened = places.filter(Boolean).length
            const closed = places.length - opened
            const tone: MetaChipTone = opened ? 'success' : 'danger'
            const fg = `var(--core-color-status-${tone}-fg)`
            const picked = group.some((x) => x.open)
            const x = at[0] + nudge - 12
            const y = at[1] - 22
            if (group.length === 1 && places.length <= 1)
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
                  transform={`translate(${x} ${y})`}
                >
                  {/* A white halo, so the pin reads on a state filled in its own tone. */}
                  <path d={PIN_PATH} fill="none" stroke="var(--core-color-surface-card)" strokeWidth={5} />
                  <path d={PIN_PATH} fill={c.open ? fg : 'var(--core-color-surface-card)'} stroke={fg} strokeWidth={2} />
                  <circle cx={12} cy={10} r={3} fill={c.open ? 'var(--core-color-surface-card)' : fg} />
                </g>,
                `city-${c.key}`
              )
            const split = [opened && `${opened} active`, closed && `${closed} inactive`].filter(Boolean).join(' · ')
            const zoomTo = () => setZoom(`${c.state}|${c.city}`)
            const onSelected = open && selected === c.state
            // Several locations: one pin, counted; the split is its hover, and
            // a click zooms into the city to show each location.
            return withTooltip(
              {
                state: c.state,
                tooltip: (
                  <span className="flex flex-col gap-0.5">
                    <span className="font-semibold">
                      {c.city} · {places.length} locations
                    </span>
                    <span>{split}</span>
                    <span className="text-text-secondary">Click to see each location</span>
                  </span>
                )
              },
              <g
                role="button"
                aria-label={`City registrations, ${c.city}: ${split}. Zoom in to see each location.`}
                aria-pressed={picked}
                tabIndex={0}
                onClick={zoomTo}
                onKeyDown={(e: KeyboardEvent) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  zoomTo()
                }}
                className="cursor-pointer outline-none focus-visible:[stroke-width:2.5]"
                transform={`translate(${x} ${y})`}
              >
                <path d={PIN_PATH} fill="none" stroke="var(--core-color-surface-card)" strokeWidth={5} />
                {/* On the selected state, which is filled solid, the pin turns
                    over — white with its tone's outline — so the two stay apart. */}
                <path d={PIN_PATH} fill={onSelected ? 'var(--core-color-surface-card)' : fg} stroke={fg} strokeWidth={2} />
                <text
                  x={12}
                  y={14}
                  textAnchor="middle"
                  className={cn(
                    'text-[11px] font-semibold tabular-nums',
                    onSelected ? 'fill-[var(--core-color-text-primary)]' : 'fill-[var(--core-color-surface-card)]'
                  )}
                >
                  {places.length}
                </text>
              </g>,
              `city-${c.state}-${c.city}`
            )
          })
          return (
            <g>
              {shapes}
              <g aria-hidden="true" className="pointer-events-none">
                {codes.map(({ code, at, tone, on }) => (
                  <text
                    key={`code-${code}`}
                    x={at[0]}
                    y={at[1]}
                    dy="0.35em"
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={on ? 'var(--core-color-surface-card)' : `var(--core-color-status-${tone}-fg)`}
                  >
                    {code}
                  </text>
                ))}
              </g>
              {pins}
              {cityPins}
            </g>
          )
        }}
      </AlbersUsa>
    </svg>
  )
}

/* ---- A city, zoomed: its locations on a street map ---------------------- */

const TILE = 256
const ZOOM_W = 720
const ZOOM_H = 420
/** Web Mercator, in pixels of the whole world at zoom `z`. */
const worldPx = (lng: number, lat: number, z: number): [number, number] => {
  const size = TILE * 2 ** z
  const s = Math.sin((lat * Math.PI) / 180)
  return [((lng + 180) / 360) * size, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size]
}

/**
 * One city's registrations, each location a pin where the register puts it,
 * on Esri's light grey canvas tiles (to zoom 16), zoomed to fit them: streets
 * without OpenStreetMap's place icons. CARTO's light basemap now wants an API key.
 * Each pin is the location's details, as its row in the list is; "Show all states"
 * goes back to the country.
 */
const CityZoom = ({ locations, onBack }: { locations: CityPin[]; onBack: () => void }) => {
  // One pin per address: a registration can cover several, and registrations
  // can share one. The pin opens the registration it belongs to.
  const byAddress = new Map<string, { address: string; point?: [number, number]; active: boolean; pin: CityPin }>()
  for (const l of locations)
    for (const pl of l.places ?? [{ address: l.address ?? l.city, active: l.active }]) {
      const had = byAddress.get(pl.address)
      if (!had || (!had.active && pl.active)) byAddress.set(pl.address, { ...pl, point: pl.point ?? had?.point, pin: l })
    }
  const all = [...byAddress.values()]
  const placed = all.filter((l) => l.point)
  const unplaced = all.filter((l) => !l.point)
  // The zoom that fits every location, with room around them; a lone one at street level.
  // The band across the top kept clear for "Show all states", in map units:
  // the button is a fixed size on screen, so the narrower the map is drawn, the
  // more of it the button covers. No pin stands in that band.
  const svgRef = useRef<SVGSVGElement>(null)
  const [drawnW, setDrawnW] = useState(ZOOM_W)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setDrawnW(e.contentRect.width || ZOOM_W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const band = (56 * ZOOM_W) / Math.max(drawnW, 1)
  // A pin's point is its tip: the pin stands 24 units above it, 10 either side.
  const areaTop = band + 26
  const areaBottom = ZOOM_H - 24
  const areaW = ZOOM_W - 60
  const fits = (z: number) => {
    const px = placed.map((l) => worldPx(l.point![0], l.point![1], z))
    const xs = px.map((p) => p[0])
    const ys = px.map((p) => p[1])
    return Math.max(...xs) - Math.min(...xs) <= areaW && Math.max(...ys) - Math.min(...ys) <= areaBottom - areaTop
  }
  let z = 16
  while (z > 9 && placed.length > 1 && !fits(z)) z--
  const pts = placed.map((l) => worldPx(l.point![0], l.point![1], z))
  const cx = pts.length ? (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2 : 0
  const cy = pts.length ? (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2 : 0
  // Centred in the area under the band, not the whole map.
  const left = cx - ZOOM_W / 2
  const top = cy - (areaTop + areaBottom) / 2
  const tiles: Array<{ x: number; y: number }> = []
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + ZOOM_W) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + ZOOM_H) / TILE); ty++) tiles.push({ x: tx, y: ty })
  const city = locations[0].city

  return (
    <div className="relative flex w-full max-w-[720px] flex-col gap-2">
      {/* The way back, over the map's top-left corner. */}
      <ActionButton
        className="absolute left-3 top-3 shadow-elevation-card"
        onClick={onBack}
        size="compact"
        type="button"
        variant="secondary"
      >
        Show all states
      </ActionButton>
      <svg
        ref={svgRef}
        aria-label={`${city} registration locations`}
        className="block h-auto w-full overflow-hidden rounded-control border border-border bg-[var(--core-color-surface-subtle)]"
        role="group"
        viewBox={`0 0 ${ZOOM_W} ${ZOOM_H}`}
      >
        {/* Esri's light grey canvas: streets and their names, no places of
            worship, theatres or shops drawn on it — the pins carry the colour. */}
        <g>
          {tiles.map(({ x, y }) => (
            <image
              key={`${x}-${y}`}
              height={TILE}
              href={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`}
              width={TILE}
              x={x * TILE - left}
              y={y * TILE - top}
            />
          ))}
        </g>
        {placed.map((l, i) => {
          const tone: MetaChipTone = l.active ? 'success' : 'danger'
          const fg = `var(--core-color-status-${tone}-fg)`
          const [px, py] = pts[i]
          return (
            <RadixTooltip.Root key={l.address} delayDuration={150}>
              <RadixTooltip.Trigger asChild>
                <g
                  aria-label={`${l.address}: ${l.active ? 'active' : 'inactive'}`}
                  aria-pressed={l.pin.open}
                  className="cursor-pointer outline-none focus-visible:[stroke-width:2.5]"
                  onClick={l.pin.onPick}
                  onKeyDown={(e: KeyboardEvent) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    l.pin.onPick()
                  }}
                  role="button"
                  tabIndex={0}
                  transform={`translate(${px - left - 12} ${py - top - 22})`}
                >
                  <path d={PIN_PATH} fill={l.pin.open ? fg : 'var(--core-color-surface-card)'} stroke={fg} strokeWidth={2} />
                  <circle cx={12} cy={10} fill={l.pin.open ? 'var(--core-color-surface-card)' : fg} r={3} />
                </g>
              </RadixTooltip.Trigger>
              <RadixTooltip.Portal>
                <RadixTooltip.Content
                  className="core-theme z-popover max-w-64 rounded-popover border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-elevation-popover"
                  side="top"
                  sideOffset={6}
                >
                  <span className="block font-semibold">{l.address}</span>
                  <span>{l.active ? 'Active' : 'Inactive'}</span>
                </RadixTooltip.Content>
              </RadixTooltip.Portal>
            </RadixTooltip.Root>
          )
        })}
        <text className="fill-[var(--core-color-text-secondary)] text-[10px]" textAnchor="end" x={ZOOM_W - 6} y={ZOOM_H - 6}>
          © Esri, HERE, Garmin, OpenStreetMap contributors
        </text>
      </svg>
      {unplaced.length > 0 && (
        <span className="text-caption text-text-secondary">
          {unplaced.length} location{unplaced.length > 1 ? 's have' : ' has'} no point on the register.
        </span>
      )}
    </div>
  )
}
