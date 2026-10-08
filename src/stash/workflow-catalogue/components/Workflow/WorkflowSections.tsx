import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

import { CountBubble, Hint, MetaChip, MutedText, PageHeadingCount, Surface, Text } from '@/core'

import { cn } from '../../../../utils/twUtils'
import {
  insightLabel,
  weightLabel,
  type Workflow,
  type WorkflowStep
} from '../../../../lib/workflows'
import { CardHeader } from '../../../../components/CardHeader'
import { Collapsible } from '../../../../components/Collapsible'
import { teamBySlug } from '../../../../lib/workflowCatalogue'
import { INVERSE_CHIP } from './inverseChip'

/**
 * The cards a workflow page is made of.
 *
 * Each is the report card's frame — a card surface with its name as its own
 * header (`CardHeader`) and a hairline between rows — so a workflow reads in
 * the same grammar as the record it runs on.
 */
export const WorkflowSection = ({
  title,
  trailing,
  children,
  className
}: {
  title: ReactNode
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <Surface variant="card" padding="none" className={cn('overflow-hidden', className)}>
    <CardHeader title={title} trailing={trailing} />
    {children}
  </Surface>
)

/** A row inside a section: row padding, a hairline above every row but the first. */
const Row = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div
    className={cn(
      'px-4 py-3 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]',
      className
    )}
  >
    {children}
  </div>
)

/** A section's name with how many rows it holds — the count pill the page
 *  heading uses beside "Compliance". The pill sits back in Suisse: the serif
 *  is the name's, not the number's. */
const Counted = ({ label, count }: { label: string; count: number }) => (
  <span className="flex items-center gap-2">
    {label}
    <PageHeadingCount className="font-suisse">{count}</PageHeadingCount>
  </span>
)

/** The data the workflow takes, and which of it is required. */
export const Needs = ({ workflow }: { workflow: Workflow }) => (
  <WorkflowSection title={<Counted label="Attributes" count={workflow.needs.length} />}>
    {workflow.needs.map((need) => (
      <Row key={need.label} className="flex items-center justify-between gap-3 py-2.5">
        <Text className="m-0">
          {need.label}
        </Text>
        {need.required ? (
          // Required reads in the inverse surface — the midnight the tooltip
          // sits on — so it stands apart from the neutral Optional beside it.
          <MetaChip size="xs" style={INVERSE_CHIP}>
            Required
          </MetaChip>
        ) : (
          <MetaChip size="xs">Optional</MetaChip>
        )}
      </Row>
    ))}
  </WorkflowSection>
)

/**
 * One step: the number, the title, how many sources it draws on — named on
 * hover — and, opened, those sources and the insights it reads, as the
 * record's Insights row opens under a card. Every step opens except the
 * agent's closing one, which names its agent and has nothing more to show.
 */
