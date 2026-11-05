import { z } from 'zod'

export const idSchema = z.ulid()
export const idParamSchema = z.object({ id: idSchema })

const REQUIRED_MESSAGE = 'This field is required'

export const nonEmptyStringSchema = z
  .string({ error: REQUIRED_MESSAGE })
  .trim()
  .min(1, REQUIRED_MESSAGE)

const NAME_MAX_LENGTH = 255

/** Display name of a project or an item. */
export const nameSchema = nonEmptyStringSchema.max(
  NAME_MAX_LENGTH,
  `Name can't be longer than ${NAME_MAX_LENGTH} characters`,
)

export const entityBaseSchema = z.object({
  id: idSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

/**
 * PASSWORD
 */

const MIN_PASSWORD_LENGTH = 8

export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
  })
  .regex(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  .regex(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  .regex(/[0-9]/, {
    message: 'Password must contain at least one number',
  })
  .regex(/[!@#$%^&*()_\-+=[\]{};':"\\|,.<>/?]/, {
    message: 'Password must contain at least one special character',
  })
