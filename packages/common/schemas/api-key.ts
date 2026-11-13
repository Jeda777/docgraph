import { z } from 'zod'
import { idSchema, nonEmptyStringSchema } from './common'

/** HTTP header MCP clients send the key in (Better Auth's API key plugin default). */
export const API_KEY_HEADER = 'x-api-key'

export const API_KEY_NAME_MAX_LENGTH = 255

/** Longest lifetime of an expiring key, in days. */
export const API_KEY_MAX_EXPIRATION_DAYS = 365

export const API_KEY_SCOPE_MAX_PROJECTS = 100
export const API_KEY_SCOPE_MAX_ITEMS = 100

/**
 * RESTRICTIONS
 */

/** One project a key may access: the whole project, or only `itemIds` when given. */
export const apiKeyProjectScopeSchema = z.object({
  projectId: idSchema,
  itemIds: z
    .array(idSchema)
    .min(1, 'Select at least one item')
    .max(API_KEY_SCOPE_MAX_ITEMS, `Select at most ${API_KEY_SCOPE_MAX_ITEMS} items`)
    .optional(),
})
export type ApiKeyProjectScope = z.infer<typeof apiKeyProjectScopeSchema>

/**
 * What a key may do on top of its owner's own access, stored as the key's metadata. They only
 * narrow the owner's access: every request still checks the owner's current permissions.
 */
export const apiKeyRestrictionsSchema = z.object({
  readOnly: z.boolean(),
  /** `null` — every project the owner can see. */
  projects: z
    .array(apiKeyProjectScopeSchema)
    .min(1, 'Select at least one project')
    .max(API_KEY_SCOPE_MAX_PROJECTS, `Select at most ${API_KEY_SCOPE_MAX_PROJECTS} projects`)
    .refine(
      (projects) => new Set(projects.map(({ projectId }) => projectId)).size === projects.length,
      'Each project can be selected only once',
    )
    .nullable(),
})
export type ApiKeyRestrictions = z.infer<typeof apiKeyRestrictionsSchema>

/** Restrictions of keys created before they existed: full access of the owner. */
export const UNRESTRICTED_API_KEY: ApiKeyRestrictions = { readOnly: false, projects: null }

/**
 * BASE
 */

export const apiKeySchema = z.object({
  id: idSchema,
  name: nonEmptyStringSchema.max(
    API_KEY_NAME_MAX_LENGTH,
    `Name can't be longer than ${API_KEY_NAME_MAX_LENGTH} characters`,
  ),
  createdAt: z.coerce.date(),
  lastUsedAt: z.coerce.date().nullable(),
  expiresAt: z.coerce.date().nullable(),
  restrictions: apiKeyRestrictionsSchema,
})
export type ApiKey = z.infer<typeof apiKeySchema>

/**
 * GET LIST
 */

export const apiKeyGetListOutputSchema = z.array(apiKeySchema)
export type ApiKeyGetListOutput = z.infer<typeof apiKeyGetListOutputSchema>

/**
 * CREATE
 */

/** The local end of a `YYYY-MM-DD` day — a key expiring on a day still works during it. */
export const apiKeyEndOfDay = (date: string) => new Date(`${date}T23:59:59.999`)

/** `YYYY-MM-DD` of the local day `days` days from today. */
export const apiKeyDateInDays = (days: number, now = new Date()) => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const apiKeyCreateInputSchema = apiKeySchema
  .pick({ name: true, restrictions: true })
  .extend({
    /** Last day the key works (`YYYY-MM-DD`, local time); empty — never expires. */
    expiresOn: z
      .string()
      .refine((date) => !date || z.iso.date().safeParse(date).success, 'Enter a valid date')
      .refine((date) => !date || date >= apiKeyDateInDays(1), 'Choose a date after today')
      .refine(
        (date) => !date || date <= apiKeyDateInDays(API_KEY_MAX_EXPIRATION_DAYS),
        `Choose a date at most ${API_KEY_MAX_EXPIRATION_DAYS} days ahead`,
      ),
  })
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateInputSchema>

/** Seconds from `now` until the end of `expiresOn`, as the API key plugin expects them. */
export const apiKeyExpiresIn = (expiresOn: string, now = new Date()) =>
  expiresOn ? Math.ceil((apiKeyEndOfDay(expiresOn).getTime() - now.getTime()) / 1000) : undefined

/** The plain key is returned only once, right after creation. */
export const apiKeyCreateOutputSchema = apiKeySchema.extend({ key: nonEmptyStringSchema })
export type ApiKeyCreateOutput = z.infer<typeof apiKeyCreateOutputSchema>
