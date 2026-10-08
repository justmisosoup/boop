import {
  BadgeCheck,
  Boxes,
  FileText,
  Globe,
  Landmark,
  type LucideIcon,
  Mail,
  Package,
  ScanSearch,
  Users
} from 'lucide-react'

import type { OrderCatalog } from './types'

// A tile is either an insight, ordered from the first listed package the
// account can order that offers it, or a single-insight package of its own.
type TileSpec = { group: string; from: readonly string[] } | { package: string }

type SectionSpec = {
  id: string
  title: string
  icon: LucideIcon
  // Untitled when a section has a single group.
  groups: readonly { title: string | null; tiles: readonly TileSpec[] }[]
}

const VERIFY = ['business_verification_verify', 'identity'] as const

const fromVerify = (groups: string[]): TileSpec[] =>
  groups.map(group => ({ group, from: VERIFY }))

const packages = (keys: string[]): TileSpec[] =>
  keys.map(key => ({ package: key }))

const single = (tiles: TileSpec[]) => [{ title: null, tiles }]

// How the builder organizes insights for customers. Selecting a tile orders
// whatever provides it; this only decides where each tile appears.
const SECTIONS: readonly SectionSpec[] = [
  {
    id: 'business_verification',
    title: 'Business Verification',
    icon: BadgeCheck,
    groups: [
      {
        title: 'Name matching',
        tiles: fromVerify(['business_name', 'dba_name', 'name_entity_type'])
      },
      {
        title: 'Registrations',
        tiles: fromVerify([
          'sos_registration_status',
          'sos_domestic_standing',
          'sos_state_match',
          'formation_state',
          'entity_type_match',
          'entity_type'
        ])
      },
      { title: 'TIN', tiles: fromVerify(['tin_match', 'tin_type']) },
      {
        title: 'Addresses',
        tiles: fromVerify([
          'address_verification',
          'address_deliverability',
          'address_property_type',
          'location_frequency',
          'address_flags',
          'address_risk'
        ])
      }
    ]
  },
  {
    id: 'people_and_ownership',
    title: 'People & ownership',
    icon: Users,
    groups: single([
      ...fromVerify(['person_verification', 'business_connections']),
      ...packages(['kyc'])
    ])
  },
  {
    id: 'compliance_screenings',
    title: 'Compliance Screenings',
    icon: ScanSearch,
    groups: single([
      { group: 'watchlist', from: ['enhanced_screenings', ...VERIFY] },
      { group: 'politically_exposed_persons', from: ['enhanced_screenings'] },
      ...packages(['adverse_media'])
    ])
  },
  {
    id: 'business_records',
    title: 'Business records',
    icon: Landmark,
    groups: single([
      ...packages(['liens', 'tax_liens', 'ucc_liens', 'litigations']),
      { group: 'bankruptcies', from: ['bankruptcies', ...VERIFY] },
      ...fromVerify(['ppp_loans'])
    ])
  },
  {
    id: 'people_records',
    title: 'People records',
    icon: FileText,
    groups: single(
      packages([
        'people_tax_liens',
        'people_ucc_liens',
        'people_bankruptcies',
        'people_litigations',
        'people_criminal_history'
      ])
    )
  },
  {
    id: 'web_analysis',
    title: 'Web Analysis',
    icon: Globe,
    groups: single([
      { group: 'website_status', from: ['web_analysis', 'identity'] },
      ...[
        'website_discovery',
        'domain',
        'web_presence_quality',
        'web_content_match',
        'profiles',
        'risky_keywords'
      ].map(group => ({ group, from: ['web_analysis'] })),
      { group: 'industry', from: ['industry_classification', 'identity'] }
    ])
  },
  {
    id: 'contact_risk',
    title: 'Contact Risk',
    icon: Mail,
    groups: single(packages(['email_risk', 'phone_risk']))
  }
]

export type BuilderTile = {
  packageKey: string
  groupId: string
  title: string
  description: string
  dataCy: string
}

