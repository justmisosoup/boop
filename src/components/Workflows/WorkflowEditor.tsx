import { useState } from 'react'

import {
  ActionButton,
  ChatComposer,
  ErrorState,
  FieldError,
  InlineAlert,
  PageContainer,
  PageHeader,
  PageHeaderBand,
  PageHeaderBar,
  PageHeaderTitles,
  PageHeading,
  SkeletonPage
} from '@/core'
import { useLocation, useNavigate, useParams } from 'react-router'

import { cn } from '@/utils/twUtils'

import {
  errorsOf,
  useSaveCustomOrderMutation,
  useUpdateCustomOrderMutation
} from '@/lib/customOrders/api'
import {
  type Draft,
  draftFromSaved,
  emptyDraft,
  insightStepErrors,
  packageStepErrors,
  toConfig
} from '@/lib/customOrders/model'
import type {
  CustomOrderError,
  OrderCatalog
} from '@/lib/customOrders/types'
import { useCustomOrderData } from '@/lib/customOrders/api'
import cya from '@/utils/cya'

import { InsightsCard } from './AddedInsights'
import { InsightPicker } from './InsightPicker'
import { suggestInsights } from '@/lib/customOrders/suggest'
import { AttributesCard } from './cards'
import { WORKFLOWS_PATH, workflowPath } from './paths'
import { WorkflowTopbar } from './WorkflowTopbar'

type Mode = 'new' | 'edit' | 'duplicate'

const TITLES: Record<Mode, string> = {
  new: 'New order',
  edit: 'Edit order',
  duplicate: 'Duplicate order'
}

