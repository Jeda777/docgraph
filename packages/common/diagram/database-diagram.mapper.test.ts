import { describe, expect, it } from 'vitest'
import { toDatabaseSchema } from './database-diagram.mapper'

describe('toDatabaseSchema', () => {
  it('skips nodes and edges it cannot describe', () => {
    const schema = toDatabaseSchema({
      nodes: [{ id: 'x', position: { x: 0, y: 0 }, data: { label: 'not a table' } }],
      edges: [{ id: 'e', source: 'x', sourceHandle: 'a-b', target: 'y', targetHandle: 'b-a' }],
    })

    expect(schema).toEqual({ tables: [], relations: [] })
  })

  it('reads areas around tables as groups, each table and name once', () => {
    const table = (id: string, x: number) => ({
      id,
      position: { x, y: 0 },
      measured: { width: 200, height: 100 },
      data: { name: id === 'copy' ? 'users' : id, color: 'blue', values: [] },
    })
    const area = (id: string, name: string, x: number, color = '#3b82f6') => ({
      id,
      position: { x: x - 20, y: -40 },
      style: { width: 400, height: 200 },
      data: { name, color, alpha: 0.1, order: 0 },
    })

    const schema = toDatabaseSchema({
      nodes: [table('users', 0), table('copy', 100), table('posts', 1000), table('tags', 2000)],
      edges: [],
      areas: [
        area('a1', ' auth ', 0, '#ff0000'),
        area('a2', 'content', 1000),
        area('a3', 'auth', 2000),
        area('a4', 'empty', 5000),
      ],
    })

    expect(schema.groups).toEqual([
      { name: 'auth', tables: ['users'], color: '#ff0000' },
      { name: 'content', tables: ['posts'], color: '#3b82f6' },
    ])
  })
})