export type BuilderSection = {
  id: string
  title: string
  icon: LucideIcon
  groups: { title: string | null; tiles: BuilderTile[] }[]
}

export const tilesIn = (section: BuilderSection) =>
  section.groups.flatMap(g => g.tiles)

export const builderSections = (catalog: OrderCatalog): BuilderSection[] => {
  const pkgOf = (key: string) => catalog.packages.find(p => p.key === key)
  const groupOf = (id: string) => catalog.insight_groups.find(g => g.id === id)
  const placedGroups = new Set<string>()
  const placedPackages = new Set<string>()

  const resolve = (spec: TileSpec): BuilderTile[] => {
    if ('package' in spec) {
      const pkg = pkgOf(spec.package)
      const [groupId] = pkg?.insight_group_ids ?? []
      if (!pkg || !groupId) return []
      placedPackages.add(pkg.key)
      return [
        {
          packageKey: pkg.key,
          groupId,
          title: pkg.label,
          description: pkg.description,
          dataCy: `CustomOrderPackage-${pkg.key}`
        }
      ]
    }
    const packageKey = spec.from.find(key =>
      pkgOf(key)?.insight_group_ids.includes(spec.group)
    )
    const group = groupOf(spec.group)
    if (!packageKey || !group) return []
    placedGroups.add(group.id)
    return [
      {
        packageKey,
        groupId: group.id,
        title: group.label,
        description: group.description,
        dataCy: `CustomOrderInsight-${packageKey}-${group.id}`
      }
    ]
  }

  const sections = SECTIONS.map(({ groups, ...spec }) => ({
    ...spec,
    groups: groups
      .map(g => ({ title: g.title, tiles: g.tiles.flatMap(resolve) }))
      .filter(g => g.tiles.length > 0)
  }))

  // The catalog can offer insights this layout doesn't know yet; they stay
  // orderable rather than silently disappearing.
  const unplaced = catalog.packages
    .filter(p => !placedPackages.has(p.key))
    .flatMap(pkg =>
      pkg.insight_group_ids
        .filter(id => !placedGroups.has(id))
        .flatMap(id => {
          placedGroups.add(id)
          return resolve({ group: id, from: [pkg.key] })
        })
    )

  return [
    ...sections,
    {
      id: 'more',
      title: 'More insights',
      icon: Package,
      groups: [{ title: null, tiles: unplaced }]
    }
  ].filter(section => tilesIn(section).length > 0)
}

export type BuilderBundle = {
  id: string
  title: string
  description: string
  icon: LucideIcon
  tiles: Pick<BuilderTile, 'packageKey' | 'groupId'>[]
}

const BUNDLE_ICONS: Record<string, LucideIcon> = {
  business_verification_verify: BadgeCheck,
  identity: BadgeCheck,
  web_analysis: Globe,
  enhanced_screenings: ScanSearch
}

const BUNDLE_TITLES: Record<string, string> = {
  business_verification_verify: 'Business Verify'
}

// Every multi-insight package can still be added whole, the way it is sold
// today.
export const builderBundles = (catalog: OrderCatalog): BuilderBundle[] =>
  catalog.packages
    .filter(pkg => pkg.insight_group_ids.length > 1)
    .map(pkg => {
      const title = BUNDLE_TITLES[pkg.key] ?? pkg.label
      return {
        id: pkg.key,
        title,
        description: `All ${pkg.insight_group_ids.length} ${title} insights.`,
        icon: BUNDLE_ICONS[pkg.key] ?? Boxes,
        tiles: pkg.insight_group_ids.map(groupId => ({
          packageKey: pkg.key,
          groupId
        }))
      }
    })

const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? []

// Each query word must start a word in the text, so "tin" finds "TIN match"
// but not "rating".
export const matchesSearch = (query: string, texts: string[]) => {
  const terms = words(query)
  const haystack = texts.flatMap(words)
  return terms.every(term => haystack.some(word => word.startsWith(term)))
}
