/**
 * A count and its noun: `3 changes`, `1 filing`.
 *
 * The app reaches for `pluralize` here, which is not a dependency of this
 * prototype and would be a whole irregular-noun engine for six call sites, all
 * of which take an `s`.
 */
export const plural = (noun: string, count: number) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`
