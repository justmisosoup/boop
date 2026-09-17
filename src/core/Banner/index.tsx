import type React from 'react'
import type { CSSProperties } from 'react'

import styled from 'styled-components'

import { Icon, type IconName } from '../Icon'
import { colors, spacing, typography } from '../theme'

type BannerIntent = 'info' | 'success' | 'warning' | 'failure'

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Custom contents of the banner. */
  children?: React.ReactNode
  /** List of classes to pass to the underlying html element. */
  className?: string
  /** Color and icon style to indicate the message's significance. */
  intent?: BannerIntent
  /** Callback to invoke when dismissed. */
  onDismiss?: React.MouseEventHandler
  /** Text to display in the banner. */
  message?: string
  /** Whether to display an icon. */
  showIcon?: boolean
  /** Full CSS properties */
  style?: CSSProperties
}

const INTENT_ICON_STYLES: Record<
  BannerIntent,
  { color: string; name: IconName }
> = {
  info: {
    color: colors.graphite,
    name: 'infoCircled'
  },
  success: {
    color: colors.green,
    name: 'checkCircled'
  },
  warning: {
    color: colors.graphite,
    name: 'exclamationTriangle'
  },
  failure: {
    color: colors.red,
    name: 'exclamationTriangle'
  }
}

const StyledIcon = styled(Icon)`
  align-self: start;
  flex: 0 0 auto;
  padding: 1px 0;
`

const DismissButton = styled.button`
  align-self: start;
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  margin-left: auto;
  padding: 0;
`

const StyledBanner = styled.div<BannerProps>`
  align-items: center;
  border: 1px solid;
  border-radius: 8px;
  column-gap: ${spacing.small};
  display: flex;
  font-size: ${typography.sizes.medium};
  padding: ${spacing.large};

  ${({ intent = 'info' }) => {
    switch (intent) {
      case 'info': {
        return `
          background: ${colors.dawn};
          border-color: ${colors.frost};
          color: ${colors.graphite};
        `
      }
      case 'success': {
        return `
          background: ${colors.greenLight};
          border-color: ${colors.green};
          color: ${colors.green};
        `
      }
      case 'warning': {
        return `
          background: ${colors.yellowLight};
          border-color: ${colors.yellow};
          color: ${colors.graphite};
        `
      }
      case 'failure': {
        return `
          background: ${colors.redLight};
          border-color: ${colors.red};
          color: ${colors.red};
        `
      }
    }
  }}
`

/**
 * @deprecated Legacy styled-components banner. Prefer `InlineAlert` from
 * `@/core` for new work — it's tokenized (light/dark parity), carries the
 * status icon, and supports dismiss + actions. This component will be migrated
 * away and removed once its consumers move over.
 */
export const Banner = ({
  children,
  intent = 'info',
  message,
  onDismiss,
  showIcon = true,
  style,
  ...rest
}: BannerProps) => {
  return (
    <StyledBanner intent={intent} style={style} {...rest}>
      {showIcon && <StyledIcon size={18} {...INTENT_ICON_STYLES[intent]} />}
      {message || children}
      {onDismiss && (
        <DismissButton onClick={onDismiss}>
          <StyledIcon label='dismiss' name='cross2' size={18} />
        </DismissButton>
      )}
    </StyledBanner>
  )
}
