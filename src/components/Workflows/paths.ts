export const WORKFLOWS_PATH = '/assessments'
export const NEW_WORKFLOW_PATH = `${WORKFLOWS_PATH}/new`

export const workflowPath = (id: string) =>
  `${WORKFLOWS_PATH}/${encodeURIComponent(id)}`

export const editWorkflowPath = (id: string) => `${workflowPath(id)}/edit`

export const duplicateWorkflowPath = (id: string) =>
  `${workflowPath(id)}/duplicate`
