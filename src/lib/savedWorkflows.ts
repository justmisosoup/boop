import { useSyncExternalStore } from 'react'

import {
  availabilityOf,
  normalizeOverrides,
  ORDER_CATALOG,
  requiredInputsFor,
  validateConfig
} from './customOrders/catalog'
import type {
  CustomOrderConfig,
  CustomOrderError,
  SavedCustomOrder,
  SavedCustomOrderInput
} from './customOrders/types'
import { CURRENT_USER } from './user'

/**
 * Saved workflows, as ~/Projects/prototype's mocks/customOrders.ts keeps them:
 * an account resource in localStorage that survives reloads, seeded with one
 * workflow. The pages read it through `useSavedWorkflows`.
 */

const SAVED_KEY = 'prototype:saved_workflows'

type SavedRecord = SavedCustomOrderInput & {
  id: string
  catalog_version: string
  created_by?: string
  created_at: string
  updated_at: string
}

const SEED_TIMESTAMP = '2026-10-01T15:00:00.000Z'

const SEEDED: SavedRecord[] = [
  {
    id: 'a7c3f0e2-5b1d-4c8e-9f6a-2d4b8e1c7a90',
    name: 'Liens only',
    description: 'Business liens for credit decisions.',
    environment: 'production',
    packages: ['liens'],
    insight_groups: ['liens'],
    status_overrides: [],
    catalog_version: ORDER_CATALOG.version,
    created_by: CURRENT_USER,
    created_at: SEED_TIMESTAMP,
    updated_at: SEED_TIMESTAMP
  }
]

const readSaved = (): SavedRecord[] => {
  try {
    const raw = window.localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as SavedRecord[]) : SEEDED
  } catch {
    return SEEDED
  }
}

const listeners = new Set<() => void>()
let snapshot: SavedCustomOrder[] | null = null

const writeSaved = (records: SavedRecord[]) => {
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(records))
  } catch {
    // Private windows and blocked storage: the change lasts for this page.
  }
  memory = records
  snapshot = null
  listeners.forEach(l => l())
}

let memory: SavedRecord[] | null = null
const records = () => (memory ??= readSaved())

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-0000-4000-a000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`

const toConfig = (input: CustomOrderConfig): CustomOrderConfig => ({
  packages: [...(input.packages ?? [])],
  insight_groups: [...(input.insight_groups ?? [])],
  status_overrides: [...(input.status_overrides ?? [])]
})

const toSavedResponse = (record: SavedRecord): SavedCustomOrder => ({
  ...record,
  environment: record.environment ?? 'draft',
  created_by: record.created_by ?? null,
  required_inputs: requiredInputsFor(record).required,
  availability: availabilityOf(record)
})

export const listSaved = (): SavedCustomOrder[] =>
  (snapshot ??= records().map(toSavedResponse))

const validateSaved = (
  input: SavedCustomOrderInput,
  exceptId?: string
): CustomOrderError[] => {
  const errors: CustomOrderError[] = []
  const name = input.name?.trim() ?? ''
  if (!name) errors.push({ message: 'Name is required.', field: 'name' })
  else if (
    records().some(
      r =>
        r.id !== exceptId && r.name.trim().toLowerCase() === name.toLowerCase()
    )
  ) {
    errors.push({
      message: 'An assessment with this name already exists.',
      field: 'name'
    })
  }
  return [...errors, ...validateConfig(toConfig(input))]
}

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: CustomOrderError[] }

export const createSaved = (
  input: SavedCustomOrderInput
): Result<SavedCustomOrder> => {
  const errors = validateSaved(input)
  if (errors.length) return { ok: false, errors }
  const now = new Date().toISOString()
  const record: SavedRecord = {
    id: uuid(),
    name: input.name.trim(),
    description: input.description?.trim() || null,
    environment: input.environment ?? 'production',
    ...toConfig(input),
    status_overrides: normalizeOverrides(input.status_overrides ?? []),
    catalog_version: ORDER_CATALOG.version,
    created_by: CURRENT_USER,
    created_at: now,
    updated_at: now
  }
  writeSaved([...records(), record])
  return { ok: true, value: toSavedResponse(record) }
}

export const updateSaved = (
  id: string,
  input: SavedCustomOrderInput
): Result<SavedCustomOrder> | null => {
  const existing = records().find(r => r.id === id)
  if (!existing) return null
  const errors = validateSaved(input, id)
  if (errors.length) return { ok: false, errors }
  const record: SavedRecord = {
    ...existing,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    environment: input.environment ?? existing.environment,
    ...toConfig(input),
    status_overrides: normalizeOverrides(input.status_overrides ?? []),
    catalog_version: ORDER_CATALOG.version,
    updated_at: new Date().toISOString()
  }
  writeSaved(records().map(r => (r.id === id ? record : r)))
  return { ok: true, value: toSavedResponse(record) }
}

export const deleteSaved = (id: string): boolean => {
  if (!records().some(r => r.id === id)) return false
  writeSaved(records().filter(r => r.id !== id))
  return true
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  // Another tab saving a workflow shows up here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== SAVED_KEY) return
    memory = null
    snapshot = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Every saved workflow, live. */
export const useSavedWorkflows = () => useSyncExternalStore(subscribe, listSaved)
