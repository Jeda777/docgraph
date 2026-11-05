import { type DbOrTx, db } from '../../db'
import { NotFoundException } from '../../errors'
import type { Actor } from '../auth/actor'
import { requireProjectAccess } from '../project/access'
import { itemNotFound, itemRepository } from './repo'

type ItemAccessOptions = {
  /** Runs the checks inside the caller's transaction. */
  tx?: DbOrTx
  /** Items of archived projects pass too (they stay readable, only edits are refused). */
  allowArchived?: boolean
}

/**
 * The item and its project when `actor` may see the project, otherwise 404.
 * The 404 names only the item, so it does not reveal which project the item belongs to.
 */
export const requireItemAccess = async (
  itemId: string,
  actor: Actor,
  { tx = db, allowArchived = false }: ItemAccessOptions = {},
) => {
  const item = await itemRepository.getByIdWithoutDocument(itemId, tx)
  try {
    const project = await requireProjectAccess(item.projectId, actor, { tx, allowArchived })
    return { item, project }
  } catch (error) {
    if (error instanceof NotFoundException) throw itemNotFound(itemId)
    throw error
  }
}
