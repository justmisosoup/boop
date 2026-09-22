import { useCallback, useEffect, useRef, useState } from 'react'

import { HoverCard, HoverCardContent, HoverCardTrigger, MutedText } from '@/core'

import { cn } from '../utils/twUtils'

/**
 * Where you are in the report, and a way to get somewhere else in it.
 *
 * A finished assessment runs to several screens, and the pillars are the only
 * structure in it — without a list of them the reader scrolls looking for the
 * one they want, and has no idea how much is left. It is the table of contents
 * a long document has always had.
 *
 * It sits in the margin beside the report rather than above it, so it stays
 * still while the prose moves past, and it is the contents and nothing else:
 * what the business does leads the report itself — see BusinessLede. Below the
 * breakpoint there is no margin to sit in and the rail is not rendered, so a
 * narrow window loses the jump list, not the report.
 */
/**
 * Where a heading counts as reached, in viewport coordinates.
 *
 * The report scrolls inside its own column, which starts below the fixed name
 * bar — so a heading is "current" once it has risen past the top of that column
 * plus a little, not past the top of the window.
 */
const LINE = 140

/** Within this of the foot of the scroller, the reader is in the last section
 *  — the travel has run out, not the sections. */
const BOTTOM = 8

/** The scrolling ancestor an element actually lives in — the report column. */
const scrollParent = (el: HTMLElement): HTMLElement | null => {
  let node = el.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll') return node
    node = node.parentElement
  }
  return null
}

/**
 * Which of the three states an entry is in, as a mark rather than a word.
 *
 * A ring for what has not started, a turning ring for what is being written, a
 * filled dot for what is on the page. Six labelled badges down a 224px margin
 * would be louder than the headings they annotate, and the headings are the
 * point of the list.
 */
/**
 * One mark, and it says one thing: whether this is the section you are on.
 *
 * Filled for where you are, an open ring for everywhere else — in the strip and
 * in the list the strip opens, because they are the same control at two sizes
 * and a dot that means "done" in one and "here" in the other is two
 * vocabularies for six dots. A section still running keeps its own tell: the
 * ring pulses rather than sitting still.
 */
const markClass = ({
  current,
  state
}: {
  current: boolean
  state: 'done' | 'running' | 'pending'
}) =>
  cn(
    'block shrink-0 rounded-full border border-solid transition-all duration-200',
    current
      ? 'size-2 border-foreground bg-foreground'
      : 'size-1.5 border-[var(--core-color-border-bold)]',
    state === 'running' && 'motion-safe:animate-pulse'
  )

const StateDot = ({
  state,
  current
}: {
  state: 'done' | 'running' | 'pending'
  current: boolean
}) => <span className={markClass({ current, state })} aria-hidden="true" />

