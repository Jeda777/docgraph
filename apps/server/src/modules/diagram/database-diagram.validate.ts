import type { DatabaseSchemaTable } from '@docgraph/common/schemas'
import { BadRequestException } from '../../errors'
import { findDuplicates } from '../../lib/find-duplicates'

/** Rejects duplicate table or column names and indexes on unknown columns. */
export const validateTables = (tables: DatabaseSchemaTable[]) => {
  const errors: string[] = []

  const duplicateTables = findDuplicates(tables.map((table) => table.name))
  if (duplicateTables.length) errors.push(`Duplicate tables: ${duplicateTables.join(', ')}`)

  for (const table of tables) {
    const names = table.columns.map((column) => column.name)
    const duplicateColumns = findDuplicates(names)
    if (duplicateColumns.length) {
      errors.push(`Duplicate columns in ${table.name}: ${duplicateColumns.join(', ')}`)
    }
    for (const index of table.indexes ?? []) {
      const missing = index.columns.filter((column) => !names.includes(column))
      if (missing.length) {
        errors.push(`Index on ${table.name} references unknown columns: ${missing.join(', ')}`)
      }
    }
  }

  if (errors.length) throw new BadRequestException('BAD_REQUEST', errors.join('\n'))
}
