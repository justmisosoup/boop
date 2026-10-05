import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useSearchParams } from 'react-router'

import {
  ActionButton,
  ActionLink,
  EmptyState,
  Heading,
  PageContainer,
  PageDescription,
  PageHeader,
  PageHeaderActions,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading,
  PageHeadingCount,
  SearchInput,
  Text
} from '@/core'

import { TeamRow } from '../components/Workflow/TeamRow'
import { WorkflowCard } from '../components/Workflow/WorkflowCard'
import { listingsByTeam, teamBySlug, WORKFLOW_COUNT, WORKFLOW_TEAMS } from '../lib/workflowCatalogue'

/**
 * The workflows marketplace.
 *
 * Every workflow Middesk lists, team by team: one paged row per team, and
 * "View all" opens one team as a full grid. Searched by name and job; the
 * query and the open team both sit in the URL as the businesses list keeps
 * its own, so a filtered page can be shared or reloaded.
 */
export const WorkflowsPage = () => {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const team = teamBySlug(params.get('team'))

  const teams = useMemo(() => listingsByTeam(query), [query])
  const open = team ? teams.find((t) => t.team.slug === team.slug) : undefined

  const onQueryChange = (value: string) => {
    setQuery(value)
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  // Back to every team, keeping the search.
  const allTeamsHref = query.trim() ? `/workflows?q=${encodeURIComponent(query)}` : '/workflows'

  return (
    <PageContainer width="wide">
      {/* `PageContainer` already provides the gutter. The top padding lands the
          title's centre on the rail's search line (74px from the top: 24px of
          container padding, then 50px less half the title's 40px line), which
          is what the band's own 2px assumes for core's smaller title. */}
      <PageHeaderBand className="px-0 pt-[30px]">
        <PageHeader>
          {/* Actions start where the description does: below the 40px title
              line and the 4px gap under it, not on the title line. */}
          <PageHeaderBar className="items-start">
            <PageHeaderTitles>
              <PageHeading className="font-arizona text-3xl font-light leading-10 tracking-[-0.02em]" size="lg" weight="normal">
                Workflows
              </PageHeading>
              <PageDescription className="text-base leading-6">
                Hand Middesk a job. It does the work, cites every source, and keeps watch.
              </PageDescription>
            </PageHeaderTitles>
            <PageHeaderActions className="mt-11">
              <SearchInput
                aria-label="Search workflows"
                className="w-56"
                placeholder="Search workflows"
                value={query}
                onChange={onQueryChange}
              />
              {/* Rendered for the shape of the page; nothing to create here yet. */}
              <ActionButton variant="primary">Create workflow</ActionButton>
            </PageHeaderActions>
          </PageHeaderBar>
        </PageHeader>
      </PageHeaderBand>

      {/* The scope line: the whole catalogue, or the one team that is open
          with the way back to all of them. A hairline closes the header. */}
      <div className="mt-6 flex items-center justify-between gap-4 border-b border-divider pb-4">
        <Text tone="secondary" size="sm" className="m-0">
          {team
            ? `${team.name} · ${open?.listings.length ?? 0} workflows`
            : `${WORKFLOW_COUNT} workflows across ${WORKFLOW_TEAMS.length} teams`}
        </Text>
        {team && (
          <ActionLink
            variant="quiet"
            size="compact"
            to={allTeamsHref}
            className="-mr-2 text-text-secondary"
            leadingIcon={<ArrowLeft aria-hidden="true" size={14} strokeWidth={1.75} />}
          >
            All teams
          </ActionLink>
        )}
      </div>

      {team ? (
        <section aria-labelledby="team-open" className="mt-8 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Heading id="team-open" level={3} className="font-arizona font-light">
              {team.name}
            </Heading>
            <PageHeadingCount>{open?.listings.length ?? 0}</PageHeadingCount>
          </div>
          {!open ? (
            <EmptyState
              title="No workflows match"
              description="Try a different name, or clear the search to see every workflow in this team."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {open.listings.map((l) => (
                <WorkflowCard key={l.slug} listing={l} />
              ))}
            </div>
          )}
        </section>
      ) : teams.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No workflows match"
            description="Try a different name, or clear the search to see every workflow."
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {teams.map(({ team: t, listings }) => (
            <TeamRow key={t.slug} team={t} listings={listings} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}
