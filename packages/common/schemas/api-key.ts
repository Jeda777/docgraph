import { z } from 'zod'
import { idSchema, nonEmptyStringSchema } from './common'

/** HTTP header MCP clients send the key in (Better Auth's API key plugin default). */
export const API_KEY_HEADER = 'x-api-key'

export const API_KEY_NAME_MAX_LENGTH = 255

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

export const apiKeyCreateInputSchema = apiKeySchema.pick({ name: true })
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateInputSchema>

/** The plain key is returned only once, right after creation. */
export const apiKeyCreateOutputSchema = apiKeySchema.extend({ key: nonEmptyStringSchema })
export type ApiKeyCreateOutput = z.infer<typeof apiKeyCreateOutputSchema>
