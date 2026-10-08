import { useState } from 'react'
import { Link, useParams } from 'react-router'

import {
  ActionButton,
  EmptyState,
  PageBreadcrumb,
  PageBreadcrumbItem,
  PageContainer,
  PageDescription,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading
} from '@/core'

import { RunDialog } from '../components/Workflow/RunDialog'
import { Adds, Needs, Overview, Steps } from '../components/Workflow/WorkflowSections'
import { teamBySlug, teamHref } from '../../../lib/workflowCatalogue'
import { workflowBySlug } from '../../../lib/workflows'

/**
 * One workflow.
 *
 * What it does, what to send, the steps and the tool each calls, and the
 * tools themselves — beside its overview and facts.
 */
export const WorkflowPage = () => {
  const { slug } = useParams()
  const workflow = workflowBySlug(slug)
  const [running, setRunning] = useState(false)

  if (!workflow) {
    return (
      <PageContainer width="wide">
        <EmptyState
          title="No such workflow"
          description="The link may be out of date. Every workflow is listed under Workflows."
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer width="wide">
      {/* The header as the band lays it out — breadcrumb, title row, the
          chips — all inside the band's own gutter, as the businesses page's
          heading sits in. */}
      {/* Gutter from `PageContainer`; the top padding centres the title on the
          rail's search line, as on the Workflows page. */}
      <PageHeaderBand className="px-0 pt-[30px]">
        <PageHeader>
          <PageBreadcrumb>
            <PageBreadcrumbItem asChild>
              <Link to="/workflows" className="no-underline">
                Workflows
              </Link>
            </PageBreadcrumbItem>
            <PageBreadcrumbItem asChild>
              <Link to={teamHref(workflow.team)} className="no-underline">
                {teamBySlug(workflow.team)?.name ?? workflow.team}
              </Link>
            </PageBreadcrumbItem>
            <PageBreadcrumbItem current>{workflow.name}</PageBreadcrumbItem>
          </PageBreadcrumb>
          {/* Actions start where the description does: below the 40px title
              line and the 4px gap under it, not on the title line. */}
          <PageHeaderBar className="items-start">
            <PageHeaderTitles>
              <PageHeading className="font-arizona text-3xl font-light leading-10 tracking-[-0.02em]" size="lg" weight="normal">
                {workflow.name}
              </PageHeading>
              <PageDescription className="text-base leading-6">{workflow.tagline}</PageDescription>
            </PageHeaderTitles>
            <PageHeaderActions className="mt-11">
              {/* Rendered for the shape of the page; there is nothing to edit here yet. */}
              <ActionButton variant="secondary">Edit</ActionButton>
              <ActionButton variant="primary" onClick={() => setRunning(true)}>
                Run workflow
              </ActionButton>
            </PageHeaderActions>
          </PageHeaderBar>
        </PageHeader>
      </PageHeaderBand>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Steps workflow={workflow} />
          <Needs workflow={workflow} />
          <Adds workflow={workflow} />
        </div>
        <div className="flex flex-col gap-4">
          <Overview workflow={workflow} />
        </div>
      </div>
      <RunDialog workflow={workflow} open={running} onClose={() => setRunning(false)} />
    </PageContainer>
  )
}
