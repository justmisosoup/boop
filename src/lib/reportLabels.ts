/**
 * How a report is named and dated, everywhere one is named.
 *
 * The Report tab's card, the Reports tab's rows and the assistant's marker all
 * say the same two things about a run: the assessment it was run from, and
 * when. One place, so a run reads the same in all three.
 */

/** What the report is called: the assessment it was run from. */
export const reportLabel = (r: { name: string }) => r.name

/** When it was run — the day, for telling two runs of one assessment apart. */
export const reportDate = (r: { at: string }) =>
  r.at
    ? new Date(r.at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : ''

/** The time of day — two runs on one day are told apart by nothing else. */
export const reportTime = (r: { at: string }) =>
  r.at
    ? new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : ''

/** Day and time, as one stamp. */
export const reportStamp = (r: { at: string }) =>
  [reportDate(r), reportTime(r)].filter(Boolean).join(' · ')
