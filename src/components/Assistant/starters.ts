/**
 * What to ask first.
 *
 * The three questions Kha's assistant opens with, in its words. They stand in
 * for suggestions until an answer carries its own (`AnalysisResult.suggestions`),
 * and they are the empty state's rows: a conversation that has not started is
 * an invitation, not a blank.
 */
export const STARTERS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'brief', label: 'Give me a two-minute brief on this business.' },
  { id: 'closer-look', label: 'What still needs a closer look?' },
  { id: 'address', label: 'What does the report show about this address?' }
]

/**
 * What to offer under an answer.
 *
 * The answer's own suggestions when it wrote any; otherwise the starters the
 * conversation has not asked yet, so the same question is never offered twice.
 */
export const suggestionsFor = (
  own: string[] | undefined,
  asked: ReadonlyArray<string>
): Array<{ id: string; label: string }> => {
  if (own && own.length > 0) return own.map((label, i) => ({ id: `s-${i}`, label }))
  const seen = new Set(asked.map((a) => a.trim().toLowerCase()))
  return STARTERS.filter((s) => !seen.has(s.label.toLowerCase()))
}
