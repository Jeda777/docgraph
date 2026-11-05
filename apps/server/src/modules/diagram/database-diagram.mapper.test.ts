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
})
