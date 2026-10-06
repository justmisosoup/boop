/**
 * A lien as the API returns it, normalised into the shape
 * `src/lib/deriveResults` reads. Shared by the full pull and the lien-only
 * patch so the two cannot drift.
 *
 * The API's own field names are kept on the right-hand side so the mapping is
 * auditable against `app/src/containers/Liens/types.ts`.
 */
type Any = Record<string, any>

/** A party to the filing: a debtor or a secured party, with every address
 *  the filing states for it. */
const party = (x: Any) => ({
  name: x.name,
  type: x.type ?? null,
  addresses: ((x.addresses ?? []) as Any[]).map((a) => a.full_address).filter((a): a is string => Boolean(a))
})

export const mapLien = (l: Any) => ({
  id: l.id,
  type: l.type ?? null,
  fileNumber: l.file_number ?? null,
  state: l.state ?? null,
  status: l.status ?? l.status_category ?? null,
  // The API's own reading of the status into open / processing / closed /
  // unknown, beside the status word.
  statusCategory: l.status_category ?? null,
  filingDate: l.filing_date ?? null,
  lapseDate: l.lapse_date ?? null,
  // When the filing office last changed the record.
  updatedDate: l.updated_date ?? null,
  collateral: l.collateral ?? null,
  // The filing office's classification of what is secured, where it gives one.
  collateralType: l.collateral_type ?? null,
  // What it secures, where the filing office states it. Null on most UCC-1s,
  // which is a fact about the filing rather than a gap in the pull.
  liabilityCents: typeof l.liability_cents === 'number' ? l.liability_cents : null,
  loanPrincipalCents: typeof l.loan_principal_amount_cents === 'number' ? l.loan_principal_amount_cents : null,
  // The filing office's own page for this lien.
  url: l.source ?? null,
  debtors: ((l.debtors ?? []) as Any[]).map(party),
  securedParties: ((l.secured_parties ?? []) as Any[]).map(party)
})
