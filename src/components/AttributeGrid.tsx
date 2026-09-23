import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { Hint, Surface, Text } from '@/core'

import { cn } from '../utils/twUtils'
import { CardHeader } from './CardHeader'

/** One fact under a cell's label. */
export type AttributeValue = {
  /** Stable identity, where the value is not unique on its own. */
  key?: string
  /**
   * An identifier in a column of its own — "7389" beside the industry it names.
   *
   * One width, defined here. Two files used to set their own (`w-16` in the
   * Attributes tab, `w-44` in Sources) for the same industry codes, so the same
   * row read differently depending on which tab you were looking at.
   */
  lead?: string
  value: ReactNode
  /** A reading OF the value, set immediately after it: "4 years old". */
  qualifier?: string
  /** Under this value: the provenance chips, a risk tag, where it came from. */
  note?: ReactNode
}

export type AttributeCell = {
  /** Stable identity, where the label and values are not unique on their own. */
  key?: string
  /** Absent where the value names itself — a business, rather than a field. */
  label?: string
  /**
   * The label, drawn by the caller.
   *
   * For a cell whose label is a heading rather than a field name — the
   * assessments on the score card, which name a section of the report. `label`
   * is still set beside it: it is what the cell is keyed and read by.
   */
  labelNode?: ReactNode
  /**
   * The facts this label names.
   *
   * One is the ordinary case. Several where the label heads a run — three
   * addresses on one filing, four codes in one scheme — because a label
   * repeated down a column reads as several separate facts rather than as one
   * fact with several values.
   */
  values: AttributeValue[]
  /** A note for the cell rather than for any one value. */
  note?: ReactNode
  /**
   * Beside the label: what the cell's values are, as a whole.
   *
   * Where the reader can act on it — the tabs, where a submitted value cites
   * the claim it came from — this is a chip carrying its own mark. On the
   * identity card, which has no chips at all, `submitted`/`verified` draw the
   * mark alone.
   */
  badge?: ReactNode
  /**
   * The customer gave us this value, and whether a source of record agreed.
   *
   * Both together are a tick; submitted with nothing corroborating it is a
   * bang. A value we merely hold is neither: it is the ordinary case, it was
   * never claimed by anyone, and a page where most things carry a mark says
   * less than a page where two do.
   */
  submitted?: boolean
  verified?: boolean
  /** The cell takes the whole row: a URL, a statement, a run of values. */
  span?: 'full'
  /**
   * Makes the cell a button. Without it the cell is a plain block.
   *
   * Never set on a cell whose note holds chips — the chips are buttons and
   * links themselves, and nesting them inside this one swallows their clicks
   * silently rather than failing.
   */
  onSelect?: () => void
}

/** The ordinary cell — one label, one value — without writing `values` out. */
export const cell = (
  label: string | undefined,
  value: ReactNode,
  rest?: Omit<Partial<AttributeCell>, 'values'>
): AttributeCell => ({ label, values: [{ value }], ...rest })

/**
 * Which cells take a whole row.
 *
 * A cell spans when it asks to, and a cell at the start of a row spans when
 * nothing can sit beside it — because it is the last, or because the next cell
 * takes a row of its own. A blank half-cell in a card of facts reads as a fact
 * we are missing rather than as a row that ran out.
 *
 * Counted over a running column rather than by `length % 2`, which one `span`
 * in the middle throws out by one for everything after it.
 */
const spans = (items: AttributeCell[]) => {
  const out: boolean[] = []
  let col = 0
  items.forEach((item, i) => {
    const alone = col === 0 && (i === items.length - 1 || items[i + 1].span === 'full')
    const full = item.span === 'full' || alone
    out.push(full)
    col = full ? 0 : col === 0 ? 1 : 0
  })
  return out
}

const Mark = ({ verified }: { verified?: boolean }) => {
  const what = verified ? 'Submitted, verified' : 'Submitted, not verified'

  return (
    /* No colour on either mark. Green and amber would rank these cells against
       the ones beside them, and the report does not grade values — the glyph
       says which of the two things happened, and the hint spells it out.
       `asChild`, because a cell that jumps is already a button and
       `HintTrigger` would put a second one inside it. */
    <Hint asChild content={what} side="top" size="compact">
      <span role="img" aria-label={what} className="inline-flex shrink-0 text-text-secondary">
        {verified ? (
          <CircleCheck aria-hidden="true" className="size-3.5" />
        ) : (
          <CircleAlert aria-hidden="true" className="size-3.5" />
        )}
      </span>
    </Hint>
  )
}

