import { useEffect, useId, useState, type MouseEvent } from 'react'
import { ChevronDown } from 'lucide-react'

import { ActionButton, MutedText, Text, TruncatedText } from '@/core'

import { attributesFor, type AttributeRow } from '../lib/attributes'
import type { BusinessRecord } from '../lib/deriveResults'
import type { InsightResult } from '../types'
import { cn } from '../utils/twUtils'
import { AttributeCells } from './AttributeGrid'
import { cellsFromRows } from './attributeCells'
import { Collapsible } from './Collapsible'
import { StateMark } from './StateMark'

/** One row per distinct fact: same label, value and sources collapse to one. */
const dedupe = (rows: AttributeRow[]): AttributeRow[] => {
  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = JSON.stringify(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * The display grammar (concept/assessment.md), built on @/core primitives.
 *
 *   result     — full weight, the value in the insight's own terms
 *   unknown    — marked, not coloured
 *   no result  — LIGHTER than a result. No surface fill, no chip, no status tone.
 *
 * A result carries no label: the mark and the weight say it, and labelling the
 * common case just adds noise down the list. Unknown and no result keep theirs,
 * because those are the states an analyst must not misread.
 *
 * DIVERGENCE from @/core, recorded in PARITY.md: no badge is used for state.
 *
 * The row's anatomy is the dashboard's own insight row
 * (`app/src/containers/BusinessHome/Insights/InsightRow.tsx`): a 16px status
 * column and a content column, 12px apart, 16/12 padding, the row's hover in
 * the list-item token. The dashboard's rows navigate; these open, so the
 * disclosure is the house one (`Collapsible`) rather than a link.
 */
export const InsightRow = ({
  result,
  record,
  onJumpToSource,
  negative,
  reveal,
  attributes: attributesOverride,
  onEdit,
  onRemove
}: {
  result: InsightResult
  record: BusinessRecord
  /** Set for an authored insight, whose evidence the key-based lookup in
   *  attributes.ts cannot resolve. */
  attributes?: AttributeRow[]
  /** Set for an authored insight. Built-in rows get neither — they come from
   *  the catalog and are regenerated on every dev start. */
  onEdit?: () => void
  onRemove?: () => void
  /** Follow an evidence row's source chip to that source's card in Sources.
   *  Without it a single-source chip has no destination and renders as static
   *  text — the same chip is clickable in the Attributes tab and was not here. */
  onJumpToSource?: (cardId: string) => void
  /**
   * Read as a point AGAINST the identity by the assessment score.
   *
   * Not the same as `adverse`, which is the record's own "should exist, not
   * found". This is the score's reading — `Unverified`, `Mismatch`, connections
   * found — and it is marked here so the three rows holding the number down are
   * findable in a stack of twenty that all carry the same filled dot.
   */
  negative?: boolean
  /** Opened and flashed when the sources roll-up jumps here. */
  reveal?: boolean
}) => {
  const [open, setOpen] = useState(false)
  /**
   * Followed here from a citation.
   *
   * Outlives the jump's own flash: the flash is over in a couple of seconds and
   * the row it opened is still sitting there expanded, so a reader looking up
   * from the evidence has nothing telling them which rows they were sent to.
   * Held until they close the row, which is them saying they are done with it.
   */
  const [cited, setCited] = useState(false)
  const regionId = useId()

  // Jumped to from the analysis's citations: open the evidence so the citation
  // lands on something rather than just scrolling.
  useEffect(() => {
    if (reveal) {
      setOpen(true)
      setCited(true)
    }
  }, [reveal])
  const adverse = result.reason === 'should_exist_not_found'
  const isResult = result.state === 'result'
  /**
   * Flagged: the record came back adverse, or the score read it against the
   * identity. The dashboard's convention for a flagged insight — the mark
   * takes the danger colour and the statement goes bold; the row itself is not
   * tinted. It used to be: a red wash over the whole row, which made three
   * findings in a stack of twenty read as three alarms rather than three
   * sentences to read first.
   */
  const flagged = adverse || Boolean(negative)
  /*
   * Deduplicated. Two people-checks reaching the same registered agent from
   * the same filings produced the same evidence row twice, one under the
   * other; a reviewer reads a repeated row as two facts and looks for the
   * difference. Same label, same value, same sources — one row.
   */
  const attributes = dedupe(attributesOverride ?? attributesFor(result.insightId, record))

  // The source's message earns a line only when it says something the statement
  // does not. On a no result the statement often already carries the reason.
  const norm = (t?: string) => (t ?? '').trim().replace(/[.\s]+$/, '').toLowerCase()
  const because = norm(result.because) === norm(result.statement) ? undefined : result.because

  /**
   * Whether the reason earns a second line in the COLLAPSED row.
   *
   * It used to show on every no-result row, which is how a row reached 145px in
   * a 392px column. The disclosure is where "why" belongs — except on an adverse
   * row, where the reason is the finding and burying it behind a chevron hides
   * the thing the panel exists to surface.
   */
  const showBecause = Boolean(!isResult && because && (adverse || open))

  const cells = cellsFromRows(attributes, {
    domesticState: record.formation?.state,
    onJumpToSource,
    // The reading this check is making — a property type, a count of
    // businesses at an address — is the finding here and nowhere else.
    evidence: true
  })
  // "Produced by …" is not rendered. It is the same sentence under every
  // insight — the Order packages a check needs — so on a page of 35 it was 35
  // copies of one fact about our plumbing, in the slot where the evidence for
  // THIS business goes. It stays on `result.evidence`, which is what the
  // assessment layer reads, so nothing downstream loses it.

  /** A row with nothing behind it does not pretend to open. */
  const expandable = cells.length > 0

  const toggle = () =>
    setOpen((v) => {
      if (v) setCited(false)
      return !v
    })

  /**
   * The whole row opens it, the dashboard's way.
   *
   * `InsightsPanel` puts the click on the row and lets it through unless it
   * landed on a control of its own. Here the controls that keep their clicks
   * are the row's actions (Edit, Remove) and anything inside the evidence —
   * a source chip in an open band must not close the band it is in. The
   * statement is not a control: `TruncatedText` wraps it in a tooltip trigger
   * when it clips, and that trigger is a `<button>`, which is why the header is
   * not a button itself — a button in a button is invalid HTML.
   */
  const delegateClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('[data-row-actions], [data-evidence]')) return
    toggle()
  }

  const statement = open ? (
    <span className={cn('block text-sm leading-5', !isResult && 'text-text-secondary', flagged && 'font-semibold')}>
      {result.statement}
    </span>
  ) : (
    /* One line while collapsed. A statement wrapping to four lines is what made
       this column unscannable; `TruncatedText` clips it and puts the full
       sentence in a tooltip, but only when it actually clips. Opening the row
       gives it all the lines it wants. Same 14/20 in both states, so the row
       does not shift under the cursor as it opens. */
    <TruncatedText
      className={cn('text-sm leading-5', !isResult && 'text-muted-foreground', flagged && 'font-semibold')}
    >
      {result.statement}
    </TruncatedText>
  )

  const body = (
    <span className="min-w-0 flex-1">
      {/* The statement IS the finding — "Submitted DBA verified against a
          filing" or "…not verified against a filing" — not a check name with
          the answer on a second line. */}
      {statement}
      {/* On a result the value already carries the outcome; repeating the
          source's message under it says the same thing twice. The message
          earns its place only where the state needs explaining. */}
      {showBecause &&
        (adverse ? (
          <Text size="sm" tone="danger" className="mt-0.5">
            {because}
          </Text>
        ) : (
          <MutedText className="mt-0.5 block text-caption">{because}</MutedText>
        ))}
    </span>
  )

  return (
    <div
      id={`insight-${result.insightId}`}
      onClick={expandable ? delegateClick : undefined}
      className={cn(
        // `group`: the row's own actions are revealed by hovering it, so they
        // stop holding width in a column that has none to spare. `pt-3` only:
        // the content column carries the bottom padding, so the evidence band
        // under it can sit flush on the row's bottom edge.
        'group grid grid-cols-[16px_minmax(0,1fr)] gap-x-3 px-4 pt-3',
        'transition-colors duration-fast motion-reduce:transition-none',
        'hover:bg-[var(--core-color-list-item-hover-bg)]',
        expandable && 'cursor-pointer',
        // Two states about the reader's position, not the finding: what a
        // citation landed on, and what is open. Open, the statement line is
        // tinted `surface-subtle` so there is something saying where the row
        // the evidence belongs to begins. Mutually exclusive rather than
        // layered — two utilities on one property resolve by stylesheet
        // order, not by the order written here.
        cited
          ? 'bg-[var(--core-color-state-selected-bg)]'
          : open
            ? 'bg-[var(--core-color-surface-subtle)]'
            : 'bg-card'
      )}
    >
      {/* `h-5` is the statement line's 20px strut, so the 12px mark centres on
          the first line however far the row wraps. */}
      <span
        className={cn(
          'flex h-5 w-4 items-center justify-center',
          // The status token in its arbitrary form: this config maps no `danger`
          // colour key, so `text-danger` (which this used to be) was a no-op
          // and a flagged mark drew in the text colour.
          flagged
            ? 'text-[var(--core-color-status-danger-fg)]'
            : isResult
              ? 'text-foreground'
              : 'text-muted-foreground'
        )}
      >
        <StateMark state={result.state} />
      </span>

      <div className="flex min-w-0 items-start gap-3 pb-3">
        <span data-statement className="flex min-w-0 flex-1">
          {body}
        </span>


        {/*
          * The row's actions, which take no width until you want them.
          *
          * A button is ~110px of permanent furniture on every row; the track
          * they sit in is collapsed to zero instead: they stay in the DOM and
          * stay focusable, and `group-focus-within` opens the track when
          * tabbing reaches them. `data-row-actions` keeps their clicks from
          * opening the row.
          */}
        {(onEdit || onRemove) && (
          <div
            data-row-actions
            className={cn(
              'grid shrink-0 grid-cols-[0fr] transition-[grid-template-columns] duration-standard',
              'group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr]'
            )}
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-2 whitespace-nowrap pl-1">
                {onEdit && (
                  <ActionButton
                    aria-label="Edit this insight"
                    onClick={onEdit}
                    size="compact"
                    variant="quiet"
                    className="!h-6 !min-h-0"
                  >
                    Edit
                  </ActionButton>
                )}
                {onRemove && (
                  <ActionButton
                    aria-label="Remove this insight"
                    onClick={onRemove}
                    size="compact"
                    variant="quiet"
                    className="!h-6 !min-h-0"
                  >
                    Remove
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
        )}

        {/* The one real control on the row: it carries the disclosure's ARIA
            contract and the keyboard, and the chevron the house disclosure
            draws (`ChatThinking`): 14px, turned a quarter when closed. No
            handler of its own — its click bubbles to the row, which is what
            opens it, so pointer and keyboard take the same path. */}
        {expandable && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={regionId}
            // `h-5`: the statement line's strut, so the 14px chevron centres on
            // the first line the way the mark does — no optical nudge needed.
            className="flex h-5 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground group-hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="sr-only">{open ? 'Hide evidence' : 'Show evidence'}</span>
            <ChevronDown
              aria-hidden="true"
              size={14}
              strokeWidth={2}
              className={cn(
                'transition-transform duration-standard ease-emphasized motion-reduce:transition-none',
                !open && '-rotate-90'
              )}
            />
          </button>
        )}
      </div>

      {/* The evidence, in the same cells as everything else the report states,
          bled to the row's edges (`-mx-4`, across both columns) and set on the
          inset surface under a hairline — a band inside the row, not a second
          card. The cells hang a pixel past the band (`-mb-px`) so the last
          row's dashed rule is clipped and the next row's hairline is the only
          line between them. */}
      {expandable && (
        <div data-evidence className="col-span-2 -mx-4 cursor-auto">
          <Collapsible id={regionId} open={open}>
            <div className="overflow-hidden border-t border-[var(--core-color-border-divider)] bg-[var(--core-color-surface-inset)]">
              <AttributeCells items={cells} className="-mb-px" />
            </div>
          </Collapsible>
        </div>
      )}
    </div>
  )
}
