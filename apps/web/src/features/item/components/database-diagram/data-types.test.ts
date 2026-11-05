import { describe, expect, it } from 'vitest'
import { getDataTypeColor, isNumericType } from './data-types'

describe('getDataTypeColor', () => {
  it.each([
    ['varchar', 'blue'],
    ['varchar(255)', 'blue'],
    ['VARCHAR(255)', 'blue'],
    ['  Varchar (255) ', 'blue'],
    ['timestamptz', 'green'],
    ['TIMESTAMPTZ', 'green'],
    ['timestamp', 'green'],
    ['decimal(10, 2)', 'amber'],
    ['DOUBLE PRECISION', 'amber'],
    ['inet', 'purple'],
    ['JSONB', 'blue'],
    ['enum', 'rose'],
  ])('maps %s to %s', (value, color) => {
    expect(getDataTypeColor(value)).toBe(color)
  })

  it.each(['custom_type', 'timestamp with time zone', '', 'constructor', 'toString'])(
    'returns undefined for the unknown type %j',
    (value) => {
      expect(getDataTypeColor(value)).toBeUndefined()
    },
  )
})

describe('isNumericType', () => {
  it.each(['int', 'INT', 'bigint', 'decimal(10,2)', 'NUMERIC(5)', 'serial'])(
    'treats %s as numeric',
    (value) => {
      expect(isNumericType(value)).toBe(true)
    },
  )

  it.each(['boolean', 'BOOLEAN', 'varchar(255)', 'timestamptz', 'unknown'])(
    'does not treat %s as numeric',
    (value) => {
      expect(isNumericType(value)).toBe(false)
    },
  )
})
