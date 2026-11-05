import type { ApiErrorIssue } from '@docgraph/common/schemas'
import { zValidator as baseZValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { z } from 'zod'
import { ValidationException } from '../errors'

const toApiErrorIssues = (issues: z.core.$ZodIssue[]): ApiErrorIssue[] =>
  issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }))

/**
 * `zValidator` that throws a `ValidationException` instead of returning the raw Zod result, so
 * validation failures share the JSON error body of every other API error.
 */
export const zValidator = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  baseZValidator(target, schema, (result) => {
    if (!result.success) throw new ValidationException(toApiErrorIssues(result.error.issues))
  })
