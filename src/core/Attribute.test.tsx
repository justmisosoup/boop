import type React from 'react'

import { renderToStaticMarkup } from 'react-dom/server'
import { ServerStyleSheet } from 'styled-components'
import { describe, expect, test } from 'vitest'

import { Attribute } from './Attribute'

// Collect the CSS styled-components generates while rendering a tree.
const collectCss = (element: React.ReactElement): string => {
  const sheet = new ServerStyleSheet()
  try {
    renderToStaticMarkup(sheet.collectStyles(element))
    return sheet.getStyleTags()
  } finally {
    sheet.seal()
  }
}

describe('Attribute required indicator', () => {
  test('required renders the red asterisk attached to the label', () => {
    const css = collectCss(<Attribute label='First Name' required />)

    // The asterisk must be an ::after pseudo attached directly to the label
    // class (`.class::after`). A bare `:after` compiles to a descendant
    // selector (`.class :after`) under stylis v4 and matches nothing, which is
    // the regression this test guards against.
    expect(css).toMatch(
      /\.[A-Za-z0-9_-]+:{1,2}after\s*\{[^}]*content:\s*['"] \*['"]/
    )
  })

  test('non-required label does not render an asterisk', () => {
    const css = collectCss(<Attribute label='Middle Name' />)

    expect(css).not.toMatch(/content:\s*['"] \*['"]/)
  })
})
