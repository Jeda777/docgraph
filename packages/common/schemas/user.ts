import { z } from 'zod'
import { entityBaseSchema, nonEmptyStringSchema } from './common'

/**
 * BASE
 */

export const userSchema = entityBaseSchema.pick({ id: true }).extend({
  name: nonEmptyStringSchema,
  email: z.email('Email is invalid'),
  isAdmin: z.boolean(),
})
export type User = z.infer<typeof userSchema>

/**
 * CREATE
 */

export const userCreateInputSchema = userSchema.pick({
  email: true,
  name: true,
})
export type UserCreateInput = z.infer<typeof userCreateInputSchema>

/**
 * UPDATE
 */

/** Admins promote and demote other users; nobody changes their own role. */
export const userUpdateInputSchema = userSchema.pick({ isAdmin: true })
export type UserUpdateInput = z.infer<typeof userUpdateInputSchema>

/**
 * GET LIST
 */

export const userSummarySchema = userSchema.pick({
  id: true,
  name: true,
  email: true,
  isAdmin: true,
})
export type UserSummary = z.infer<typeof userSummarySchema>

export const userGetListOutputSchema = z.array(userSummarySchema)
export type UserGetListOutput = z.infer<typeof userGetListOutputSchema>

export const userUpdateOutputSchema = userSummarySchema
export type UserUpdateOutput = z.infer<typeof userUpdateOutputSchema>
