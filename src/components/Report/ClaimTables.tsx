import type { ReactNode } from 'react'

import { attributesFor } from '../../lib/attributes'
import type { BusinessRecord } from '../../lib/deriveResults'
import { RowProvenance } from '../Provenance'
import { chapterTitle, bankruptcySections } from './bankruptcySections'
import { StatusChip } from './ClaimsStrips'
import { lienKind, lienSections } from './lienSections'
import { caseTitle, litigationSections, partyRole } from './litigationSections'
import { RecordSections } from './recordSections'
import { ResultTable, type ResultRow } from './ResultTable'

/** Closed, in any of the words a court or filing office uses for it: cleared. */
const CLOSED = /closed|terminated|lapsed|released|dismissed|satisfied|discharged/i
const cleared = (status: string | null | undefined) => CLOSED.test(status ?? '')

/** "Filed Mar 2020". */
const filed = (iso: string | null | undefined) =>
  iso
    ? `Filed ${new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : null

const caption = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(' · ')

type Props = {
  record: BusinessRecord
  onJumpToSource?: (cardId: string) => void
  /** Under "None found": what was searched. */
  none?: ReactNode
  /** Every name searched: the clear names, where nothing was found. */
  searched?: string[]
  /** After the records: the searches that came back with nothing. */
  footnote?: ReactNode
}

/** Every lien, as the Addresses card reads its places: the kind and filing
 *  over who holds it, open or closed beside; the closed fold under "None found"
 *  where nothing is open. */
export const LienTable = ({ record, onJumpToSource, none, searched, footnote }: Props) => {
  const rows = attributesFor('liens', record)
  const results: ResultRow[] = (record.liens ?? []).map((l, i) => {
    const row = rows.find((r) => r.docId === l.id)
    const holders = (l.securedParties ?? []).map((p) => p.name).filter(Boolean)
    return {
      key: l.id ?? String(i),
      caption: caption(lienKind(l), l.state, filed(l.filingDate)),
      title: holders.join(', ') || 'Secured party not stated',
      sub: row && <RowProvenance row={row} onJumpToSource={onJumpToSource} />,
      chips: <StatusChip status={l.status} />,
      cleared: cleared(l.status),
      detail: <RecordSections sections={lienSections(l)} />
    }
  })
  return <ResultTable
      columns={['Liens', 'Status']}
      rows={results}
      none={none}
      clean={results.length === 0 ? searched : []}
      footnote={footnote}
      foldCleared={{ one: 'closed lien', many: 'closed liens', none: 'No open liens' }}
    />
}

/** Every court case: the business's part and the filing over the case's name. */
export const LitigationTable = ({ record, onJumpToSource, none, searched, footnote }: Props) => {
  const rows = attributesFor('litigations', record)
  const results: ResultRow[] = (record.litigations ?? []).map((c, i) => {
    const row = rows.find((r) => r.docId === c.id)
    return {
      key: c.id ?? String(i),
      caption: caption(partyRole(c), c.caseType, filed(c.filingDate)),
      title: caseTitle(c),
      sub: row && <RowProvenance row={row} onJumpToSource={onJumpToSource} />,
      chips: <StatusChip status={c.caseStatus} />,
      cleared: cleared(c.caseStatus),
      detail: <RecordSections sections={litigationSections(c)} />
    }
  })
  return <ResultTable
      columns={['Cases', 'Status']}
      rows={results}
      none={none}
      clean={results.length === 0 ? searched : []}
      footnote={footnote}
      foldCleared={{ one: 'closed case', many: 'closed cases', none: 'No open cases' }}
    />
}

/** Every bankruptcy petition: the court and filing over its chapter. */
export const BankruptcyTable = ({ record, onJumpToSource, none, searched, footnote }: Props) => {
  const rows = attributesFor('bankruptcies', record)
  const results: ResultRow[] = (record.bankruptcies ?? []).map((b, i) => {
    const row = rows.find((r) => r.docId === b.id)
    return {
      key: b.id ?? String(i),
      caption: caption(b.court ?? b.courtState, filed(b.filingDate)),
      title: chapterTitle(b),
      sub: row && <RowProvenance row={row} onJumpToSource={onJumpToSource} />,
      chips: <StatusChip status={b.status} />,
      cleared: cleared(b.status),
      detail: <RecordSections sections={bankruptcySections(b)} />
    }
  })
  return <ResultTable columns={['Petitions', 'Status']} rows={results} none={none} clean={results.length === 0 ? searched : []} footnote={footnote} />
}
