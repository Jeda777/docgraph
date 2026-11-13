import {
  applyDatabaseSchema as applySchema,
  DatabaseSchemaError,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  toDatabaseSchema,
} from '@docgraph/common/diagram'
import { type DatabaseSchema, DIAGRAM_MAPS, type SchemaApplyMode } from '@docgraph/common/schemas'
import type { Doc } from 'yjs'
import { BadRequestException } from '../../errors'
import type { Actor } from '../auth/actor'
import {
  readCollection,
  readItemDocument,
  requireItemOfType,
  writeCollection,
  writeItemDocument,
} from '../item/item-document'
import { createItem } from '../item/service'

const applyDatabaseSchema = (...args: Parameters<typeof applySchema>) => {
  try {
    return applySchema(...args)
  } catch (error) {
    if (error instanceof DatabaseSchemaError) {
      throw new BadRequestException('BAD_REQUEST', error.message)
    }
    throw error
  }
}

const readDiagram = (doc: Doc): DiagramDocument => ({
  nodes: readCollection<DiagramNode>(doc, DIAGRAM_MAPS.nodes),
  edges: readCollection<DiagramEdge>(doc, DIAGRAM_MAPS.edges),
})

/** Current schema of a database diagram. */
export const getDatabaseSchema = async (itemId: string, actor: Actor) => {
  const item = await requireItemOfType(itemId, 'DATABASE_DIAGRAM', actor)
  const schema = await readItemDocument(itemId, (doc) => toDatabaseSchema(readDiagram(doc)))
  return { item, schema }
}

/**
 * Applies a schema to a database diagram through Hocuspocus, so editors that
 * have the diagram open receive the change immediately, like any peer edit.
 */
export const updateDatabaseSchema = async (
  itemId: string,
  schema: DatabaseSchema,
  mode: SchemaApplyMode,
  actor: Actor,
) => {
  const { item, value: summary } = await writeItemDocument(
    itemId,
    'DATABASE_DIAGRAM',
    actor,
    (doc) => {
      const result = applyDatabaseSchema(readDiagram(doc), schema, mode)
      writeCollection(doc, DIAGRAM_MAPS.nodes, result.nodes)
      writeCollection(doc, DIAGRAM_MAPS.edges, result.edges)
      return result.summary
    },
  )

  return { item, summary }
}

export const createDatabaseDiagram = async (
  { projectId, name, schema }: { projectId: string; name: string; schema?: DatabaseSchema },
  actor: Actor,
) => {
  // Validate before creating the item, so a bad schema leaves no empty diagram
  // behind (an agent retrying would otherwise pile up duplicates).
  if (schema?.tables.length) applyDatabaseSchema({ nodes: [], edges: [] }, schema, 'replace')

  const item = await createItem({ projectId, name, type: 'DATABASE_DIAGRAM' }, actor)
  if (!schema?.tables.length) return { item, summary: undefined }

  const { summary } = await updateDatabaseSchema(item.id, schema, 'replace', actor)
  return { item, summary }
}
