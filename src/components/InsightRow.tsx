import { useEffect, useState } from 'react'

import { ActionButton, MutedText, Text, TruncatedText } from '@/core'

import { attributesFor, type AttributeRow } from '../lib/attributes'
import type { BusinessRecord } from '../lib/deriveResults'
import type { InsightResult } from '../types'
import { AttributeCells, cell } from './AttributeGrid'
import { cellsFromRows } from './attributeCells'
import { DisclosureChevron } from './DisclosureChevron'
import { StateMark } from './StateMark'

/**
 * The display grammar (concept/assessment.md), built on @/core primitives.
 *
 *   result     — card surface, full weight, the value in the insight's own terms
 *   unknown    — marked, not coloured
 *   no result  — LIGHTER than a result. No surface fill, no chip, no status tone.
 *
 * A result carries no label: the mark and the weight say it, and labelling the
 * common case just adds noise down the list. Unknown and no result keep theirs,
 * because those are the states an analyst must not misread.
 *
 * DIVERGENCE from @/core, recorded in PARITY.md: no badge is used for state.
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
  /** Offered once an analysis exists, on rows it did not use. */
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
  const attributes = attributesOverride ?? attributesFor(result.insightId, record)

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

  // A single-line row centres in the card; once there is a line of sub-text the
  // row grows and everything aligns to the top instead.
  const hasSubtext = showBecause

  const cells = [
    ...cellsFromRows(attributes, {
      domesticState: record.formation?.state,
      onJumpToSource,
      // The reading this check is making — a property type, a count of
      // businesses at an address — is the finding here and nowhere else.
      evidence: true
    }),
    // "Produced by …" is not rendered. It is the same sentence under every
    // insight — the Order packages a check needs — so on a page of 35 it was 35
    // copies of one fact about our plumbing, in the slot where the evidence for
    // THIS business goes. It stays on `result.evidence`, which is what the
    // assessment layer reads, so nothing downstream loses it.
  ]

  return (
    <div
      id={`insight-${result.insightId}`}
      className={[
        // `group`: the row's own actions are revealed by hovering it, so they
        // stop holding width in a column that has none to spare.
        // Solid divider, not the dashed one the attribute lists use — see
        // `.insight-row` in theme.css.
        'insight-row group px-4 py-3 transition-colors',
        // No left bar. It said what the mark at the head of the row already
        // says — result, no result, adverse — in a second vocabulary, and on a
        // card whose own frame is a hard graphite rule it read as a fourth
        // edge. The background still carries the two states that are about the
        // reader's position rather than the finding: what a citation landed on,
        // and what came back adverse.
        //
        // Mutually exclusive rather than layered: two utilities setting the same
        // property are resolved by stylesheet order, not by the order they are
        // written here, so an override that merely comes later is a coin toss.
        // Open, the statement line is tinted: `surface-subtle`, the system's
        // own soft grey. A row that has been opened is a row the reader is
        // working in, and with the evidence bled to the card's edges there was
        // nothing saying where the row it belongs to begins. The evidence keeps
        // the card colour below, so the tint reads as the header of what is
        // open rather than as a highlight over the whole thing.
        cited
          ? 'bg-[var(--core-color-state-selected-bg)]'
          : open
            ? 'bg-[var(--core-color-surface-subtle)]'
            : negative
              ? 'bg-[var(--core-color-status-danger-bg)]'
              : isResult
              ? 'bg-card'
              : adverse
                ? 'bg-[var(--core-color-status-danger-bg)]'
                : 'bg-transparent'
      ].join(' ')}
    >
      <div className={['flex gap-3', hasSubtext ? 'items-start' : 'items-center'].join(' ')}>
        <span
          className={
            adverse || negative
              ? 'text-danger'
              : isResult
                ? 'text-foreground'
                : 'text-muted-foreground'
          }
        >
          <StateMark state={result.state} className={hasSubtext ? 'mt-[7px]' : ''} />
        </span>

        <div className="min-w-0 flex-1">
          {/* The statement IS the finding — "Submitted DBA verified against a
              filing" or "…not verified against a filing" — not a check name
              with the answer on a second line. */}
          {/* One line while collapsed. A statement wrapping to four lines is
              what made this column unscannable; `TruncatedText` clips it and
              puts the full sentence in a tooltip, but only when it actually
              clips. Opening the row gives it all the lines it wants. */}
          {/* The grid's value type, in both states. They were 14/20 collapsed
              and 14/24 open, so a row shifted under the cursor as it opened. */}
          {open ? (
            <span
              className={[
                'block text-sm leading-snug',
                isResult ? '' : 'text-text-secondary'
              ].join(' ')}
            >
              {result.statement}
            </span>
          ) : (
            <TruncatedText
              className={
                isResult ? 'text-sm leading-snug' : 'text-sm leading-snug text-muted-foreground'
              }
            >
              {result.statement}
            </TruncatedText>
          )}

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
        </div>

        {/* Far right: the evidence disclosure.
            No state tag — the mark on the left already carries the state by
            shape, and the statement says it in words ("... could not be
            resolved"). A third copy, set in caps, was the loudest thing in a row
            whose actual content is the sentence. */}
        <div
          className={[
            'flex shrink-0 items-center gap-2',
            hasSubtext ? 'self-start' : 'self-center'
          ].join(' ')}
        >
          {/*
            * The row's actions, which take no width until you want them.
            *
            * A button is ~110px of permanent furniture on every row; beside a
            * Signal chip it left the statement about 150px to wrap into, which
            * is how a one-sentence row reached four lines. Hiding them outright
            * would take them off the keyboard, so
            * the track they sit in is collapsed to zero instead: the buttons
            * stay in the DOM and stay focusable, and `group-focus-within`
            * opens the track when tabbing reaches them.
            */}
          {(onEdit || onRemove) && (
            <div
              className={[
                'grid grid-cols-[0fr] transition-[grid-template-columns] duration-200',
                'group-hover:grid-cols-[1fr] group-focus-within:grid-cols-[1fr]'
              ].join(' ')}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-2 whitespace-nowrap pl-1">
                  {onEdit && (
                    <ActionButton
                      aria-label="Edit this insight"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEdit()
                      }}
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
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemove()
                      }}
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
          {/*
            * A plain button, not `ActionButton`.
            *
            * The core action carries a 32px min-height and its own padding, and
            * at this density every one of those had to be fought off with an
            * `!important` — three of them, to get a 24px square. A disclosure
            * chevron is not an action button anyway: it has no label, it does
            * not act on anything, it opens the row it sits in.
            */}
          <button
            type="button"
            onClick={() =>
              setOpen((v) => {
                if (v) setCited(false)
                return !v
              })
            }
            aria-expanded={open}
            aria-label={open ? 'Hide evidence' : 'Show evidence'}
            className={[
              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              'text-muted-foreground transition-colors',
              'hover:bg-[var(--core-color-state-hover-bg)] hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-[var(--core-color-focus-ring)]'
            ].join(' ')}
          >
            {/* Colour from the button, so the row's hover still reaches it. */}
            <DisclosureChevron open={open} className="text-inherit" />
          </button>
        </div>
      </div>

      {/* The evidence, in the same cells as everything else the report states
          — bled to the card's edges so its rules line up with the rows above
          and below. It was an indented list inside the row, with a second
          indent for detail; the cell frame says both of those things without
          drawing either. */}
      {open && cells.length > 0 && (
        <div className="attribute-row-top -mx-4 -mb-3 mt-3 bg-card">
          <AttributeCells items={cells} />
        </div>
      )}
    </div>
  )
}
