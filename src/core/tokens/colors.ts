/**
 * Semantic color tokens — CSS variable references for scoped core theming.
 *
 * Values resolve at runtime via .core-theme / .core-theme[data-theme="dark"]
 * defined in src/core/theme.css.
 *
 * This is a scoped design-system proof, not full-app dark mode.
 */

type TokenTree = {
  readonly [key: string]: string | TokenTree
}

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`

type LeafPaths<T> = T extends string
  ? ''
  : {
      [K in keyof T & string]: `${K}${DotPrefix<LeafPaths<T[K]>>}`
    }[keyof T & string]

const cssVar = (name: string) => `var(--core-color-${name})`

export const semanticColors = {
  surface: {
    canvas: cssVar('surface-canvas'),
    default: cssVar('surface-default'),
    card: cssVar('surface-card'),
    raised: cssVar('surface-raised'),
    subtle: cssVar('surface-subtle'),
    inset: cssVar('surface-inset'),
    inverse: cssVar('surface-inverse'),
    popover: cssVar('surface-popover'),
    modal: cssVar('surface-modal')
  },
  text: {
    primary: cssVar('text-primary'),
    secondary: cssVar('text-secondary'),
    muted: cssVar('text-muted'),
    disabled: cssVar('text-disabled'),
    inverse: cssVar('text-inverse'),
    link: cssVar('text-link'),
    onAction: cssVar('text-on-action'),
    onStatus: cssVar('text-on-status'),
    danger: cssVar('text-danger'),
    success: cssVar('text-success'),
    warning: cssVar('text-warning')
  },
  border: {
    subtle: cssVar('border-subtle'),
    default: cssVar('border-default'),
    strong: cssVar('border-strong'),
    bold: cssVar('border-bold'),
    divider: cssVar('border-divider'),
    inverse: cssVar('border-inverse')
  },
  focus: {
    ring: cssVar('focus-ring'),
    offset: cssVar('focus-offset'),
    control: cssVar('focus-control'),
    destructive: cssVar('focus-destructive')
  },
  action: {
    primary: {
      bg: cssVar('action-primary-bg'),
      fg: cssVar('action-primary-fg'),
      border: cssVar('action-primary-border'),
      hoverBg: cssVar('action-primary-hover-bg'),
      activeBg: cssVar('action-primary-active-bg'),
      disabledBg: cssVar('action-primary-disabled-bg'),
      disabledFg: cssVar('action-primary-disabled-fg')
    },
    secondary: {
      bg: cssVar('action-secondary-bg'),
      fg: cssVar('action-secondary-fg'),
      border: cssVar('action-secondary-border'),
      hoverBg: cssVar('action-secondary-hover-bg'),
      activeBg: cssVar('action-secondary-active-bg'),
      disabledBg: cssVar('action-secondary-disabled-bg'),
      disabledFg: cssVar('action-secondary-disabled-fg')
    },
    quiet: {
      bg: cssVar('action-quiet-bg'),
      fg: cssVar('action-quiet-fg'),
      border: cssVar('action-quiet-border'),
      hoverBg: cssVar('action-quiet-hover-bg'),
      activeBg: cssVar('action-quiet-active-bg'),
      disabledBg: cssVar('action-quiet-disabled-bg'),
      disabledFg: cssVar('action-quiet-disabled-fg')
    },
    destructive: {
      bg: cssVar('action-destructive-bg'),
      fg: cssVar('action-destructive-fg'),
      border: cssVar('action-destructive-border'),
      hoverBg: cssVar('action-destructive-hover-bg'),
      activeBg: cssVar('action-destructive-active-bg'),
      disabledBg: cssVar('action-destructive-disabled-bg'),
      disabledFg: cssVar('action-destructive-disabled-fg')
    }
  },
  control: {
    bg: cssVar('control-bg'),
    fg: cssVar('control-fg'),
    placeholder: cssVar('control-placeholder'),
    border: cssVar('control-border'),
    borderHover: cssVar('control-border-hover'),
    borderFocus: cssVar('control-border-focus'),
    disabledBg: cssVar('control-disabled-bg'),
    disabledFg: cssVar('control-disabled-fg'),
    errorFg: cssVar('control-error-fg'),
    errorBorder: cssVar('control-error-border'),
    errorBg: cssVar('control-error-bg'),
    helperText: cssVar('control-helper-text')
  },
  table: {
    headerBg: cssVar('table-header-bg'),
    headerText: cssVar('table-header-text'),
    rowBg: cssVar('table-row-bg'),
    rowHoverBg: cssVar('table-row-hover-bg'),
    rowSelectedBg: cssVar('table-row-selected-bg'),
    cellText: cssVar('table-cell-text'),
    border: cssVar('table-border'),
    divider: cssVar('table-divider')
  },
  nav: {
    bg: cssVar('nav-bg'),
    border: cssVar('nav-border'),
    itemText: cssVar('nav-item-text'),
    itemMuted: cssVar('nav-item-muted'),
    itemHoverBg: cssVar('nav-item-hover-bg'),
    itemActiveBg: cssVar('nav-item-active-bg'),
    itemActiveText: cssVar('nav-item-active-text')
  },
  overlay: {
    backdrop: cssVar('overlay-backdrop'),
    scrim: cssVar('overlay-scrim'),
    modalBg: cssVar('overlay-modal-bg'),
    popoverBg: cssVar('overlay-popover-bg'),
    tooltipBg: cssVar('overlay-tooltip-bg'),
    tooltipText: cssVar('overlay-tooltip-text')
  },
  elevation: {
    card: cssVar('elevation-card'),
    raised: cssVar('elevation-raised'),
    popover: cssVar('elevation-popover'),
    modal: cssVar('elevation-modal'),
    drawer: cssVar('elevation-drawer')
  },
  status: {
    success: {
      bg: cssVar('status-success-bg'),
      fg: cssVar('status-success-fg'),
      border: cssVar('status-success-border')
    },
    warning: {
      bg: cssVar('status-warning-bg'),
      fg: cssVar('status-warning-fg'),
      border: cssVar('status-warning-border')
    },
    danger: {
      bg: cssVar('status-danger-bg'),
      fg: cssVar('status-danger-fg'),
      border: cssVar('status-danger-border')
    },
    info: {
      bg: cssVar('status-info-bg'),
      fg: cssVar('status-info-fg'),
      border: cssVar('status-info-border')
    },
    neutral: {
      bg: cssVar('status-neutral-bg'),
      fg: cssVar('status-neutral-fg'),
      border: cssVar('status-neutral-border')
    }
  },
  risk: {
    none: {
      bg: cssVar('risk-none-bg'),
      fg: cssVar('risk-none-fg'),
      border: cssVar('risk-none-border')
    },
    low: {
      bg: cssVar('risk-low-bg'),
      fg: cssVar('risk-low-fg'),
      border: cssVar('risk-low-border')
    },
    moderate: {
      bg: cssVar('risk-moderate-bg'),
      fg: cssVar('risk-moderate-fg'),
      border: cssVar('risk-moderate-border')
    },
    high: {
      bg: cssVar('risk-high-bg'),
      fg: cssVar('risk-high-fg'),
      border: cssVar('risk-high-border')
    },
    critical: {
      bg: cssVar('risk-critical-bg'),
      fg: cssVar('risk-critical-fg'),
      border: cssVar('risk-critical-border')
    },
    unknown: {
      bg: cssVar('risk-unknown-bg'),
      fg: cssVar('risk-unknown-fg'),
      border: cssVar('risk-unknown-border')
    }
  },
  workflow: {
    draft: {
      bg: cssVar('workflow-draft-bg'),
      fg: cssVar('workflow-draft-fg'),
      border: cssVar('workflow-draft-border')
    },
    preview: {
      bg: cssVar('workflow-preview-bg'),
      fg: cssVar('workflow-preview-fg'),
      border: cssVar('workflow-preview-border')
    },
    queued: {
      bg: cssVar('workflow-queued-bg'),
      fg: cssVar('workflow-queued-fg'),
      border: cssVar('workflow-queued-border')
    },
    processing: {
      bg: cssVar('workflow-processing-bg'),
      fg: cssVar('workflow-processing-fg'),
      border: cssVar('workflow-processing-border')
    },
    pending: {
      bg: cssVar('workflow-pending-bg'),
      fg: cssVar('workflow-pending-fg'),
      border: cssVar('workflow-pending-border')
    },
    complete: {
      bg: cssVar('workflow-complete-bg'),
      fg: cssVar('workflow-complete-fg'),
      border: cssVar('workflow-complete-border')
    },
    submitted: {
      bg: cssVar('workflow-submitted-bg'),
      fg: cssVar('workflow-submitted-fg'),
      border: cssVar('workflow-submitted-border')
    },
    disabled: {
      bg: cssVar('workflow-disabled-bg'),
      fg: cssVar('workflow-disabled-fg'),
      border: cssVar('workflow-disabled-border')
    },
    failed: {
      bg: cssVar('workflow-failed-bg'),
      fg: cssVar('workflow-failed-fg'),
      border: cssVar('workflow-failed-border')
    }
  },
  outcome: {
    positive: {
      bg: cssVar('outcome-positive-bg'),
      fg: cssVar('outcome-positive-fg'),
      border: cssVar('outcome-positive-border')
    },
    negative: {
      bg: cssVar('outcome-negative-bg'),
      fg: cssVar('outcome-negative-fg'),
      border: cssVar('outcome-negative-border')
    },
    neutral: {
      bg: cssVar('outcome-neutral-bg'),
      fg: cssVar('outcome-neutral-fg'),
      border: cssVar('outcome-neutral-border')
    }
  },
  confidence: {
    high: {
      bg: cssVar('confidence-high-bg'),
      fg: cssVar('confidence-high-fg'),
      border: cssVar('confidence-high-border')
    },
    medium: {
      bg: cssVar('confidence-medium-bg'),
      fg: cssVar('confidence-medium-fg'),
      border: cssVar('confidence-medium-border')
    },
    low: {
      bg: cssVar('confidence-low-bg'),
      fg: cssVar('confidence-low-fg'),
      border: cssVar('confidence-low-border')
    },
    unavailable: {
      bg: cssVar('confidence-unavailable-bg'),
      fg: cssVar('confidence-unavailable-fg'),
      border: cssVar('confidence-unavailable-border')
    }
  },
  evidence: {
    strong: {
      bg: cssVar('evidence-strong-bg'),
      fg: cssVar('evidence-strong-fg'),
      border: cssVar('evidence-strong-border')
    },
    moderate: {
      bg: cssVar('evidence-moderate-bg'),
      fg: cssVar('evidence-moderate-fg'),
      border: cssVar('evidence-moderate-border')
    },
    weak: {
      bg: cssVar('evidence-weak-bg'),
      fg: cssVar('evidence-weak-fg'),
      border: cssVar('evidence-weak-border')
    },
    unavailable: {
      bg: cssVar('evidence-unavailable-bg'),
      fg: cssVar('evidence-unavailable-fg'),
      border: cssVar('evidence-unavailable-border')
    }
  },
  brand: {
    primary: cssVar('brand-primary'),
    accent: cssVar('brand-accent')
  },

  // Compatibility aliases from the first scoped-token proof.
  bg: {
    primary: cssVar('bg-primary'),
    secondary: cssVar('bg-secondary'),
    surface: cssVar('bg-surface')
  },
  interactive: {
    default: cssVar('interactive-default'),
    hover: cssVar('interactive-hover'),
    active: cssVar('interactive-active'),
    disabled: cssVar('interactive-disabled')
  }
} as const satisfies TokenTree

export type SemanticColorToken = LeafPaths<typeof semanticColors>

const flattenTokenTree = (tree: TokenTree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const token = prefix ? `${prefix}.${key}` : key

    if (typeof value === 'string') {
      return [token]
    }

    return flattenTokenTree(value, token)
  })

/** Resolve a semantic color token to its CSS variable reference. */
export function tokenVar(token: SemanticColorToken): string {
  return `var(--core-color-${token
    .replace(/\./g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()})`
}

/** All semantic color token names as an array for specimens and docs. */
export const semanticColorTokens = flattenTokenTree(
  semanticColors
) as SemanticColorToken[]
