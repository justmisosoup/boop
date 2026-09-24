/**
 * How a report is named and dated, everywhere one is named.
 *
 * The Report tab's card, the Reports tab's rows and the assistant's marker all
 * say the same two things about a run: the assessment it was run from, and
 * when. One place, so a run reads the same in all three.
 */

/** What the report is called: the assessment it was run from. */
export const reportLabel = (r: { name: string }) => r.name

/** Month names as the page writes them: "Sept 22 2026", not "22 Sep 2026". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']

/** "Sept 22 2026". */
export const formatDate = (iso: string) => {
  const d = new Date(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`
}

/** "1:06 PM". */
export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "Sept 22 2026 · 1:06 PM". */
export const formatStamp = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`

/** When it was run — the day, for telling two runs of one assessment apart. */
export const reportDate = (r: { at: string }) => (r.at ? formatDate(r.at) : '')

/** The time of day — two runs on one day are told apart by nothing else. */
export const reportTime = (r: { at: string }) => (r.at ? formatTime(r.at) : '')

/** Day and time, as one stamp. */
export const reportStamp = (r: { at: string }) =>
  [reportDate(r), reportTime(r)].filter(Boolean).join(' · ')
