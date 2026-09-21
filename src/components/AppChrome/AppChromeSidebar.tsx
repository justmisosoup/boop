import { useEffect, useMemo, useState } from 'react'

import { ArrowRight, ExternalLink, Plus, type LucideIcon } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'

import { byId } from '@/lib/records'
import { ago, CURRENT_USER } from '@/lib/user'

import { AppSidebar, type AppNavLink } from './AppSidebar'
import { CommandPalette, type CommandItem } from './CommandPalette'
import { NAV_GROUPS, PRIMARY_NAV } from './navItems'
import { useBusinessSearch } from './useBusinessSearch'
import { useRecentlyViewedBusinesses } from './useRecentlyViewedBusinesses'

const glyph = (Icon: LucideIcon) => (
  <Icon aria-hidden='true' size={16} strokeWidth={1.5} />
)

// The businesses in the palette carry the same glyph as the rail's Businesses
// item, so a result and the destination it belongs to read as one thing.
const businessGlyph = PRIMARY_NAV.find(link => link.id === 'businesses')?.icon

/**
 * The rail plus the ⌘K palette it opens.
 *
 * Ported from `app/src/components/AppChrome/AppChromeSidebar.tsx` with the
 * account plumbing removed: no redux, no auth, no feature gating, no
 * route-hiding. What's left is what the app does with it — the keybinding, the
 * palette query, and the command list the palette renders.
 */
export const AppChromeSidebar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(current => !current)
      } else if (mod && event.key === '/') {
        // ⌘/ (ctrl+/) also opens the palette — a carried-over search shortcut.
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The hook stays idle until the palette reports a query via onQueryChange.
  const { loading: businessesLoading, results: businessResults } =
    useBusinessSearch(paletteQuery)
  const trimmedPaletteQuery = paletteQuery.trim()

  const businessCommands: CommandItem[] = useMemo(() => {
    if (trimmedPaletteQuery.length < 2) return []

    // Newest first.
    const sorted = [...businessResults].sort((a, b) => {
      const aTime = a.created_date ? new Date(a.created_date).getTime() : 0
      const bTime = b.created_date ? new Date(b.created_date).getTime() : 0
      return bTime - aTime
    })

    const items: CommandItem[] = sorted.map(business => ({
      id: `bus-${business.id}`,
      group: 'Businesses',
      label: business.name,
      icon: businessGlyph,
      matchQuery: trimmedPaletteQuery,
      // Relative "added" date — also disambiguates same-name hits.
      trailing: business.created_date ? ago(business.created_date) : undefined,
      serverFiltered: true,
      onSelect: () => navigate(`/businesses/${business.id}`)
    }))

    if (businessResults.length > 0) {
      items.push({
        id: 'bus-see-all',
        group: 'Businesses',
        label: `See all results for “${trimmedPaletteQuery}”`,
        icon: <ArrowRight aria-hidden='true' size={16} strokeWidth={1.5} />,
        // Reachable by ⌘↵ from anywhere; the palette renders the chord hint.
        primaryAction: true,
        serverFiltered: true,
        onSelect: () =>
          navigate(`/businesses?q=${encodeURIComponent(trimmedPaletteQuery)}`)
      })
    }

    return items
  }, [businessResults, trimmedPaletteQuery, navigate])

  // Recents make the palette's empty state a useful launcher. Captured off the
  // route rather than a store, so a table click and a deep link both count.
  const { recents, record: recordRecentBusiness } =
    useRecentlyViewedBusinesses()
  const viewedId = location.pathname.match(/^\/businesses\/([^/]+)/)?.[1]
  useEffect(() => {
    const viewed = byId(viewedId)
    if (viewed) recordRecentBusiness({ id: viewed.id, name: viewed.name })
  }, [viewedId, recordRecentBusiness])

  const recentCommands: CommandItem[] = useMemo(() => {
    // Recents only fill the empty/short-query state; live results take over
    // once the user starts typing.
    if (trimmedPaletteQuery.length >= 2) return []
    return recents.map(business => ({
      id: `recent-${business.id}`,
      group: 'Recent',
      label: business.name,
      icon: businessGlyph,
      onSelect: () => navigate(`/businesses/${business.id}`)
    }))
  }, [recents, trimmedPaletteQuery, navigate])

  const staticCommands: CommandItem[] = [
    // Top-level destinations keep their own icons under "Go to".
    ...PRIMARY_NAV.map(link => ({
      id: `goto-${link.id}`,
      group: 'Go to',
      label: link.label,
      icon: link.icon,
      keywords: link.href,
      onSelect: () => navigate(link.href)
    })),
    // Grouped items file under their group's section and inherit its icon, so
    // the palette's icon column is always filled (no empty left gutter) and the
    // sections mirror the sidebar.
    ...NAV_GROUPS.flatMap(group =>
      group.items
        .filter((item): item is AppNavLink => 'href' in item)
        .map(link => ({
          id: `goto-${link.id}`,
          group: group.label,
          label: link.label,
          icon: group.icon,
          keywords: link.href,
          onSelect: () => navigate(link.href)
        }))
    ),
    {
      id: 'act-order',
      group: 'Actions',
      label: 'Place an order',
      icon: glyph(Plus),
      keywords: 'verify create new business',
      onSelect: () => navigate('/order')
    },
    {
      id: 'act-docs',
      group: 'Actions',
      label: 'Open docs',
      icon: glyph(ExternalLink),
      keywords: 'docs api developer help documentation',
      onSelect: () =>
        window.open('https://docs.middesk.com/home', '_blank', 'noopener')
    }
  ]

  return (
    <>
      <AppSidebar
        account={{ name: CURRENT_USER, email: 'smenefee@middesk.com' }}
        activeHref={location.pathname}
        groups={NAV_GROUPS}
        primary={PRIMARY_NAV}
        themeMode='light'
        onOpenSearch={() => setPaletteOpen(true)}
        onProfileSettings={() => navigate('/settings/profile')}
      />
      <CommandPalette
        commands={[...businessCommands, ...recentCommands, ...staticCommands]}
        loading={businessesLoading}
        open={paletteOpen}
        themeMode='light'
        onOpenChange={setPaletteOpen}
        onQueryChange={setPaletteQuery}
      />
    </>
  )
}
