import type React from 'react'

import styled, { ThemeProvider, keyframes } from 'styled-components'

import { colors } from './theme'

const outer = keyframes`
  0% {
    transform: rotateZ(0deg);
  }

  100% {
    transform: rotateZ(360deg)
  }
`

const inner = keyframes`
  0%,
  25% {
    stroke-dashoffset: 180;
    transform: rotate(0);
  }

  50%,
  75% {
    stroke-dashoffset: 45;
    transform: rotate(45deg);
  }

  100% {
    stroke-dashoffset: 180;
    transform: rotate(360deg);
  }
`

const SIZES = {
  small: 16,
  medium: 32,
  large: 64
} as const

type LoaderSize = keyof typeof SIZES

type LoaderProps = Omit<React.SVGAttributes<SVGSVGElement>, 'color'> & {
  size?: LoaderSize
  color?: string
}

const Circle = styled.circle`
  animation: 2s ease-in-out infinite both ${inner};
  display: block;
  fill: transparent;
  stroke: ${({ theme }) => (theme as { color: string }).color};
  stroke-dasharray: 270;
  stroke-dashoffset: 180;
  transform-origin: 50% 50%;
`

const SVG = styled.svg`
  animation: 1.4s linear infinite ${outer};
`

const Loader = ({
  size = 'medium',
  color = colors.midnight,
  ...props
}: LoaderProps) => {
  return (
    <ThemeProvider theme={{ color }}>
      <SVG
        viewBox={`0 0 100 100`}
        xmlns='http://www.w3.org/2000/svg'
        width={SIZES[size]}
        {...props}
      >
        <Circle cx={50} cy={50} r={45} strokeWidth={10} />
      </SVG>
    </ThemeProvider>
  )
}

export default Loader
