import type { NodeColor } from '@docgraph/common/schemas'

/** DBML `headercolor` of each table color: the Tailwind 500 shade as hex, since DBML takes no other format. */
export const DBML_HEADER_COLORS: Record<NodeColor, `#${string}`> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  lime: '#84cc16',
  emerald: '#10b981',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  gray: '#6b7280',
  stone: '#78716c',
}

/** DBML schema of tables written without one; its name is left out of imported table names. */
export const DBML_DEFAULT_SCHEMA = 'public'
