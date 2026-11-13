import type { ApiKeyRestrictions } from '@docgraph/common/schemas'

/** The authenticated caller, as authorization decisions see it. */
export type Actor = {
  id: string
  isAdmin: boolean
  /** Set when the caller authenticated with an API key; narrows the user's own access. */
  apiKeyRestrictions?: ApiKeyRestrictions
}
