import {
  AREA_NODE_TYPE,
  columnHandleId,
  columnIdFromHandleId,
  DATABASE_DIAGRAM_EDGE_TYPE,
  DATABASE_DIAGRAM_NODE_TYPE,
  type DatabaseDiagramEdgeData,
  type DatabaseDiagramEnum,
  type DatabaseDiagramNodeData,
  type DatabaseDiagramNodeDataCheck,
  type DatabaseDiagramNodeDataConstraint,
  type DatabaseDiagramNodeDataValue,
  type DatabaseSchema,
  type DatabaseSchemaEnum,
  type DatabaseSchemaGroup,
  type DatabaseSchemaTable,
  nodeColorAt,
  type SchemaApplyMode,
} from '../schemas'
import {
  AREA_PADDING,
  areaRect,
  fitAreaRect,
  rectsOverlap,
  tableGroupsOf,
  tableRect,
} from './database-diagram.groups'
import {
  GRID_GAP_X,
  GRID_GAP_Y,
  gridFrom,
  gridPositions,
  tableHeight,
} from './database-diagram.layout'
import {
  asAreaNode,
  asTableNode,
  DatabaseSchemaError,
  type DiagramDocument,
  type DiagramEdge,
  type DiagramNode,
  edgeKey,
  keyOfEdge,
  type SchemaApplySummary,
  type TableNode,
} from './database-diagram.model'
import { validateEnums, validateGroups, validateTables } from './database-diagram.validate'
import {
  AREA_NODE_DEFAULT_ALPHA,
  AREA_NODE_DEFAULT_COLOR,
  TABLE_ESTIMATED_WIDTH,
} from './diagram-defaults'
import { findDuplicates } from './find-duplicates'
import { randomId } from './random-id'

const buildTableData = (
  table: DatabaseSchemaTable,
  existing: DatabaseDiagramNodeData | undefined,
  fallbackColor: DatabaseDiagramNodeData['color'],
): DatabaseDiagramNodeData => {
  const existingColumns = new Map(existing?.values.map((value) => [value.name, value]))

  const values = table.columns.map((column): DatabaseDiagramNodeDataValue => {
    const previous = existingColumns.get(column.name)
    return {
      id: previous?.id ?? randomId(),
      name: column.name,
      value: column.type,
      primaryKey: column.primaryKey,
      // Resolved against the final relations in `applyDatabaseSchema`.
      foreignKey: column.foreignKey ?? false,
      index: column.index,
      unique: column.unique,
      nullable: column.nullable,
      ...(column.unsigned !== undefined ? { unsigned: column.unsigned } : {}),
      ...(column.increment !== undefined ? { increment: column.increment } : {}),
      ...(column.defaultValue ? { defaultValue: column.defaultValue } : {}),
      ...(column.description ? { description: column.description } : {}),
    }
  })

  const columnIdByName = new Map(values.map((value) => [value.name, value.id]))
  const constraintKey = ({
    type,
    columns,
    expressions = [],
  }: Omit<DatabaseDiagramNodeDataConstraint, 'id'>) =>
    JSON.stringify([
      type,
      [...columns].sort(),
      expressions.map((expression) => expression.trim()).filter(Boolean),
    ])
  const existingConstraints = new Map(
    existing?.constraints?.map((constraint) => [constraintKey(constraint), constraint.id]),
  )

  const constraints = (table.indexes ?? []).map((index): DatabaseDiagramNodeDataConstraint => {
    const constraint = {
      type: index.type,
      columns: index.columns.flatMap((name) => columnIdByName.get(name) ?? []),
      ...(index.expressions?.length ? { expressions: index.expressions } : {}),
    }
    return { id: existingConstraints.get(constraintKey(constraint)) ?? randomId(), ...constraint }
  })

  // Each existing check lends its id once, so repeated expressions still get unique ids.
  const unclaimedChecks = [...(existing?.checks ?? [])]
  const checks = (table.checks ?? []).map((check): DatabaseDiagramNodeDataCheck => {
    const match = unclaimedChecks.findIndex(
      (previous) => previous.expression.trim() === check.expression.trim(),
    )
    const [previous] = match === -1 ? [] : unclaimedChecks.splice(match, 1)
    return {
      id: previous?.id ?? randomId(),
      expression: check.expression,
      ...(check.name ? { name: check.name } : {}),
    }
  })

  return {
    name: table.name,
    color: table.color ?? existing?.color ?? fallbackColor,
    values,
    ...(constraints.length ? { constraints } : {}),
    ...(checks.length ? { checks } : {}),
    ...(table.description !== undefined
      ? table.description
        ? { description: table.description }
        : {}
      : existing?.description
        ? { description: existing.description }
        : {}),
  }
}

