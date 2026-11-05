import { eq } from 'drizzle-orm'
import { createRepo, type DbOrTx, db, projects, projectsToUsers, users } from '../../db'
import type { Actor } from '../auth/actor'
import { visibilityWhere } from './access'

export const projectRepository = {
  ...createRepo(projects),

  /**
   * All projects visible to the actor — the Project access rule
   * (see `./access`) applied to the list query.
   */
  async findAllVisible(actor: Actor, tx: DbOrTx = db) {
    const where = visibilityWhere(actor)

    const query = tx
      .selectDistinct({
        id: projects.id,
        name: projects.name,
        isForAllUsers: projects.isForAllUsers,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        isArchived: projects.isArchived,
      })
      .from(projects)
      .$dynamic()

    if (where) {
      return query
        .leftJoin(projectsToUsers, eq(projectsToUsers.projectId, projects.id))
        .where(where)
    }

    return query
  },

  async addMembers(id: string, userIds: string[], tx: DbOrTx = db) {
    const uniqueUserIds = [...new Set(userIds)]
    if (!uniqueUserIds.length) return []

    return tx
      .insert(projectsToUsers)
      .values(uniqueUserIds.map((userId) => ({ projectId: id, userId })))
      .returning()
  },

  async replaceMembers(id: string, userIds: string[], tx: DbOrTx = db) {
    await tx.delete(projectsToUsers).where(eq(projectsToUsers.projectId, id))
    return this.addMembers(id, userIds, tx)
  },

  async getMembers(id: string, tx: DbOrTx = db) {
    return tx
      .select({ id: users.id, email: users.email, name: users.name })
      .from(projectsToUsers)
      .innerJoin(users, eq(projectsToUsers.userId, users.id))
      .where(eq(projectsToUsers.projectId, id))
  },
}
