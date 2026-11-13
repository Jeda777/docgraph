import type { ItemCreateInput, ItemUpdateInput } from '@docgraph/common/schemas'
import { closeItemConnections } from '../../crdt'
import { db, type ItemUpdate } from '../../db'
import type { Actor } from '../auth/actor'
import { assertKeyCanWrite } from '../auth/api-key-scope'
import { requireProjectAccess } from '../project/access'
import { requireItemAccess } from './access'
import { itemRepository } from './repo'

export const createItem = async ({ name, type, projectId }: ItemCreateInput, actor: Actor) =>
  db.transaction(async (tx) => {
    assertKeyCanWrite(actor)
    await requireProjectAccess(projectId, actor, { tx, wholeProject: true })

    return itemRepository.create({ name, type, projectId }, tx)
  })

export const getItemById = async (id: string, actor: Actor) => {
  const { item } = await requireItemAccess(id, actor, { allowArchived: true })
  return item
}

export const updateItem = async (
  { id, name, isArchived }: ItemUpdateInput & { id: string },
  actor: Actor,
) => {
  const { item, archiveChanged } = await db.transaction(async (tx) => {
    assertKeyCanWrite(actor)
    const { item } = await requireItemAccess(id, actor, { tx })

    const changes: ItemUpdate = {}
    if (item.isArchived !== isArchived) {
      changes.isArchived = isArchived
    }
    if (item.name !== name) {
      changes.name = name
    }

    return {
      item: Object.keys(changes).length > 0 ? await itemRepository.update(id, changes, tx) : item,
      archiveChanged: 'isArchived' in changes,
    }
  })

  // Open editors reconnect and get the new scope (read-only or read-write).
  if (archiveChanged) closeItemConnections(id)

  return item
}

export const deleteItem = async (id: string, actor: Actor) => {
  await db.transaction(async (tx) => {
    assertKeyCanWrite(actor)
    await requireItemAccess(id, actor, { tx })

    await itemRepository.delete(id, tx)
  })

  // After the commit, so reconnecting editors are refused instead of reopening the item.
  closeItemConnections(id)
}
