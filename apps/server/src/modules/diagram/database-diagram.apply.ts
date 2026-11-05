import { randomUUID } from 'node:crypto'
import {
  columnHandleId,
  columnIdFromHandleId,
  DATABASE_DIAGRAM_EDGE_TYPE,
  DATABASE_DIAGRAM_NODE_TYPE,
  type DatabaseDiagramEdgeData,
  type DatabaseDiagramNodeData,
  type DatabaseDiagramNodeDataConstraint,
  type DatabaseDiagramNodeDataValue,
  type DatabaseSchema,
  type DatabaseSchemaTable,
  nodeColorAt,
  type SchemaApplyMode,
} from '@docgraph/common/schemas'
import { BadRequestException } from '../../errors'
import { findDuplicates } from '../../lib/find-duplicates'
import { gridPositions, tableHeight } from './database-diagram.layout'
import {
  asTableNode,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  edgeKey,
  keyOfEdge,
  type SchemaApplySummary,
  type TableNode,
} from './database-diagram.model'
import { validateTables } from './database-diagram.validate'

const buildTableData = (
  table: DatabaseSchemaTable,
  existing: DatabaseDiagramNodeData | undefined,
  fallbackColor: DatabaseDiagramNodeData['color'],
): DatabaseDiagramNodeData => {
  const existingColumns = new Map(existing?.values.map((value) => [value.name, value]))

  const values = table.columns.map((column): DatabaseDiagramNodeDataValue => {
    const previous = existingColumns.get(column.name)
    return {
      id: previous?.id ?? randomUUID(),
      name: column.name,
      value: column.type,
      primaryKey: column.primaryKey,
      // Resolved against the final relations in `applyDatabaseSchema`.
      foreignKey: column.foreignKey ?? false,
      index: column.index,
      unique: column.unique,
      nullable: column.nullable,
      ...(column.unsigned !== undefined ? { unsigned: column.unsigned } : {}),
      ...(column.description ? { description: column.description } : {}),
    }
  })

  const columnIdByName = new Map(values.map((value) => [value.name, value.id]))
  const constraintKey = (type: string, columnIds: string[]) =>
    `${type}:${[...columnIds].sort().join(',')}`
  const existingConstraints = new Map(
    existing?.constraints?.map((constraint) => [
      constraintKey(constraint.type, constraint.columns),
      constraint.id,
    ]),
  )

  const constraints = (table.indexes ?? []).map((index): DatabaseDiagramNodeDataConstraint => {
    const columns = index.columns.flatMap((name) => columnIdByName.get(name) ?? [])
    return {
      id: existingConstraints.get(constraintKey(index.type, columns)) ?? randomUUID(),
      type: index.type,
      columns,
    }
  })

  return {
    name: table.name,
    color: table.color ?? existing?.color ?? fallbackColor,
    values,
    ...(constraints.length ? { constraints } : {}),
    ...(table.description !== undefined
      ? table.description
        ? { description: table.description }
        : {}
      : existing?.description
        ? { description: existing.description }
        : {}),
  }
}

/**
 * Schema → diagram. Tables are matched to existing nodes by name and columns
 * by name, so ids, positions, sizes and colors survive the round trip; new
 * tables are laid out below the current content.
 *
 * - `replace`: the result contains exactly the given tables and relations.
 * - `merge`: given tables are created or fully redefined, given relations are
 *   added or updated; everything else in the diagram is left as is.
 */
