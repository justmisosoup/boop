/**
 * The Middesk mark.
 *
 * Copied from the dashboard's own asset (`app/src/components/Icons/middesk.svg`)
 * rather than drawn here — the same one-way clone as `@/core`. It is a product
 * asset, not a design-system primitive, which is why it lives in components
 * beside its consumers and not in core.
 *
 * `currentColor` rather than the asset's literal `#333333`, matching how the
 * dashboard sidebar renders it (`[&_path]:fill-current`), so it follows the
 * text colour it sits in and survives the dark theme.
 */
export const MiddeskMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    preserveAspectRatio="xMidYMid meet"
    viewBox="0 0 34 19"
  >
    <path
      d="M1.35137 3.31951V-8.75461e-05H4.74474L20.4066 15.6803H20.4117V15.6853V18.9999H17.0166V18.9949L1.35137 3.31951Z"
      fill="currentColor"
    />
    <path d="M5.13509 13.9766H0V19H5.13509V13.9766Z" fill="currentColor" />
    <path
      d="M14.9397 3.31951V-8.75461e-05H18.3331L33.995 15.6803H34.0001V15.6853V18.9999H30.6067V18.9949L14.9397 3.31951Z"
      fill="currentColor"
    />
  </svg>
)
