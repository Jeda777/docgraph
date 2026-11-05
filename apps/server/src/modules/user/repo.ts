import { asc, eq, inArray } from 'drizzle-orm'
import { createRepo, type DbOrTx, db, type Transaction, type User, users } from '../../db'
import { NotFoundException } from '../../errors'

export const userRepository = {
  ...createRepo(users),
  /** Emails are stored lowercased, the form Better Auth looks them up in. */
  async findByEmail(email: string, tx: DbOrTx = db): Promise<User | undefined> {
    const [row] = await tx.select().from(users).where(eq(users.email, email))
    return row
  },

  /** Listing shape for admins: identity and role, ordered for stable display. */
  async findAllSummaries(tx: DbOrTx = db) {
    return tx
      .select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin })
      .from(users)
      .orderBy(asc(users.name))
  },

  /**
   * Locks every admin row (`FOR UPDATE`, in id order so concurrent callers can't deadlock) until
   * the transaction ends and returns their ids. Role changes and deletes take this lock first, so
   * they run one after another and each sees the admins the previous one left.
   */
  async lockAdminIds(tx: Transaction): Promise<string[]> {
    const rows = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isAdmin, true))
      .orderBy(asc(users.id))
      .for('update')
    return rows.map((row) => row.id)
  },

  async assertExists(ids: string[], tx: DbOrTx = db) {
    if (!ids.length) return
    const distinctIds = Array.from(new Set(ids))
    const res = await tx.select({ id: users.id }).from(users).where(inArray(users.id, distinctIds))
    if (res.length !== distinctIds.length)
      throw new NotFoundException(
        'NOT_FOUND',
        `Users with ids ${distinctIds.filter((id) => !res.some((r) => r.id === id)).join(', ')} not found`,
      )
  },
}
