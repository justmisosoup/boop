import type React from 'react'
import { cloneElement, useEffect, useRef, useState } from 'react'

import styled from 'styled-components'

import { colors, spacing } from '../theme'

import Indicator from './Indicator'
import type { TabProps } from './Tab'

const Box = styled.div`
  align-items: center;
  background-color: transparent;
  border-bottom: 1px solid ${colors.frost};
  column-gap: ${spacing.xlarge};
  display: flex;
  padding: ${spacing.xsmall} 0;
  position: relative;
`

export type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  activeIndex?: number
  children: React.ReactNode
  /** Hex, rga or rgba value to style the active indicator. */
  indicatorColor?: string
  left?: number
  onTab: (index: number, event: Event) => void
  width?: number
  isFetching?: boolean
}

export const Tabs = ({
  activeIndex = 0,
  children,
  indicatorColor,
  onTab,
  isFetching,
  ...props
}: TabsProps) => {
  const [dimensions, setDimensions] = useState({ left: 0, width: 0 })

  const activeRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef(null)

  let tabs = Array.isArray(children) ? children : [children]
  let _activeIndex = tabs.findIndex(
    (el: { props: TabProps }) => el.props.active
  )

  if (_activeIndex === -1) {
    _activeIndex = activeIndex
  }

  const handler = (index: number) => (event: Event) => onTab(index, event)
  const p = (key: number) => {
    const active = key === _activeIndex
    const ref = active ? activeRef : null

    return { active, key, ref, onClick: handler(key) }
  }

  tabs = tabs.map((el: React.ReactElement, i) => cloneElement(el, p(i)))

  useEffect(() => {
    const { current } = activeRef || {}

    if (!isFetching) {
      setDimensions({
        left: current?.offsetLeft || 0,
        width: current?.clientWidth || 0
      })
    }
  }, [activeIndex, isFetching])

  return (
    <Box {...props}>
      {tabs}
      <Indicator
        indicatorColor={indicatorColor}
        ref={indicatorRef}
        {...dimensions}
      />
    </Box>
  )
}
