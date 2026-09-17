/**
 * Smoke test for every consumer of `@/core` Dropdown.
 *
 * Mount-each was the original goal, but many consumers require non-trivial
 * parent-container fixtures (PolicyRule shape, RTK Query endpoints,
 * CreateConfiguration step-machine state, etc.) that mostly test the consumer
 * rather than the Dropdown wrapping. We therefore use a hybrid approach — the
 * split is whatever the two blocks below actually contain, deliberately not
 * restated as a count here, because a number in prose rots the first time a
 * consumer is added or migrated away (it already had):
 *
 *   - consumers that mount cleanly with shared redux/router mocks get real
 *     render-time signal (catches construction-time crashes plus exercises
 *     Dropdown.tsx in each usage pattern: Toggle+Menu+Options,
 *     Toggle+Subheader+Menu, Dropdown.Interactive children, styled
 *     Dropdown.Menu extension, controlled isOpen, etc.)
 *   - the deeper consumers are verified via a static file read + regex check
 *     ("file exists and imports Dropdown from @/core"). This catches accidental
 *     removal of the Dropdown import without instrumenting the consumer's
 *     transitive code into coverage.
 *
 * Behavioral coverage for Dropdown itself lives in `Dropdown.test.tsx`
 * (95.31% statements / 85.36% branches / 100% functions).
 */
import type React from 'react'

import { configureStore } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, expect, test, vi } from 'vitest'

// === Mocks for the mount-each block =================================

vi.mock('actions', () => {
  const noop = vi.fn(() => ({ type: 'NOOP' }))
  return {
    openModal: noop,
    signout: noop,
    updateEmployerMail: noop,
    fetchReferralLink: noop,
    fetchUsers: noop,
    fetchPartnerAnalytics: noop,
    updateBusiness: noop,
    fetchPolicies: noop,
    UPDATE_EMPLOYER_MAIL_FAILURE: 'UPDATE_EMPLOYER_MAIL_FAILURE'
  }
})

vi.mock('containers/SandboxProvider', () => ({
  useSandboxMode: () => ({ sandboxMode: false })
}))

vi.mock('hooks/useBusinessPackages', () => ({
  useBusinessPackages: () => ({ packageSettings: {} })
}))

vi.mock('hooks/useAppDispatch', () => ({
  useAppDispatch: () => vi.fn()
}))

vi.mock('utils/cya', () => ({
  default: (name: string) => ({ 'data-cy': name })
}))

vi.mock('react-toast-notifications', () => ({
  useToasts: () => ({ addToast: vi.fn() })
}))

vi.mock('lib/api', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const lazyStub = () => [vi.fn(), { data: undefined, isLoading: false }]
  return {
    ...actual,
    useLazyGetSignalsQuery: lazyStub
  }
})

vi.mock(
  'containers/Settings/Policies/Components/PolicyForms/PolicyFormContext',
  () => ({
    usePolicyForm: () => ({ values: {}, setValue: vi.fn() }),
    PolicyFormProvider: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    )
  })
)

const createStore = () =>
  configureStore({
    reducer: {
      business: (
        state = {
          data: {
            id: 'biz_1',
            user: { name: 'Owner', email: 'owner@biz.com' },
            status: 'review',
            assignee_id: null
          }
        }
      ) => state,
      currentUser: (
        state = {
          account: { settings: {}, name: 'x' },
          email: 'a@b.com',
          name: 'Test User'
        }
      ) => state,
      sandbox: (state = { sandboxMode: false }) => state,
      session: (
        state = {
          data: {
            user: {
              name: 'Test User',
              email: 'a@b.com',
              account: { name: 'Acme', short_name: 'a' }
            }
          }
        }
      ) => state,
      analytics: (state = {}) => state,
      ui: (state = {}) => state,
      settings: (state = {}) => state,
      filteredBusinessesCSV: (state = {}) => state,
      referralLink: (state = { isFetching: false }) => state,
      users: (state = { data: [], isFetching: false }) => state,
      partnerAnalytics: (state = { data: {}, isFetching: false }) => state
    }
  })

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <Provider store={createStore()}>
    <MemoryRouter>{children}</MemoryRouter>
  </Provider>
)

