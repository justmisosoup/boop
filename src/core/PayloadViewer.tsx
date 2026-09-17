import type React from 'react'
import { useRef } from 'react'

import { Download } from 'lucide-react'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/light'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'

import { cn } from '@/utils/twUtils'

import { ActionButton, IconActionButton } from './Action'
import { CopyButton } from './CopyButton'
import { Skeleton } from './FeedbackState'
import { Text } from './Surface'
import { coreSyntaxStyle } from './syntaxStyle'
import { useToast } from './Toast'

SyntaxHighlighter.registerLanguage('json', json)

// Above this size we skip pretty-printing + syntax highlighting: the highlighter
// tokenizes the whole string and emits one DOM node per token, which hangs the
// page on multi-MB bodies. Sits above normal webhook traffic (~290KB max,
// p99 ~55KB) and below the highlighter's perf cliff.
const MAX_INLINE_BYTES = 500 * 1024

type Payload = unknown

const hasStringBody = (
  payload: Payload
): payload is { body: string } & Record<string, unknown> =>
  typeof payload === 'object' &&
  payload !== null &&
  'body' in payload &&
  typeof (payload as { body: unknown }).body === 'string'

const rawBodyOf = (payload: Payload): string => {
  if (typeof payload === 'string') return payload
  if (hasStringBody(payload)) return payload.body
  return JSON.stringify(payload)
}

const measureBytes = (payload: Payload): number => {
  if (typeof payload === 'string') return payload.length
  return rawBodyOf(payload).length
}

// Sniff the first non-whitespace char to pick a file extension without parsing
// the whole (possibly multi-MB) string. We deliberately never save as `.html`:
// a webhook response is attacker-controllable, and a `.html` file could execute
// embedded <script> if a developer double-clicked it. `.txt` is always safe.
const detectFormat = (str: string): { extension: string; mimeType: string } => {
  const head = str.slice(0, 16).trimStart()

  if (head.startsWith('{') || head.startsWith('[')) {
    return { extension: 'json', mimeType: 'application/json' }
  }

  return { extension: 'txt', mimeType: 'text/plain' }
}

const downloadAsFile = (
  content: string,
  filename: string,
  mimeType: string
) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Webhook request/response bodies often arrive as a JSON string nested under a
// `body` key; unwrap it so the viewer pretty-prints the real structure.
const unwrapStringBody = (payload: Payload): Payload => {
  if (hasStringBody(payload)) {
    try {
      return { ...payload, body: JSON.parse(payload.body) }
    } catch {
      return payload
    }
  }

  return payload
}

const downloadPayloadContent = (payload: Payload, downloadFilename: string) => {
  const content = rawBodyOf(payload)
  const { extension, mimeType } = detectFormat(content)

  downloadAsFile(content, `${downloadFilename}.${extension}`, mimeType)
}

const OversizedFallback = ({
  downloadFilename,
  payload
}: {
  downloadFilename: string
  payload: Payload
}) => {
  const { showToast } = useToast()

  const handleDownload = () => {
    downloadPayloadContent(payload, downloadFilename)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawBodyOf(payload))
      showToast({ text: 'Copied to clipboard!' })
    } catch {
      showToast({
        appearance: 'error',
        text: 'Could not copy — try Download instead'
      })
    }
  }

  return (
    <div className='grid gap-3 px-3 py-3'>
      <Text size='sm' tone='muted'>
        This body is too large to display inline. Use the actions below to view
        the full content.
      </Text>
      <div className='flex gap-2'>
        <ActionButton onClick={handleDownload} variant='secondary'>
          Download file
        </ActionButton>
        <ActionButton onClick={handleCopy} variant='secondary'>
          Copy to clipboard
        </ActionButton>
      </div>
    </div>
  )
}

export type PayloadViewerProps = {
  payload: Payload
  /** Optional heading rendered above the code block. */
  title?: React.ReactNode
  /** Base filename (no extension) used by the oversize-download action. */
  downloadFilename?: string
  className?: string
  /** Keep the copy button fixed while the rendered payload body scrolls. */
  scrollBody?: boolean
  showLineNumbers?: boolean
  unframed?: boolean
  wrapLongLines?: boolean
  showDownload?: boolean
}

/**
 * Read-only viewer for JSON-ish payloads (webhook request/response bodies, event
 * data): pretty-prints + syntax-highlights small bodies, and falls back to a
 * copy/download affordance for bodies too large to render inline. The DS
 * replacement for the legacy styled `DetailPayload`.
 */
