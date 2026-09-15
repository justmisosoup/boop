import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Heading,
  Input,
  MutedText,
  Surface,
  TabsContent,
  TabsCount,
  TabsList,
  TabsRoot,
  TabsTrigger,
  Tag,
  Text
} from '@/core'

import { AnalysisDock } from './components/AnalysisDock'
import { AttributesTab, countAttributes } from './components/AttributesTab'
import { AnalysisPanel } from './components/AnalysisPanel'
import { BusinessLede } from './components/BusinessLede'
import { SourcesTab, sourcesFor } from './components/SourcesTab'
import { InsightRow } from './components/InsightRow'
import records from './data/records.json'
import { categoriesOf, deriveResults, type BusinessRecord } from './lib/deriveResults'
import { GROUPS, makeGroupFor } from './lib/groups'
import { useAnalysis } from './lib/useAnalysis'

const ALL = records as unknown as BusinessRecord[]

const describe = (r: BusinessRecord) =>
  r.formation
    ? `${r.formation.entityType} · ${r.formation.state} · formed ${r.formation.date}`
    : 'No formation record'

export default function App() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<BusinessRecord>(ALL[0])
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return ALL.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.formation?.state.toLowerCase().includes(q) ||
        r.addresses.some((a) => a.fullAddress.toLowerCase().includes(q))
    ).slice(0, 6)
  }, [query])

  const choose = (r: BusinessRecord) => {
    setSelected(r)
    setQuery('')
    setOpen(false)
  }

  const results = useMemo(() => deriveResults(selected), [selected])
  const undetermined = results.filter((r) => r.reasonUndetermined).length

  const analysis = useAnalysis(selected, results)

  // The settled report first, the draft while one is still being written — the
  // lede is the first section the session writes, so it lands early.
  const lede = (analysis.active?.result ?? analysis.draft)?.sections.find(
    (s) => s.id === 'description'
  )

  // Navigational only — grouping helps a reader find things and nothing rests
  // on it (00-MASTER-PLAN.md rule 3).
  const categories = useMemo(() => categoriesOf(selected), [selected])
  const groupFor = useMemo(() => makeGroupFor(categories), [categories])
  const attributeCount = useMemo(
    () => countAttributes(selected, results, groupFor),
    [selected, results, groupFor]
  )
  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: results.filter((r) => groupFor(r.insightId) === g.id)
  })).filter((g) => g.rows.length > 0)
  const [dockOpen, setDockOpen] = useState(true)
  const [revealed, setRevealed] = useState<string[]>([])
  const [tab, setTab] = useState('analysis')

  // Ids the current answer already used — those rows do not offer "add".
  const used = new Set(analysis.active?.result.used ?? [])

  // A citation has to land somewhere: switch to the raw insights, then scroll.
  const sourceCount = sourcesFor(selected, results, groupFor).length

  const reveal = (ids: string[], anchor: string) => {
    setTab('insights')
    setRevealed(ids)
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    window.setTimeout(() => setRevealed([]), 2400)
  }

  /**
   * A citation names a category, so following it lands on that category — the
   * Insights tab is already grouped the same way. Every insight the paragraph
   * cited there is revealed at once, which is the thing the citation was
   * standing for.
   */
  const jumpToGroup = (groupId: string, insightIds: string[]) =>
    reveal(insightIds, `group-${groupId}`)

  /**
   * An attribute's source chip names a record, and the record is in the Sources
   * tab in full. Following it out to the registry's own page left the reader to
   * find their way back to what we actually hold.
   */
  const [sourceFocus, setSourceFocus] = useState<string | null>(null)
  const jumpToSource = (cardId: string) => {
    setTab('sources')
    setSourceFocus(cardId)
    // The tab's content mounts on the switch, so the card does not exist yet
    // and its section is still laying out for a frame or two after it does.
    // Retried rather than delayed by a guessed constant.
    let tries = 0
    const land = () => {
      // Exact card, else the first of that type: a tax permit's card id carries
      // its state ("src:Tax permit · Pennsylvania") and the chip that cites it
      // only knows the type.
      const el =
        document.getElementById(`source-${cardId}`) ??
        document.querySelector(`[id^="source-${cardId.replace(/"/g, '\\"')}"]`)
      if (el) return el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (tries++ < 20) requestAnimationFrame(land)
    }
    requestAnimationFrame(land)
    window.setTimeout(() => setSourceFocus(null), 2400)
  }

  return (
    <div className="core-theme min-h-full">
      <div className="mx-auto max-w-[880px] px-6 pb-40 pt-10">
        {/* Search sits on the assessment screen. Typing swaps the business
            underneath it; there is no separate list to pick from first. */}
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 120)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches[0]) choose(matches[0])
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Search a business by name, state or address"
            aria-label="Search a business"
          />

          {open && matches.length > 0 && (
            <Surface
              variant="raised"
              padding="none"
              className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden"
            >
              <div className="divide-y divide-solid divide-border">
                {matches.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={() => {
                      clearTimeout(blurTimer.current)
                      choose(r)
                    }}
                    className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <Text size="sm" className="truncate font-medium">
                        {r.name}
                      </Text>
                      <MutedText className="mt-0.5 block truncate text-caption">
                        {describe(r)}
                      </MutedText>
                    </span>
                    <Tag tone="subtle" size="compact">
                      {r.reviewTasks.length}
                    </Tag>
                  </button>
                ))}
              </div>
            </Surface>
          )}
        </div>

        <header className="mb-5 mt-6">
          <Heading level={1}>{selected.name}</Heading>
          <MutedText className="mt-1 block text-caption">{describe(selected)}</MutedText>
          <BusinessLede section={lede} pending={analysis.waiting} />
        </header>

        <TabsRoot value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="analysis">Assessment</TabsTrigger>
            <TabsTrigger value="insights">
              Insights
              <TabsCount>{results.length}</TabsCount>
            </TabsTrigger>
            <TabsTrigger value="attributes">
              Attributes
              <TabsCount>{attributeCount}</TabsCount>
            </TabsTrigger>
            <TabsTrigger value="sources">
              Sources
              <TabsCount>{sourceCount}</TabsCount>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4 pt-4">
            <AnalysisPanel
              versions={analysis.versions}
              results={results}
              categories={categories}
              waiting={analysis.waiting}
              waitingKind={analysis.waitingKind}
              draft={analysis.draft}
              slow={analysis.slow}
              error={analysis.error}
              onJumpToGroup={jumpToGroup}
            />

          </TabsContent>

          <TabsContent value="insights" className="space-y-4 pt-4">
            {grouped.map((group) => (
              /* Core's `Section` fixes its title at Heading level 2; these are
                 sub-sections of the tab, so the heading is composed at level 3. */
              <section
                key={group.id}
                id={`group-${group.id}`}
                className="grid gap-[var(--core-spacing-sm)] scroll-mt-6"
              >
                <Heading level={3}>{group.label}</Heading>
                <Surface variant="default" padding="none" className="overflow-hidden">
                  <div className="divide-y divide-solid divide-border">
                    {group.rows.map((r) => (
                      <InsightRow
                        key={r.insightId}
                        result={r}
                        record={selected}
                        reveal={revealed.includes(r.insightId)}
                        onAddToAnalysis={
                          analysis.active && !used.has(r.insightId) && !analysis.waiting
                            ? () => analysis.addAndRerun(r.insightId)
                            : undefined
                        }
                        onJumpToSource={jumpToSource}
                      />
                    ))}
                  </div>
                </Surface>
              </section>
            ))}

            {/* The count gates the CARD, not the sentence inside it. Gating only
                the text left an empty panel under the last group on every record
                where every no-result was attributable — which is most of them. */}
            {undetermined > 0 && (
              <Surface variant="subtle" padding="md">
                <MutedText className="block text-caption">
                  {undetermined} no-result{undetermined > 1 ? 's' : ''} could not be attributed to
                  one of the four reasons from this record alone.
                </MutedText>
              </Surface>
            )}
          </TabsContent>

          <TabsContent value="attributes" className="space-y-6 pt-4">
            <AttributesTab
              record={selected}
              results={results}
              groupFor={groupFor}
              onJumpToSource={jumpToSource}
            />
          </TabsContent>

          <TabsContent value="sources" className="space-y-4 pt-4">
            <SourcesTab
              record={selected}
              results={results}
              groupFor={groupFor}
              focus={sourceFocus}
            />
          </TabsContent>
        </TabsRoot>
      </div>

      <AnalysisDock
        open={dockOpen}
        setOpen={setDockOpen}
        onRun={(prompt, attachments) => analysis.run(prompt, analysis.pinned, attachments)}
        waiting={analysis.waiting}
        pinned={analysis.pinned}
        results={results}
        onUnpin={(id) => analysis.unpin(id)}
        hasAnalysis={analysis.versions.length > 0}
      />
    </div>
  )
}