const Step = ({ step, n }: { step: WorkflowStep; n: number }) => {
  const [open, setOpen] = useState(false)
  const id = useId()
  const count = step.tools.length
  // An agent's step names its agent at the top level and has nothing to open.
  if (count === 1 && /agent$/i.test(step.tools[0]))
    return (
      <li className="flex items-center gap-3 px-4 py-2.5">
        <CountBubble>{n}</CountBubble>
        <Text className="m-0 min-w-0 flex-1">{step.title}</Text>
        <MetaChip size="xs">{step.tools[0]}</MetaChip>
      </li>
    )
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--core-color-list-item-hover-bg)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <CountBubble>{n}</CountBubble>
        <Text className="m-0 min-w-0 flex-1">{step.title}</Text>
        <Hint asChild content={step.tools.join(' · ')} side="top" size="compact">
          <MetaChip size="xs">
            {count} {count === 1 ? 'source' : 'sources'}
          </MetaChip>
        </Hint>
        <ChevronDown
          aria-hidden="true"
          size={14}
          strokeWidth={2}
          className={cn('shrink-0 text-text-secondary transition-transform', open && 'rotate-180')}
        />
      </button>
      <Collapsible open={open} id={id}>
        <div className="border-t border-[var(--core-color-border-divider)] bg-[var(--core-color-surface-subtle)]">
          {/* The sources, named. */}
          <div className="flex items-baseline gap-3 py-2 pl-[3.25rem] pr-4">
            <MutedText className="m-0 shrink-0">{count === 1 ? 'Source' : 'Sources'}</MutedText>
            <span className="flex flex-wrap gap-1">
              {step.tools.map((tool) => (
                <MetaChip key={tool} size="xs">
                  {tool}
                </MetaChip>
              ))}
            </span>
          </div>
          {/* The data the step reads where no insight names it, as the API names it. */}
          {step.attributes && step.attributes.length > 0 && (
            <ul className="m-0 list-none border-t border-[var(--core-color-border-divider)] p-0">
              {step.attributes.map((a) => (
                <li
                  key={a.id}
                  className="flex items-baseline justify-between gap-3 py-2 pl-[3.25rem] pr-4 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]"
                >
                  <Text className="m-0">{a.label}</Text>
                  <MutedText className="m-0 font-mono">{a.id}</MutedText>
                </li>
              ))}
            </ul>
          )}
          {/* The insights, indented under the title, each a hairline apart. */}
          {step.insights.length > 0 && (
            <ul className="m-0 list-none border-t border-[var(--core-color-border-divider)] p-0">
              {step.insights.map((insightId) => (
                <li
                  key={insightId}
                  className="flex items-baseline justify-between gap-3 py-2 pl-[3.25rem] pr-4 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]"
                >
                  <Text className="m-0">{insightLabel(insightId)}</Text>
                  <MutedText className="m-0 font-mono">{insightId}</MutedText>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Collapsible>
    </li>
  )
}

/** The steps in order, each with the toolsets it calls and the insights it reads. */
export const Steps = ({ workflow }: { workflow: Workflow }) => (
  <WorkflowSection title={<Counted label="Steps" count={workflow.steps.length} />}>
    <ol className="m-0 list-none p-0 [&>li:not(:first-child)]:border-t [&>li:not(:first-child)]:border-[var(--core-color-border-divider)]">
      {workflow.steps.map((step, i) => (
        <Step key={step.title} step={step} n={i + 1} />
      ))}
    </ol>
  </WorkflowSection>
)

/** The tools the workflow calls, and what each one brings to the job. */
export const Adds = ({ workflow }: { workflow: Workflow }) => (
  <WorkflowSection title={<Counted label="Tools" count={workflow.adds.length} />}>
    {workflow.adds.map(({ icon: Icon, name, description }) => (
      <Row key={name} className="grid grid-cols-[auto_minmax(0,11rem)_minmax(0,1fr)] items-start gap-x-3 py-2.5">
        <Icon aria-hidden="true" size={16} strokeWidth={1.5} className="mt-0.5 text-text-secondary" />
        <Text className="m-0 font-medium">
          {name}
        </Text>
        <Text tone="secondary" className="m-0">
          {description}
        </Text>
      </Row>
    ))}
  </WorkflowSection>
)

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 px-4 py-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--core-color-border-divider)]">
    <Text tone="secondary" className="m-0">
      {label}
    </Text>
    <Text className="m-0 text-right">
      {children}
    </Text>
  </div>
)

/** What the workflow establishes and how, then its facts under it — its
 *  status as the head's one tag, at the far right. */
export const Overview = ({ workflow }: { workflow: Workflow }) => (
  <WorkflowSection
    title="Overview"
    trailing={
      <MetaChip size="compact" tone={workflow.status === 'Available' ? 'success' : 'neutral'}>
        {workflow.status}
      </MetaChip>
    }
  >
    <Row>
      <Text className="m-0">{workflow.overview}</Text>
    </Row>
    <div className="border-t border-[var(--core-color-border-divider)]">
      <Detail label="Team">{teamBySlug(workflow.team)?.name ?? workflow.team}</Detail>
      <Detail label="Output">{workflow.output}</Detail>
      <Detail label="Steps">{workflow.steps.length}</Detail>
      <Detail label="Checks">{workflow.checks}</Detail>
      <Detail label="Weight">{weightLabel(workflow.weight)}</Detail>
      <Detail label="Status">{workflow.status}</Detail>
      <Detail label="Runs through">{workflow.runsThrough.join(', ')}</Detail>
    </div>
  </WorkflowSection>
)
