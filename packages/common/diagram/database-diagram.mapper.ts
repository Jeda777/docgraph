import {
  columnIdFromHandleId,
  type DatabaseSchema,
  type DatabaseSchemaRelation,
  databaseDiagramEdgeDataSchema,
} from '../schemas'
import { asTableNode, type DiagramDocument } from './database-diagram.model'

/**
 * Pure conversion between a database diagram document (React Flow nodes/edges
 * as stored in the CRDT maps) and the layout-free `DatabaseSchema` exchanged
 * with AI agents over MCP and as DBML in the editor. Nothing here touches the
 * database or Yjs.
 *
 * This file reads a diagram as a schema; `database-diagram.apply.ts` writes a
 * schema back, using `.layout.ts` for placement and `.validate.ts` for checks.
 */

/** Diagram → schema. Nodes or edges the schema cannot describe are skipped. */
export const toDatabaseSchema = ({ nodes, edges }: DiagramDocument): DatabaseSchema => {
  const tables = nodes.flatMap((node) => asTableNode(node) ?? [])
  const tableById = new Map(tables.map((node) => [node.id, node.data]))

  const columnName = (nodeId: string, handle: string) =>
    tableById.get(nodeId)?.values.find((value) => value.id === columnIdFromHandleId(handle))?.name

  const relations = edges.flatMap((edge): DatabaseSchemaRelation[] => {
    const data = databaseDiagramEdgeDataSchema.safeParse(edge.data)
    const fromTable = tableById.get(edge.source)?.name
    const toTable = tableById.get(edge.target)?.name
    const fromColumn = columnName(edge.source, edge.sourceHandle)
    const toColumn = columnName(edge.target, edge.targetHandle)
    if (!data.success || !fromTable || !toTable || !fromColumn || !toColumn) return []

    return [
      {
        from: { table: fromTable, column: fromColumn },
        to: { table: toTable, column: toColumn },
        ...data.data,
      },
    ]
  })

  return {
    tables: tables.map(({ data }) => {
      const columnNameById = new Map(data.values.map((value) => [value.id, value.name]))
      const indexes = (data.constraints ?? []).map((constraint) => ({
        type: constraint.type,
        columns: constraint.columns.flatMap((id) => columnNameById.get(id) ?? []),
      }))

      return {
        name: data.name,
        ...(data.description ? { description: data.description } : {}),
        color: data.color,
        columns: data.values.map((value) => ({
          name: value.name,
          type: value.value,
          primaryKey: value.primaryKey,
          nullable: value.nullable,
          unique: value.unique,
          index: value.index,
          foreignKey: value.foreignKey,
          ...(value.unsigned !== undefined ? { unsigned: value.unsigned } : {}),
          ...(value.description ? { description: value.description } : {}),
        })),
        ...(indexes.length ? { indexes } : {}),
      }
    }),
    relations,
  }
}
