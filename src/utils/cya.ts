/**
 * Utility to conditionally add data-cy attributes for testing
 * Replaces the babel macro functionality in Vite
 */

const validProductionEnvs = ['production', 'staging']

const cya = (identifier: string): { 'data-cy'?: string } => {
  if (validProductionEnvs.includes(import.meta.env.MODE)) {
    // In production/staging, return empty object (no data-cy attribute)
    return {}
  }

  // In development, return data-cy attribute
  return {
    'data-cy': identifier
  }
}

export default cya
