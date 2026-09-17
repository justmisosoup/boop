import { fireEvent, render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { Avatar } from './Avatar'

const root = (markup: ReturnType<typeof render>) =>
  markup.container.firstChild as HTMLElement

describe('Avatar', () => {
  test('renders two-letter initials from a full name', () => {
    expect(render(<Avatar name='Jane Cooper' />).container.textContent).toBe(
      'JC'
    )
  })

  test('renders up to two letters for a single name', () => {
    expect(render(<Avatar name='cher' />).container.textContent).toBe('CH')
  })

  test('derives initials from an email when there is no name', () => {
    expect(render(<Avatar name='g@middesk.com' />).container.textContent).toBe(
      'G'
    )
    expect(
      render(<Avatar name='jane.doe@acme.com' />).container.textContent
    ).toBe('JD')
  })

  test('assigns a deterministic tint from the name', () => {
    const a = root(render(<Avatar name='Jane Cooper' />)).getAttribute('style')
    const b = root(render(<Avatar name='Jane Cooper' />)).getAttribute('style')

    expect(a).toMatch(/--core-color-avatar-\d+-bg/)
    // Same name → identical tint (stable across renders/surfaces).
    expect(b).toBe(a)
  })

  test('falls back to a neutral glyph (no tint) when there is no name', () => {
    const markup = render(<Avatar />)

    expect(markup.container.textContent).toBe('')
    expect(markup.container.querySelector('svg')).not.toBeNull()
    expect(root(markup).getAttribute('style')).toContain(
      '--core-color-surface-sunken'
    )
  })

  test('renders an image with alt defaulting to the name', () => {
    const img = render(
      <Avatar name='Jane Cooper' src='https://example.com/a.png' />
    ).container.querySelector('img')

    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/a.png')
    expect(img?.getAttribute('alt')).toBe('Jane Cooper')
  })

  test('applies the size variant class', () => {
    expect(
      root(render(<Avatar name='Jane Cooper' size='lg' />)).className
    ).toContain('size-10')
  })

  test('hides the initials fallback once the image loads', () => {
    const markup = render(
      <Avatar name='Jane Cooper' src='https://example.com/a.png' />
    )
    // Fallback shows while the image is still loading.
    expect(markup.container.textContent).toBe('JC')

    const img = markup.container.querySelector('img') as HTMLImageElement
    fireEvent.load(img)

    // After load: initials are gone and the image gets an opaque backing.
    expect(markup.container.textContent).toBe('')
    expect(img.className).toContain('surface-default')
  })

  test('keeps the initials fallback when the image errors', () => {
    const markup = render(
      <Avatar name='Jane Cooper' src='https://example.com/broken.png' />
    )
    const img = markup.container.querySelector('img') as HTMLImageElement
    fireEvent.error(img)

    expect(markup.container.textContent).toBe('JC')
    expect(markup.container.querySelector('img')).toBeNull()
  })

  test('rewrites Gravatar src to use d=404 so fallback initials render', () => {
    const gravatarUrl =
      '//www.gravatar.com/avatar/abc123?s=64&d=https%3A%2F%2Fapp.middesk.com%2Fimages%2Fdefault-avatar.png'
    const markup = render(<Avatar name='Jane Cooper' src={gravatarUrl} />)
    const img = markup.container.querySelector('img') as HTMLImageElement

    expect(img.src).toContain('gravatar.com/avatar/abc123')
    expect(img.src).toContain('d=404')
    expect(img.src).not.toContain('default-avatar.png')
  })

  test('passes non-Gravatar src through unchanged', () => {
    const url = 'https://lh3.googleusercontent.com/a-/photo.png'
    const markup = render(<Avatar name='Jane Cooper' src={url} />)
    const img = markup.container.querySelector('img') as HTMLImageElement

    expect(img.src).toBe(url)
  })
})
