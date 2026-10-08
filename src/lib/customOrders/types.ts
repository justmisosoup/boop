// Contract for custom orders: the order catalog, saved custom orders, and the
// config snapshotted onto a business. The silkscreen mocks serve these shapes;
// a real API is expected to match them.
//
// Dependency packages (e.g. the verification a Liens order needs) never
// appear here. The catalog folds their inputs into each package's
// `required_inputs`, so the client cannot name them.

export type InsightStatus = 'success' | 'warning' | 'failure'

export type InputKey =
  | 'name'
  | 'address'
  | 'website_url'
  | 'tin'
  | 'dba_name'
  | 'formation_state'
  | 'entity_type'
  | 'email'
  | 'phone'
  | 'person'
  | 'person_dob'
  | 'person_ssn'

export type InputRequirement = InputKey | { any_of: InputKey[] }

export type InputDef = {
  key: InputKey
  label: string
}

export type CatalogPackage = {
  key: string
  label: string
  description: string
  exclusive_with: string[]
  required_inputs: InputRequirement[]
  insight_group_ids: string[]
}

export type CatalogOutcome = {
  key: string
  label: string
  default_status: InsightStatus
}

export type CatalogInsight = {
  key: string
  label: string
  group_id: string
  trigger_inputs: InputKey[]
  outcomes: CatalogOutcome[]
}

export type InsightGroup = {
  id: string
  label: string
  description: string
  packages: string[]
  insight_keys: string[]
  report_section: string
  trigger_inputs: InputKey[]
}

export type OrderCatalog = {
  version: string
  packages: CatalogPackage[]
  insight_groups: InsightGroup[]
  insights: CatalogInsight[]
  inputs: InputDef[]
  // Business details every order collects, required or not, so the report's
  // Business details card always has them.
  context_inputs: InputKey[]
}

export type StatusOverride = {
  insight: string
  outcome: string
  status: InsightStatus
}

export type CustomOrderConfig = {
  packages: string[]
  // Included groups, listed explicitly so groups added to the catalog later
  // never join an existing saved order on their own.
  insight_groups: string[]
  status_overrides: StatusOverride[]
}

export type WorkflowEnvironment =
  | 'draft'
  | 'sandbox'
  | 'production'
  | 'sandbox_and_production'

export type SavedCustomOrderInput = CustomOrderConfig & {
  name: string
  description?: string | null
  environment?: WorkflowEnvironment
}

export type SavedCustomOrder = SavedCustomOrderInput & {
  id: string
  required_inputs: InputRequirement[]
  availability: { orderable: boolean; reason?: string }
  environment: WorkflowEnvironment
  catalog_version: string
  /** Name of the teammate who created it; null for records saved before this was kept. */
  created_by: string | null
  created_at: string
  updated_at: string
}

// Stored on the business at order time. Editing or deleting the saved order
// never changes a report already placed with it.
export type CustomOrderSnapshot = CustomOrderConfig & {
  saved_custom_order_id: string | null
  name: string | null
  insights: string[]
  report_sections: string[]
  catalog_version: string
}

export type CustomOrderError = { message: string; field?: InputKey | 'name' }
