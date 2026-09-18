import { useEffect, useRef, useState } from 'react'

import { MutedText, Text } from '@/core'

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
 * still while the prose moves past. Below the breakpoint there is no margin to
 * sit in, so it becomes an ordinary row above the report instead of being
 * dropped: on a narrow window the report is longer, not shorter.
 */
/**
 * Where a heading counts as reached, in viewport coordinates.
 *
 * The report scrolls inside its own column, which starts below the fixed name
 * bar — so a heading is "current" once it has risen past the top of that column
 * plus a little, not past the top of the window.
 */
const LINE = 140

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
const StateDot = ({ state }: { state: 'done' | 'running' | 'pending' }) => {
  if (state === 'done') {
    return <span className="size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
  }
  if (state === 'running') {
    return (
      <span
        className="size-2.5 shrink-0 rounded-full border border-solid border-muted-foreground border-t-transparent motion-safe:animate-spin"
        aria-hidden="true"
      />
    )
  }
  return (
    <span
      className="size-1.5 shrink-0 rounded-full border border-solid border-muted-foreground"
      aria-hidden="true"
    />
  )
}

export const AssessmentIndex = ({
  sections,
  lede,
  present,
  steps,
  running = false
}: {
  /** The pillars in the report, in the order they are laid out. */
  sections: Array<{ id: string; heading: string }>
  lede: string | null
  /** Section ids whose prose is on the page right now. */
  present?: Set<string>
  /** What each section did, opened from the caret beside it. */
  steps?: Map<string, Array<{ label: string }>>
  /** A run is being written. What is not here yet is coming, not absent. */
  running?: boolean
}) => {
  const [here, setHere] = useState<string | null>(null)
  /** Which entries are showing their steps. Closed by default: the contents
   *  list is a list of contents first, and the work behind each is on request. */
  const [shown, setShown] = useState<string[]>([])
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
        // A jump is in flight and its destination is already marked.
        if (jumpingTo.current) return

        const line = LINE
        let current: { id: string } | undefined
        for (const s of sections) {
          const el = document.getElementById(`section-${s.id}`)
          if (el && el.getBoundingClientRect().top <= line) current = s
        }
        // Above the first heading, the first section is the one you are in.
        setHere((current ?? sections[0]).id)
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

  return (
    <nav
      aria-label="Assessment contents"
      /* Aligned to the page column, not the window. The page is 1400px centred,
         so a fixed `left-6` only agreed with it at one width — wider than that
         and the rail drifted away from the report it indexes. */
      style={{ left: 'max(1.5rem, calc((100vw - 1400px) / 2))' }}
      className={cn(
        // Fixed to the window, not part of the flow: it takes no space, so it
        // cannot squeeze the report or wrap the panel beside it.
        //
        // Shown only where the page is genuinely narrower than the window, so
        // there is empty margin for it to sit in. Below that it would overlap
        // the prose, and a contents list on top of the text it indexes is worse
        // than no contents list.
        // `lg`, not `2xl`: gated at 1536px this never appeared in a window
        // anyone actually has. The page reserves the gutter it sits in, so it
        // does not depend on there happening to be spare margin.
        'hidden',
        // No ground of its own. It is margin furniture, not a panel — a white
        // card here made it compete with the report for the same reading, and
        // the page behind it is what marks it as apart from the document.
        // `pt-7` matches the report card's own top padding, so the rail's first
        // line sits on the same baseline as the report's rather than 28px
        // above it.
        'lg:fixed lg:top-20 lg:z-10 lg:flex lg:w-56 lg:flex-col lg:gap-y-1 lg:pt-7'
      )}
    >
      {/* What the business actually does, kept in view while working down a
          report about it. The name and the entity line used to sit above this
          and now live in the fixed header, which is on screen at every scroll
          position — printing them here as well was the same fact twice, 200px
          apart. */}
      {lede && (
        <Text className="mb-4 line-clamp-6 block font-normal leading-relaxed">
          {lede}
        </Text>
      )}

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

      {/* How much of the report exists, before the list of what it is. Only
          while a run is in flight — a finished report does not need a progress
          bar over its table of contents. */}
      {sections.map(({ id, heading }) => {
        const current = here === id
        const state = stateOf(id)
        const mine = steps?.get(id) ?? []
        const open = shown.includes(id)

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
                <StateDot state={state} />
                <span className={cn('min-w-0 truncate', state === 'running' && 'shimmer-text')}>
                  {heading}
                </span>
              </button>

              {/* Only where there is something to open. A caret on a section
                  that has not run yet promises a list that does not exist. */}
              {mine.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setShown((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  aria-expanded={open}
                  aria-label={open ? `Hide steps for ${heading}` : `Show steps for ${heading}`}
                  className="inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                    className={cn('h-2.5 w-2.5 transition-transform duration-200', open && 'rotate-90')}
                    fill="none"
                  >
                    <path
                      d="M4.5 3 7.5 6 4.5 9"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>

            {open && (
              <ul className="ml-[3px] mt-1 space-y-1 border-l border-solid border-border pl-3">
                {mine.map((step) => (
                  <li key={step.label} className="flex items-start gap-1.5">
                    <span
                      className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground"
                      aria-hidden="true"
                    />
                    <MutedText className="text-caption leading-snug">{step.label}</MutedText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}
