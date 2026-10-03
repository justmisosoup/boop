import { profileName } from './attributes'
import type { BusinessRecord } from './deriveResults'

/** The site's address as people say it: "sprig.com". */
const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`
const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/**
 * The Web presence assessment, as the Assistant states it under Industry: the
 * business's site — whether it is up, how long its domain has been held and
 * with whom — its third-party profiles, and its online reputation where a
 * platform rates it. From the record alone; nothing the record does not hold.
 */
export const webPresenceSummary = (record: BusinessRecord): { headline: string; summary: string } => {
  const site = record.website?.url ? record.website : undefined
  const profiles = record.profiles ?? []
  const n = profiles.length
  const online = site?.status === 'online'

  const headline = site
    ? `Website ${online ? 'online' : 'found'}${n > 0 ? `, with ${plural(n, 'third-party profile')}` : ''}`
    : n > 0
      ? `No website; ${plural(n, 'third-party profile')}`
      : 'No web presence found'

  // The site, and how long its domain has been held.
  const created = site?.domainCreated ? new Date(site.domainCreated) : undefined
  const years = created && !Number.isNaN(created.getTime()) ? Math.floor((Date.now() - created.getTime()) / (365.25 * 86_400_000)) : undefined
  const registrar = site?.registrar?.replace(/\.+$/, '')
  const siteLine = site
    ? `The site is ${hostOf(site.url as string)}${
        created
          ? `, its domain registered ${years && years > 0 ? `${plural(years, 'year')} ago` : `in ${created.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}${
              registrar ? ` with ${registrar}` : ''
            }`
          : ''
      }.`
    : n === 0
      ? 'No website was submitted or found, and no third-party profiles.'
      : ''

  // Where else it is found, with how many where one platform has several.
  const byPlatform = new Map<string, number>()
  for (const p of profiles) byPlatform.set(profileName(p.type ?? ''), (byPlatform.get(profileName(p.type ?? '')) ?? 0) + 1)
  const platforms = [...byPlatform.entries()].map(([name, k]) => (k > 1 ? `${name} (${k})` : name))
  const profilesLine = platforms.length > 0 ? `Profiles on ${list(platforms)}.` : ''

  // How the platforms that rate it rate it: a BBB grade and its complaints,
  // and the review scores — only those with reviews behind them.
  const ratings = profiles.flatMap((p) => {
    const m = (p.metadata ?? {}) as Record<string, unknown>
    const type = (p.type ?? '').toLowerCase()
    const out: string[] = []
    if (type === 'bbb' && typeof m.bbb_rating === 'string')
      out.push(
        `BBB rating ${m.bbb_rating}${typeof m.complaints_total === 'number' && m.complaints_total > 0 ? ` with ${plural(m.complaints_total, 'complaint')}` : ''}`
      )
    if (typeof p.rating === 'number' && (p.ratingCount ?? 0) > 0)
      out.push(`${p.rating} from ${plural(p.ratingCount as number, 'review')} on ${profileName(p.type ?? '')}`)
    return out
  })
  // Once each: a business with two BBB pages has one BBB rating.
  const shown = [...new Set(ratings)]
  const reputationLine = shown.length > 0 ? `${shown.slice(0, 3).join('; ')}.` : ''

  const summary = [siteLine, profilesLine, reputationLine].filter(Boolean).join(' ')
  return { headline, summary }
}
