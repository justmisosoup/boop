/**
 * Source chips without their letter tiles.
 *
 * Core gives every source a glyph, falling back to a deterministic letter tile
 * when there is no favicon. For insight themes and record sources there is
 * never a favicon, so every chip carried a coloured letter that duplicated the
 * first character of the word beside it — decoration standing in for an icon
 * that does not exist.
 *
 * These reach into core's own markup by class, which is the trade for not
 * forking the vendored copy. The real fix is a `glyph={false}` prop on the
 * primitives; until then this is one place to change rather than eight.
 */

/** For `ChatSourceChip` — a single 12px tile before the label. */
export const CHIP_NO_GLYPH = '[&_.size-3.overflow-hidden]:hidden'

/** For `ChatSources` — up to three overlapped 16px tiles before the count. */
export const ROLLUP_NO_GLYPH = '[&_.-space-x-1]:hidden'

/**
 * The claim chip's tint.
 *
 * Overrides core's neutral chip colours rather than forking them; `cn` is
 * tailwind-merge, so these win the background and text groups outright. The
 * tokens are in `src/theme.css`.
 */
export const CHIP_CLAIM =
  'bg-[var(--chip-claim-bg)] text-[var(--chip-claim-fg)] hover:bg-[var(--chip-claim-hover-bg)] hover:text-[var(--chip-claim-fg)] data-[state=open]:bg-[var(--chip-claim-hover-bg)] data-[state=open]:text-[var(--chip-claim-fg)]'

/** A submitted value nothing verifies: the warning tone, so it is not read as
 *  one of the claimed-and-checked values beside it. */
export const CHIP_UNVERIFIED =
  'bg-[var(--core-color-status-warning-bg)] text-[var(--core-color-status-warning-fg)] ring-1 ring-inset ring-[var(--core-color-status-warning-border)] hover:bg-[var(--core-color-status-warning-bg)] hover:text-[var(--core-color-status-warning-fg)] data-[state=open]:bg-[var(--core-color-status-warning-bg)] data-[state=open]:text-[var(--core-color-status-warning-fg)]'
