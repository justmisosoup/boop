import type React from 'react'
import { useEffect } from 'react'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore will be replaced with new icons
import { ReactComponent as CloseIcon } from 'ionicons/dist/ionicons/svg/ios-close.svg'
import styled from 'styled-components'

import { colors, spacing, typography } from './theme'

export interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  width?: number
  title?: string
  showCloseButton?: boolean
  header?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  zIndex?: number
  closeOnEscape?: boolean
  closeOnBackdropClick?: boolean
  className?: string
}

const DEFAULT_WIDTH = 472

const Backdrop = styled.div<{ isOpen: boolean; zIndex: number }>`
  height: 100vh;
  left: 0;
  opacity: ${props => (props.isOpen ? 1 : 0)};
  position: fixed;
  top: 0;
  transition: opacity 0.2s ease-in-out;
  visibility: ${props => (props.isOpen ? 'visible' : 'hidden')};
  width: 100vw;
  z-index: ${props => props.zIndex - 1};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Container = styled.div<{
  isOpen: boolean
  width: number
  zIndex: number
}>`
  background-color: ${colors.frostLight};
  box-shadow: 0 0 30px 0 rgb(0 0 0 / 20%);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: fixed;
  right: ${props => (props.isOpen ? '0' : `-${props.width + 30}px`)};
  top: 0;
  /* Deprecated: animates 'right' (layout-triggering). The modern Drawer.tsx
     uses translate-x (no reflow) — prefer it. */
  transition: right 0.2s ease-in-out;
  width: ${props => props.width}px;
  z-index: ${props => props.zIndex};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

const Header = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: ${spacing.medium} ${spacing.xlarge} ${spacing.small};
`

const HeaderLeft = styled.div`
  align-items: center;
  display: flex;
  gap: ${spacing.medium};
`

const HeaderRight = styled.div`
  align-items: center;
  display: flex;
`

const Title = styled.h2`
  color: ${colors.graphite};
  font-size: ${typography.sizes.display.medium};
  font-weight: ${typography.weights.normal};
  margin: 0;
`

const CloseButton = styled.button`
  align-items: center;
  background-color: white;
  border: 1px solid ${colors.frost};
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  height: 24px;
  justify-content: center;
  padding: 0;
  width: 24px;

  &:hover,
  &:focus {
    background-color: ${colors.frostLight};
  }

  svg {
    fill: black;
  }
`

const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${spacing.medium};
  overflow-y: auto;
  padding: 0 ${spacing.xlarge};
`

const Footer = styled.div`
  padding: ${spacing.xlarge};
`

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  width = DEFAULT_WIDTH,
  title,
  showCloseButton = true,
  header,
  children,
  footer,
  zIndex = 100,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  className
}) => {
  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeOnEscape, isOpen, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (closeOnBackdropClick && event.target === event.currentTarget) {
      onClose()
    }
  }

  return (
    <>
      <Backdrop isOpen={isOpen} zIndex={zIndex} onClick={handleBackdropClick} />
      <Container
        isOpen={isOpen}
        width={width}
        zIndex={zIndex}
        className={className}
      >
        <Header>
          <HeaderLeft>
            {title && <Title>{title}</Title>}
            {header}
          </HeaderLeft>
          <HeaderRight>
            {showCloseButton && (
              <CloseButton onClick={onClose} aria-label='Close drawer'>
                <CloseIcon />
              </CloseButton>
            )}
          </HeaderRight>
        </Header>

        <Body>{children}</Body>

        {footer && <Footer>{footer}</Footer>}
      </Container>
    </>
  )
}
