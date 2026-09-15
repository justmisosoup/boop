/**
 * THE DENSITY AXIS — one two-step scale for panel/chat surfaces.
 *
 * `standard` must render byte-identically to the pre-density system; `compact`
 * is the 12px/8px-rhythm ramp a crowded canvas (the Explorer dock) opts into.
 * Role-aware names per tokens/README — primitives map each density to their
 * own anatomy. (DataTable keeps its own three-step `DataTableDensity`;
 * different anatomy, deliberately not merged.)
 *
 * `FloatingPanel` is the sanctioned injection point: it provides the context
 * once and every part inside — header parts, chat primitives, portaled
 * pickers — inherits. Each consumer-facing component still accepts its own
 * `density` prop for standalone use; the explicit prop wins over inheritance.
 *
 * Internal: only the `Density` type is public API. The provider/hook stay
 * private so density can't be injected from arbitrary product wrappers.
 */
import { createContext, useContext } from 'react'

export type Density = 'standard' | 'compact'

const DensityContext = createContext<Density>('standard')

export const DensityProvider = DensityContext.Provider

/** Non-throwing on purpose — every part must stay usable outside a panel
 *  (falling back to `standard`), unlike the panel-chrome context whose
 *  accessor throws. */
export const useDensity = (override?: Density): Density => {
  const inherited = useContext(DensityContext)
  return override ?? inherited
}