export const applyDatabaseSchema = (
  current: DiagramDocument,
  schema: DatabaseSchema,
  mode: SchemaApplyMode,
): DiagramDocument & { summary: SchemaApplySummary } => {
  validateTables(schema.tables)

  const existingTables = current.nodes.flatMap((node) => asTableNode(node) ?? [])
  const existingByName = new Map(existingTables.map((node) => [node.data.name, node]))
  const inputNames = new Set(schema.tables.map((table) => table.name))

  // Tables are matched by name, so a name shared by several nodes is ambiguous:
  // redefining it would silently drop all but one of them.
  const ambiguousNames = new Set(findDuplicates(existingTables.map((node) => node.data.name)))
  const ambiguousInput = [...inputNames].filter((name) => ambiguousNames.has(name))
  if (ambiguousInput.length) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `The diagram has several tables named ${ambiguousInput.join(', ')}; rename them in the editor first`,
    )
  }

  // Nodes this call does not define: unknown node kinds always, other tables in merge mode.
  const untouched = current.nodes.filter((node) => {
    const table = asTableNode(node)
    if (!table) return true
    return mode === 'merge' && !inputNames.has(table.data.name)
  })

  const newTables = schema.tables.filter((table) => !existingByName.has(table.name))
  const newIds = new Map(newTables.map((table) => [table.name, randomUUID()]))
  const keptForLayout = current.nodes.filter(
    (node) => untouched.includes(node) || inputNames.has(asTableNode(node)?.data.name ?? ''),
  )
  const positions = gridPositions(
    keptForLayout,
    newTables.map((table) => tableHeight(table.columns.length)),
  )
  const newPosition = new Map(newTables.map((table, i) => [table.name, positions[i]]))

  let colorIndex = existingTables.length
  const defined: TableNode[] = schema.tables.map((table) => {
    const previous = existingByName.get(table.name)
    const fallbackColor = nodeColorAt(++colorIndex)
    const data = buildTableData(table, previous?.data, fallbackColor)

    if (previous) return { ...previous, data }
    return {
      id: newIds.get(table.name) ?? randomUUID(),
      type: DATABASE_DIAGRAM_NODE_TYPE,
      position: newPosition.get(table.name) ?? { x: 0, y: 0 },
      data,
    }
  })

  const nodes =
    mode === 'merge' ? mergeInOrder(current.nodes, untouched, defined) : [...untouched, ...defined]

  // Relations. Untouched tables in merge mode may still share a name; a relation
  // to such a table cannot be resolved.
  const tableByName = new Map(
    nodes.flatMap((node) => {
      const table = asTableNode(node)
      return table && !ambiguousNames.has(table.data.name)
        ? [[table.data.name, table] as const]
        : []
    }),
  )

  const resolve = (ref: { table: string; column: string }) => {
    const node = tableByName.get(ref.table)
    const column = node?.data.values.find((value) => value.name === ref.column)
    return node && column ? { nodeId: node.id, columnId: column.id } : undefined
  }

  const unresolved: string[] = []
  const existingEdges = new Map(current.edges.map((edge) => [keyOfEdge(edge), edge]))
  const definedEdges = new Map<string, DiagramEdge>()

  for (const relation of schema.relations) {
    const from = resolve(relation.from)
    const to = resolve(relation.to)
    if (!from || !to) {
      unresolved.push(
        `${relation.from.table}.${relation.from.column} -> ${relation.to.table}.${relation.to.column}`,
      )
      continue
    }

    const key = edgeKey(from.nodeId, from.columnId, to.nodeId, to.columnId)
    const data: DatabaseDiagramEdgeData = {
      relation: relation.relation,
      nullable: relation.nullable,
      onDelete: relation.onDelete,
      onUpdate: relation.onUpdate,
    }
    const previous = existingEdges.get(key)
    definedEdges.set(
      key,
      previous
        ? { ...previous, data }
        : {
            id: randomUUID(),
            type: DATABASE_DIAGRAM_EDGE_TYPE,
            source: from.nodeId,
            // Relations leave a table on the right and enter on the left.
            sourceHandle: columnHandleId(from.columnId, 'right'),
            target: to.nodeId,
            targetHandle: columnHandleId(to.columnId, 'left'),
            data,
          },
    )
  }

  if (unresolved.length) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `Relations reference unknown or ambiguous tables or columns:\n${unresolved.join('\n')}`,
    )
  }

  // Existing edges survive in merge mode as long as both columns still exist.
  const columnIds = new Set(
    nodes.flatMap((node) => {
      const table = asTableNode(node)
      return table ? table.data.values.map((value) => `${node.id}:${value.id}`) : []
    }),
  )
  const stillConnected = (edge: DiagramEdge) =>
    columnIds.has(`${edge.source}:${columnIdFromHandleId(edge.sourceHandle)}`) &&
    columnIds.has(`${edge.target}:${columnIdFromHandleId(edge.targetHandle)}`)

  const keptEdges =
    mode === 'merge'
      ? current.edges.filter((edge) => !definedEdges.has(keyOfEdge(edge)) && stillConnected(edge))
      : []
  const edges = [...keptEdges, ...definedEdges.values()]

  // A column without an explicit `foreignKey` is one when a relation points at it.
  const referenced = new Set(
    edges.map((edge) => `${edge.target}:${columnIdFromHandleId(edge.targetHandle)}`),
  )
  const explicitForeignKey = new Map(
    schema.tables.flatMap((table) =>
      table.columns.map((column) => [`${table.name}.${column.name}`, column.foreignKey] as const),
    ),
  )
  for (const node of defined) {
    node.data.values = node.data.values.map((value) => ({
      ...value,
      foreignKey:
        explicitForeignKey.get(`${node.data.name}.${value.name}`) ??
        referenced.has(`${node.id}:${value.id}`),
    }))
  }

  // Tables left untouched in merge mode keep their flags (they may have been set
  // by hand), but a column that a relation from this call points at becomes one.
  const newlyReferenced = new Set(
    [...definedEdges.values()].map(
      (edge) => `${edge.target}:${columnIdFromHandleId(edge.targetHandle)}`,
    ),
  )
  const isNewForeignKey = (nodeId: string, value: DatabaseDiagramNodeDataValue) =>
    !value.foreignKey && newlyReferenced.has(`${nodeId}:${value.id}`)

  const finalNodes = nodes.map((node): DiagramNode => {
    const table = untouched.includes(node) ? asTableNode(node) : undefined
    if (!table?.data.values.some((value) => isNewForeignKey(node.id, value))) return node
    return {
      ...table,
      data: {
        ...table.data,
        values: table.data.values.map((value) =>
          isNewForeignKey(node.id, value) ? { ...value, foreignKey: true } : value,
        ),
      },
    }
  })

  const remainingNames = new Set(nodes.flatMap((node) => asTableNode(node)?.data.name ?? []))

  return {
    nodes: finalNodes,
    edges,
    summary: {
      tablesCreated: newTables.map((table) => table.name),
      tablesUpdated: schema.tables
        .filter((table) => existingByName.has(table.name))
        .map((table) => table.name),
      tablesRemoved: existingTables
        .map((node) => node.data.name)
        .filter((name) => !remainingNames.has(name)),
      relations: edges.length,
    },
  }
}

/** Keeps the original node order: redefined tables stay in place, new ones go last. */
const mergeInOrder = (original: DiagramNode[], untouched: DiagramNode[], defined: TableNode[]) => {
  const definedById = new Map(defined.map((node) => [node.id, node]))
  const placed = original.flatMap((node) =>
    untouched.includes(node) ? [node] : (definedById.get(node.id) ?? []),
  )
  const placedIds = new Set(placed.map((node) => node.id))
  return [...placed, ...defined.filter((node) => !placedIds.has(node.id))]
}
