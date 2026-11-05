import { z } from 'zod'
import { entityBaseSchema, idSchema, nameSchema } from './common'

export const ITEM_TYPES = ['BUSINESS_PROCESS', 'DATABASE_DIAGRAM', 'DOCUMENT', 'FLOWCHART'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

/**
 * BASE
 */

export const itemSchema = entityBaseSchema.extend({
  name: nameSchema,
  projectId: idSchema,
  type: z.enum(ITEM_TYPES),
  /** Archived items stay readable but refuse every edit. */
  isArchived: z.boolean(),
})
export type Item = z.infer<typeof itemSchema>

/**
 * OUTPUT
 */

/** The CRDT document never goes through the REST API — it is synced through Hocuspocus. */
export const itemOutputSchema = itemSchema
export type ItemOutput = z.infer<typeof itemOutputSchema>

/**
 * CREATE
 */

export const itemCreateInputSchema = itemSchema.pick({
  name: true,
  type: true,
  projectId: true,
})
export type ItemCreateInput = z.infer<typeof itemCreateInputSchema>

/**
 * UPDATE
 */

export const itemUpdateInputSchema = itemSchema.pick({
  name: true,
  isArchived: true,
})
export type ItemUpdateInput = z.infer<typeof itemUpdateInputSchema>