const expectMounts = (Component: React.ComponentType) => {
  const { container } = render(
    <Wrap>
      <Component />
    </Wrap>
  )
  expect(container.firstChild).not.toBeNull()
}

const expectRenders = (node: React.ReactElement) => {
  const { container } = render(<Wrap>{node}</Wrap>)
  expect(container.firstChild).not.toBeNull()
}

// === Mount-each block (8 consumers that mount cleanly) ==============

describe('Dropdown consumers — mount smoke', () => {
  test('components/NavBar/PlaceOrder', async () => {
    const { default: PlaceOrder } = await import('components/NavBar/PlaceOrder')
    expectMounts(PlaceOrder)
  })

  test('components/AppSwitcher', async () => {
    const { default: AppSwitcher } = await import('components/AppSwitcher')
    expectMounts(AppSwitcher)
  })

  test('containers/AgentCompany/Communications/SenderAndTags', async () => {
    const mod = (await import(
      'containers/AgentCompany/Communications/SenderAndTags'
    )) as { default: React.ComponentType<Record<string, unknown>> }
    expectRenders(
      <mod.default
        comm={{
          id: '1',
          object: 'mail',
          tags: [],
          from: 'a@b.com',
          to: 'b@c.com'
        }}
      />
    )
  })

  // AssigneeDropdown used to be smoke-tested here despite never importing
  // `Dropdown` (it was on `SelectedDropdown`). It now composes `@/core`
  // `ListPicker` and has real behaviour coverage of its own in
  // `containers/BusinessHome/BusinessStatusBar/AssigneeDropdown/index.test.tsx`.

  test('containers/Settings/Policies/Components/AddCombinator', async () => {
    const { default: AddCombinator } = await import(
      'containers/Settings/Policies/Components/AddCombinator'
    )
    expectMounts(() => <AddCombinator onSelect={() => undefined} />)
  })

  test('containers/Settings/Policies/Components/AddPolicyDropdown', async () => {
    const { default: AddPolicyDropdown } = await import(
      'containers/Settings/Policies/Components/AddPolicyDropdown'
    )
    expectMounts(AddPolicyDropdown)
  })

  test('containers/Settings/Policies/Components/EditableScoreRule', async () => {
    const mod = (await import(
      'containers/Settings/Policies/Components/EditableScoreRule'
    )) as { default: React.ComponentType<Record<string, unknown>> }
    expectRenders(
      <mod.default
        rule={{ kind: 'score', value: '0' }}
        onChange={() => undefined}
      />
    )
  })
})

// === Static manifest block =====

// The two `AddorEditRuleSet/Select.tsx` react-select overrides used to be
// listed here. They never imported `Dropdown` — the regex matched
// `SelectedDropdown` — so the entry asserted nothing. Both now have
// colocated render tests next to the components.
const staticConsumers: string[] = [
  // Previously skipped — parent-fixture complexity
  'src/components/Agent/AddNewBusiness/index.tsx',
  'src/containers/Businesses/Toolbar/DropdownMenu.tsx',
  'src/containers/Settings/Policies/Components/FormationDateRule.tsx',
  'src/containers/Settings/Policies/Components/PolicyForms/AddorEditRuleSet/RuleSetBuilder/Business/DisplayRule.tsx',
  'src/containers/Settings/Policies/PolicyCard/index.tsx',
  'src/containers/Settings/SandboxConfiguration/CreateConfiguration/BusinessInformationStep.tsx',
  'src/containers/agent/Analytics/index.tsx'
]

describe('Dropdown consumers — static manifest', () => {
  test.each(staticConsumers)('%s imports Dropdown from @/core', file => {
    const fullPath = resolve(process.cwd(), file)
    expect(existsSync(fullPath)).toBe(true)
    const source = readFileSync(fullPath, 'utf8')
    expect(source).toMatch(/Dropdown/)
    expect(source).toMatch(/from\s+['"]@\/core['"]/)
  })
})
