export const capitalize = (originalString?: string | null): string => {
  const stringToConvert = originalString || ''

  return (
    stringToConvert.charAt(0).toUpperCase() +
    stringToConvert.slice(1).toLowerCase()
  )
}

export function upperFirst(originalString?: string | null): string {
  const stringToConvert = originalString || ''
  const capitalizedFirstLetter = stringToConvert.charAt(0).toUpperCase()
  const restOfString = stringToConvert.slice(1)

  return `${capitalizedFirstLetter}${restOfString}`
}

/**
 * The separator that precedes item `index` of a `total`-item list, in the app's
 * house style: "a and b", "a, b, and c" (serial comma). Returns '' before the
 * first item.
 *
 * Exported because not every list is a list of STRINGS — the Explorer chat
 * joins clickable node references, so it can't call `joinWithAnd` but must read
 * the same rule. One definition, so the two can't drift apart.
 */
export function listSeparator(index: number, total: number): string {
  if (index === 0) return ''
  if (index < total - 1) return ', '
  return total > 2 ? ', and ' : ' and '
}

export function joinWithAnd(strings: string[]): string {
  return strings.reduce(
    (out, item, index) => out + listSeparator(index, strings.length) + item,
    ''
  )
}

/**
 * Middle-ellipsize a long display name: `BRIGHTHOUSE LIFE … NEW YORK`.
 *
 * Middle rather than end, because entity names in this domain share long
 * prefixes and differ at the TAIL — "…INSURANCE COMPANY OF NEW YORK" vs
 * "…OF NEW JERSEY" — so clipping the end throws away the identifying half.
 * The ellipsis costs one character of the budget; an odd remainder goes to the
 * head. `max` counts characters, so use this only where a character bound is
 * the real constraint (single-line `nowrap` text); for width-driven truncation
 * with a reveal-on-overflow tooltip, use `@/core`'s `TruncatedText`.
 */
export function middleEllipsis(text: string, max: number): string {
  if (text.length <= max) return text
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`
}
