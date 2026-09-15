import { useCallback, useState } from 'react'

/**
 * `.core-theme` is what activates the `--core-*` tokens every `@/core`
 * primitive reads. The canonical boundary is `AppShellRoot` (it sets the class
 * + `data-theme`), but during the design-system rollout primitives also render
 * on legacy routes that have no such boundary — there they would come out
 * unstyled (transparent surfaces, no overlay/shadow, square corners).
 *
 * This hook lets a primitive supply that scope itself, but only as a
 * *fallback*: `applyFallback` is `true` when no ancestor already establishes
 * `.core-theme`, and `false` when one does — so it never re-declares the scope
 * inside, e.g., a dark `AppShellRoot` and reset its tokens back to the light
 * defaults. It starts `true` so the first paint is already scoped (no flash of
 * unstyled content) and flips to `false` after mount if a themed ancestor is
 * found.
 *
 * Lifecycle — this is a transitional bridge, not a permanent dependency, and it
 * is self-retiring: the moment a subtree sits under a `.core-theme` boundary it
 * no-ops (defers to the ancestor), so nothing breaks as routes migrate. The
 * hook and the conditional class can be deleted outright once no `@/core`
 * primitive is ever rendered outside such a boundary — i.e. once the app shell
 * is fully on `AppShellRoot` / a global core-theme provider.
 *
 * Usage: attach `ref` to the primitive's root element and add `core-theme` to
 * its className when `applyFallback` is true.
 */
export function useCoreThemeFallback<T extends HTMLElement = HTMLElement>() {
  const [applyFallback, setApplyFallback] = useState(true)

  // A callback ref (not a one-shot mount effect) so detection re-runs whenever
  // the element actually attaches. Overlay primitives like Drawer/Dialog render
  // `null` while closed, so a `useLayoutEffect([])` check fires once — before
  // their element exists — finds no ancestor, and stays stuck on the `true`
  // default. The overlay would then re-declare a *light* `.core-theme` inside a
  // dark root and reset the panel's tokens to light. Re-checking on attach lets
  // it correctly defer to the ancestor (inheriting dark) when one exists.
  const ref = useCallback((node: T | null) => {
    if (node) {
      setApplyFallback(!node.parentElement?.closest('.core-theme'))
    }
  }, [])

  return [ref, applyFallback] as const
}