export const PayloadViewer = ({
  className,
  downloadFilename = 'payload',
  payload,
  scrollBody = false,
  showLineNumbers = false,
  title,
  unframed = false,
  wrapLongLines = true,
  showDownload = false
}: PayloadViewerProps) => {
  const lineNumberRef = useRef<HTMLDivElement | null>(null)

  if (payload === null || payload === undefined || payload === '') return null

  const oversized = measureBytes(payload) > MAX_INLINE_BYTES

  let body = ''
  let language = 'json'

  if (!oversized) {
    try {
      body =
        typeof payload === 'string'
          ? JSON.stringify(JSON.parse(payload), null, 2)
          : JSON.stringify(unwrapStringBody(payload), null, 2)
    } catch {
      body = rawBodyOf(payload)
      language = 'text'
    }
  }

  const renderedBody = (
    <SyntaxHighlighter
      customStyle={{
        background: 'transparent',
        fontSize: 'var(--core-font-size-dense)',
        lineHeight: '21.5px',
        margin: 0,
        overflowWrap: wrapLongLines ? 'anywhere' : 'normal',
        overflowX: scrollBody ? 'visible' : 'auto',
        padding: showLineNumbers ? '0.5rem 0.75rem 0.75rem' : '0.75rem',
        whiteSpace: wrapLongLines ? 'pre-wrap' : 'pre',
        wordBreak: wrapLongLines ? 'break-all' : 'normal'
      }}
      language={language}
      style={coreSyntaxStyle}
      wrapLongLines={wrapLongLines}
    >
      {body}
    </SyntaxHighlighter>
  )
  const lineNumbers = showLineNumbers
    ? Array.from(
        { length: Math.max(1, body.split('\n').length) },
        (_, index) => index + 1
      )
    : []
  const actions = (
    <>
      {showDownload && (
        <IconActionButton
          aria-label='Download response'
          onClick={() => downloadPayloadContent(payload, downloadFilename)}
          variant='secondary'
        >
          <Download size={14} />
        </IconActionButton>
      )}
      <CopyButton value={body} variant='secondary' />
    </>
  )
  const handleBodyScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = event.currentTarget.scrollTop
    }
  }

  return (
    <div
      className={cn(
        'grid gap-2',
        scrollBody &&
          (title
            ? 'h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]'
            : 'h-full min-h-0 grid-rows-[minmax(0,1fr)]'),
        className
      )}
    >
      {title && (
        <Text className='font-semibold' size='sm'>
          {title}
        </Text>
      )}
      <div
        className={cn(
          'isolate relative overflow-hidden',
          unframed
            ? 'bg-[var(--core-color-bg-primary)]'
            : 'bg-[var(--core-color-surface-canvas)]',
          !unframed && 'rounded-control border border-border',
          scrollBody && 'h-full min-h-0'
        )}
      >
        {oversized ? (
          <OversizedFallback
            downloadFilename={downloadFilename}
            payload={payload}
          />
        ) : (
          <>
            <div
              className={cn(
                'absolute top-2 z-10 flex gap-2',
                scrollBody ? 'right-4' : 'right-2'
              )}
            >
              {actions}
            </div>
            <div className={cn('flex', scrollBody && 'h-full min-h-0')}>
              {showLineNumbers && (
                <div
                  aria-hidden
                  className='pointer-events-none w-12 shrink-0 select-none overflow-hidden bg-[var(--core-color-bg-primary)] py-2 pr-3 text-right !font-mono text-[11px] leading-[21.5px] text-muted-foreground'
                  ref={lineNumberRef}
                >
                  {lineNumbers.map(lineNumber => (
                    <div className='!font-mono' key={lineNumber}>
                      {lineNumber}
                    </div>
                  ))}
                </div>
              )}
              {scrollBody ? (
                <div
                  className={cn(
                    'h-full min-h-0 min-w-0 flex-1 overflow-auto',
                    '[@media(hover:hover)]:[scrollbar-width:thin]',
                    '[@media(hover:hover)]:[scrollbar-gutter:stable]',
                    '[@media(hover:hover)]:[scrollbar-color:transparent_transparent]',
                    'transition-[scrollbar-color] duration-standard ease-standard motion-reduce:transition-none',
                    'hover:[scrollbar-color:var(--core-color-border-strong)_transparent]',
                    '[@media(hover:hover)]:focus-within:[scrollbar-color:var(--core-color-border-strong)_transparent]'
                  )}
                  onScroll={showLineNumbers ? handleBodyScroll : undefined}
                >
                  {renderedBody}
                </div>
              ) : (
                <div className='min-w-0 flex-1'>{renderedBody}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

PayloadViewer.displayName = 'PayloadViewer'

export type PayloadViewerSkeletonProps = {
  className?: string
}

/**
 * Loading placeholder for `PayloadViewer`: mirrors its framed container
 * (border/radius/background tokens) so the swap to real content doesn't
 * change the surrounding chrome, just the body.
 */
export const PayloadViewerSkeleton = ({
  className
}: PayloadViewerSkeletonProps) => (
  <div
    className={cn(
      'grid gap-2 rounded-control border border-border bg-[var(--core-color-surface-canvas)] p-3',
      className
    )}
  >
    <span aria-live='polite' className='sr-only' role='status'>
      Loading
    </span>
    <Skeleton className='h-3 w-1/3' />
    <Skeleton className='h-3 w-2/3' />
    <Skeleton className='h-3 w-1/2' />
  </div>
)

PayloadViewerSkeleton.displayName = 'PayloadViewerSkeleton'
