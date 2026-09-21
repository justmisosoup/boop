import { useLocation } from 'react-router'

import { EmptyState, PageContainer } from '@/core'
import { ALL_NAV_LINKS } from '../components/AppChrome/navItems'

/**
 * Stands in for every destination in the rail the prototype doesn't build.
 *
 * The nav is the real one, so its links have to go somewhere: without a route
 * they'd 404 and the rail's active state would never resolve. This says what
 * the destination is and that it isn't here.
 */
export const StubPage = () => {
  const location = useLocation()
  const match = ALL_NAV_LINKS.find(
    ({ link }) => link.href.split(/[?#]/)[0] === location.pathname
  )

  return (
    <PageContainer width="wide">
      <EmptyState
        description="This prototype covers the businesses list and the assessment record it opens. Everything else in the nav is here so the rail matches the app."
        title={match ? match.link.label : 'Not built in this prototype'}
      />
    </PageContainer>
  )
}
