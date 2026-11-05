import { z } from 'zod'
import { entityBaseSchema, idSchema, nameSchema } from './common'
import { itemSchema } from './item'
import { userSchema } from './user'

/**
 * BASE
 */

export const projectSchema = entityBaseSchema.extend({
  name: nameSchema,
  isForAllUsers: z.boolean(),
  /** Archived projects stay readable but refuse every edit, including their items. */
  isArchived: z.boolean(),
})
export type Project = z.infer<typeof projectSchema>

/**
 * CREATE
 */

export const projectCreateInputSchema = projectSchema
  .pick({
    name: true,
    isForAllUsers: true,
  })
  .extend({
    memberIds: z.array(idSchema).optional(),
  })
export type ProjectCreateInput = z.infer<typeof projectCreateInputSchema>
export const projectCreateOutputSchema = projectSchema
export type ProjectCreateOutput = z.infer<typeof projectCreateOutputSchema>

/**
 * GET LIST
 */

export const projectGetListOutputSchema = z.array(projectSchema)
export type ProjectGetListOutput = z.infer<typeof projectGetListOutputSchema>

/**
 * GET DETAILS
 */

export const projectGetByIdInputSchema = z.object({
  getItems: z.stringbool().optional(),
  getMembers: z.stringbool().optional(),
})
export type ProjectGetByIdInput = z.infer<typeof projectGetByIdInputSchema>
export const projectGetByIdOutputSchema = projectSchema.extend({
  members: z.array(userSchema.pick({ id: true, email: true, name: true })).optional(),
  items: z
    .array(
      itemSchema.pick({
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
        isArchived: true,
      }),
    )
    .optional(),
})

export type ProjectGetByIdOutput = z.infer<typeof projectGetByIdOutputSchema>

/**
 * UPDATE
 */

export const projectUpdateInputSchema = projectCreateInputSchema.extend({
  isArchived: z.boolean(),
})
export type ProjectUpdateInput = z.infer<typeof projectUpdateInputSchema>
export const projectUpdateOutputSchema = projectSchema
export type ProjectUpdateOutput = z.infer<typeof projectUpdateOutputSchema>
