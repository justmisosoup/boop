import { useState } from 'react'

import { ActionButton, EmptyState, InlineAlert, MetaChip, MutedText, Surface, Text } from '@/core'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import catalog from '../data/catalog.json'
import { type AuthoredInsight, composeStatement, sourceLabel, templateFor } from '../lib/customInsights'
import type { BusinessRecord } from '../lib/deriveResults'
import type { useAuthoredInsights } from '../lib/useAuthoredInsights'
import { InsightPrompt } from './InsightPrompt'

type ShippedInsight = { id: string; name: string; statement: string; template?: string }

const SHIPPED = (catalog as { insights: { insights: ShippedInsight[] } }).insights.insights

/**
 * The library: every insight the record can be read against.
 *
 * Built-in entries are read-only. They come from `catalog/insights.yaml`, and
 * `src/data/catalog.json` — the file the app imports — is regenerated from it
 * on every `bun run dev`, so an edit here would be erased on the next start.
 */
export const CatalogTab = ({
  authored,
  record
}: {
  /** Shared with the Insights tab, so both surfaces show the same set. */
  authored: ReturnType<typeof useAuthoredInsights>
  record?: BusinessRecord
}) => {
  /** 'new', or the insight being edited. */
  const [writing, setWriting] = useState<'new' | AuthoredInsight | null>(null)
  /**
   * Which row is asking to be confirmed.
   *
   * Deliberately not `window.confirm`: a native dialog can be suppressed by
   * the browser or dismissed without the click registering, and the delete
   * then silently does nothing, which is indistinguishable from a broken
   * button. A second click on the row itself cannot be swallowed.
   */
  const [confirming, setConfirming] = useState<string | null>(null)
  const { insights, error, saving, save, remove } = authored

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <MutedText className="max-w-prose text-[13px] leading-5">
          Built-in insights come from <code>catalog/insights.yaml</code> and are read-only here.
          Insights you write are saved to <code>catalog/custom-insights.json</code>.
        </MutedText>
        {!writing && (
          <ActionButton onClick={() => setWriting('new')}>
            <Plus size={14} /> New insight
          </ActionButton>
        )}
      </div>

      {error && <InlineAlert tone="danger">{error}</InlineAlert>}

      {writing && (
        <InsightPrompt
          initial={writing === 'new' ? undefined : writing}
          key={writing === 'new' ? 'new' : writing.id}
          onCancel={() => setWriting(null)}
          onSave={async (insight) => {
            await save(insight)
            setWriting(null)
          }}
          record={record}
          saving={saving}
        />
      )}

      <Surface padding="md" variant="card">
        <Text className="pb-1 font-semibold">Yours</Text>
        {insights === null ? (
          <MutedText className="text-[13px]">Loading…</MutedText>
        ) : insights.length === 0 ? (
          <EmptyState
            description="Write what you want the insight to say. It compiles into the attributes and sources it reads, and you can correct that before saving."
            title="No insights written yet"
          />
        ) : (
          insights.map((insight) => (
            <div
              className="flex items-start justify-between gap-4 border-border border-b py-3 last:border-b-0"
              key={insight.id}
            >
              <div className="grid min-w-0 gap-1">
                <Text className="text-[13px] leading-5">{composeStatement(insight)}</Text>
                <div className="flex flex-wrap items-center gap-1">
                  <MetaChip size="xs" tone="info">
                    Yours
                  </MetaChip>
                  <MutedText className="text-xs">{templateFor(insight)}</MutedText>
                  {insight.compiled.sources.map((source) => (
                    <MutedText className="text-xs" key={source.id}>
                      {sourceLabel(source)}
                    </MutedText>
                  ))}
                </div>
              </div>
              {confirming === insight.id ? (
                <span className="flex shrink-0 items-center gap-1">
                  <ActionButton
                    onClick={async () => {
                      await remove(insight.id)
                      setConfirming(null)
                    }}
                    size="compact"
                    variant="secondary"
                  >
                    Confirm delete
                  </ActionButton>
                  <ActionButton
                    onClick={() => setConfirming(null)}
                    size="compact"
                    variant="quiet"
                  >
                    Cancel
                  </ActionButton>
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  <ActionButton
                    aria-label={`Edit ${composeStatement(insight)}`}
                    onClick={() => setWriting(insight)}
                    size="compact"
                    variant="quiet"
                  >
                    <Pencil size={14} />
                  </ActionButton>
                  <ActionButton
                    aria-label={`Delete ${composeStatement(insight)}`}
                    onClick={() => setConfirming(insight.id)}
                    size="compact"
                    variant="quiet"
                  >
                    <Trash2 size={14} />
                  </ActionButton>
                </span>
              )}
            </div>
          ))
        )}
      </Surface>

      <Surface padding="md" variant="card">
        <Text className="pb-1 font-semibold">Built-in</Text>
        {SHIPPED.map((insight) => (
          <div
            className="flex items-start justify-between gap-4 border-border border-b py-3 last:border-b-0"
            key={insight.id}
          >
            <div className="grid min-w-0 gap-1">
              <Text className="text-[13px] leading-5">{insight.statement}</Text>
              <div className="flex flex-wrap items-center gap-2">
                <MetaChip size="xs" tone="neutral">
                  Built-in
                </MetaChip>
                {insight.template && <MutedText className="text-xs">{insight.template}</MutedText>}
              </div>
            </div>
          </div>
        ))}
      </Surface>
    </div>
  )
}
