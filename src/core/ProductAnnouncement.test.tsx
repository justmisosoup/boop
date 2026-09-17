import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { ProductAnnouncement } from './ProductAnnouncement'

const cta = { label: 'Learn more', href: 'https://example.com/promo' }

describe('ProductAnnouncement display=nav', () => {
  test('renders copy and CTA, and dismisses from the X', () => {
    const onDismiss = vi.fn()
    render(
      <ProductAnnouncement cta={cta} display='nav' onDismiss={onDismiss}>
        Nav promo copy
      </ProductAnnouncement>
    )

    expect(screen.getByText('Nav promo copy')).not.toBeNull()
    expect(
      screen.getByRole('link', { name: /Learn more/ }).getAttribute('href')
    ).toBe('https://example.com/promo')

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss announcement' })
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  test('pages through campaigns from the image overlay', () => {
    const onSelect = vi.fn()
    render(
      <ProductAnnouncement
        cta={cta}
        display='nav'
        imageSrc='/images/promo.png'
        pager={{ count: 3, index: 0, onSelect }}
      >
        Nav promo copy
      </ProductAnnouncement>
    )

    expect(screen.getByText('1/3')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Next announcement' }))
    expect(onSelect).toHaveBeenCalledWith(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Previous announcement' })
    )
    expect(onSelect).toHaveBeenLastCalledWith(2)
  })

  test('collapses to the title row and expands from the chevron', () => {
    const onExpand = vi.fn()
    render(
      <ProductAnnouncement
        collapse={{ isCollapsed: true, onExpand }}
        cta={cta}
        display='nav'
        imageSrc='/images/promo.png'
        title='A new thing is live.'
        onDismiss={vi.fn()}
      >
        Nav promo copy
      </ProductAnnouncement>
    )

    expect(screen.getByText('A new thing is live.')).not.toBeNull()
    expect(screen.queryByText('Nav promo copy')).toBeNull()
    expect(screen.queryByRole('link', { name: /Learn more/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand announcement' }))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  test('once expanded there is no collapse control — only dismiss', () => {
    render(
      <ProductAnnouncement
        collapse={{ isCollapsed: false, onExpand: vi.fn() }}
        cta={cta}
        display='nav'
        imageSrc='/images/promo.png'
        title='A new thing is live.'
        onDismiss={vi.fn()}
      >
        Nav promo copy
      </ProductAnnouncement>
    )

    expect(
      screen.queryByRole('button', { name: 'Collapse announcement' })
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Dismiss announcement' })
    ).not.toBeNull()
  })

  test('hides the pager while a single campaign runs', () => {
    render(
      <ProductAnnouncement
        cta={cta}
        display='nav'
        imageSrc='/images/promo.png'
        pager={{ count: 1, index: 0, onSelect: vi.fn() }}
      >
        Nav promo copy
      </ProductAnnouncement>
    )

    expect(
      screen.queryByRole('button', { name: 'Next announcement' })
    ).toBeNull()
  })
})

describe('ProductAnnouncement display=banner', () => {
  test('renders the strip with title, copy, and CTA, and dismisses from the X', () => {
    const onCtaClick = vi.fn()
    const onDismiss = vi.fn()
    render(
      <ProductAnnouncement
        cta={cta}
        display='banner'
        title='A new thing:'
        onCtaClick={onCtaClick}
        onDismiss={onDismiss}
      >
        Banner promo copy
      </ProductAnnouncement>
    )

    expect(screen.getByText('A new thing:')).not.toBeNull()
    expect(screen.getByText('Banner promo copy')).not.toBeNull()

    const link = screen.getByRole('link', { name: /Learn more/ })
    expect(link.getAttribute('href')).toBe('https://example.com/promo')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')

    fireEvent.click(link)
    expect(onCtaClick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss banner' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe('ProductAnnouncement display=body', () => {
  test('renders the announcement aside and dismisses from the corner X', () => {
    const onDismiss = vi.fn()
    render(
      <ProductAnnouncement
        cta={cta}
        display='body'
        title='A new thing is live'
        onDismiss={onDismiss}
      >
        Body promo copy
      </ProductAnnouncement>
    )

    screen.getByRole('complementary', { name: 'Announcement' })
    expect(screen.getByText('Body promo copy')).not.toBeNull()

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss announcement' })
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