export const AssessmentIndex = ({
  sections,
  present,
  steps,
  running = false
}: {
  /** The pillars in the report, in the order they are laid out. */
  sections: Array<{ id: string; heading: string }>
  /** Section ids whose prose is on the page right now. */
  present?: Set<string>
  /** What each section did, opened from the caret beside it. */
  steps?: Map<string, Array<{ label: string }>>
  /** A run is being written. What is not here yet is coming, not absent. */
  running?: boolean
}) => {
  const [here, setHere] = useState<string | null>(null)
  /**
   * Set while a click's smooth scroll is still travelling.
   *
   * `go` marks the entry you asked for, then the scroll crosses every heading
   * between here and there and the observer dutifully reported each one — so
   * clicking an entry lit up an intermediate section, then settled back. That
   * is the flicker: the spy was answering a question about where the page is
   * while the page was still moving somewhere you had already named.
   *
   * Released on the next scroll the reader starts themselves, so manual
   * scrolling takes over immediately rather than waiting out a timer.
   */
  const jumpingTo = useRef<string | null>(null)

  /**
   * How long this has been going, counting up.
   *
   * The report only ever said "Thought for 7s" — past tense, arriving with the
   * finished thing, so during the wait itself nothing on the page was moving or
   * counting. A number that advances is the difference between "this is working"
   * and "this may be stuck", and it costs one interval.
   *
   * It keeps its final value when the run ends rather than resetting, so the
   * line reads as a record of the run that just happened.
   */
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef<number | null>(null)
  useEffect(() => {
    if (!running) {
      startedAt.current = null
      return
    }
    startedAt.current = Date.now()
    setElapsed(0)
    const tick = window.setInterval(() => {
      if (startedAt.current) setElapsed(Math.round((Date.now() - startedAt.current) / 1000))
    }, 1000)
    return () => window.clearInterval(tick)
  }, [running])

  /**
   * Which pillar is being read.
   *
   * Tracked with an observer rather than on scroll: a scroll handler has to
   * measure every section on every frame to answer the same question, and this
   * one is answered by the browser as the sections cross the line.
   *
   * The band is the top third of the window, so a heading counts as current
   * once it has settled under the pinned name bar rather than the moment it
   * appears at the bottom of the screen.
   */
  /**
   * Which heading was most recently crossed — and, at the foot of the report,
   * the last one whether it was crossed or not.
   *
   * The end of the document is the end of the last section, but its heading may
   * never reach the line: the scroller runs out of travel first, so on a short
   * final section you could be reading nothing but Ownership with the dot still
   * on Compliance. Clicking the entry worked, because a click sets the answer
   * directly; scrolling to the same place did not.
   */
  const measure = useCallback(() => {
    // A jump is in flight and its destination is already marked.
    if (jumpingTo.current) return

    const first = document.getElementById(`section-${sections[0]?.id}`)
    const scroller = first ? scrollParent(first) : null
    if (
      scroller &&
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < BOTTOM
    ) {
      setHere(sections[sections.length - 1].id)
      return
    }

    let current: { id: string } | undefined
    for (const s of sections) {
      const el = document.getElementById(`section-${s.id}`)
      if (el && el.getBoundingClientRect().top <= LINE) current = s
    }
    // Above the first heading, the first section is the one you are in.
    setHere((current ?? sections[0]).id)
  }, [sections])

  /**
   * The observer says WHEN a heading crosses; the scroll says when the travel
   * ends. Neither alone answers both — an observer fires nothing once the last
   * heading has settled, which is exactly where the bottom of the report is.
   */
  useEffect(() => {
    if (sections.length === 0) return
    const first = document.getElementById(`section-${sections[0].id}`)
    const scroller = first ? scrollParent(first) : null
    if (!scroller) return

    scroller.addEventListener('scroll', measure, { passive: true })
    return () => scroller.removeEventListener('scroll', measure)
  }, [sections, measure])

  useEffect(() => {
    if (sections.length === 0) return

    const seen = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting)

        /**
         * The last section whose top has gone past the line — which is the one
         * being read, whatever its length.
         *
         * Intersection alone could not answer this. Taking the first section
         * overlapping the band named the one you were leaving, because a long
         * section still covers the band while the next heading arrives in it.
         * Taking the last one broke the opposite way: `Financial standing` is
         * 138px tall, so the section after it also sat in the band and won.
         * Neither is a question about overlap — it is about which heading was
         * most recently crossed, so that is what is measured.
         *
         * The observer is still what decides WHEN to measure. Only a handful of
         * headings are read, and only when one of them crosses the band, rather
         * than every section on every frame of a scroll.
         */
        measure()
      },
      // A band rather than a single line, so the callback fires as headings
      // approach and leave; the decision itself is made against `LINE`.
      { rootMargin: '-40px 0px -60% 0px' }
    )

    for (const { id } of sections) {
      const el = document.getElementById(`section-${id}`)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [sections])

  if (sections.length === 0) return null

  /**
   * What the contents list is FOR while a report is being written.
   *
   * The assessments are worked at the same time and land in whatever order they
   * finish, so the report grows in an order nobody chose. Without state here,
   * the index listed six headings as though all six were on the page and the
   * reader had to scroll to find out which were. Each entry now says which it
   * is, and the list is the same list either way — it does not become a
   * different component mid-run.
   *
   * Everything outstanding is `running`, not queued: they are genuinely all in
   * flight at once. Only the recommendation waits, because it reads the others.
   */
  const here_ = present ?? new Set<string>()
  const assessments = sections.filter((s) => s.id !== 'recommendation')
  const allAssessmentsIn = assessments.every((s) => here_.has(s.id))
  const stateOf = (id: string): 'done' | 'running' | 'pending' => {
    if (here_.has(id)) return 'done'
    if (!running) return 'pending'
    if (id === 'recommendation') return allAssessmentsIn ? 'running' : 'pending'
    return 'running'
  }


  const go = (id: string) => {
    const el = document.getElementById(`section-${id}`)
    if (!el) return
    jumpingTo.current = id
    // `scrollIntoView` rather than a computed offset: the section carries its
    // own `scroll-mt`, so the clearance lives with the thing being scrolled to.
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setHere(id)

    /**
     * Hold the mark until the scroll actually stops moving.
     *
     * Releasing on the reader's own wheel/touch looked right and was not: a
     * trackpad throws inertial `wheel` events for a while after a click, which
     * released the lock while the smooth scroll was still travelling — the
     * observer then reported whatever heading it was passing, and the highlight
     * bounced between the section you left and the one you asked for.
     *
     * Watching the scroll position settle asks the real question instead: is
     * the page still moving? The timeout is a floor, not the mechanism, for the
     * case where the target is already in place and nothing moves at all.
     */
    let still = 0
    let frames = 0
    let last = -1
    const scroller = scrollParent(el)
    const watch = () => {
      if (jumpingTo.current !== id) return
      const now = scroller ? Math.round(scroller.scrollTop) : 0
      still = now === last ? still + 1 : 0
      last = now
      if (still >= 4 || ++frames > 180) {
        jumpingTo.current = null
        return
      }
      requestAnimationFrame(watch)
    }
    requestAnimationFrame(watch)
  }

  /**
   * The list itself, rendered by both forms of this component.
   *
   * The rail holds it in the margin; the collapsed strip holds it in a hover
   * card. Same element, so the rows, their states, their step disclosures and
   * the jump cannot drift apart between the two — and `shown` being shared
   * means a section opened in one is open in the other.
   */
  const contents = (
    <>
      {/* What the run is doing, at the top of the thing that tracks it. It used
          to sit over the report as "Thought for 7s" — the right fact in the
          wrong place, arriving only once there was nothing left to wait for. */}
      {(running || elapsed > 0) && (
        <div className="mb-2 flex items-center gap-2">
          {/* Only while it is turning. A static dot on a finished line marked
              nothing — the spinner is there to say something is moving, and
              once nothing is, the sentence says it by itself. */}
          {running && (
            <span
              className="size-2.5 shrink-0 rounded-full border border-solid border-muted-foreground border-t-transparent motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          <MutedText
            className={cn('text-caption tabular-nums', running && 'shimmer-text')}
            aria-live="polite"
          >
            {running ? `Working ${elapsed}s` : `Thought for ${elapsed}s`}
          </MutedText>
        </div>
      )}

      {sections.map(({ id, heading }) => {
        const current = here === id
        const state = stateOf(id)

        return (
          /* No rule down the side. It moved as the current entry changed, and
             with the steps opening underneath it the segment it marked resized
             too — a line that twitched every time you clicked something. Weight
             already says which entry you are on. */
          <div key={id} className="py-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                // Nothing to scroll to until it exists.
                onClick={state === 'done' ? () => go(id) : undefined}
                disabled={state !== 'done'}
                aria-current={current ? 'true' : undefined}
                aria-busy={state === 'running' || undefined}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 text-left text-caption transition-colors',
                  state === 'pending' ? 'text-muted-foreground' : 'text-foreground',
                  current && state === 'done' && 'font-semibold',
                  state === 'done' && 'cursor-pointer'
                )}
              >
                <StateDot state={state} current={current} />
                <span className={cn('min-w-0 truncate', state === 'running' && 'shimmer-text')}>
                  {heading}
                </span>
              </button>

            </div>

          </div>
        )
      })}
    </>
  )

  /** The current entry, before the observer has had a chance to say. Without
   *  this the strip opens with no mark lit, which reads as "nowhere" rather
   *  than "the top". */
  const at = here ?? sections[0].id

  return (
    <>
      {/*
        * The contents, collapsed to their marks.
        *
        * A dot per section: where you are, and a way to somewhere else. The
        * names come back on hover, which is the whole list — so the list is
        * there when it is wanted and costs 24px when it is not. A 224px rail
        * standing open beside the prose spent the width permanently to say
        * what five dots say.
        *
        * It belongs to the assessment it indexes, so it sits inside that tab
        * and sticks to the top of the report's scroller while the prose moves
        * past it.
        */}
      <HoverCard openDelay={120} closeDelay={160}>
        <HoverCardTrigger asChild>
          <div
            className={cn(
              // In the document's own left padding, not in the column: the
              // prose keeps the measure the tabs above it set. Sticky, so the
              // marks hold while the prose moves past them.
              //
              // `-ml-9` against the measure's `px-12`: the 24px strip ends 12px
              // short of the first character. At `-ml-7` in a 32px gutter it
              // ended 4px short, which read as the dots sitting on the words.
              'sticky top-0 z-20 -ml-9 w-6',
              'flex flex-col items-center gap-0.5'
            )}
          >
            {sections.map(({ id, heading }) => {
              const state = stateOf(id)
              const current = at === id
              /* Empty at rest — a column of filled dots beside the prose read
                 as a second piece of content. They are an outline, and an
                 outline is the quietest thing that can still be pointed at.
                 The one you are on is filled, and the list this strip opens
                 fills the same one. */
              const mark = markClass({ current, state })
              /* A section that has not landed is not a button — and not a
                 disabled one either: a disabled control swallows the pointer,
                 which would punch a hole in the strip the hover card opens
                 from. */
              return state === 'done' ? (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  aria-label={heading}
                  aria-current={current ? 'true' : undefined}
                  className="flex w-full cursor-pointer justify-center py-1"
                >
                  <span className={mark} aria-hidden="true" />
                </button>
              ) : (
                <span key={id} className="flex w-full justify-center py-1" aria-hidden="true">
                  <span className={mark} />
                </span>
              )
            })}
          </div>
        </HoverCardTrigger>
        {/* Pulled back over the strip — a negative offset of exactly its 24px
            width — so the list opens where the dots were rather than beside
            them. The dots are the collapsed state of this list, not a legend
            for it, and leaving both on screen read as two controls. */}
        <HoverCardContent
          side="right"
          align="start"
          sideOffset={-24}
          alignOffset={-12}
          className="w-56 p-3"
        >
          <div className="flex flex-col gap-y-1">{contents}</div>
        </HoverCardContent>
      </HoverCard>
    </>
  )
}