/** The quiet line under a value. A `span` rather than `MutedText`, which is a
 *  `<p>` — the note carries source chips, and one day a tag or a thumbnail. */
const Note = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('mt-1 block text-caption leading-snug text-muted-foreground', className)}>
    {children}
  </span>
)

const CellBody = ({ item }: { item: AttributeCell }) => (
  <>
    {item.label && (
      <span className="flex items-center gap-1">
        {item.labelNode ?? (
          <Text tone="secondary" size="sm" className="leading-snug">
            {item.label}
          </Text>
        )}
        {item.badge ?? (item.submitted ? <Mark verified={item.verified} /> : null)}
      </span>
    )}
    {item.values.map((v, i) => (
      <span key={v.key ?? `${i}`} className={cn('block', (item.label || i > 0) && 'mt-0.5')}>
        <span className="flex gap-2">
          {v.lead !== undefined && (
            <span className="w-14 shrink-0 break-words text-sm leading-snug tabular-nums">
              {v.lead}
            </span>
          )}
          <span className="min-w-0 flex-1 break-words text-sm leading-snug [overflow-wrap:anywhere]">
            {v.value}
            {/* Same type as the value it qualifies: "June 13, 2022 (4 years, 3
                months old)" is one statement, and setting the second half
                smaller and greyer made it read as a footnote on a number. The
                parentheses already say which half is the reading. */}
            {v.qualifier && <span className="ml-1">{v.qualifier}</span>}
          </span>
        </span>
        {v.note && <Note className={v.lead !== undefined ? 'pl-16' : undefined}>{v.note}</Note>}
      </span>
    ))}
    {item.note && <Note>{item.note}</Note>}
  </>
)

/**
 * Attributes in cells, two to a row.
 *
 * The rules between the cells are dashed and cross at the corners —
 * `.attribute-cell` in `theme.css` paints them, because no border style draws a
 * 4px dash against a 4px gap.
 *
 * The cells run a pixel wider than the card they sit in (`-mr-px`) so the last
 * column's rules hang outside and the card's `overflow-hidden` clips them.
 * `-mb-px` does the same for the last row, but it belongs to the caller: a grid
 * stacked above another band inside a card needs its last rule as the
 * separator, while the last grid in a card must hang it outside.
 *
 * One attribute runs the full width; the split starts at two.
 */
export const AttributeCells = ({
  items,
  className
}: {
  items: AttributeCell[]
  className?: string
}) => {
  if (items.length === 0) return null
  const wide = spans(items)

  return (
    <div className={cn('-mr-px grid', items.length > 1 && 'sm:grid-cols-2', className)}>
      {items.map((item, i) => {
        const key = item.key ?? `${item.label ?? ''}-${i}`
        const cls = cn('attribute-cell p-4', wide[i] && 'sm:col-span-2')

        return item.onSelect ? (
          <button
            key={key}
            type="button"
            onClick={item.onSelect}
            className={cn(
              cls,
              'text-left transition-colors hover:bg-[var(--core-color-state-hover-bg)]'
            )}
          >
            <CellBody item={item} />
          </button>
        ) : (
          <div key={key} className={cls}>
            <CellBody item={item} />
          </div>
        )
      })}
    </div>
  )
}

/** The cells in a card of their own: the card surface and radius, the default
 *  border — the same frame every other stack on the report sits in. It was a
 *  hard square in graphite. */
export const AttributeGrid = ({
  items,
  title,
  trailing,
  className
}: {
  items: AttributeCell[]
  /** The card's own name, in a header row inside it (see `CardHeader`). */
  title?: ReactNode
  trailing?: ReactNode
  className?: string
}) => {
  if (items.length === 0) return null

  return (
    <Surface variant="card" padding="none" className={cn('overflow-hidden', className)}>
      {title && <CardHeader title={title} trailing={trailing} />}
      <AttributeCells items={items} className="-mb-px" />
    </Surface>
  )
}
