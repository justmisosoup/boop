import React, { useEffect, useMemo, useState } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'
import { User } from 'lucide-react'

import { cn } from '@/utils/twUtils'

import { toneFromLabel } from './internal/identityTone'

/**
 * `Avatar` is the design-system identity chip: an image with a graceful
 * fallback to initials, and — when there is no name at all — a neutral user
 * glyph. The fallback fill is a decorative tint chosen deterministically from
 * the name (via the `--core-color-avatar-*` tokens), so a given person keeps a
 * stable color across the app. It is mode-blind: the tint tokens swap their
 * values in scoped dark.
 *
 * The avatar is presentational. When it sits next to the person's visible name
 * (e.g. a table row), pass `aria-hidden` on the avatar — or `alt=""` when an
 * image is present — so screen readers don't announce the name twice.
 */
export type AvatarSize = 'sm' | 'md' | 'lg'

const avatarVariants = cva(
  [
    'core-avatar relative inline-flex shrink-0 select-none items-center justify-center',
    'overflow-hidden rounded-full align-middle font-mono font-medium uppercase'
  ],
  {
    variants: {
      size: {
        sm: 'size-6 text-[length:var(--core-font-size-xs)]',
        md: 'size-8 text-caption',
        lg: 'size-10 text-dense'
      }
    },
    defaultVariants: { size: 'md' }
  }
)

// Gravatar URLs with a custom `d=` default (typically a silhouette PNG) always
// "succeed", so the Avatar never falls back to initials. Rewriting `d=` to `404`
// makes Gravatar return a 404 when there is no real photo — triggering onError
// and the initials fallback. Non-Gravatar URLs pass through untouched.
const normalizeGravatarSrc = (src?: string): string | undefined => {
  if (!src) return undefined
  try {
    const normalized = src.startsWith('//') ? `https:${src}` : src
    const url = new URL(normalized)
    if (!/(^|\.)gravatar\.com$/i.test(url.hostname)) return src
    url.searchParams.set('d', '404')
    return url.toString()
  } catch {
    return src
  }
}

// Up to two initials. For an email-looking value (has `@`, no spaces) the local
// part is used, split on spaces/dots/underscores/hyphens — so "jane.doe@x.com"
// → "JD", "g@x.com" → "G", "Jane Cooper" → "JC". This keeps name-less, email-only
// users on a letter avatar instead of the neutral glyph.
const initialsFromName = (name: string): string => {
  const trimmed = name.trim()
  if (!trimmed) return ''

  const base =
    trimmed.includes('@') && !/\s/.test(trimmed)
      ? trimmed.slice(0, trimmed.indexOf('@'))
      : trimmed
  const parts = base.split(/[\s._-]+/).filter(Boolean)

  if (parts.length === 0) return base.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export type AvatarProps = Omit<
  React.HTMLAttributes<HTMLSpanElement>,
  'children'
> &
  VariantProps<typeof avatarVariants> & {
    /** Display name — drives the initials and the deterministic fallback tint. */
    name?: string
    /** Optional image URL; falls back to initials on load error or when absent. */
    src?: string
    /** Image alt text. Defaults to `name`; pass `''` when the name is shown beside it. */
    alt?: string
    size?: AvatarSize
  }

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  (
    { alt, className, name, size = 'md', src: rawSrc, style, ...props },
    ref
  ) => {
    const src = useMemo(() => normalizeGravatarSrc(rawSrc), [rawSrc])
    const [imageFailed, setImageFailed] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    // Reset load/error state when the source changes on a reused instance.
    useEffect(() => {
      setImageFailed(false)
      setImageLoaded(false)
    }, [src])
    const trimmed = (name ?? '').trim()
    const initials = useMemo(() => initialsFromName(trimmed), [trimmed])
    const tone = useMemo(
      () => (trimmed ? toneFromLabel(trimmed) : null),
      [trimmed]
    )

    // Computed colors go through inline style (not a Tailwind arbitrary class)
    // since the tint is dynamic — and inline style keeps it clear of the
    // foundations contract scan while still pointing at semantic tokens.
    const toneStyle: React.CSSProperties = tone
      ? {
          backgroundColor: `var(--core-color-avatar-${tone}-bg)`,
          color: `var(--core-color-avatar-${tone}-fg)`
        }
      : {
          backgroundColor: 'var(--core-color-surface-sunken)',
          color: 'var(--core-color-text-muted)'
        }

    const showImage = Boolean(src) && !imageFailed

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        // lineHeight:1 keeps the glyph in a tight line box that centers cleanly
        // in the circle (a taller inherited line-height rounds off-center). Inline
        // so it survives the class merge dropping `leading-none` next to the
        // arbitrary font-size utility.
        style={{ lineHeight: 1, ...toneStyle, ...style }}
        {...props}
      >
        {(!showImage || !imageLoaded) &&
          (initials || (
            <User
              aria-hidden='true'
              className='h-1/2 w-1/2'
              strokeWidth={1.75}
            />
          ))}
        {showImage && (
          <img
            alt={alt ?? trimmed}
            // Opaque backing once loaded so a transparent image never reveals the
            // tint/initials behind it; until then the fallback shows (no blank).
            className={cn(
              'absolute inset-0 size-full object-cover',
              imageLoaded && 'bg-[var(--core-color-surface-default)]'
            )}
            onError={() => setImageFailed(true)}
            onLoad={() => setImageLoaded(true)}
            src={src}
          />
        )}
      </span>
    )
  }
)

Avatar.displayName = 'Avatar'
