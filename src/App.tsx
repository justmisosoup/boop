import { useEffect, useMemo, useRef, useState } from 'react'

import {
  ActionButton,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  Input,
  MetaChip,
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
import { ScreenshotViewerProvider } from './components/ScreenshotViewer'
import { SourcesTab, sourcesFor } from './components/SourcesTab'
import { InsightRow } from './components/InsightRow'
import records from './data/records.json'
import { categoriesOf, deriveResults, type BusinessRecord, type Derived } from './lib/deriveResults'
import { GROUPS, type GroupId, makeGroupFor } from './lib/groups'
import { useAnalysis } from './lib/useAnalysis'
import { AssessmentEditor } from './components/AssessmentEditor'
import { useAgent } from './lib/useAgent'
import { useLede } from './lib/useLede'

const ALL = records as unknown as BusinessRecord[]

/**
 * What the assessment workflow runs against.
 *
 * The concepts, not the records underneath them. Listing the record's own
 * sources here said the same thing the answer's citations already say, one
 * filing at a time; the workflow is not written against the Delaware
 * registration, it is written against what these three hold.
 */
const CONTEXT = [
  { id: 'context:entities', label: 'Middesk Entities' },
  { id: 'context:jurisdictions', label: 'Middesk Jurisdictions' },
  { id: 'context:industries', label: 'Middesk Industries' }
]

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

  const derived = useMemo(() => deriveResults(selected), [selected])
  const results: Derived[] = useMemo(() => derived, [derived])
  const undetermined = derived.filter((r) => r.reasonUndetermined).length

  // The skill that runs on arrival. Not a special case: it is the same thing a
  // reader could have dropped into the composer themselves.
  // The customer's assessments — the one that runs and the parts under it.
  const agent = useAgent()
  // Asked for on arrival and reused verbatim after: the business's own
  // description, independent of any assessment.
  const lede = useLede(selected.id, selected.name)
  // The workflow that runs on arrival is the customer's, not a Middesk default
  // — so the report waits for their store rather than firing against a stand-in.
  const standing = agent.skills.find((s) => s.kind === 'workflow')
  /** The assessments inside the standing one, in the order they run. */
  const policy = useMemo(
    () =>
      agent.skills
        .filter((x) => x.kind !== 'workflow' && !(agent.disabled ?? []).includes(x.id))
        .map((x) => x.name),
    [agent.skills, agent.disabled]
  )
  const analysis = useAnalysis(
    selected,
    results,
    standing?.instructions ?? '',
    agent.ready && Boolean(standing)
  )
  const [agentOpen, setAgentOpen] = useState<string | null>(null)


  // Navigational only — grouping helps a reader find things and nothing rests
  // on it (00-MASTER-PLAN.md rule 3).
  /**
   * Insights that actually reported.
   *
   * The tab counts these, not every insight evaluated. The list below includes
   * every check the catalog defines so a reader can see what was never answered,
   * but counting those would say a business has 63 insights when half of them
   * are the absence of one.
   */
  const reported = useMemo(() => derived.filter((r) => !r.notReported), [derived])

  const categories = useMemo(() => categoriesOf(selected), [selected])
  const groupFor = useMemo(() => makeGroupFor(categories), [categories])
  const attributeCount = useMemo(
    () => countAttributes(selected, results, groupFor),
    [selected, results, groupFor]
  )
  const groupOf = (result: (typeof results)[number]) => groupFor(result.insightId)

  /**
   * Found / Not found / All.
   *
   * "Found" is a check that reported anything at all — a result, an unknown, a
   * no-result with a reason. "Not found" is a check the record never mentioned:
   * the catalog says it exists and this business has nothing for it, which is
   * most of the list once every insight is evaluated rather than only the ones
   * that ran.
   */
  const [filter, setFilter] = useState<'all' | 'found' | 'not_found'>('all')

  const visible = useMemo(
    () =>
      filter === 'all'
        ? results
        : results.filter((r) => (filter === 'found' ? !r.notReported : r.notReported)),
    [results, filter]
  )

  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: visible.filter((r) => groupOf(r) === g.id)
  })).filter((g) => g.rows.length > 0)
  const [dockOpen, setDockOpen] = useState(true)
  const [revealed, setRevealed] = useState<string[]>([])
  const [tab, setTab] = useState('analysis')

  // Ids the current answer already used — those rows do not offer "add".
  const used = new Set(analysis.active?.result.used ?? [])

  // A citation has to land somewhere: switch to the raw insights, then scroll.
  const recordSources = useMemo(
    () => sourcesFor(selected, results, groupFor),
    [selected, results, groupFor]
  )
  const sourceCount = recordSources.length

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
    <ScreenshotViewerProvider>
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
          <BusinessLede text={lede} />
        </header>

        <TabsRoot value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="analysis">Assessment</TabsTrigger>
            <TabsTrigger value="insights">
              Insights
              <TabsCount>{reported.length}</TabsCount>
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
              // The count the Insights tab shows — what this business actually
              // has — not every check the catalog defines.
              insightCount={reported.length}
              categories={categories}
              waiting={analysis.waiting}
              waitingKind={analysis.waitingKind}
              waitingSkills={analysis.waitingSkills}
              waitingTyped={analysis.waitingTyped}
              acknowledged={analysis.acknowledged}
              policy={policy}
              draft={analysis.draft}
              slow={analysis.slow}
              error={analysis.error}
              onJumpToGroup={jumpToGroup}
              superseded={analysis.superseded}
            />

          </TabsContent>

          <TabsContent value="insights" className="space-y-4 pt-4">
            {/* The default is everything: a reader who does not know a check
                exists cannot ask for it, so the unanswered ones stay visible
                until they choose otherwise. */}
            <SegmentedControl
              size="sm"
              aria-label="Filter insights"
              value={filter}
              onValueChange={(value) => setFilter(value as typeof filter)}
            >
              <SegmentedControlItem value="all">All {results.length}</SegmentedControlItem>
              <SegmentedControlItem value="found">Found {reported.length}</SegmentedControlItem>
              <SegmentedControlItem value="not_found">
                Not found {results.length - reported.length}
              </SegmentedControlItem>
            </SegmentedControl>

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

      <AssessmentEditor
        open={agentOpen !== null}
        startOn={agentOpen ?? 'list'}
        onClose={() => setAgentOpen(null)}
        skills={agent.skills}
        workflow={standing}
        onRenameWorkflow={(id, name) => {
          const w = agent.skills.find((x) => x.id === id)
          if (w) void agent.updateSkill(id, name, w.instructions)
        }}
        onCreateSkill={(name, instructions) => void agent.createSkill(name, instructions)}
        onUpdateSkill={(id, name, instructions) => void agent.updateSkill(id, name, instructions)}
        disabled={agent.disabled ?? []}
        onSetEnabled={(id, on) => void agent.setEnabled(id, on)}
        onDeleteSkill={(id) => void agent.deleteSkill(id)}
      />

      <AnalysisDock
        open={dockOpen}
        setOpen={setDockOpen}
        onSend={({ prompt, attachments, skills, typed, kind }) =>
          analysis.run(prompt, analysis.pinned, attachments, kind, skills, typed, policy)
        }
        // Switched off means not offered: the menu lists what can be run, and
        // an entry that is off would be a row you can pick and nothing happens.
        custom={agent.skills.filter((x) => !(agent.disabled ?? []).includes(x.id))}
        disabled={agent.disabled ?? []}
        onCreateSkill={() => setAgentOpen('new')}
        // The standing assessment IS the settings page, so editing it opens
        // that page rather than an editor nested inside itself.
        onEditSkill={(id) => setAgentOpen(id === standing?.id ? 'list' : id)}
        onUpdateSkill={(id, name, instructions) => void agent.updateSkill(id, name, instructions)}
        waiting={analysis.waiting}
        pinned={analysis.pinned}
        results={results}
        onUnpin={(id) => analysis.unpin(id)}
        hasAnalysis={analysis.versions.length > 0}
      />
    </div>
    </ScreenshotViewerProvider>
  )
}
