import { describe, expect, it } from 'vitest'
import { fitAreaRect, tableGroupsOf } from './database-diagram.groups'
import type { DiagramNode } from './database-diagram.model'
import { AREA_NODE_MIN_SIZE } from './diagram-defaults'

const table = (id: string, x: number, y: number): DiagramNode => ({
  id,
  position: { x, y },
  measured: { width: 200, height: 100 },
  data: { name: id, color: 'blue', values: [] },
})

const area = (id: string, x: number, y: number, width: number, height: number): DiagramNode => ({
  id,
  position: { x, y },
  style: { width, height },
  data: { name: id, color: '#3b82f6', alpha: 0.1, order: 0 },
})

const membersOf = (nodes: DiagramNode[], areas: DiagramNode[]) =>
  tableGroupsOf(nodes, areas).map((group) => [group.area.id, group.tables.map((node) => node.id)])

describe('tableGroupsOf', () => {
  it('puts a table in the area that contains its center', () => {
    const nodes = [table('users', 0, 0), table('posts', 150, 0), table('tags', 1000, 0)]

    // posts overlaps the area, but its center (250, 50) is outside
    expect(membersOf(nodes, [area('auth', -20, -20, 260, 200)])).toEqual([['auth', ['users']]])
  })

  it('picks the smallest of overlapping areas and skips areas without tables', () => {
    const nodes = [table('users', 0, 0), table('posts', 400, 0)]
    const areas = [
      area('empty', 2000, 0, 300, 300),
      area('all', -50, -50, 800, 300),
      area('auth', -20, -20, 260, 200),
    ]

    expect(membersOf(nodes, areas)).toEqual([
      ['all', ['posts']],
      ['auth', ['users']],
    ])
  })

  it('ignores nodes that are not tables or areas', () => {
    const note = { id: 'note', position: { x: 0, y: 0 }, data: { label: 'note' } }

    expect(membersOf([note, table('users', 0, 0)], [note, area('auth', 0, 0, 300, 200)])).toEqual([
      ['auth', ['users']],
    ])
  })
})

describe('fitAreaRect', () => {
  it('wraps the tables with padding and room for the name', () => {
    const rect = fitAreaRect([table('users', 0, 0), table('posts', 300, 200)])

    expect(rect.x).toBeLessThan(0)
    expect(rect.y).toBeLessThan(0)
    expect(rect.x + rect.width).toBeGreaterThan(500)
    expect(rect.y + rect.height).toBeGreaterThan(300)
    // the name sits above the tables, so the top margin is larger than the others
    expect(-rect.y).toBeGreaterThan(-rect.x)
  })

  it('is never smaller than the editor allows', () => {
    const tiny = { ...table('t', 0, 0), measured: { width: 10, height: 10 } }

    expect(fitAreaRect([tiny])).toMatchObject(AREA_NODE_MIN_SIZE)
  })
})
