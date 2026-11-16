import {
  type Column,
  type CompileError,
  Compiler,
  type Database,
  DEFAULT_ENTRY,
  getMultiplicities,
  isEndpointManySide,
  MemoryProjectLayout,
  type Ref,
  type Table,
  type TablePartial,
} from '@dbml/parse'
import {
  type DatabaseSchema,
  type DatabaseSchemaRelation,
  type DatabaseSchemaTable,
  NODE_COLORS,
  type NodeColor,
  REFERENTIAL_ACTIONS,
  type ReferentialAction,
} from '@docgraph/common/schemas'
import { DBML_DEFAULT_SCHEMA, DBML_HEADER_COLORS } from './dbml.config'

export type DbmlParseResult = { ok: true; schema: DatabaseSchema } | { ok: false; error: string }

const MAX_REPORTED_ERRORS = 5
const UNSIGNED_SUFFIX = /\s+unsigned$/i

const qualifiedName = (schemaName: string | null, name: string) =>
  schemaName && schemaName !== DBML_DEFAULT_SCHEMA ? `${schemaName}.${name}` : name

const columnKey = (table: string, column: string) => `${table}\0${column}`

const hexToRgb = (hex: string) => {
  const digits = hex.slice(1)
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits
  const value = Number.parseInt(full, 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** The table color closest to a DBML `headercolor`. */
const nearestColor = (hex: string | undefined): NodeColor | undefined => {
  if (!hex || !/^#([\da-f]{3}|[\da-f]{6})$/i.test(hex)) return undefined
  const rgb = hexToRgb(hex)
  const distance = (color: NodeColor) =>
    hexToRgb(DBML_HEADER_COLORS[color]).reduce(
      (sum, channel, i) => sum + (channel - rgb[i]) ** 2,
      0,
    )
  return NODE_COLORS.reduce((best, color) => (distance(color) < distance(best) ? color : best))
}

const referentialAction = (action: string | undefined): ReferentialAction => {
  const upper = action?.toUpperCase()
  return REFERENTIAL_ACTIONS.find((known) => known === upper) ?? 'NO ACTION'
}

const relationType = ([left, right]: Ref['endpoints']): DatabaseSchemaRelation['relation'] => {
  const leftMany = isEndpointManySide(left.relation)
  const rightMany = isEndpointManySide(right.relation)
  if (leftMany && rightMany) return 'many-to-many'
  if (leftMany) return 'many-to-one'
  return rightMany ? 'one-to-many' : 'one-to-one'
}

/**
 * Columns holding the foreign key of each reference: the many side, or for one-to-one the
 * side that isn't the primary key (the right one when that doesn't tell). Many-to-many
 * references have none.
 */
const foreignKeyColumns = (refs: Ref[], primaryKeys: Set<string>) => {
  const keys = new Set<string>()
  for (const ref of refs) {
    const [left, right] = ref.endpoints
    const columnsOf = (endpoint: Ref['endpoints'][number]) =>
      endpoint.fieldNames.map((field) =>
        columnKey(qualifiedName(endpoint.schemaName, endpoint.tableName), field),
      )
    const isPrimary = (endpoint: Ref['endpoints'][number]) =>
      columnsOf(endpoint).every((key) => primaryKeys.has(key))

    const relation = relationType(ref.endpoints)
    const side =
      relation === 'many-to-one'
        ? left
        : relation === 'one-to-many'
          ? right
          : relation === 'one-to-one'
            ? isPrimary(right) && !isPrimary(left)
              ? left
              : right
            : undefined
    for (const key of side ? columnsOf(side) : []) keys.add(key)
  }
  return keys
}

type ParsedIndexes = {
  primaryKey: Set<string>
  unique: Set<string>
  indexed: Set<string>
  composite: NonNullable<DatabaseSchemaTable['indexes']>
}

/** Expression indexes have no counterpart in the diagram and are skipped. */
const parseIndexes = (table: Table): ParsedIndexes => {
  const parsed: ParsedIndexes = {
    primaryKey: new Set(table.fields.filter((field) => field.pk).map((field) => field.name)),
    unique: new Set(),
    indexed: new Set(),
    composite: [],
  }

  for (const index of table.indexes) {
    if (index.columns.some((column) => column.type !== 'column')) continue
    const columns = index.columns.map((column) => column.value)

    if (index.pk) for (const column of columns) parsed.primaryKey.add(column)
    else if (columns.length === 1) (index.unique ? parsed.unique : parsed.indexed).add(columns[0])
    else parsed.composite.push({ type: index.unique ? 'unique' : 'index', columns })
  }
  return parsed
}

/**
 * A table with the columns, indexes, color and note of its `~partial` injections, which
 * the parser keeps apart. Columns stay where they were written; a table's own column
 * wins over a partial's, and a later partial over an earlier one.
 */
const withPartials = (table: Table, partials: readonly TablePartial[]): Table => {
  if (!table.partials.length) return table
  const partialByName = new Map(partials.map((partial) => [partial.name, partial]))
  const injected = table.partials.flatMap((injection) => {
    const partial = partialByName.get(injection.name)
    return partial ? [{ order: injection.order, partial }] : []
  })

  // `order` is the injection's position among the table's elements, own columns included.
  const written: Column[] = []
  let nextOwn = 0
  const total = table.fields.length + injected.length
  for (let position = 0; position < total; position++) {
    const injection = injected.find(({ order }) => order === position)
    if (injection) written.push(...injection.partial.fields)
    else if (nextOwn < table.fields.length) written.push(table.fields[nextOwn++])
  }
  written.push(...table.fields.slice(nextOwn))

  const ownNames = new Set(table.fields.map((field) => field.name))
  const winner = new Map<string, Column>()
  for (const field of written) {
    if (!ownNames.has(field.name) || table.fields.includes(field)) winner.set(field.name, field)
  }
  const lastWith = <K extends 'headerColor' | 'note'>(key: K) =>
    injected.findLast(({ partial }) => partial[key])?.partial[key]

  return {
    ...table,
    fields: written.filter((field) => winner.get(field.name) === field),
    indexes: [...injected.flatMap(({ partial }) => partial.indexes), ...table.indexes],
    headerColor: table.headerColor ?? lastWith('headerColor'),
    note: table.note ?? lastWith('note'),
  }
}

/** Inline refs of the columns a table got from partials, which the parser leaves out of `refs`. */
const partialRefs = (table: Table, ownFields: readonly Column[]): Ref[] =>
  table.fields
    .filter((field) => !ownFields.includes(field))
    .flatMap((field) =>
      field.inline_refs.flatMap((inline): Ref[] => {
        const multiplicities = getMultiplicities(inline.relation)
        if (!multiplicities) return []
        const [columnSide, targetSide] = multiplicities
        // The parser names the partial as the table of a same-table ref like `ref: > id`.
        const isSelfRef =
          !inline.schemaName && table.partials.some(({ name }) => name === inline.tableName)
        const target = isSelfRef
          ? { ...inline, schemaName: table.schemaName, tableName: table.name, relation: targetSide }
          : { ...inline, relation: targetSide }
        const column = {
          schemaName: table.schemaName,
          tableName: table.name,
          fieldNames: [field.name],
          relation: columnSide,
          token: field.token,
        }
        // Same endpoint order as the parser gives the table's own inline refs.
        return [{ schemaName: null, name: null, token: inline.token, endpoints: [target, column] }]
      }),
    )

/** The same for both directions of a ref, so a partial's ref can't duplicate an explicit one. */
const refKey = ({ endpoints }: Ref) =>
  endpoints
    .map((endpoint) =>
      columnKey(qualifiedName(endpoint.schemaName, endpoint.tableName), endpoint.fieldNames.join()),
    )
    .sort()
    .join('\n')

const toSchema = (rawDatabase: Readonly<Database>): DatabaseSchema => {
  const mergedTables = rawDatabase.tables.map((table) =>
    withPartials(table, rawDatabase.tablePartials),
  )
  const explicitRefs = new Set(rawDatabase.refs.map(refKey))
  const database = {
    ...rawDatabase,
    tables: mergedTables,
    refs: [
      ...rawDatabase.refs,
      ...mergedTables
        .flatMap((table, i) => partialRefs(table, rawDatabase.tables[i].fields))
        .filter((ref) => !explicitRefs.has(refKey(ref))),
    ],
  }
  const indexesByTable = new Map(
    database.tables.map((table) => [
      qualifiedName(table.schemaName, table.name),
      parseIndexes(table),
    ]),
  )
  const primaryKeys = new Set(
    [...indexesByTable].flatMap(([table, { primaryKey }]) =>
      [...primaryKey].map((column) => columnKey(table, column)),
    ),
  )
  const foreignKeys = foreignKeyColumns(database.refs, primaryKeys)
  const nullableColumns = new Set<string>()

  const tables = database.tables.map((table): DatabaseSchemaTable => {
    const name = qualifiedName(table.schemaName, table.name)
    const indexes = indexesByTable.get(name) ?? parseIndexes(table)
    const color = nearestColor(table.headerColor)

    return {
      name,
      ...(table.note?.value ? { description: table.note.value } : {}),
      ...(color ? { color } : {}),
      columns: table.fields.map((field) => {
        const primaryKey = indexes.primaryKey.has(field.name)
        const nullable = !primaryKey && !field.not_null
        if (nullable) nullableColumns.add(columnKey(name, field.name))
        const unsigned = UNSIGNED_SUFFIX.test(field.type.type_name)

        return {
          name: field.name,
          type: field.type.type_name.replace(UNSIGNED_SUFFIX, ''),
          primaryKey,
          nullable,
          unique: !!field.unique || indexes.unique.has(field.name),
          index: indexes.indexed.has(field.name),
          foreignKey: foreignKeys.has(columnKey(name, field.name)),
          ...(unsigned ? { unsigned } : {}),
          ...(field.note?.value ? { description: field.note.value } : {}),
        }
      }),
      ...(indexes.composite.length ? { indexes: indexes.composite } : {}),
    }
  })

  // A composite reference becomes one relation per column pair.
  const relations = database.refs.flatMap((ref) => {
    const [left, right] = ref.endpoints
    const from = qualifiedName(left.schemaName, left.tableName)
    const to = qualifiedName(right.schemaName, right.tableName)
    const relation = relationType(ref.endpoints)

    return left.fieldNames.map((fromColumn, i): DatabaseSchemaRelation => {
      const toColumn = right.fieldNames[i]
      return {
        from: { table: from, column: fromColumn },
        to: { table: to, column: toColumn },
        relation,
        nullable: [columnKey(from, fromColumn), columnKey(to, toColumn)].some(
          (key) => foreignKeys.has(key) && nullableColumns.has(key),
        ),
        onDelete: referentialAction(ref.onDelete),
        onUpdate: referentialAction(ref.onUpdate),
      }
    })
  })

  return { tables, relations }
}

const lineOf = (source: string, offset: number) => source.slice(0, offset).split('\n').length

const formatErrors = (source: string, errors: readonly Readonly<CompileError>[]) => {
  const lines = errors
    .slice(0, MAX_REPORTED_ERRORS)
    .map((error) => `Line ${lineOf(source, error.start)}: ${error.diagnostic}`)
  if (errors.length > MAX_REPORTED_ERRORS) {
    lines.push(`…and ${errors.length - MAX_REPORTED_ERRORS} more`)
  }
  return lines.join('\n')
}

/**
 * Reads DBML into a layout-free schema. What the diagram can't hold is dropped: enum
 * definitions (columns keep the enum name as their type), defaults, increments, checks,
 * expression indexes, table groups and sticky notes. DBML has no foreign key flag or
 * relation nullability, so both are derived: a column is a foreign key when it is the
 * referencing side of a ref, and a relation is nullable when that column is.
 */
export const parseDbml = (source: string): DbmlParseResult => {
  const layout = new MemoryProjectLayout()
  layout.setSource(DEFAULT_ENTRY, source)
  const compiler = new Compiler(layout)

  const errors = compiler.parse.errors(DEFAULT_ENTRY)
  if (errors.length) return { ok: false, error: formatErrors(source, errors) }

  const database = compiler.parse.rawDb(DEFAULT_ENTRY)
  if (!database) return { ok: false, error: 'Not a valid DBML file.' }
  return { ok: true, schema: toSchema(database) }
}
