// The hooks ~/Projects/prototype's workflow pages call (RTK Query there),
// backed here by the localStorage store in `lib/savedWorkflows.ts`, so the
// copied pages read the same.

import { useState } from 'react'

import {
  createSaved,
  deleteSaved,
  updateSaved,
  useSavedWorkflows
} from '../savedWorkflows'
import { ORDER_CATALOG } from './catalog'
import type {
  CustomOrderError,
  SavedCustomOrder,
  SavedCustomOrderInput
} from './types'

type ErrorResponse = { data: { errors: CustomOrderError[] } }

const reject = (errors: CustomOrderError[]): ErrorResponse => ({
  data: { errors }
})

export const errorsOf = (error: unknown): CustomOrderError[] => {
  const errors = (error as ErrorResponse)?.data?.errors
  return errors?.length
    ? errors
    : [{ message: 'Something went wrong. Please try again.' }]
}

const noop = () => {}

export const useCustomOrderData = () => {
  const saved = useSavedWorkflows()
  return {
    catalog: { data: ORDER_CATALOG, isError: false, refetch: noop },
    saved: { data: saved, isError: false, isLoading: false, refetch: noop }
  }
}

/** A mutation as RTK hands it back: a trigger whose result `unwrap`s. */
const useMutation = <A, T>(run: (arg: A) => T) => {
  const [isLoading, setLoading] = useState(false)
  const trigger = (arg: A) => {
    setLoading(true)
    const result = new Promise<T>((resolve, reject) => {
      try {
        resolve(run(arg))
      } catch (e) {
        reject(e)
      } finally {
        setLoading(false)
      }
    })
    return { unwrap: () => result }
  }
  return [trigger, { isLoading, isError: false }] as const
}

export const useSaveCustomOrderMutation = () =>
  useMutation((body: SavedCustomOrderInput): SavedCustomOrder => {
    const result = createSaved(body)
    if (!result.ok) throw reject(result.errors)
    return result.value
  })

export const useUpdateCustomOrderMutation = () =>
  useMutation(
    ({ id, ...body }: SavedCustomOrderInput & { id: string }): SavedCustomOrder => {
      const result = updateSaved(id, body)
      if (!result) throw reject([{ message: 'This order no longer exists.' }])
      if (!result.ok) throw reject(result.errors)
      return result.value
    }
  )

export const useDeleteCustomOrderMutation = () =>
  useMutation((id: string) => {
    if (!deleteSaved(id)) throw reject([{ message: 'This order no longer exists.' }])
  })
