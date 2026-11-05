import { syncCollection } from '@docgraph/common/diagram'
import type { ItemType } from '@docgraph/common/schemas'
import { applyUpdate, Doc } from 'yjs'
import { crdt } from '../../crdt'
import type { Item } from '../../db'
import { BadRequestException, InternalServerErrorException } from '../../errors'
import type { Actor } from '../auth/actor'
import { getItemDocumentAccess, isItemReadOnly, loadItemDocument } from './document-store'
import { getItemById } from './service'

/**
 * Reads and writes an item's CRDT document from server code (the diagram and
 * document services behind the MCP tools). Writes go through Hocuspocus, so
 * editors that have the item open receive them like any peer edit.
 */

/** An item (without its CRDT document) narrowed to the expected type. */
export type ItemOfType<T extends ItemType> = Omit<Item, 'document' | 'type'> & { type: T }

const withType = <T extends ItemType>(
  item: Omit<Item, 'document'>,
  expected: T | readonly T[],
): ItemOfType<T> => {
  const types: readonly T[] = typeof expected === 'string' ? [expected] : expected
  if (!types.includes(item.type as T)) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `Item ${item.id} is a ${item.type}, not a ${types.join(' or ')}`,
    )
  }
  return { ...item, type: item.type as T }
}

/** The item, when the caller may see it and it has the expected type (or one of them). */
export const requireItemOfType = async <T extends ItemType>(
  itemId: string,
  expected: T | readonly T[],
  actor: Actor,
) => withType(await getItemById(itemId, actor), expected)

/**
 * Runs `read` on the current document. A document open in an editor is read
 * from memory (it may hold edits not persisted yet); otherwise from storage.
 * `read` must not modify the document.
 */
export const readItemDocument = async <T>(itemId: string, read: (doc: Doc) => T): Promise<T> => {
  const live = crdt.documents.get(itemId)
  if (live) return read(live)

  const doc = new Doc()
  const state = await loadItemDocument(itemId)
  if (state) applyUpdate(doc, state)
  return read(doc)
}

/**
 * Runs `write` in one transaction on the shared document and persists the result.
 * Checks access and the item type like `requireItemOfType`, and refuses read-only items.
 */
export const writeItemDocument = async <T extends ItemType, R>(
  itemId: string,
  expected: T | readonly T[],
  actor: Actor,
  write: (doc: Doc, item: ItemOfType<T>) => R,
) => {
  const access = await getItemDocumentAccess(itemId, actor)
  const item = withType(access.item, expected)
  if (access.readOnly) {
    throw new BadRequestException('BAD_REQUEST', `Item ${itemId} is archived and read-only`)
  }

  const connection = await crdt.openDirectConnection(itemId, { userId: actor.id })
  let result: { value: R } | undefined
  try {
    await connection.transact((doc) => {
      result = { value: write(doc, item) }
    })
  } finally {
    // Persists the document right away (see `DirectConnection.disconnect`).
    await connection.disconnect()
  }

  // `saveItemDocument` silently drops the write when the item or its project was
  // archived after the check above; report that instead of a false success.
  if (await isItemReadOnly(itemId)) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `Item ${itemId} was archived during the update; the changes were not saved`,
    )
  }

  if (!result)
    throw new InternalServerErrorException(
      'INTERNAL_SERVER_ERROR',
      `The update of item ${itemId} did not run`,
    )
  return { item, value: result.value }
}

/** Elements of one diagram collection (nodes, edges or areas), one map entry per id. */
export const readCollection = <T>(doc: Doc, name: string): T[] =>
  Array.from(doc.getMap<T>(name).values())

/** Writes a diagram collection; only new and changed elements are set (see `syncCollection`). */
export const writeCollection = <T extends { id: string }>(doc: Doc, name: string, next: T[]) =>
  syncCollection(doc.getMap<T>(name), next)
