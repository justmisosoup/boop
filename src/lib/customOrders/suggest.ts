import {
  conflictFor,
  type Draft,
  setInsightsSelected
} from './model'
import type { OrderCatalog } from './types'

import { type BuilderTile, builderSections } from './layout'

// Words that say nothing about which insight is meant: connectives, and the
// verbs nearly every insight's description uses ("match", "check").
const STOP_WORDS = new Set(
  'a an and any are as at be by can do does for from has have if in into is it its me my of on or our that the their them then this to was we what when where which who will with want need make sure whether also should all run check checks verify confirm compare match matches matching against submitted associated account'.split(
    ' '
  )
)

// Instructions say "person" or "owner"; the insights say "people".
const SYNONYMS: Record<string, string> = {
  person: 'people',
  persons: 'people',
  individual: 'people',
  individuals: 'people',
  owner: 'people',
  owners: 'people'
}

const words = (text: string) =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map(w => SYNONYMS[w] ?? w)
    .filter(w => !STOP_WORDS.has(w))

// Compares the first five letters so "registered" finds "Registration";
// short words must match whole.
const sameWord = (a: string, b: string) =>
  a.length >= 4 && b.length >= 4 ? a.slice(0, 5) === b.slice(0, 5) : a === b

/**
 * A best guess at the insights a workflow's instructions ask for. A tile is
 * picked when the instructions cover at least half the words of its title, or
 * name one word of its title and a different word of its description. A word
 * found in more than a third of the tiles ("business") says nothing about
 * which one is meant, so it doesn't count. Adds, never removes, and skips a
 * tile whose package can't be combined with one already chosen.
 */
export const suggestInsights = (
  catalog: OrderCatalog,
  draft: Draft,
  instructions: string
): { draft: Draft; added: number } => {
  const tiles = builderSections(catalog).flatMap(section =>
    section.groups.flatMap(group =>
      group.tiles.map(tile => ({
        tile,
        title: [...new Set(words(tile.title))],
        context: words(`${tile.description} ${group.title ?? ''}`)
      }))
    )
  )
  const has = (list: string[], term: string) =>
    list.some(w => sameWord(term, w))
  const terms = [...new Set(words(instructions))].filter(
    term =>
      tiles.filter(t => has(t.title, term) || has(t.context, term)).length <=
      tiles.length / 3
  )

  const picks: BuilderTile[] = tiles
    .filter(t => {
      const inTitle = terms.filter(term => has(t.title, term))
      const covered = t.title.filter(w => terms.some(term => sameWord(term, w)))
      const inContext = terms.filter(
        term => !inTitle.includes(term) && has(t.context, term)
      )
      return (
        covered.length * 2 >= t.title.length ||
        (inTitle.length > 0 && inContext.length > 0)
      )
    })
    .filter(t => t.title.length > 0)
    .map(t => t.tile)

  let next = draft
  let added = 0
  for (const tile of picks) {
    if (
      !next.packages.includes(tile.packageKey) &&
      conflictFor(catalog, next, tile.packageKey)
    )
      continue
    const after = setInsightsSelected(catalog, next, [tile], true)
    if (after !== next) added += 1
    next = after
  }
  return { draft: next, added }
}
