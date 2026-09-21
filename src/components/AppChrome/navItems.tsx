import {
  Building2,
  CircleCheckBig,
  Compass,
  Landmark,
  Radio,
  ScanSearch,
  Settings as SettingsIcon,
  Zap,
  type LucideIcon
} from 'lucide-react'

import type {
  AppNavGroupConfig,
  AppNavLink,
  AppNavSection
} from './AppSidebar'

/**
 * The nav the rail renders.
 *
 * The app builds this from account roles, feature flags and package settings
 * (`app/src/components/AppChrome/useAppNav.tsx`). The prototype has no account,
 * so this is the same IA — same labels, hrefs, icons and order — held flat and
 * ungated. Every destination except Businesses renders a stub; they are kept
 * so the rail looks and behaves like the real one.
 */

// Lighter 1.5 stroke reads calmer/simpler at 16px than lucide's default.
const glyph = (Icon: LucideIcon) => (
  <Icon aria-hidden='true' size={16} strokeWidth={1.5} />
)

// Stands in for the real account id in the entity routes. Only shapes the URL.
const ACCOUNT_ID = 'prototype'

export const PRIMARY_NAV: AppNavLink[] = [
  { id: 'explorer', label: 'Explorer', href: '/explorer', icon: glyph(Compass) },
  {
    id: 'formations',
    label: 'Formations',
    href: `/entity/partner/${ACCOUNT_ID}/formations`,
    icon: glyph(Building2)
  },
  {
    id: 'convert',
    label: 'Customer Acquisition',
    href: '/convert',
    icon: glyph(ScanSearch)
  },
  { id: 'signal', label: 'Signal', href: '/signal', icon: glyph(Radio) },
  {
    id: 'businesses',
    label: 'Businesses',
    href: '/businesses',
    icon: glyph(CircleCheckBig)
  }
]

const entityItems: (AppNavLink | AppNavSection)[] = [
  {
    id: 'entity-home',
    label: 'Home',
    href: `/entity/partner/${ACCOUNT_ID}`,
    exact: true
  },
  {
    id: 'entity-export',
    label: 'Export IDs',
    href: `/entity/partner/${ACCOUNT_ID}/export?hide_completed=true`
  },
  {
    id: 'entity-info',
    label: 'Information requests',
    href: `/entity/partner/${ACCOUNT_ID}/information_requests`
  }
]

const settingsItems: (AppNavLink | AppNavSection)[] = [
  { id: 'settings-general', sectionLabel: 'General' },
  { id: 'agents', label: 'Agents', href: '/settings/agents' },
  { id: 'batches', label: 'Batch orders', href: '/settings/batches' },
  {
    id: 'exports',
    label: 'Business exports',
    href: '/settings/business_exports'
  },
  { id: 'team', label: 'Team', href: '/settings/team' },
  { id: 'lien-filing', label: 'Lien filing', href: '/settings/lien-filing' },
  { id: 'people-risk', label: 'People Risk', href: '/settings/people-risk' },
  {
    id: 'risky-keywords',
    label: 'Risky Keywords',
    href: '/settings/risky-keywords'
  },
  { id: 'screenings', label: 'Screenings', href: '/settings/screenings' },
  { id: 'subaccounts', label: 'Subaccounts', href: '/settings/subaccounts' },
  { id: 'denylist', label: 'TIN Denylist', href: '/settings/denylist' },
  {
    id: 'verification-sources',
    label: 'Data Settings',
    href: '/settings/verification-sources'
  },
  { id: 'settings-developer', sectionLabel: 'Developer' },
  { id: 'credentials', label: 'Credentials', href: '/settings/credentials' },
  { id: 'logs', label: 'API Logs', href: '/settings/logs' },
  {
    id: 'security-event-logs',
    label: 'Security Event Logs',
    href: '/settings/security-event-logs'
  },
  { id: 'webhooks', label: 'Webhooks', href: '/settings/webhooks' },
  { id: 'sdk', label: 'SDK Settings', href: '/settings/sdk' },
  {
    id: 'sandbox-config',
    label: 'Sandbox Configuration',
    href: '/settings/sandbox-configuration'
  }
]

export const NAV_GROUPS: AppNavGroupConfig[] = [
  {
    id: 'entity',
    label: 'Tax registrations',
    icon: glyph(Landmark),
    items: entityItems
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: glyph(Zap),
    items: [
      { id: 'policies', label: 'Policies', href: '/settings/policies' },
      { id: 'monitoring', label: 'Monitoring', href: '/settings/monitoring' }
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: glyph(SettingsIcon),
    items: settingsItems
  }
]

const isLink = (entry: AppNavLink | AppNavSection): entry is AppNavLink =>
  'href' in entry

/**
 * Every destination in the rail, flattened. The router turns these into stub
 * routes (so active states resolve rather than 404), and the command palette
 * turns them into its "Go to" and group sections.
 */
export const ALL_NAV_LINKS: { link: AppNavLink; group: string }[] = [
  ...PRIMARY_NAV.map(link => ({ link, group: 'Go to' })),
  ...NAV_GROUPS.flatMap(group =>
    group.items.filter(isLink).map(link => ({ link, group: group.label }))
  )
]
