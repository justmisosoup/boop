import { Navigate, Route, Routes } from 'react-router'

import { Toaster } from '@/core'

import { Shell } from './Shell'
import { WorkflowDetail } from './components/Workflows/WorkflowDetail'
import { WorkflowEditor } from './components/Workflows/WorkflowEditor'
import { WorkflowsList } from './components/Workflows/WorkflowsList'
import { BusinessSectionPage } from './pages/BusinessSectionPage'
import { BusinessesPage } from './pages/BusinessesPage'
import { OrderPage } from './pages/OrderPage'
import { RecordPage } from './pages/RecordPage'
import { StubPage } from './pages/StubPage'

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
      <Route element={<Shell />} path='/'>
        <Route element={<Navigate replace to='/businesses' />} index />
        {/* Running an assessment, in the dashboard's body: the nav stays. */}
        <Route element={<OrderPage />} path='order' />
        <Route element={<BusinessesPage />} path='businesses' />
        <Route element={<RecordPage />} path='businesses/:businessId' />
        {/* The business's overview, and each of its assessments. */}
        <Route element={<RecordPage />} path='businesses/:businessId/assessments/:assessmentId' />
        <Route element={<BusinessSectionPage section='timeline' />} path='businesses/:businessId/timeline' />
        <Route element={<BusinessSectionPage section='activity' />} path='businesses/:businessId/activity' />
        <Route element={<WorkflowsList />} path='assessments' />
        <Route element={<WorkflowEditor mode='new' />} path='assessments/new' />
        <Route element={<WorkflowEditor mode='edit' />} path='assessments/:id/edit' />
        <Route element={<WorkflowEditor mode='duplicate' />} path='assessments/:id/duplicate' />
        <Route element={<WorkflowDetail />} path='assessments/:id' />
        {/* Assessments were called custom orders, and workflows before that;
            old links land on the list. */}
        <Route element={<Navigate replace to='/assessments' />} path='custom-orders/*' />
        <Route element={<Navigate replace to='/assessments' />} path='workflows/*' />
        <Route element={<StubPage />} path='*' />
      </Route>
    </Routes>
    <Toaster />
  </>
)
