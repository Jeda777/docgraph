import { z } from 'zod'
import { nonEmptyStringSchema } from './common'
import { baseNodeSchema } from './diagram'

/**
 * Grouping rectangle rendered behind the primary nodes of a diagram.
 */
export const areaNodeDataSchema = z.object({
  name: nonEmptyStringSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  alpha: z.number().min(0).max(1),
  locked: z.boolean().optional(),
  order: z.number(), // stack order; lower = further back (rendered behind)
})
export type AreaNodeData = z.infer<typeof areaNodeDataSchema>

export const AREA_NODE_TYPE = 'areaNode' as const
export const areaNodeSchema = baseNodeSchema.extend({
  type: z.literal(AREA_NODE_TYPE),
  data: areaNodeDataSchema,
})
