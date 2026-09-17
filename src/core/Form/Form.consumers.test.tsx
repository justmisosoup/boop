/**
 * Consumer smoke test for every importer of `@/core` Form, Form.Submit,
 * Form.Cancel, or Form.Actions.
 *
 * Each consumer's module is dynamically imported and asserted to expose
 * a callable React component. That catches any import-time breakage
 * (broken re-exports, circular imports, TS compile errors at module
 * boundary) that the Form JS→TS conversion or its call-site touch-ups
 * could plausibly introduce.
 *
 * Mount-level behavioral tests live in `Form.test.tsx`. End-to-end
 * coverage for the highest-traffic consumers (Settings/Webhooks, OAuth,
 * Setup/Signin) lives in `tests/e2e/`.
 */
import { describe, expect, test, vi } from 'vitest'

// Stub action thunks so consumer modules that pull from `actions` at
// import time don't fail when their reducers aren't fully present.
vi.mock('actions', () => {
  const noop = vi.fn(() => ({ type: 'NOOP' }))
  return new Proxy(
    {
      UPDATE_EMPLOYER_MAIL_FAILURE: 'UPDATE_EMPLOYER_MAIL_FAILURE'
    },
    {
      get: (target: Record<string, unknown>, key: string) => {
        if (key in target) return target[key]
        if (key === '__esModule') return true
        if (key === 'default') return undefined
        return noop
      }
    }
  )
})

const consumers: Array<{ path: string; named?: string }> = [
  { path: 'components/AdverseMedia/FlagAdverseMediaResultModal' },
  { path: 'components/Agent/AddNewBusiness/ReferralLinkModal' },
  { path: 'components/Industry/FlagIncorrectClassificationModal' },
  { path: 'components/SupportForm' },
  { path: 'components/Watchlists/DismissWatchlistResultModal' },
  { path: 'components/ZeroStates/PartnerReferralLink' },
  { path: 'containers/AgentExport/ExportModal' },
  {
    path: 'containers/BusinessHome/BusinessStatusBar/StatusChangeModal',
    named: 'StatusChangeModal'
  },
  { path: 'containers/ChangePassword' },
  {
    path: 'containers/Operator/Assistant/Artifact/RunFeedback/RunFeedback',
    named: 'RunFeedback'
  },
  {
    path: 'containers/Operator/Assistant/Artifact/controls/CardCheckbox',
    named: 'CardCheckbox'
  },
  {
    path: 'containers/Operator/Assistant/Artifact/controls/SourceCheckbox',
    named: 'SourceCheckbox'
  },
  { path: 'containers/PasswordReset' },
  { path: 'containers/Settings/Credentials/components/CreateOAuthModal' },
  { path: 'containers/Settings/CustomWatchlists/CustomWatchlistDetail' },
  { path: 'containers/Settings/CustomWatchlists/CustomWatchlistsList' },
  { path: 'containers/Settings/CustomWatchlists' },
  { path: 'containers/Settings/Denylist' },
  { path: 'containers/Settings/LienFiling' },
  {
    path: 'containers/Settings/PeopleRisk/LitigationCaseTypesContainer',
    named: 'LitigationCaseTypesContainer'
  },
  { path: 'containers/Settings/Policies/Components/PolicyForms/Header' },
  { path: 'containers/Settings/Policies/Components/PolicyForms/PolicyForm' },
  { path: 'containers/Settings/Profile' },
  { path: 'containers/Settings/Sdk/AddDomainModal' },
  // Settings/Team/{SSO,DSync,IdleTimeout}SettingsContainer migrated off the
  // legacy Form to @/core (Toggle/Combobox) in the Team Settings @/core migration.
  { path: 'containers/Settings/Watchlists/ListScreenedContainer' },
  { path: 'containers/Settings/Watchlists/PeopleContainer' },
  { path: 'containers/Setup' },
  { path: 'containers/Signin/SingleSignOn' },
  { path: 'containers/Signin' }
]

describe('Form consumers — module-load smoke', () => {
  test.each(consumers)('$path', async ({ path, named }) => {
    const mod = (await import(path)) as Record<string, unknown>
    const exported = named ? mod[named] : (mod.default ?? mod[path])
    // Accept plain function components, styled-component wrappers
    // (objects), and React.forwardRef results (objects).
    expect(['function', 'object']).toContain(typeof exported)
    expect(exported).not.toBeNull()
  })
})
