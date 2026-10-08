import type { ReactNode } from 'react'

import { Menu as MenuIcon } from 'lucide-react'

import {
  AppShellTopbar,
  AppShellTopbarContent,
  IconActionButton,
  PageBreadcrumb,
  PageBreadcrumbItem
} from '@/core'
import { Link } from 'react-router'

import { useSidebar } from '@/contexts/SidebarContext'
import { useBreakpoint } from '@/hooks/useBreakpoint'

import { WORKFLOWS_PATH } from './paths'

// Mirrors the app's topbar (components/AppChrome/AppTopbar), which a workflow's
// own pages drop: the hamburger on mobile, then the page's breadcrumb and
// actions.
export const WorkflowTopbar = ({
  current,
  actions
}: {
  /** The page under Workflows; omitted on the workflows list itself. */
  current?: string
  actions?: ReactNode
}) => {
  const { isMobile } = useBreakpoint()
  const { openMobileNav } = useSidebar()
  return (
    <AppShellTopbar>
      <AppShellTopbarContent>
        {isMobile && (
          <IconActionButton
            aria-label='Open navigation'
            className='mr-2 size-9 shrink-0'
            onClick={openMobileNav}
            variant='secondary'
          >
            <MenuIcon aria-hidden='true' size={18} strokeWidth={1.5} />
          </IconActionButton>
        )}
        <PageBreadcrumb className='min-w-0'>
          {current ? (
            <>
              <PageBreadcrumbItem asChild>
                <Link className='no-underline' to={WORKFLOWS_PATH}>
                  Assessments
                </Link>
              </PageBreadcrumbItem>
              <PageBreadcrumbItem current>{current}</PageBreadcrumbItem>
            </>
          ) : (
            <PageBreadcrumbItem current>Assessments</PageBreadcrumbItem>
          )}
        </PageBreadcrumb>
        <div className='flex-grow' />
        {actions && <div className='flex items-center gap-2'>{actions}</div>}
      </AppShellTopbarContent>
    </AppShellTopbar>
  )
}
