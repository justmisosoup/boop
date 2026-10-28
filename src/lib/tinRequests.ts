import { createLocalStore } from './localStore'

/**
 * Where the reviewer asked Middesk to find a business's TIN, and when — the
 * TIN Match assessment's other way in, beside submitting the TIN themselves.
 * Kept in the browser: it is the reviewer's action, not the record.
 */
const store = createLocalStore<{ at: string }>('prototype:tin-requests')

export const useTinRequest = (businessId: string) => store.useAll()[businessId] ?? null
export const requestTin = (businessId: string) => store.set(businessId, { at: new Date().toISOString() })
export const cancelTinRequest = (businessId: string) => store.remove(businessId)

/** A TIN as typed — nine digits, the dash optional. */
export const tinDigits = (typed: string) => typed.replace(/\D/g, '')
export const isTin = (typed: string) => tinDigits(typed).length === 9
