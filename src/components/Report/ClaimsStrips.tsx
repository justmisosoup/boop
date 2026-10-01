import { Briefcase, PackageOpen } from 'lucide-react'
import type { ReactNode } from 'react'

import { MetaChip } from '@/core'

import { attributesFor, type AttributeRow } from '../../lib/attributes'
import type { BusinessRecord } from '../../lib/deriveResults'
import { AttributeCells } from '../AttributeGrid'
import { cellsFromRows } from '../attributeCells'
import { Strip } from './Strip'

const icon = { 'aria-hidden': true, size: 12, strokeWidth: 2, className: 'shrink-0' } as const

/**
 * Whether a record is still live, as a chip: open is an open box, orange;
 * closed a shut case, grey. A status the source did not give draws nothing.
 */
const StatusChip = ({ status }: { status: string | null | undefined }) => {
  const s = (status ?? '').toLowerCase()
  if (/open/.test(s))
    return (
      <MetaChip tone="warning" size="compact">
        <PackageOpen {...icon} />
        Open
      </MetaChip>
    )
  if (/closed|terminated|lapsed|released|dismissed|satisfied|discharged/.test(s))
    return (
      <MetaChip tone="neutral" size="compact">
        <Briefcase {...icon} />
        Closed
      </MetaChip>
    )
  return null
}

/**
 * One kind of record — UCC liens, a case type — as a strip: a tile per kind,
 * counted, opening to every record of that kind beneath, each a cell with its
 * status chip beside the label and the row's own detail and source chip.
 */
const KindStrip = ({
  label,
  rows,
  statusOf,
  onJumpToSource
}: {
  label: string
  rows: AttributeRow[]
  statusOf: (i: number) => string | null | undefined
  onJumpToSource?: (cardId: string) => void
}) => {
  if (rows.length === 0) return null
  /* A tile per kind AND state — "UCC lien · Open 2", "UCC lien · Closed 12" —
     so the live ones are one click, not a scan. Open leads within a kind. */
  const stateOf = (i: number) => {
    const st = (statusOf(i) ?? '').toLowerCase()
    return /open/.test(st) ? 'Open' : /closed|terminated|lapsed|released|dismissed|satisfied|discharged/.test(st) ? 'Closed' : ''
  }
  const keyOf = (row: AttributeRow, i: number) => `${row.label}|${stateOf(i)}`
  const kinds = [...new Set(rows.map((r) => r.label))].flatMap((k) =>
    ['Open', 'Closed', ''].filter((st) => rows.some((r, i) => r.label === k && stateOf(i) === st)).map((st) => `${k}|${st}`)
  )
  // The chip says the status, so the row's own status word leaves its meta line.
  const STATUS = /^(open|closed|unknown|terminated|lapsed|released|dismissed|satisfied|discharged)$/i
  const chipped = (row: AttributeRow, i: number) =>
    cellsFromRows([{ ...row, meta: row.meta?.filter((m) => !STATUS.test(m)) }], { onJumpToSource }).map((c, j) => {
      const status: ReactNode = <StatusChip status={statusOf(i)} />
      // The status beside the label, before whatever else the row carries there.
      return j === 0
        ? {
            ...c,
            badge: (
              <span className="flex flex-wrap items-center gap-1">
                {status}
                {c.badge}
              </span>
            )
          }
        : c
    })
  return (
    <Strip
      label={label}
      tiles={kinds.map((k) => {
        const [kind, st] = k.split('|')
        const n = rows.filter((r, i) => keyOf(r, i) === k).length
        const open = st === 'Open'
        return {
          key: k,
          chip: (
            <MetaChip tone={open ? 'warning' : 'neutral'} size="compact">
              {open ? <PackageOpen {...icon} /> : st === 'Closed' ? <Briefcase {...icon} /> : null}
              {kind}
              {st && ` · ${st}`}
              {n > 1 && <span className="tabular-nums text-text-secondary">{n}</span>}
            </MetaChip>
          )
        }
      })}
      detail={(k) => (
        <>
          {rows
            .map((row, i) => [row, i] as const)
            .filter(([row, i]) => keyOf(row, i) === k)
            .map(([row, i]) => (
              // A solid rule between records; the dashed rules stay within one.
              <div key={i} className="overflow-hidden border-b border-[var(--core-color-border-divider)] last:border-b-0">
                <AttributeCells className="-mb-px" items={chipped(row, i)} />
              </div>
            ))}
        </>
      )}
    />
  )
}

/**
 * What is held against the business — its liens, litigations and bankruptcies
 * — each a strip by kind: the kind of lien (UCC, state tax, federal tax), the
 * kind of case, the chapter. Under a kind, every record of it, open or closed.
 */
export const ClaimsStrips = ({ record, onJumpToSource }: { record: BusinessRecord; onJumpToSource?: (cardId: string) => void }) => {
  const liens = record.liens ?? []
  const cases = record.litigations ?? []
  const petitions = record.bankruptcies ?? []
  if (liens.length + cases.length + petitions.length === 0) return null

  return (
    <div className="border-b border-[var(--core-color-border-divider)]">
      <KindStrip label="Liens" rows={attributesFor('liens', record)} statusOf={(i) => liens[i]?.status} onJumpToSource={onJumpToSource} />
      <KindStrip label="Litigations" rows={attributesFor('litigations', record)} statusOf={(i) => cases[i]?.caseStatus} onJumpToSource={onJumpToSource} />
      <KindStrip label="Bankruptcies" rows={attributesFor('bankruptcies', record)} statusOf={(i) => petitions[i]?.status} onJumpToSource={onJumpToSource} />
    </div>
  )
}
