import type React from 'react'
import { useState } from 'react'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore will be replaced with new icons
import { ReactComponent as EyeOffIcon } from 'ionicons/dist/ionicons/svg/ios-eye-off.svg'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore will be replaced with new icons
import { ReactComponent as EyeIcon } from 'ionicons/dist/ionicons/svg/ios-eye.svg'
import styled from 'styled-components'

import { colors, spacing, typography } from './theme'
import { TooltipIcon } from './Tooltip/TooltipIcon'

const ICON_HEIGHT = '24px'

const Box = styled.div`
  display: block;
  font-family: ${typography.faces.default};
  margin-bottom: ${spacing.xsmall};
`

const Label = styled.div<{ required: boolean; labelWeight: number }>`
  color: ${colors.graphite};
  font-size: ${typography.sizes.medium};
  ${props => `font-weight: ${props.labelWeight};`}

  ${({ required }) => {
    if (required) {
      return `
        &::after {
          content: ' *';
          color: ${colors.red};
        }
      `
    }
  }}
`

const Sublabel = styled.div`
  color: ${colors.karl};
  font-size: ${typography.sizes.medium};
  font-weight: ${typography.weights.normal};
`

const Value = styled.div`
  color: ${colors.graphite};
  font-size: ${typography.sizes.medium};

  &:empty::before {
    color: ${colors.frost};
    content: '–';
  }
`

const Details = styled.div`
  color: ${colors.karl};
  font-size: ${typography.sizes.medium};

  &:empty {
    display: none;
  }
`

const Show = styled(EyeIcon)`
  height: ${ICON_HEIGHT};
`

const Mask = styled(EyeOffIcon)`
  height: ${ICON_HEIGHT};
`

type MaskedValueProps = {
  children: React.ReactNode
  className?: string
}

const MaskedValue = styled(({ children, className }: MaskedValueProps) => {
  const [masked, setMasked] = useState(true)

  return (
    <div className={className}>
      <div>{masked ? '•'.repeat(15) : <Value>{children}</Value>}</div>
      {masked ? (
        <Show onClick={() => setMasked(false)} />
      ) : (
        <Mask onClick={() => setMasked(true)} />
      )}
    </div>
  )
})`
  align-items: center;
  display: flex;

  > div:first-child {
    margin-right: 20px;
    min-width: 110px;
  }
`

export type AttributeProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Content of the attribute
   */
  children?: React.ReactNode
  /**
   * Additional information related to attribute
   */
  detail?: React.ReactNode
  /**
   * The label used to describe the attribute
   */
  label?: string | React.ReactNode
  /**
   * If the field should be masked initially
   */
  masked?: boolean
  /**
   * Whether to add `(optional)` text to the label
   */
  optional?: boolean
  /**
   * Whether field is required. Denoted by red asterisk appended to label
   */
  required?: boolean
  /**
   * Text supplementary to the label
   */
  sublabel?: string | React.ReactNode
  /**
   * Alternative shorthand for attribute content
   */
  value?: React.ReactNode
  /**
   * Tooltip object for the label
   */
  tooltip?: { content?: string; text?: string; url?: string }
  /**
   * fontWeight for the label
   */
  labelWeight?: number
}

const BetweenDiv = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacing.xsmall};
  justify-content: space-between;
  margin-right: 5px;
`

export const Attribute = ({
  children,
  detail,
  label,
  masked,
  optional,
  required = false,
  sublabel,
  value,
  tooltip,
  labelWeight = typography.weights.bold,
  ...props
}: AttributeProps) => {
  const LabelComponent = (
    <Label required={required} labelWeight={labelWeight}>
      {label}
      {optional && ` (optional)`}
    </Label>
  )

  return (
    <Box {...props}>
      {tooltip ? (
        <BetweenDiv>
          {LabelComponent}
          <TooltipIcon {...tooltip} />
        </BetweenDiv>
      ) : (
        LabelComponent
      )}
      {sublabel && <Sublabel>{sublabel}</Sublabel>}
      {masked ? (
        <MaskedValue>{children || value}</MaskedValue>
      ) : (
        <Value>{children || value}</Value>
      )}
      <Details>{detail}</Details>
    </Box>
  )
}

const ListItem = styled.div`
  border-bottom: 2px solid ${colors.dawn};
  margin: 4px 0;
  padding: 6px 0;

  &:first-child {
    border-top: 2px solid ${colors.dawn};
  }
`

const EmptyList = styled.div`
  &::before {
    border-bottom: 2px solid ${colors.dawn};
    border-top: 2px solid ${colors.dawn};
    color: ${colors.karl};
    content: 'None';
    display: block;
    font-style: italic;
    margin: 4px 0;
    padding: 6px 0;
  }
`

export type AttributeListProps = {
  /**
   * The label used to describe the attribute
   */
  label: string
  /**
   * Values for the attribute list
   */
  values?: React.ReactNode[]
}

export const AttributeList = ({ label, values = [] }: AttributeListProps) => {
  return (
    <Attribute label={label}>
      {values.length > 0 ? (
        values.map((value, index) => <ListItem key={index}>{value}</ListItem>)
      ) : (
        <EmptyList />
      )}
    </Attribute>
  )
}
