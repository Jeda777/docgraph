import { z } from 'zod'
import { areaNodeSchema } from './area-node'
import { nonEmptyStringSchema } from './common'
import { baseEdgeSchema, baseNodeSchema } from './diagram'
import type { ItemType } from './item'

/**
 * DIAGRAM DOCUMENT
 *
 * The `data` payloads stored in a database diagram's CRDT document. The web
 * editor wraps them in React Flow nodes/edges; the server reads and writes them
 * for the MCP endpoint.
 */

/** React Flow `type` of database diagram nodes (tables) and edges (relations). */
export const DATABASE_DIAGRAM_NODE_TYPE = 'databaseNode' as const
export const DATABASE_DIAGRAM_EDGE_TYPE = 'databaseEdge' as const

const HANDLE_SUFFIX = { left: '-a', right: '-b' } as const

/** Every column has a connection handle on both sides of its table node. */
export const columnHandleId = (columnId: string, side: keyof typeof HANDLE_SUFFIX) =>
  `${columnId}${HANDLE_SUFFIX[side]}`

export const columnIdFromHandleId = (handleId: string) => handleId.replace(/-[ab]$/, '')

export const NODE_COLORS = [
  'red',
  'orange',
  'yellow',
  'lime',
  'emerald',
  'cyan',
  'blue',
  'violet',
  'fuchsia',
  'pink',
  'rose',
  'gray',
  'stone',
] as const
export type NodeColor = (typeof NODE_COLORS)[number]

/** Cycles through the palette, e.g. to give each new table or collaborator its own color. */
export const nodeColorAt = (index: number): NodeColor => NODE_COLORS[index % NODE_COLORS.length]

export const databaseDiagramNodeDataValueSchema = z.object({
  id: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  value: nonEmptyStringSchema,
  primaryKey: z.boolean(),
  foreignKey: z.boolean(),
  index: z.boolean(),
  unique: z.boolean(),
  unsigned: z.boolean().optional(),
  nullable: z.boolean(),
  description: z.string().optional(),
})
export type DatabaseDiagramNodeDataValue = z.infer<typeof databaseDiagramNodeDataValueSchema>

export const CONSTRAINT_TYPES = ['unique', 'index'] as const

export const databaseDiagramNodeDataConstraintSchema = z.object({
  id: nonEmptyStringSchema,
  type: z.enum(CONSTRAINT_TYPES),
  columns: z.array(nonEmptyStringSchema),
})
export type DatabaseDiagramNodeDataConstraint = z.infer<
  typeof databaseDiagramNodeDataConstraintSchema
>

export const databaseDiagramNodeDataSchema = z.object({
  name: nonEmptyStringSchema,
  color: z.enum(NODE_COLORS),
  values: z.array(databaseDiagramNodeDataValueSchema),
  constraints: z.array(databaseDiagramNodeDataConstraintSchema).optional(),
  description: z.string().optional(),
})
export type DatabaseDiagramNodeData = z.infer<typeof databaseDiagramNodeDataSchema>

export const RELATION_TYPES = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'] as const

export const REFERENTIAL_ACTIONS = [
  'NO ACTION',
  'CASCADE',
  'RESTRICT',
  'SET NULL',
  'SET DEFAULT',
] as const
export type ReferentialAction = (typeof REFERENTIAL_ACTIONS)[number]

export const databaseDiagramEdgeDataSchema = z.object({
  relation: z.enum(RELATION_TYPES),
  nullable: z.boolean(),
  onDelete: z.enum(REFERENTIAL_ACTIONS),
  onUpdate: z.enum(REFERENTIAL_ACTIONS),
})
export type DatabaseDiagramEdgeData = z.infer<typeof databaseDiagramEdgeDataSchema>

/** Data of a relation drawn in the editor or sent over MCP without these fields. */
export const DATABASE_DIAGRAM_DEFAULT_EDGE_DATA: DatabaseDiagramEdgeData = {
  relation: 'one-to-many',
  nullable: false,
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION',
}

export const databaseDiagramNodeSchema = baseNodeSchema.extend({
  type: z.literal(DATABASE_DIAGRAM_NODE_TYPE),
  data: databaseDiagramNodeDataSchema,
})

export const databaseDiagramEdgeSchema = baseEdgeSchema.extend({
  type: z.literal(DATABASE_DIAGRAM_EDGE_TYPE),
  data: databaseDiagramEdgeDataSchema,
})

export const databaseDiagramSchema = z.object({
  type: z.literal('DATABASE_DIAGRAM' satisfies ItemType),
  nodes: z.array(databaseDiagramNodeSchema),
  edges: z.array(databaseDiagramEdgeSchema),
  areas: z.array(areaNodeSchema),
})
export type DatabaseDiagram = z.infer<typeof databaseDiagramSchema>

/**
 * DATABASE SCHEMA (MCP)
 *
 * Layout-free view of a database diagram exchanged with AI agents: tables,
 * columns and relations referenced by name, no ids or positions.
 */

export const databaseSchemaColumnSchema = z.object({
  name: nonEmptyStringSchema,
  type: nonEmptyStringSchema.describe(
    'SQL type as written in DDL, e.g. "varchar(255)", "bigint", "uuid"',
  ),
  primaryKey: z.boolean().default(false),
  nullable: z.boolean().default(false),
  unique: z.boolean().default(false),
  index: z.boolean().default(false),
  foreignKey: z
    .boolean()
    .optional()
    .describe('Defaults to true when the column is the `to` side of a relation'),
  unsigned: z.boolean().optional(),
  description: z.string().optional(),
})

export const databaseSchemaIndexSchema = z.object({
  type: z.enum(CONSTRAINT_TYPES),
  columns: z.array(nonEmptyStringSchema).min(1).describe('Column names of this table'),
})

export const databaseSchemaTableSchema = z.object({
  name: nonEmptyStringSchema,
  description: z.string().optional(),
  color: z.enum(NODE_COLORS).optional(),
  columns: z.array(databaseSchemaColumnSchema),
  indexes: z
    .array(databaseSchemaIndexSchema)
    .optional()
    .describe('Composite (multi-column) indexes and unique constraints'),
})
export type DatabaseSchemaTable = z.infer<typeof databaseSchemaTableSchema>

const columnRefSchema = z.object({ table: nonEmptyStringSchema, column: nonEmptyStringSchema })

export const databaseSchemaRelationSchema = z.object({
  from: columnRefSchema.describe('Referenced side, usually the primary key (e.g. users.id)'),
  to: columnRefSchema.describe('Referencing side, usually the foreign key (e.g. posts.author_id)'),
  relation: z
    .enum(RELATION_TYPES)
    .default(DATABASE_DIAGRAM_DEFAULT_EDGE_DATA.relation)
    .describe('Cardinality read from `from` to `to`'),
  nullable: z.boolean().default(DATABASE_DIAGRAM_DEFAULT_EDGE_DATA.nullable),
  onDelete: z.enum(REFERENTIAL_ACTIONS).default(DATABASE_DIAGRAM_DEFAULT_EDGE_DATA.onDelete),
  onUpdate: z.enum(REFERENTIAL_ACTIONS).default(DATABASE_DIAGRAM_DEFAULT_EDGE_DATA.onUpdate),
})
export type DatabaseSchemaRelation = z.infer<typeof databaseSchemaRelationSchema>

export const databaseSchemaSchema = z.object({
  tables: z.array(databaseSchemaTableSchema),
  relations: z.array(databaseSchemaRelationSchema).default([]),
})
export type DatabaseSchema = z.infer<typeof databaseSchemaSchema>
export type DatabaseSchemaInput = z.input<typeof databaseSchemaSchema>