/** Enums and their values are matched by name, so their ids survive the round trip. */
const applyEnums = (
  current: DatabaseDiagramEnum[],
  input: DatabaseSchemaEnum[],
  mode: SchemaApplyMode,
): DatabaseDiagramEnum[] => {
  // Names are compared trimmed, as `toDatabaseSchema` reports them; the first of repeated
  // names wins.
  const existingByName = new Map<string, DatabaseDiagramEnum>()
  for (const item of current) {
    if (!existingByName.has(item.name.trim())) existingByName.set(item.name.trim(), item)
  }
  const defined = input.map((item): DatabaseDiagramEnum => {
    const previous = existingByName.get(item.name)
    const valueIds = new Map(previous?.values.map((value) => [value.name.trim(), value.id]))
    return {
      id: previous?.id ?? randomId(),
      name: item.name,
      values: item.values.map((value) => ({
        id: valueIds.get(value.name) ?? randomId(),
        name: value.name,
        ...(value.note ? { note: value.note } : {}),
      })),
    }
  })
  if (mode === 'replace') return defined

  const definedByName = new Map(defined.map((item) => [item.name, item]))
  const kept = current.flatMap((item) => {
    const redefined = definedByName.get(item.name.trim())
    if (!redefined) return [item]
    // A redefined enum takes the place of its first occurrence and replaces the others.
    return existingByName.get(item.name.trim()) === item ? [redefined] : []
  })
  return [...kept, ...defined.filter((item) => !existingByName.has(item.name))]
}

/**
 * Groups are matched to areas by name. An area that contains exactly its group's tables is
 * kept as it is, otherwise it is fitted around them; a new group gets a new area. Without
 * `groups` the areas are left as they are. In `replace` mode areas that read as a group but
 * match none are removed; empty areas stay.
 */
const applyGroups = (
  current: DiagramDocument,
  nodes: DiagramNode[],
  tableByName: Map<string, TableNode>,
  groups: DatabaseSchemaGroup[] | undefined,
  mode: SchemaApplyMode,
): DiagramNode[] => {
  const areas = current.areas ?? []
  if (!groups) return areas

  // Like `toDatabaseSchema`, only the first area of a name reads as a group.
  const readAsGroup = new Map<string, string>()
  for (const { area } of tableGroupsOf(current.nodes, areas)) {
    const name = area.data.name.trim()
    if (!readAsGroup.has(name)) readAsGroup.set(name, area.id)
  }
  const removable = new Set(readAsGroup.values())
  const tablesOfArea = new Map(
    tableGroupsOf(nodes, areas).map(({ area, tables }) => [
      area.id,
      new Set(tables.map((table) => table.id)),
    ]),
  )

  let order = Math.max(-1, ...areas.map((area) => asAreaNode(area)?.data.order ?? -1))
  const redefined = new Map<string, DiagramNode>()
  const created: DiagramNode[] = []

  for (const group of groups) {
    const members = [...new Set(group.tables.flatMap((name) => tableByName.get(name) ?? []))]
    const existing = areas
      .flatMap((node) => asAreaNode(node) ?? [])
      .find((area) => !redefined.has(area.id) && area.data.name.trim() === group.name)
    const color = group.color ?? existing?.data.color ?? AREA_NODE_DEFAULT_COLOR

    const inside = tablesOfArea.get(existing?.id ?? '')
    const unchanged =
      inside?.size === members.length && members.every((table) => inside.has(table.id))
    if (existing && unchanged) {
      redefined.set(existing.id, { ...existing, data: { ...existing.data, color } })
      continue
    }

    const { x, y, width, height } = fitAreaRect(members)
    if (existing) {
      const { measured: _, ...area } = existing
      redefined.set(existing.id, {
        ...area,
        position: { x, y },
        style: { ...existing.style, width, height },
        data: { ...existing.data, color },
      })
    } else {
      created.push({
        id: randomId(),
        type: AREA_NODE_TYPE,
        position: { x, y },
        style: { width, height },
        data: {
          name: group.name,
          color,
          alpha: AREA_NODE_DEFAULT_ALPHA,
          order: ++order,
        },
      })
    }
  }

  const kept = areas.flatMap((area) => {
    const next = redefined.get(area.id)
    if (next) return [next]
    return mode === 'replace' && removable.has(area.id) ? [] : [area]
  })
  return [...kept, ...created]
}

/**
 * Schema → diagram. Tables are matched to existing nodes by name and columns
 * by name, so ids, positions, sizes and colors survive the round trip; new
 * tables are laid out below the current content, each group's new tables together.
 *
 * - `replace`: the result contains exactly the given tables, enums, relations and, when
 *   given, groups.
 * - `merge`: given tables, enums and groups are created or fully redefined, given relations
 *   are added or updated; everything else in the diagram is left as is.
 */
