export const dataTypes = {
  // Numeric
  tinyint: 'amber',
  smallint: 'amber',
  mediumint: 'amber',
  int: 'amber',
  bigint: 'amber',

  decimal: 'amber',
  float: 'amber',
  double: 'amber',
  bit: 'amber',

  numeric: 'amber',
  real: 'amber',
  'double precision': 'amber',
  smallserial: 'amber',
  serial: 'amber',
  bigserial: 'amber',

  boolean: 'amber',

  // Date and Time
  date: 'green',
  datetime: 'green',
  timestamp: 'green',
  timestamptz: 'green',
  time: 'green',
  timetz: 'green',
  year: 'green',
  interval: 'green',

  // String
  char: 'blue',
  varchar: 'blue',

  tinyblob: 'blue',
  blob: 'blue',
  mediumblob: 'blue',
  longblob: 'blue',

  tinytext: 'blue',
  text: 'blue',
  mediumtext: 'blue',
  longtext: 'blue',

  json: 'blue',
  jsonb: 'blue',
  binary: 'blue',
  varbinary: 'blue',
  uuid: 'blue',
  xml: 'blue',

  inet: 'purple',
  inet4: 'purple',
  inet6: 'purple',
  cidr: 'purple',
  macaddr: 'purple',
  macaddr8: 'purple',

  money: 'rose',

  bytea: 'rose',

  // Other
  enum: 'rose',
  set: 'rose',

  vector: 'rose',
  point: 'rose',
  line: 'rose',
  lseg: 'rose',
  box: 'rose',
  path: 'rose',
  polygon: 'rose',
  circle: 'rose',
} as Record<string, string>

/** The type name without its arguments, as typed in any case: `VARCHAR(255)` → `varchar`. */
const baseType = (value: string) => value.split('(')[0].trim().toLowerCase()

/** Tailwind color of a column type, or `undefined` for types not in the map. */
export const getDataTypeColor = (value: string): string | undefined => {
  const base = baseType(value)
  return Object.hasOwn(dataTypes, base) ? dataTypes[base] : undefined
}

/** Numeric types accept UNSIGNED (boolean excluded). */
export const isNumericType = (value: string) => {
  const base = baseType(value)
  return base !== 'boolean' && dataTypes[base] === 'amber'
}
