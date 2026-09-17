import { type ComponentType, lazy, Suspense, useState } from 'react'

import styled from 'styled-components'

import { colors, spacing, typography } from '../theme'
import { coreSyntaxStyle } from '../syntaxStyle'

export type SourceLanguage = 'json' | 'bash'

type SyntaxHighlighterProps = {
  children: string
  language: string
  style: typeof coreSyntaxStyle
}

// Lazy registry of language modules so each language's grammar only ships
// when something actually renders it. Add new entries as consumers need them
// — the available hljs languages live in react-syntax-highlighter/dist/esm/
// languages/hljs/.
const languageLoaders: Record<
  SourceLanguage,
  () => Promise<{ default: unknown }>
> = {
  json: () => import('react-syntax-highlighter/dist/esm/languages/hljs/json'),
  bash: () => import('react-syntax-highlighter/dist/esm/languages/hljs/bash')
}

const loadedLanguages = new Set<SourceLanguage>()

const loadSyntaxHighlighter = (language: SourceLanguage) =>
  lazy<ComponentType<SyntaxHighlighterProps>>(async () => {
    const [light, lang] = await Promise.all([
      import('react-syntax-highlighter/dist/esm/light'),
      languageLoaders[language]()
    ])
    const highlighter =
      light.default as ComponentType<SyntaxHighlighterProps> & {
        registerLanguage: (name: string, definition: unknown) => void
      }
    if (!loadedLanguages.has(language)) {
      highlighter.registerLanguage(language, lang.default)
      loadedLanguages.add(language)
    }
    return { default: highlighter }
  })

// Memoize per-language lazy components so we don't pay the import + register
// cost on every render.
const syntaxHighlighterCache = new Map<
  SourceLanguage,
  ComponentType<SyntaxHighlighterProps>
>()

const getSyntaxHighlighter = (language: SourceLanguage) => {
  let component = syntaxHighlighterCache.get(language)
  if (!component) {
    component = loadSyntaxHighlighter(language)
    syntaxHighlighterCache.set(language, component)
  }
  return component
}

const Spacing = styled.div`
  margin: 0;
`

const DiveBody = styled.div<{ $embedded?: boolean }>`
  background: ${({ $embedded }) =>
    $embedded ? 'transparent' : 'var(--core-color-surface-card)'};
  border: ${({ $embedded }) =>
    $embedded ? 'none' : '1px solid var(--core-color-border-default)'};
  border-radius: ${({ $embedded }) => ($embedded ? '0' : '10px')};
  color: var(--core-color-text-primary);
  display: flex;
  flex-direction: column;
  font-size: ${typography.sizes.medium};
  margin: 0;
  padding: ${({ $embedded }) => ($embedded ? '0' : spacing.xlarge)};

  & code {
    white-space: pre-wrap !important;
  }
`

const CopyButton = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  color: var(--core-color-text-secondary);
  cursor: pointer;
  font-family: ${typography.faces.default};
  font-size: 14px;
  font-weight: ${typography.weights.normal};
  margin-bottom: ${spacing.normal};
  padding: 0;
  position: relative;
  transition: color 150ms ease;

  &:hover {
    color: var(--core-color-text-primary);
  }

  &:active {
    transform: translateY(1px);
  }

  &.copied::after {
    background-color: ${colors.graphite};
    border-radius: 4px;
    color: ${colors.white};
    content: 'Copied!';
    font-size: 0.75rem;
    line-height: 32px;
    margin-right: 5px;
    padding: 0px 24px;
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    white-space: nowrap;
  }
`

const MAX_SOURCE_SIZE = 1000000

type Props = {
  /** String to render. Objects are stringified as pretty-printed JSON. */
  content?: string | object
  language: SourceLanguage
  embedded?: boolean
  copyLabel?: string
}

export const SourceView = ({
  content,
  language,
  embedded = false,
  copyLabel = 'Copy'
}: Props) => {
  const [copied, setCopied] = useState(false)

  if (content === undefined || content === null) {
    return null
  }

  const source =
    typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  const plainTextFallback = <code>{source}</code>

  const handleCopyClick = () => {
    navigator.clipboard.writeText(source)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  const SyntaxHighlighter = getSyntaxHighlighter(language)

  return (
    <Spacing>
      <DiveBody $embedded={embedded}>
        <CopyButton
          className={copied ? 'copied' : ''}
          onClick={handleCopyClick}
        >
          {copyLabel}
        </CopyButton>
        {source.length < MAX_SOURCE_SIZE ? (
          <Suspense fallback={plainTextFallback}>
            <SyntaxHighlighter language={language} style={coreSyntaxStyle}>
              {source}
            </SyntaxHighlighter>
          </Suspense>
        ) : (
          plainTextFallback
        )}
      </DiveBody>
    </Spacing>
  )
}