export const applyDatabaseSchema = (
  current: DiagramDocument,
  schema: DatabaseSchema,
  mode: SchemaApplyMode,
): DiagramDocument & { summary: SchemaApplySummary } => {
  validateTables(schema.tables)
  validateEnums(schema.enums ?? [])

  const existingTables = current.nodes.flatMap((node) => asTableNode(node) ?? [])
  const existingByName = new Map(existingTables.map((node) => [node.data.name, node]))
  const inputNames = new Set(schema.tables.map((table) => table.name))

  // Tables are matched by name, so a name shared by several nodes is ambiguous:
  // redefining it would silently drop all but one of them.
  const ambiguousNames = new Set(findDuplicates(existingTables.map((node) => node.data.name)))
  const ambiguousInput = [...inputNames].filter((name) => ambiguousNames.has(name))
  if (ambiguousInput.length) {
    throw new DatabaseSchemaError(
      `The diagram has several tables named ${ambiguousInput.join(', ')}; rename them in the editor first`,
    )
  }

  const finalTableNames = new Set([
    ...inputNames,
    ...(mode === 'merge'
      ? existingTables.map((node) => node.data.name).filter((name) => !ambiguousNames.has(name))
      : []),
  ])
  const groups = schema.groups ?? []
  validateGroups(groups, finalTableNames)
  const areaIds = new Set((current.areas ?? []).map((area) => area.id))

  // Nodes this call does not define: unknown node kinds always, other tables in merge mode.
  const untouched = current.nodes.filter((node) => {
    const table = asTableNode(node)
    if (!table) return true
    return mode === 'merge' && !inputNames.has(table.data.name)
  })

  const newTables = schema.tables.filter((table) => !existingByName.has(table.name))
  const newIds = new Map(newTables.map((table) => [table.name, randomId()]))
  const laidOut: DiagramNode[] = [
    ...current.nodes.filter(
      (node) => untouched.includes(node) || inputNames.has(asTableNode(node)?.data.name ?? ''),
    ),
    ...(current.areas ?? []),
  ]
  const newPosition = new Map<string, { x: number; y: number }>()
  const heightsOf = (tables: DatabaseSchemaTable[]) =>
    tables.map((table) => tableHeight(table.columns.length))
  const place = (tables: DatabaseSchemaTable[], positions: { x: number; y: number }[]) =>
    positions.forEach((position, i) => {
      newPosition.set(tables[i].name, position)
      // Padded, so the next block leaves room for the area around a group.
      const height = tableHeight(tables[i].columns.length) + AREA_PADDING
      laidOut.push({ id: tables[i].name, position, style: { height } })
    })

  /**
   * Positions for new tables of a group next to its tables already in the diagram, below or
   * to the right of them, where the fitted area overlaps no other table or area.
   */
  const besideGroup = (group: DatabaseSchemaGroup, members: DiagramNode[], heights: number[]) => {
    if (!members.length) return undefined
    const rects = members.map(tableRect)
    const others = laidOut.filter((node) => !members.includes(node) && !areaIds.has(node.id))
    const otherAreas = (current.areas ?? []).filter(
      (node) => asAreaNode(node)?.data.name.trim() !== group.name,
    )
    const origins = [
      {
        x: Math.min(...rects.map((rect) => rect.x)),
        y: Math.max(...rects.map((rect) => rect.y + rect.height)) + GRID_GAP_Y,
      },
      {
        x:
          Math.max(...rects.map((rect) => rect.x + rect.width)) +
          GRID_GAP_X -
          TABLE_ESTIMATED_WIDTH,
        y: Math.min(...rects.map((rect) => rect.y)),
      },
    ]
    return origins
      .map((origin) => gridFrom(origin, heights))
      .find((positions) => {
        const added = positions.map((position, i) => ({
          id: '',
          position,
          style: { height: heights[i] },
        }))
        const area = fitAreaRect([...members, ...added])
        return (
          !others.some((node) => rectsOverlap(area, tableRect(node))) &&
          !otherAreas.some((node) => rectsOverlap(area, areaRect(node)))
        )
      })
  }

  const groupOf = new Map(
    groups.flatMap((group) => group.tables.map((table) => [table, group] as const)),
  )
  const ungrouped = newTables.filter((table) => !groupOf.has(table.name))
  place(ungrouped, gridPositions(laidOut, heightsOf(ungrouped)))
  for (const group of groups) {
    const added = newTables.filter((table) => groupOf.get(table.name) === group)
    const members = group.tables.flatMap((name) => existingByName.get(name) ?? [])
    const heights = heightsOf(added)
    place(added, besideGroup(group, members, heights) ?? gridPositions(laidOut, heights))
  }

  let colorIndex = existingTables.length
  const defined: TableNode[] = schema.tables.map((table) => {
    const previous = existingByName.get(table.name)
    const fallbackColor = nodeColorAt(++colorIndex)
    const data = buildTableData(table, previous?.data, fallbackColor)

    if (previous) return { ...previous, data }
    return {
      id: newIds.get(table.name) ?? randomId(),
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
            id: randomId(),
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
    throw new DatabaseSchemaError(
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
    enums: applyEnums(current.enums ?? [], schema.enums ?? [], mode),
    areas: applyGroups(current, finalNodes, tableByName, schema.groups, mode),
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
