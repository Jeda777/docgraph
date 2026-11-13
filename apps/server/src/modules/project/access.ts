import { and, eq, inArray, or, type SQL } from 'drizzle-orm'
import { type DbOrTx, db, projects, projectsToUsers } from '../../db'
import { ForbiddenException, NotFoundException } from '../../errors'
import type { Actor } from '../auth/actor'
import {
  isProjectInKeyScope,
  isWholeProjectInKeyScope,
  keyScopeProjectIds,
} from '../auth/api-key-scope'

type ProjectAccessOptions = {
  /** Runs the checks inside the caller's transaction. */
  tx?: DbOrTx
  /** Archived projects pass too (they stay readable, only edits are refused). */
  allowArchived?: boolean
  /** An API key must reach the whole project, not only some of its items (e.g. to add items). */
  wholeProject?: boolean
}

const projectNotFound = (projectId: string) =>
  new NotFoundException('NOT_FOUND', `Project with id ${projectId} not found`)

/** The user's own access, without API key restrictions. */
const requireUserProjectAccess = async (
  projectId: string,
  actor: Actor,
  { tx, allowArchived }: { tx: DbOrTx; allowArchived: boolean },
) => {
  const [project] = await tx.select().from(projects).where(eq(projects.id, projectId))
  if (!project || (project.isArchived && !allowArchived)) throw projectNotFound(projectId)

  if (project.isForAllUsers || actor.isAdmin) return project

  const [access] = await tx
    .select()
    .from(projectsToUsers)
    .where(and(eq(projectsToUsers.projectId, projectId), eq(projectsToUsers.userId, actor.id)))
  if (!access) throw projectNotFound(projectId)

  return project
}

/**
 * The single home of "who may see which Project": returns the project the actor
 * has access to, otherwise 404 (404 instead of 403 on purpose, so the project's
 * existence is not revealed). An API key limited to other projects gets 404 as well.
 */
export const requireProjectAccess = async (
  projectId: string,
  actor: Actor,
  { tx = db, allowArchived = false, wholeProject = false }: ProjectAccessOptions = {},
): Promise<typeof projects.$inferSelect> => {
  if (!isProjectInKeyScope(actor, projectId)) throw projectNotFound(projectId)

  const project = await requireUserProjectAccess(projectId, actor, { tx, allowArchived })

  if (wholeProject && !isWholeProjectInKeyScope(actor, projectId)) {
    throw new ForbiddenException(
      'FORBIDDEN',
      'This API key can access only selected items of the project',
    )
  }

  return project
}

/**
 * The same visibility rule expressed for list queries: restricts a query on
 * `projects` to rows the actor may see. `undefined` means no restriction (admin
 * without an API key limited to some projects).
 */
export const visibilityWhere = (actor: Actor): SQL | undefined => {
  const userWhere = actor.isAdmin
    ? undefined
    : or(eq(projectsToUsers.userId, actor.id), eq(projects.isForAllUsers, true))
  const keyProjectIds = keyScopeProjectIds(actor)
  const keyWhere = keyProjectIds ? inArray(projects.id, keyProjectIds) : undefined
  return userWhere && keyWhere ? and(userWhere, keyWhere) : (userWhere ?? keyWhere)
}
