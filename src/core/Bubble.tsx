import styled from 'styled-components'

import { colors, typography, borderRadius } from './theme'

type BubbleVariant =
  | 'blue'
  | 'green'
  | 'yellow'
  | 'red'
  | 'karl'
  | 'orange'
  | 'purple'
  | 'silas'
  | 'midnight'
  | 'pink'
  | 'lavender'

export type BubbleProps = {
  variant: BubbleVariant
}

export const Bubble = styled.div<BubbleProps>`
  align-items: center;
  border-radius: ${borderRadius.large};
  cursor: pointer;
  display: flex;
  flex-direction: row;
  font-size: ${typography.sizes.medium};
  font-weight: ${typography.weights.bold};
  height: 40px;
  justify-content: center;
  text-transform: uppercase;
  width: 40px;

  ${({ variant = 'green' }) => {
    if (variant === 'green') {
      return `
        color: ${colors.green};
        background-color: ${colors.greenLight};
      `
    } else if (variant === 'yellow') {
      return `
        color: ${colors.karl};
        background-color: ${colors.yellowLight};
      `
    } else if (variant === 'blue') {
      return `
        color: ${colors.blue};
        background-color: ${colors.blueLight};
      `
    } else if (variant === 'karl') {
      return `
        color: ${colors.karl};
        background-color: ${colors.dawn};
      `
    } else if (variant === 'orange') {
      return `
        color: ${colors.orange};
        background-color: ${colors.orangeLight};
      `
    } else if (variant === 'silas' || variant === 'midnight') {
      return `
            color: ${colors.midnightDark2};
            background-color: ${colors.midnightLight2};
          `
    } else if (variant === 'pink') {
      return `
        color: ${colors.pink};
        background-color: ${colors.pinkLight};
      `
    } else if (variant === 'lavender') {
      return `
        color: ${colors.lavender};
        background-color: ${colors.lavenderLight};
      `
    } else {
      return `
        color: ${colors.red};
        background-color: ${colors.redLight};
      `
    }
  }}
`
