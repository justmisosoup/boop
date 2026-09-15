/** Count of decorative tint pairs defined in `theme.css` (`--core-color-avatar-N-*`). */
export const AVATAR_TONES = 10

/**
 * A small, stable hash of a display label → one of the N tint pairs.
 * Deterministic so an identity keeps its color across renders and surfaces.
 * Shared by `Avatar` (person initials) and the chat source letter tiles
 * (domains/registries) — one tint system for every "who is this" glyph.
 */
export const toneFromLabel = (label: string): number => {
  let hash = 0
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash + label.charCodeAt(i)) % 9973
  }

  return (hash % AVATAR_TONES) + 1
}
