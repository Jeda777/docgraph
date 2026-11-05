import { eq } from 'drizzle-orm'
import { db, items, projects } from '../../db'
import { toUint8Array } from '../../lib/binary'
import type { Actor } from '../auth/actor'
import { requireItemAccess } from './access'
import { itemRepository } from './repo'

/**
 * The single owner of `items.document` — the CRDT blob. Every load/save of the
 * blob and the rules for opening a document happen here; nothing else touches
 * the column. Document names are item ids.
 */

type ArchiveState = { isArchived: boolean }

/**
 * Archived items and items of archived projects stay visible, but no longer
 * accept edits — for anyone. The one place this rule is spelled out.
 */
const isReadOnly = (item: ArchiveState, project: ArchiveState): boolean =>
  item.isArchived || project.isArchived

/** Raw CRDT state of an item, or null when the item has no stored state yet. */
export const loadItemDocument = async (itemId: string): Promise<Uint8Array | null> => {
  const item = await itemRepository.getByIdOrThrow(itemId)
  return toUint8Array(item.document)
}

/**
 * How `actor` may open the document: the item and whether it opens read-only
 * (see `isReadOnly`). Throws 404 when the actor has no access to the item's project.
 */
export const getItemDocumentAccess = async (itemId: string, actor: Actor) => {
  const { item, project } = await requireItemAccess(itemId, actor, { allowArchived: true })
  return { item, readOnly: isReadOnly(item, project) }
}

/** Whether the document is read-only right now (see `isReadOnly`). Does not check access. */
export const isItemReadOnly = async (itemId: string): Promise<boolean> => {
  const item = await itemRepository.getByIdWithoutDocument(itemId)
  const [project] = await db
    .select({ isArchived: projects.isArchived })
    .from(projects)
    .where(eq(projects.id, item.projectId))
  return !project || isReadOnly(item, project)
}

/**
 * Persists the raw CRDT state. Returns `false` when the document has been
 * archived (item or project) or deleted in the meantime and the write was
 * dropped — the caller should then treat every connection to it as read-only.
 */
export const saveItemDocument = async (itemId: string, state: Uint8Array): Promise<boolean> =>
  db.transaction(async (tx) => {
    // Checked per write, not only on connect: a connection opened before archiving must stop
    // persisting. No actor — archived documents reject everyone. The row locks make a concurrent
    // archive wait for this commit (it updates only the item or only the project row, so no deadlock).
    const [item] = await tx
      .select({ projectId: items.projectId, isArchived: items.isArchived })
      .from(items)
      .where(eq(items.id, itemId))
      .for('update')
    // Deleted while open: the last store runs when its connections are closed.
    if (!item) return false

    const [project] = await tx
      .select({ isArchived: projects.isArchived })
      .from(projects)
      .where(eq(projects.id, item.projectId))
      .for('share')
    if (!project || isReadOnly(item, project)) return false

    // Drizzle maps the `bytea` column to a Buffer.
    await itemRepository.update(itemId, { document: Buffer.from(state) }, tx)
    return true
  })
