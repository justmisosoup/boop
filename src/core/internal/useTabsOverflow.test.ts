import { describe, expect, test } from 'vitest'

import { computeVisibleTabCount } from './useTabsOverflow'

describe('computeVisibleTabCount', () => {
  test('unmeasurable container (zero or negative) shows everything', () => {
    expect(
      computeVisibleTabCount({
        containerWidth: 0,
        gap: 24,
        itemWidths: [100, 100, 100],
        moreWidth: 60
      })
    ).toBe(3)
    expect(
      computeVisibleTabCount({
        containerWidth: -10,
        gap: 24,
        itemWidths: [100, 100],
        moreWidth: 60
      })
    ).toBe(2)
  })

  test('everything fits: no collapse, no More reservation', () => {
    // 100*3 + 24*2 = 348 natural width
    expect(
      computeVisibleTabCount({
        containerWidth: 348,
        gap: 24,
        itemWidths: [100, 100, 100],
        moreWidth: 60
      })
    ).toBe(3)
  })

  test('fits within the 0.5px slack boundary', () => {
    expect(
      computeVisibleTabCount({
        containerWidth: 347.6,
        gap: 24,
        itemWidths: [100, 100, 100],
        moreWidth: 60
      })
    ).toBe(3)
  })

  test('just past the slack collapses, reserving More width', () => {
    // Natural 348 > 347 + 0.5 → collapse. Greedy with More reserved (60):
    // tab1: 100 + 24 + 60 = 184 ≤ 347 ✓; tab2: 224 + 24 + 60 = 308 ≤ 347 ✓;
    // tab3: 348 + 24 + 60 = 432 > 347 ✗ → 2 visible.
    expect(
      computeVisibleTabCount({
        containerWidth: 347,
        gap: 24,
        itemWidths: [100, 100, 100],
        moreWidth: 60
      })
    ).toBe(2)
  })

  test('More reservation can push out a tab that would otherwise fit', () => {
    // Natural: 100+24+100 = 224 > 200 → collapse. tab1 alone with More:
    // 100 + 24 + 60 = 184 ≤ 200 ✓; tab2: 224 + 24 + 60 = 308 ✗ → 1 visible.
    expect(
      computeVisibleTabCount({
        containerWidth: 200,
        gap: 24,
        itemWidths: [100, 100],
        moreWidth: 60
      })
    ).toBe(1)
  })

  test('zero visible when not even the first tab fits beside More', () => {
    expect(
      computeVisibleTabCount({
        containerWidth: 120,
        gap: 24,
        itemWidths: [100, 100],
        moreWidth: 60
      })
    ).toBe(0)
  })

  test('single tab that fits needs no More', () => {
    expect(
      computeVisibleTabCount({
        containerWidth: 120,
        gap: 24,
        itemWidths: [100],
        moreWidth: 60
      })
    ).toBe(1)
  })

  test('empty item list', () => {
    expect(
      computeVisibleTabCount({
        containerWidth: 500,
        gap: 24,
        itemWidths: [],
        moreWidth: 60
      })
    ).toBe(0)
  })

  test('reserveMore: fits-all must also accommodate the More trigger', () => {
    // Tabs alone fit exactly (348), but tabs + gap + More = 432 > 348 →
    // something collapses even though the tabs would fit by themselves.
    expect(
      computeVisibleTabCount({
        containerWidth: 348,
        gap: 24,
        itemWidths: [100, 100, 100],
        moreWidth: 60,
        reserveMore: true
      })
    ).toBe(2)
    // Wide enough for tabs + More: nothing collapses.
    expect(
      computeVisibleTabCount({
        containerWidth: 432,
        gap: 24,
        itemWidths: [100, 100, 100],
        moreWidth: 60,
        reserveMore: true
      })
    ).toBe(3)
  })

  test('reserveMore: unmeasurable container still shows everything', () => {
    expect(
      computeVisibleTabCount({
        containerWidth: 0,
        gap: 24,
        itemWidths: [100, 100],
        moreWidth: 60,
        reserveMore: true
      })
    ).toBe(2)
  })
})
