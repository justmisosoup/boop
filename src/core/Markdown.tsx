import type React from 'react'

import ReactMarkdown from 'react-markdown'
import { Link as RouterLink } from 'react-router'
import styled from 'styled-components'

import { Link } from './Link'

export type MarkdownProps = {
  /** CommonMark source. Raw HTML stays inert (no rehype-raw). */
  children: string
  className?: string
}

const isExternalUrl = (url: string): boolean => {
  try {
    const origin = window.location.origin
    const urlObj = new URL(url, origin)

    return urlObj.origin !== origin
  } catch {
    return false
  }
}

// Link routing: same-origin hrefs stay in the SPA via the router,
// cross-origin hrefs open in a new tab. react-markdown's default
// urlTransform strips dangerous protocols before hrefs reach here.
const MarkdownRoot = ({ children, className }: MarkdownProps) => (
  <div className={className}>
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          if (!href) return <span>{children}</span>

          if (isExternalUrl(href)) {
            return (
              <Link href={href} target='_blank' rel='noopener noreferrer'>
                {children}
              </Link>
            )
          }

          return <RouterLink to={href}>{children}</RouterLink>
        }
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
)

// Renders AI-generated or user-authored Markdown with routed links and
// mode-blind typography. Surfaces extend it for their own type scale and
// chrome: styled(Markdown)`font-size: ...; padding: ...;`.
//
// `white-space: pre-wrap` is load-bearing: react-markdown preserves a
// softbreak (a single newline inside a paragraph) as a literal `\n` in the
// text node, and pre-wrap renders it as a line break rather than letting the
// browser collapse it to a space — LLM and user content uses single newlines
// deliberately (addresses, stacked short lines). Paragraph breaks (`\n\n`)
// are unaffected: they become separate <p> elements during parsing.
export const Markdown = styled(MarkdownRoot)`
  p {
    /* Neutralize the legacy global \`p { color: #555; line-height: 1.3em }\`
       (src/index.css): an element rule beats inheritance, so without these
       the surface's own text color and line-height never reach paragraphs —
       and the pinned light-mode gray is unreadable in scoped dark. */
    color: inherit;
    line-height: inherit;
    margin: 0 0 var(--core-spacing-xs);
    overflow-wrap: break-word;
    white-space: pre-wrap;

    &:last-child {
      margin-bottom: 0;
    }
  }

  ul,
  ol {
    margin: var(--core-spacing-xs) 0;
    padding-left: var(--core-spacing-md);
  }

  ul {
    list-style-type: disc;
  }

  ol {
    list-style-type: decimal;
  }

  li {
    margin-bottom: var(--core-spacing-xxs);
  }

  strong {
    font-weight: var(--core-font-weight-bold);
  }

  em {
    font-style: italic;
  }

  a {
    color: var(--core-color-text-link);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`
