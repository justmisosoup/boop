import type React from 'react'
import type { ReactElement } from 'react'

import * as AccessibleIcon from '@radix-ui/react-accessible-icon'
import * as RadixIcons from '@radix-ui/react-icons'

import { colors } from '../theme'

// Transform key to camelCase and remove trailing "Icon" suffix.
// E.g., "ArrowDownIcon" -> "arrowDown"
const generateMiddeskIconName = (key: string): string => {
  const base = key.replace(/Icon$/, '')

  return `${base.charAt(0).toLowerCase()}${base.slice(1)}`
}

const RADIX_ICONS: typeof RadixIcons = RadixIcons

type RadixIconKey = keyof typeof RadixIcons

// Type utilities to transform Radix icon names to camelCase
type StripIconSuffix<T extends string> = T extends `${infer Base}Icon`
  ? Base
  : T

type ToCamelCase<T extends string> = T extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : T

// Generate type for all Radix icons in camelCase format
type GeneratedIconName = ToCamelCase<StripIconSuffix<RadixIconKey>>

// Legacy aliases for backwards compatibility
type LegacyAlias = 'info' | 'search' | 'success' | 'warning' | 'error'

// Final IconName type includes all generated names plus legacy aliases
export type IconName = GeneratedIconName | LegacyAlias

// Runtime map generation
export const ICON_NAME_MAP: Record<string, RadixIconKey> = Object.keys(
  RadixIcons
).reduce<Record<string, RadixIconKey>>((nameMap, name) => {
  nameMap[generateMiddeskIconName(name)] = name as RadixIconKey

  return nameMap
}, {})

// Add legacy aliases
ICON_NAME_MAP.info = 'InfoCircledIcon'
ICON_NAME_MAP.search = 'MagnifyingGlassIcon'
ICON_NAME_MAP.success = 'CheckCircledIcon'
ICON_NAME_MAP.warning = 'ExclamationTriangleIcon'
ICON_NAME_MAP.error = 'ExclamationTriangleIcon'

const hasKey = <T extends object>(obj: T, key: PropertyKey): key is keyof T =>
  key in obj

const ICON_COLORS: Record<string, string> = {
  success: colors.green,
  warning: colors.orange,
  error: colors.red
}

export type IconProps = Omit<React.SVGAttributes<SVGElement>, 'children'> & {
  /** Class name to apply to the icon. */
  className?: string
  /** Hex, RGB, or named color of the icon. */
  color?: string
  /** Accessibility text for the icon. */
  label?: string
  /** camelCase name of the icon to render. */
  name: IconName
  /** Size of the icon. */
  size?: number | string
}

/**
 * Icon component that renders Radix UI icons with accessibility support. Browse available icons at https://www.radix-ui.com/icons.
 */
export const Icon = ({
  className,
  label,
  name = 'success',
  size = 16,
  color = ICON_COLORS[name],
  ...rest
}: IconProps): ReactElement | null => {
  const radixIconName = ICON_NAME_MAP[name] as RadixIconKey | undefined

  if (!radixIconName || !hasKey(RADIX_ICONS, radixIconName)) return null

  const IconComponent = RADIX_ICONS[radixIconName]

  return (
    <AccessibleIcon.Root label={label || name}>
      <IconComponent
        className={className}
        color={color}
        height={size}
        width={size}
        {...rest}
      />
    </AccessibleIcon.Root>
  )
}
