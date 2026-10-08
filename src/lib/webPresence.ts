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

  // The site, and how long its domain has been held: "Its website,
  // themalamarket.com, is online; the domain was registered 10 years ago
  // with Squarespace Domains II LLC."
  const created = site?.domainCreated ? new Date(site.domainCreated) : undefined
  const years = created && !Number.isNaN(created.getTime()) ? Math.floor((Date.now() - created.getTime()) / (365.25 * 86_400_000)) : undefined
  const registrar = site?.registrar?.replace(/\.+$/, '')
  const siteLine = site
    ? `Its website, ${hostOf(site.url as string)}, is ${online ? 'online' : 'found'}${
        created
          ? `; the domain was registered ${years && years > 0 ? `${plural(years, 'year')} ago` : `in ${created.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}${
              registrar ? ` with ${registrar}` : ''
            }`
          : ''
      }.`
    : n === 0
      ? 'No website was submitted or found, and it has no third-party profiles.'
      : 'No website was submitted or found.'

  // Where else it is found, with how many where one platform has several:
  // "It has one third-party profile, on Trustpilot."
  const byPlatform = new Map<string, number>()
  for (const p of profiles) byPlatform.set(profileName(p.type ?? ''), (byPlatform.get(profileName(p.type ?? '')) ?? 0) + 1)
  const platforms = [...byPlatform.entries()].map(([name, k]) => (k > 1 ? `${name} (${k})` : name))
  const profilesLine =
    platforms.length > 0 ? `It has ${n === 1 ? 'one third-party profile' : plural(n, 'third-party profile')}, on ${list(platforms)}.` : ''

  // How the platforms that rate it rate it — only those with reviews behind
  // them — and the BBB's grade with its complaints: "It is rated 4 from 3
  // reviews on Trustpilot. Its BBB rating is A-, with 2 complaints."
  const reviews = [
    ...new Set(
      profiles.flatMap((p) =>
        typeof p.rating === 'number' && (p.ratingCount ?? 0) > 0
          ? [`${p.rating} from ${plural(p.ratingCount as number, 'review')} on ${profileName(p.type ?? '')}`]
          : []
      )
    )
  ]
  const bbb = profiles.find((p) => (p.type ?? '').toLowerCase() === 'bbb' && typeof (p.metadata as Record<string, unknown> | undefined)?.bbb_rating === 'string')
  const bbbMeta = (bbb?.metadata ?? {}) as Record<string, unknown>
  // One profile, and it is the one that rates it: one sentence — "It has
  // one third-party profile, on Trustpilot, where it is rated 4 from 3 reviews."
  const only = platforms.length === 1 && reviews.length === 1 && reviews[0].endsWith(` on ${platforms[0]}`)
  const profilesSaid = only ? `It has one third-party profile, on ${platforms[0]}, where it is rated ${reviews[0].slice(0, -` on ${platforms[0]}`.length)}.` : profilesLine
  const reputationLine = [
    reviews.length > 0 && !only ? `It is rated ${list(reviews.slice(0, 3))}.` : '',
    bbb
      ? `Its BBB rating is ${bbbMeta.bbb_rating as string}${typeof bbbMeta.complaints_total === 'number' && bbbMeta.complaints_total > 0 ? `, with ${plural(bbbMeta.complaints_total, 'complaint')}` : ''}.`
      : ''
  ]
    .filter(Boolean)
    .join(' ')

  const summary = [siteLine, profilesSaid, reputationLine].filter(Boolean).join(' ')
  return { headline, summary }
}
