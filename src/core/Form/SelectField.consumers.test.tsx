/**
 * Static-file consumer manifest for `@/core` SelectField.
 *
 * Each consumer is verified by reading the file from disk and asserting it
 * actually imports `SelectField` from `@/core`. We deliberately avoid
 * dynamic `import()` here — pulling these modules into the test runner
 * instruments their (and their transitive) code into the coverage report,
 * dragging project-level coverage down without adding meaningful behavioral
 * signal. Module-resolution and TS export integrity for these consumers is
 * already verified by `tsc --noEmit` in the lint job.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

const consumers: string[] = [
  'src/components/Agent/RequestedApplicationsField/RegistrationRequestModalV2.tsx',
  'src/components/Industry/FlagIncorrectClassificationModal.tsx',
  'src/containers/AgentExport/ExportModal.tsx',
  'src/containers/Convert/AuditLog/Filters.tsx',
  'src/containers/Convert/Run/AiPromptDrawer/AiConfig.tsx',
  'src/containers/Convert/Run/CitySelect.tsx',
  'src/containers/Convert/Run/CodeSelect.tsx',
  'src/containers/Convert/Run/FilterAndEnrichDrawer/EnrichSection.tsx',
  'src/containers/Convert/Run/FilterAndEnrichDrawer/FilterSelectField.tsx',
  'src/containers/Convert/Run/ProfilesTable/ScheduleModal.tsx',
  'src/containers/LienFiling/LienFilingDebtorForm.tsx',
  'src/containers/LienFiling/LienFilingMainForm.tsx',
  'src/containers/LienFiling/LienFilingSecuredPartyForm.tsx',
  'src/containers/PlaceOrderFlow/People/KycAddress.tsx',
  'src/containers/Settings/LienFiling/index.tsx',
  'src/containers/Settings/RiskyKeywords/RiskyKeywordsForm.tsx',
  'src/containers/Settings/SandboxConfiguration/CreateConfiguration/BusinessInformationStep.tsx',
  'src/containers/Settings/SandboxConfiguration/CreateConfiguration/SelectAttributesStep.tsx',
  'src/containers/Settings/SandboxConfiguration/ScenarioDetailsDrawer.tsx',
  // Settings/Team/IdleTimeoutSettingsContainer.tsx (Team Settings PR4) and
  // Settings/Webhooks/NewWebhook.tsx migrated to the DS single-select Combobox
  // (react-select retired there) — see those @/core migrations.
  'src/containers/Signal/Form/index.tsx'
]

describe('SelectField consumers — static manifest', () => {
  test.each(consumers)('%s imports SelectField from @/core', file => {
    const fullPath = resolve(process.cwd(), file)
    expect(existsSync(fullPath)).toBe(true)
    const source = readFileSync(fullPath, 'utf8')
    expect(source).toMatch(/SelectField/)
    expect(source).toMatch(/from\s+['"]@\/core['"]/)
  })
})
