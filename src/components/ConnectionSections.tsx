import { MutedText, Text } from '@/core'

import type { BusinessRecord } from '../lib/deriveResults'
import { relatedBusinessesOf } from '../lib/relatedBusinesses'
import { AttributeCells } from './AttributeGrid'
import type { AttributeCell } from './AttributeGrid'

type Connection = NonNullable<BusinessRecord['connections']>[number]

/** "Shared person (1)", "Shared addresses (2)". */
const countLabel = (n: number, one: string, many: string) => `${n === 1 ? one : many} (${n})`

/**
 * A title as the dashboard prints it (`TitleCell`, DiveCards/Connections.tsx):
 * an all-caps title longer than three letters becomes words, a short one —
 * CEO, CFO — stays.
 */
const titleLabel = (t: string) =>
  t.length > 3 && t === t.toUpperCase()
    ? t
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    : t

/** The name as filed, and under it every title the filing gives. */
const Person = ({ name, titles = [] }: { name: string; titles?: string[] }) => (
  <span className="flex flex-col">
    <span>{name}</span>
    {titles.length > 0 && (
      <span className="text-caption text-text-secondary">
        {titles.map(titleLabel).join(', ')}
      </span>
    )}
  </span>
)

/** One connected business: its name and confidence, then what is shared. */
export const cellsFor = (c: Connection, i: number): AttributeCell[] => {
  const people = c.people ?? []
  const addresses = c.addresses ?? []
  const businesses = c.businesses ?? []
  const confidence = typeof c.confidence === 'number' ? `${Math.round(c.confidence * 100)}%` : undefined

  return [
    {
      key: `${i}:lead`,
      span: 'full',
      values: [
        {
          value: (
            <span className="flex items-baseline gap-3">
              <Text size="sm" className="min-w-0 flex-1 font-medium leading-snug">
                {c.name}
              </Text>
              {confidence && <MutedText className="shrink-0 text-caption tabular-nums">{confidence}</MutedText>}
            </span>
          )
        }
      ]
    },
    ...(people.length > 0
      ? [
          {
            key: `${i}:people`,
            span: 'full' as const,
            label: countLabel(people.length, 'Shared person', 'Shared people'),
            values: people.map((p, j) => ({ key: `${j}`, value: <Person name={p.name} titles={p.titles} /> }))
          }
        ]
      : []),
    // A business named on the other's filing: Miette Cakes LLC is the manager
    // on Miette, LLC's. Shown under the title it is named with.
    ...(businesses.length > 0
      ? [
          {
            key: `${i}:businesses`,
            span: 'full' as const,
            label: countLabel(businesses.length, 'Shared business', 'Shared businesses'),
            values: businesses.map((b, j) => ({ key: `${j}`, value: <Person name={b.name} titles={b.titles} /> }))
          }
        ]
      : []),
    // Each shared address its own cell, as the record's locations are.
    ...addresses.map((a, j) => ({
      key: `${i}:address:${j}`,
      label: 'Shared address',
      values: [{ value: a.fullAddress }]
    })),
  ]
}

/**
 * The Related businesses source card's body: each related business, strongest
 * first, and under it how it is connected to this one — the people it shares
 * (with the titles the filing gives), then a business named on the other's
 * filing, then the addresses. The report counts these; this is where the
 * values are.
 */
export const ConnectionSections = ({ record }: { record: BusinessRecord }) => (
  <>
    {relatedBusinessesOf(record).map((c, i) => (
      // A solid rule between businesses; the dashed rules stay within one.
      <div key={c.id ?? i} className="overflow-hidden border-b border-[var(--core-color-border-divider)] last:border-b-0">
        <AttributeCells items={cellsFor(c, i)} className="-mb-px" />
      </div>
    ))}
  </>
)
