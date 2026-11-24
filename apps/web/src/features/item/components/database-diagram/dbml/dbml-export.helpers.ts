import type {
  DatabaseSchema,
  DatabaseSchemaRelation,
  DatabaseSchemaTable,
  RELATION_TYPES,
} from '@docgraph/common/schemas'
import { DBML_HEADER_COLORS } from './dbml.config'

const RELATION_OPERATORS: Record<(typeof RELATION_TYPES)[number], string> = {
  'one-to-many': '<',
  'many-to-one': '>',
  'one-to-one': '-',
  'many-to-many': '<>',
}

const IDENTIFIER = /^[A-Za-z_]\w*$/
/** Words that start an element inside a table, so a column named after one must be quoted. */
const TABLE_KEYWORDS = new Set(['note', 'indexes', 'checks', 'records'])
const SCHEMA_QUALIFIED_NAME = /^[A-Za-z_]\w*\.[A-Za-z_]\w*$/
const PLAIN_TYPE = /^[A-Za-z_]\w*(\([^()"\\]*\))?(\[\])?$/

const escapeText = (value: string, quote: string) =>
  value
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replace(/\r?\n/g, '\\n')
    .replaceAll('\t', '\\t')

const quoted = (value: string) => `"${escapeText(value, '"')}"`
const text = (value: string) => `'${escapeText(value, "'")}'`

const columnName = (name: string) =>
  IDENTIFIER.test(name) && !TABLE_KEYWORDS.has(name.toLowerCase()) ? name : quoted(name)

/** A `schema.table` name, as a DBML import produces, stays unquoted so the schema survives. */
const tableName = (name: string) =>
  SCHEMA_QUALIFIED_NAME.test(name) || IDENTIFIER.test(name) ? name : quoted(name)

const columnType = (type: string, unsigned: boolean | undefined) => {
  const full = unsigned ? `${type} unsigned` : type
  return PLAIN_TYPE.test(full) ? full : quoted(full)
}

const SQL_STRING = /^'((?:[^']|'')*)'$/s
const KEYWORD_DEFAULT = /^(true|false|null)$/i
const NUMBER_DEFAULT = /^-?\d+(\.\d+)?$/

/**
 * A SQL default as a DBML `default:` value. Numbers and keywords stay bare, string literals
 * become DBML strings and anything else an expression. Expressions with a backtick can't be
 * written in DBML and are left out.
 */
const defaultSetting = (sql: string | undefined) => {
  const value = sql?.trim()
  if (!value) return undefined
  // Only numbers that read back unchanged, so `1.50` stays as written.
  if (NUMBER_DEFAULT.test(value) && String(Number(value)) === value) return `default: ${value}`
  if (KEYWORD_DEFAULT.test(value)) return `default: ${value.toLowerCase()}`
  const string = SQL_STRING.exec(value)
  if (string) return `default: ${text(string[1].replaceAll("''", "'"))}`
  return value.includes('`') ? undefined : `default: \`${value}\``
}

const settings = (items: (string | false | undefined)[]) => {
  const present = items.filter(Boolean)
  return present.length ? ` [${present.join(', ')}]` : ''
}

const exportTable = (table: DatabaseSchemaTable) => {
  const lines = [
    `Table ${tableName(table.name)}${settings([table.color && `headercolor: ${DBML_HEADER_COLORS[table.color]}`])} {`,
  ]

  for (const column of table.columns) {
    lines.push(
      `  ${columnName(column.name)} ${columnType(column.type, column.unsigned)}${settings([
        column.primaryKey && 'pk',
        column.unique && 'unique',
        !column.primaryKey && !column.nullable && 'not null',
        column.increment && 'increment',
        defaultSetting(column.defaultValue),
        column.description && `note: ${text(column.description)}`,
      ])}`,
    )
  }

  const indexes = [
    ...table.columns.filter((column) => column.index).map((column) => columnName(column.name)),
    ...(table.indexes ?? []).flatMap((index) => {
      if (!index.columns.length) return []
      const columns = index.columns.map(columnName)
      const target = columns.length === 1 ? columns[0] : `(${columns.join(', ')})`
      return `${target}${settings([index.type === 'unique' && 'unique'])}`
    }),
  ]
  if (indexes.length) {
    lines.push('', '  indexes {', ...indexes.map((index) => `    ${index}`), '  }')
  }

  const checks = (table.checks ?? []).flatMap(({ expression, name }) =>
    expression.includes('`') ? [] : `\`${expression}\`${settings([name && `name: ${text(name)}`])}`,
  )
  if (checks.length) {
    lines.push('', '  checks {', ...checks.map((check) => `    ${check}`), '  }')
  }

  if (table.description) lines.push('', `  Note: ${text(table.description)}`)

  lines.push('}')
  return lines.join('\n')
}

const endpoint = ({ table, column }: DatabaseSchemaRelation['from']) =>
  `${tableName(table)}.${columnName(column)}`

const exportRelation = (relation: DatabaseSchemaRelation) =>
  `Ref: ${endpoint(relation.from)} ${RELATION_OPERATORS[relation.relation]} ${endpoint(relation.to)}${settings(
    [
      relation.onDelete !== 'NO ACTION' && `delete: ${relation.onDelete.toLowerCase()}`,
      relation.onUpdate !== 'NO ACTION' && `update: ${relation.onUpdate.toLowerCase()}`,
    ],
  )}`

/**
 * Writes a schema as DBML. What DBML can't express is left out: tables without columns
 * (named in a comment instead), repeated relations between the same two columns, which
 * DBML rejects, and default or check expressions containing a backtick.
 */
export const toDbml = ({ tables, relations }: DatabaseSchema) => {
  const exported = tables.filter((table) => table.columns.length)
  const skipped = tables.filter((table) => !table.columns.length).map((table) => table.name)

  const seen = new Set<string>()
  const uniqueRelations = relations.filter(({ from, to }) => {
    const key = [`${from.table}.${from.column}`, `${to.table}.${to.column}`].sort().join('\0')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return `${[
    ...(skipped.length ? [`// Tables without columns, left out: ${skipped.join(', ')}`] : []),
    ...exported.map(exportTable),
    ...(uniqueRelations.length ? [uniqueRelations.map(exportRelation).join('\n')] : []),
  ].join('\n\n')}\n`
}
