import React, { forwardRef } from 'react'

import { useSpring, animated } from 'react-spring'
import styled from 'styled-components'

import { colors } from '../theme'

const StyledIndicator = styled(animated.div)`
  bottom: 0;
  height: 3px;
  position: absolute;
`

type IndicatorProps = {
  indicatorColor?: string
  left?: number
  width?: number
}

const Indicator = forwardRef<HTMLDivElement, IndicatorProps>(function Indicator(
  { indicatorColor = colors.midnight, left = 0, width = 0 },
  ref
) {
  const style = useSpring({
    config: {
      duration: 100,
      tension: 300
    },
    left,
    width,
    backgroundColor: indicatorColor
  })

  return <StyledIndicator ref={ref} style={style} />
})

export default Indicator
