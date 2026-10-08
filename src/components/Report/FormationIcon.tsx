import type { SVGProps } from 'react'

/**
 * The formation filing's mark: a courthouse with a flag on its roof — the
 * state the business was formed in. Drawn in lucide's grid and stroke so it
 * sits with the other icons.
 */
export const FormationIcon = ({
  size = 24,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* The flag on its pole, from the roof's peak. */}
    <path d="M12 8V2" />
    <path d="M12 2.5h5l-1.5 1.75L17 6h-5" />
    {/* The courthouse: roof, columns, steps. */}
    <path d="M4 11 12 8l8 3Z" />
    <path d="M6 14v4" />
    <path d="M10 14v4" />
    <path d="M14 14v4" />
    <path d="M18 14v4" />
    <path d="M3 22h18" />
  </svg>
)