const EditorForm = ({
  catalog,
  initialDraft,
  mode
}: {
  catalog: OrderCatalog
  initialDraft: Draft
  mode: Mode
}) => {
  const navigate = useNavigate()
  const { state } = useLocation()
  // Place order passes itself so saving or cancelling goes back there.
  const returnTo: string | null =
    typeof state?.returnTo === 'string' ? state.returnTo : null
  const [draft, setDraft] = useState(initialDraft)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [errors, setErrors] = useState<CustomOrderError[]>([])
  const [saveOrder, saveState] = useSaveCustomOrderMutation()
  const [updateOrder, updateState] = useUpdateCustomOrderMutation()
  const isSaving = saveState.isLoading || updateState.isLoading

  const change = (next: Draft) => {
    setErrors([])
    setSuggestion(null)
    setDraft(next)
  }

  const suggest = () => {
    const { draft: next, added } = suggestInsights(
      catalog,
      draft,
      draft.description
    )
    change(next)
    setSuggestion(added ? null : 'No new insights matched')
  }

  const cancel = () =>
    navigate(returnTo ?? (draft.id ? workflowPath(draft.id) : WORKFLOWS_PATH))

  const save = async () => {
    const selectionProblems = packageStepErrors(catalog, draft)
    const problems: CustomOrderError[] = [
      ...(draft.name.trim()
        ? []
        : [{ message: 'Name is required.', field: 'name' as const }]),
      ...(selectionProblems.length
        ? selectionProblems
        : insightStepErrors(catalog, draft)
      ).map(message => ({ message }))
    ]
    if (problems.length) {
      setErrors(problems)
      return
    }
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      ...toConfig(catalog, draft)
    }
    try {
      const saved = draft.id
        ? await updateOrder({ id: draft.id, ...body }).unwrap()
        : await saveOrder(body).unwrap()
      navigate(returnTo ?? workflowPath(saved.id))
    } catch (error) {
      setErrors(errorsOf(error))
    }
  }

  const nameError = errors.find(e => e.field === 'name')?.message ?? null
  const otherErrors = errors.filter(e => e.field !== 'name').map(e => e.message)

  return (
    <>
      <WorkflowTopbar
        actions={
          <>
            <ActionButton onClick={cancel} type='button' variant='secondary'>
              Cancel
            </ActionButton>
            <ActionButton
              isLoading={isSaving}
              onClick={save}
              type='button'
              variant='primary'
              {...cya('SaveCustomOrder')}
            >
              Save
            </ActionButton>
          </>
        }
        current={draft.name.trim() || TITLES[mode]}
      />
      <PageContainer width='comfortable'>
        <PageHeaderBand className='px-0'>
          <PageHeader>
            <PageHeaderBar>
              <PageHeaderTitles className='flex-1'>
                <PageHeading
                  aria-label={draft.name.trim() || TITLES[mode]}
                  className='overflow-visible'
                  weight='normal'
                >
                  <input
                    aria-describedby={
                      nameError ? 'custom-order-name-error' : undefined
                    }
                    aria-invalid={nameError ? true : undefined}
                    aria-label='Order name'
                    className={cn(
                      '-mx-1.5 w-full min-w-0 rounded-md bg-transparent px-1.5 [font:inherit] [letter-spacing:inherit]',
                      'text-foreground placeholder:text-muted-foreground outline-none',
                      'transition-colors duration-fast hover:bg-[var(--core-color-list-item-hover-bg)]',
                      'focus-visible:bg-transparent focus-visible:ring-2 focus-visible:ring-ring',
                      nameError && 'ring-2 ring-[var(--core-color-text-danger)]'
                    )}
                    id='custom-order-name'
                    maxLength={80}
                    onChange={e => change({ ...draft, name: e.target.value })}
                    placeholder={TITLES.new}
                    value={draft.name}
                  />
                </PageHeading>
                {nameError && (
                  <FieldError id='custom-order-name-error'>
                    {nameError}
                  </FieldError>
                )}
              </PageHeaderTitles>
            </PageHeaderBar>
          </PageHeader>
        </PageHeaderBand>

        {otherErrors.length > 0 && (
          <InlineAlert
            className='mt-6'
            title={
              otherErrors.length === 1 ? otherErrors[0] : 'Check your selection'
            }
            tone='danger'
          >
            {otherErrors.length > 1 && (
              <ul className='list-disc pl-5'>
                {otherErrors.map(e => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </InlineAlert>
        )}

        <div className='mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'>
          <div className='flex min-w-0 flex-col gap-4'>
            <InsightsCard
              catalog={catalog}
              composer={
                <ChatComposer
                  autoFocus
                  density='standard'
                  focusRing='quiet'
                  label='Instructions'
                  minRows={3}
                  onChange={value =>
                    change({ ...draft, description: value.slice(0, 280) })
                  }
                  hint={suggestion}
                  onSubmit={suggest}
                  placeholder='What do you want this order to check?'
                  value={draft.description}
                />
              }
              draft={draft}
              onAdd={() => setPickerOpen(true)}
              onChange={change}
            />
          </div>
          <div className='flex min-w-0 flex-col gap-4 lg:sticky lg:top-6'>
            <AttributesCard catalog={catalog} draft={draft} />
          </div>
        </div>

        <InsightPicker
          catalog={catalog}
          draft={draft}
          isOpen={pickerOpen}
          onChange={change}
          onClose={() => setPickerOpen(false)}
        />
      </PageContainer>
    </>
  )
}

export const WorkflowEditor = ({ mode }: { mode: Mode }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { catalog, saved } = useCustomOrderData()
  const needsSaved = mode !== 'new'
  const source = needsSaved ? saved.data?.find(o => o.id === id) : undefined

  const body = (() => {
    if (catalog.isError || (needsSaved && saved.isError)) {
      return (
        <ErrorState
          description='Custom orders aren’t available right now.'
          onAction={() => {
            catalog.refetch()
            if (needsSaved) saved.refetch()
          }}
          title='Couldn’t load insights'
        />
      )
    }
    if (!catalog.data || (needsSaved && !saved.data)) {
      return <SkeletonPage className='pt-0' subtitle={false} />
    }
    if (needsSaved && !source) {
      return (
        <ErrorState
          actionLabel='Back to custom orders'
          description='It may have been deleted.'
          onAction={() => navigate(WORKFLOWS_PATH)}
          title='Couldn’t find that order'
        />
      )
    }
    return null
  })()

  return (
    <>
      <title>{`${TITLES[mode]} • Middesk`}</title>
      {body || !catalog.data ? (
        <>
          <WorkflowTopbar current={TITLES[mode]} />
          <PageContainer width='comfortable'>{body}</PageContainer>
        </>
      ) : (
        <EditorForm
          catalog={catalog.data}
          initialDraft={
            source
              ? draftFromSaved(source, catalog.data, {
                  duplicate: mode === 'duplicate'
                })
              : emptyDraft()
          }
          key={`${mode}-${id ?? 'new'}`}
          mode={mode}
        />
      )}
    </>
  )
}
