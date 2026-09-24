import { Navigate, Route, Routes, useParams } from 'react-router'

import { Shell } from './Shell'
import { BusinessesPage } from './pages/BusinessesPage'
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
 * Two real destinations — the businesses list and the assessment record it
 * opens. Everything else the rail links to falls through to the stub, so the
 * nav can be the app's own without any of its links dead-ending.
 */
export const AppRoutes = () => (
  <Routes>
    <Route element={<Shell />} path='/'>
      <Route element={<Navigate replace to='/businesses' />} index />
      <Route element={<BusinessesPage />} path='businesses' />
      <Route element={<RecordPage />} path='businesses/:businessId' />
      <Route element={<BusinessRedirect />} path='businesses/:businessId/assessments/*' />
      <Route element={<StubPage />} path='*' />
    </Route>
  </Routes>
)
