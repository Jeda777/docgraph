import { describe, expect, it } from 'vitest'
import type { DatabaseDiagramNodeDataValue } from '../schemas'
import { gridPositions, tableHeight } from './database-diagram.layout'
import type { DiagramNode } from './database-diagram.model'
import { TABLE_HEADER_HEIGHT, TABLE_ROW_HEIGHT } from './diagram-defaults'

const column = (id: string): DatabaseDiagramNodeDataValue => ({
  id,
  name: id,
  value: 'bigint',
  primaryKey: false,
  foreignKey: false,
  index: false,
  unique: false,
  nullable: false,
})

const table = (
  id: string,
  position: { x: number; y: number },
  columns: number,
  overrides: Partial<DiagramNode> = {},
): DiagramNode => ({
  id,
  position,
  data: {
    name: id,
    color: 'blue',
    values: Array.from({ length: columns }, (_, index) => column(`${id}-${index}`)),
  },
  ...overrides,
})

describe('tableHeight', () => {
  it('adds one row per column to the header', () => {
    expect(tableHeight(0)).toBe(TABLE_HEADER_HEIGHT)
    expect(tableHeight(3)).toBe(TABLE_HEADER_HEIGHT + 3 * TABLE_ROW_HEIGHT)
  })
})

describe('gridPositions', () => {
  it('returns no positions when there is nothing to place', () => {
    expect(gridPositions([table('a', { x: 0, y: 0 }, 1)], [])).toEqual([])
  })

  it('starts an empty diagram at the origin, four tables per row', () => {
    const positions = gridPositions([], [100, 200, 100, 100, 50, 70])

    // The second row starts below the tallest table of the first (200) plus the 80 gap.
    expect(positions).toEqual([
      { x: 0, y: 0 },
      { x: 320, y: 0 },
      { x: 640, y: 0 },
      { x: 960, y: 0 },
      { x: 0, y: 280 },
      { x: 320, y: 280 },
    ])
  })

  it('places new tables below the existing ones, aligned with the leftmost', () => {
    const existing = [
      table('a', { x: 200, y: 0 }, 1, { style: { height: 300 } }),
      table('b', { x: 600, y: 100 }, 1, { style: { height: 100 } }),
    ]

    // Lowest bottom edge is 300 (a), plus the 80 gap.
    expect(gridPositions(existing, [100, 100])).toEqual([
      { x: 200, y: 380 },
      { x: 520, y: 380 },
    ])
  })

  it('estimates existing heights from the style, then the measured size, then the columns', () => {
    const top = (node: DiagramNode) => gridPositions([node], [100])[0]?.y

    const styled = table('a', { x: 0, y: 0 }, 5, {
      style: { height: 400 },
      measured: { height: 500 },
    })
    const measured = table('a', { x: 0, y: 0 }, 5, { measured: { height: 500 } })
    const estimated = table('a', { x: 0, y: 0 }, 5)

    expect(top(styled)).toBe(400 + 80)
    expect(top(measured)).toBe(500 + 80)
    expect(top(estimated)).toBe(tableHeight(5) + 80)
  })

  it('estimates nodes that are not tables as one column high', () => {
    const area: DiagramNode = { id: 'area', type: 'areaNode', position: { x: 0, y: 0 } }

    expect(gridPositions([area], [100])).toEqual([{ x: 0, y: tableHeight(1) + 80 }])
  })
})
