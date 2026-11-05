import { and, eq, or, type SQL } from 'drizzle-orm'
import { type DbOrTx, db, projects, projectsToUsers } from '../../db'
import { NotFoundException } from '../../errors'
import type { Actor } from '../auth/actor'

type ProjectAccessOptions = {
  /** Runs the checks inside the caller's transaction. */
  tx?: DbOrTx
  /** Archived projects pass too (they stay readable, only edits are refused). */
  allowArchived?: boolean
}

/**
 * The single home of "who may see which Project": returns the project the actor
 * has access to, otherwise 404 (404 instead of 403 on purpose, so the project's
 * existence is not revealed).
 */
export const requireProjectAccess = async (
  projectId: string,
  actor: Actor,
  { tx = db, allowArchived = false }: ProjectAccessOptions = {},
): Promise<typeof projects.$inferSelect> => {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId))
  if (!project || (project.isArchived && !allowArchived))
    throw new NotFoundException('NOT_FOUND', `Project with id ${projectId} not found`)

  if (project.isForAllUsers || actor.isAdmin) return project

  const [access] = await tx
    .select()
    .from(projectsToUsers)
    .where(and(eq(projectsToUsers.projectId, projectId), eq(projectsToUsers.userId, actor.id)))
  if (!access) throw new NotFoundException('NOT_FOUND', `Project with id ${projectId} not found`)

  return project
}

/**
 * The same visibility rule expressed for list queries: restricts a query on
 * `projects` to rows the actor may see. `undefined` means no restriction (admin).
 */
export const visibilityWhere = (actor: Actor): SQL | undefined =>
  actor.isAdmin
    ? undefined
    : or(eq(projectsToUsers.userId, actor.id), eq(projects.isForAllUsers, true))
