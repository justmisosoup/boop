import { useEffect, useState } from 'react'

import { ActionButton, MutedText, Tag, Text, TruncatedText } from '@/core'

import { attributesFor, type AttributeRow } from '../lib/attributes'
import type { BusinessRecord } from '../lib/deriveResults'
import type { InsightResult } from '../types'
import { AttributeSources, SubmittedChip } from './AttributesTab'
import { StateMark } from './StateMark'

/** Colour follows the provider's confidence, not our reading of it. */
const RISK_TONE: Record<string, 'subtle' | 'warning' | 'danger'> = {
  'Low risk': 'subtle',
  'Moderate risk': 'warning',
  'High risk': 'danger'
}

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
  onAddToAnalysis,
  onJumpToSource,
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
  onAddToAnalysis?: () => void
  /** Follow an evidence row's source chip to that source's card in Sources.
   *  Without it a single-source chip has no destination and renders as static
   *  text — the same chip is clickable in the Attributes tab and was not here. */
  onJumpToSource?: (cardId: string) => void
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

  /**
   * The order requirement, lifted out of `evidence`.
   *
   * It is carried there so the assessment layer sees it too, but in the row it
   * belongs at the end rather than interleaved with the attributes the check
   * actually read.
   */
  const producedBy = (result.evidence ?? []).find(
    (e) => e.startsWith('Requires Order package:') || e.startsWith('Produced by a signal')
  )

  return (
    <div
      id={`insight-${result.insightId}`}
      className={[
        // `group`: the row's own actions are revealed by hovering it, so they
        // stop holding width in a column that has none to spare.
        'group border-l-2 border-solid px-4 py-1.5 transition-colors',
        // Mutually exclusive rather than layered: two utilities setting the same
        // property are resolved by stylesheet order, not by the order they are
        // written here, so an override that merely comes later is a coin toss.
        cited
          ? 'border-l-[var(--core-color-state-selected-border)] bg-[var(--core-color-state-selected-bg)]'
          : isResult
            ? 'border-l-border bg-card'
            : adverse
              ? 'border-l-[var(--core-color-status-danger-border)] bg-[var(--core-color-status-danger-bg)]'
              : 'border-l-transparent bg-transparent'
      ].join(' ')}
    >
      <div className={['flex gap-3', hasSubtext ? 'items-start' : 'items-center'].join(' ')}>
        <span
          className={
            adverse ? 'text-danger' : isResult ? 'text-foreground' : 'text-muted-foreground'
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
          {open ? (
            <Text tone={isResult ? 'primary' : 'secondary'}>{result.statement}</Text>
          ) : (
            <TruncatedText
              className={isResult ? 'text-sm' : 'text-sm text-muted-foreground'}
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
            * "Add to analysis" is ~110px of permanent furniture on every
            * unused row; beside a Signal chip it left the statement about
            * 150px to wrap into, which is how a one-sentence row reached four
            * lines. Hiding them outright would take them off the keyboard, so
            * the track they sit in is collapsed to zero instead: the buttons
            * stay in the DOM and stay focusable, and `group-focus-within`
            * opens the track when tabbing reaches them.
            */}
          {(onEdit || onRemove || onAddToAnalysis) && (
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
                  {onAddToAnalysis && (
                    <ActionButton
                      variant="quiet"
                      size="compact"
                      onClick={onAddToAnalysis}
                      className="!h-6 !min-h-0"
                    >
                      Add to analysis
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
            <svg
              viewBox="0 0 12 12"
              aria-hidden="true"
              className={['h-3 w-3 transition-transform duration-200', open ? 'rotate-180' : ''].join(
                ' '
              )}
              fill="none"
            >
              <path
                d="M3 4.5 6 7.5 9 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <ul className="ml-6 mt-2 space-y-1.5 border-l border-solid border-border pl-3">
          {attributes.map((a: AttributeRow, i) => (
            // Detail sits UNDER the row it supports, indented and quiet. Flat,
            // fourteen articles read as fourteen findings and the four names
            // they belong to disappeared into them. The label goes too — the
            // indent already says what these are, and "Article" fourteen times
            // is the loudest thing in the list.
            <li
              key={`${a.label}-${i}`}
              className={
                a.detail
                  ? 'ml-4 flex flex-wrap items-baseline gap-x-2 border-l border-solid border-border pl-3'
                  : 'mt-2 flex flex-wrap items-baseline gap-x-2 first:mt-0'
              }
            >
              {!a.detail && (
                <MutedText className="text-caption font-semibold">{a.label}</MutedText>
              )}
              {a.lead && (
                <MutedText className="text-caption tabular-nums">{a.lead}</MutedText>
              )}
              {a.value &&
                (a.href ? (
                  <a
                    href={a.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs leading-4 underline decoration-[var(--core-color-border-strong)] underline-offset-2 hover:decoration-current"
                  >
                    {a.value}
                  </a>
                ) : (
                  <Text size="xs">{a.value}</Text>
                ))}
              {/* A reading OF the value, immediately after it — a case's status
                  and filing date, how a lien stands. Same placement as the
                  Attributes tab. Without it ten court records read as ten
                  identical rows when half are open and half are closed. */}
              {a.qualifier && (
                <MutedText className="text-caption">{a.qualifier}</MutedText>
              )}
              {/* Whether the customer gave us this value or we found it. An
                  address list where seven are ours and two are theirs reads as
                  one undifferentiated list without it, and which is which is
                  what the check turns on. */}
              {a.submitted && <SubmittedChip />}
              {/* Our reading of the value — a property type, how many
                  businesses share the address. Here rather than in Attributes:
                  no source stated it, and judging the address is what the
                  insight is for. */}
              {a.evidenceNote && (
                <MutedText className="text-caption">· {a.evidenceNote}</MutedText>
              )}
              {/* The provider's rating of what it found, beside the finding.
                  Without it "Kyle Mack" reads the same whether the flags came
                  back low or high. */}
              {a.trailing &&
                (RISK_TONE[a.trailing] ? (
                  <Tag tone={RISK_TONE[a.trailing]} size="compact">
                    {a.trailing}
                  </Tag>
                ) : (
                  <MutedText className="w-full text-caption">{a.trailing}</MutedText>
                ))}
              {/* Every article behind this name, in one chip. Listed as rows
                  instead, nine headlines pushed the four names being screened
                  off the top of the list — and the name is what is being
                  judged, not the article. */}
              {/* The same chip the Attributes tab shows, so an insight cites
                  what the attribute cites. Rendering only `registrations` here
                  dropped every other attestation: a legal name on six records
                  read as one, because five of them were not filings. */}
              <AttributeSources
                sources={a.sources ?? (a.source ? [a.source] : [])}
                links={a.links}
                registrations={a.registrations}
                domesticState={record.formation?.state}
                href={a.href}
                note={a.sourceNote}
                title={a.sourceTitle}
                label={a.label}
                onJumpToSource={onJumpToSource}
              />
            </li>
          ))}

          {/* What had to be ordered for this check to run.
              Last, and quiet: it is the same fact for every insight and says
              nothing about this business — but for a check that returned
              nothing it is the only actionable thing on the row, because
              ordering the package is what closes it. */}
          {producedBy && (
            <li className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <MutedText className="text-caption font-semibold">Produced by</MutedText>
              <MutedText className="text-caption">{producedBy}</MutedText>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
