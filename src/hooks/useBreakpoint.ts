import { useEffect, useState } from 'react'

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface BreakpointState {
  width: number
  breakpoint: Breakpoint
  isXS: boolean // ≤767px
  isSM: boolean // 768-1023px
  isMD: boolean // 1024-1279px
  isLG: boolean // 1280-1439px
  isXL: boolean // ≥1440px
  isMobile: boolean // ≤767px
  isTablet: boolean // 768-1023px
  isDesktop: boolean // ≥1024px
}

const getBreakpoint = (width: number): Breakpoint => {
  if (width < 768) return 'xs'
  if (width < 1024) return 'sm'
  if (width < 1280) return 'md'
  if (width < 1440) return 'lg'

  return 'xl'
}

const getBreakpointState = (width: number): BreakpointState => {
  const breakpoint = getBreakpoint(width)

  return {
    width,
    breakpoint,
    isXS: breakpoint === 'xs',
    isSM: breakpoint === 'sm',
    isMD: breakpoint === 'md',
    isLG: breakpoint === 'lg',
    isXL: breakpoint === 'xl',
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024
  }
}

/**
 * Hook to detect current breakpoint based on window width.
 *
 * Breakpoints:
 * - xs: <768px (mobile)
 * - sm: 768-1023px (tablet)
 * - md: 1024-1279px (small desktop)
 * - lg: 1280-1439px (large desktop)
 * - xl: ≥1440px (extra large desktop)
 *
 * @returns {BreakpointState} Current breakpoint information
 */
export const useBreakpoint = (): BreakpointState => {
  const [state, setState] = useState<BreakpointState>(() =>
    getBreakpointState(typeof window !== 'undefined' ? window.innerWidth : 1440)
  )

  useEffect(() => {
    const handleResize = () => {
      setState(getBreakpointState(window.innerWidth))
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return state
}
