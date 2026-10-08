import { Navigate, Route, Routes, useParams } from 'react-router'

import { Toaster } from '@/core'

import { Shell } from './Shell'
import { WorkflowDetail } from './components/Workflows/WorkflowDetail'
import { WorkflowEditor } from './components/Workflows/WorkflowEditor'
import { WorkflowsList } from './components/Workflows/WorkflowsList'
import { BusinessesPage } from './pages/BusinessesPage'
import { OrderPage } from './pages/OrderPage'
import { RecordPage } from './pages/RecordPage'
import { StubPage } from './pages/StubPage'

/** A link from when each assessment had a page of its own lands on the business. */
const BusinessRedirect = () => {
  const { businessId } = useParams()
  return <Navigate replace to={`/businesses/${businessId}`} />
}

/**
 * Where the prototype goes.
 *
 * The businesses list and the assessment record it opens; custom orders — the
 * list, builder and detail, called workflows in ~/Projects/prototype; and
 * Place order, full page
 * without the app chrome. Everything else the rail links to falls through to
 * the stub, so the nav can be the app's own without any of its links
 * dead-ending. The workflow catalogue these replaced is in `src/stash/`.
 */
export const AppRoutes = () => (
  <>
    <Routes>
      <Route element={<OrderPage />} path='/order' />
      <Route element={<Shell />} path='/'>
        <Route element={<Navigate replace to='/businesses' />} index />
        <Route element={<BusinessesPage />} path='businesses' />
        <Route element={<RecordPage />} path='businesses/:businessId' />
        <Route element={<BusinessRedirect />} path='businesses/:businessId/assessments/*' />
        <Route element={<WorkflowsList />} path='custom-orders' />
        <Route element={<WorkflowEditor mode='new' />} path='custom-orders/new' />
        <Route element={<WorkflowEditor mode='edit' />} path='custom-orders/:id/edit' />
        <Route element={<WorkflowEditor mode='duplicate' />} path='custom-orders/:id/duplicate' />
        <Route element={<WorkflowDetail />} path='custom-orders/:id' />
        {/* Custom orders were called workflows; old links land on the list. */}
        <Route element={<Navigate replace to='/custom-orders' />} path='workflows/*' />
        <Route element={<StubPage />} path='*' />
      </Route>
    </Routes>
    <Toaster />
  </>
)
