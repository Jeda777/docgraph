import { describe, expect, it } from 'vitest'
import { type DatabaseSchemaInput, databaseSchemaSchema } from '../schemas'
import { applyDatabaseSchema } from './database-diagram.apply'
import { toDatabaseSchema } from './database-diagram.mapper'
import type { DiagramDocument } from './database-diagram.model'

const schemaOf = (input: DatabaseSchemaInput) => databaseSchemaSchema.parse(input)

const BLOG = schemaOf({
  tables: [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'bigint', primaryKey: true },
        { name: 'email', type: 'varchar(255)', unique: true },
      ],
    },
    {
      name: 'posts',
      description: 'Blog posts',
      columns: [
        { name: 'id', type: 'bigint', primaryKey: true },
        { name: 'author_id', type: 'bigint' },
        { name: 'slug', type: 'varchar(100)' },
      ],
      indexes: [{ type: 'unique', columns: ['author_id', 'slug'] }],
    },
  ],
  relations: [
    {
      from: { table: 'users', column: 'id' },
      to: { table: 'posts', column: 'author_id' },
      onDelete: 'CASCADE',
    },
  ],
})

const EMPTY: DiagramDocument = { nodes: [], edges: [] }

describe('applyDatabaseSchema', () => {
  it('builds a diagram that reads back as the same schema', () => {
    const diagram = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    expect(diagram.nodes).toHaveLength(2)
    expect(diagram.edges).toHaveLength(1)
    expect(diagram.summary.tablesCreated).toEqual(['users', 'posts'])

    const schema = toDatabaseSchema(diagram)
    expect(schema.tables.map((table) => table.name)).toEqual(['users', 'posts'])
    expect(schema.tables[1]).toMatchObject({
      description: 'Blog posts',
      indexes: [{ type: 'unique', columns: ['author_id', 'slug'] }],
    })
    expect(schema.relations).toEqual([
      {
        from: { table: 'users', column: 'id' },
        to: { table: 'posts', column: 'author_id' },
        relation: 'one-to-many',
        nullable: false,
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      },
    ])
  })

  it('marks the referencing column as a foreign key unless told otherwise', () => {
    const { tables } = toDatabaseSchema(applyDatabaseSchema(EMPTY, BLOG, 'replace'))
    const posts = tables.find((table) => table.name === 'posts')

    expect(posts?.columns.find((column) => column.name === 'author_id')?.foreignKey).toBe(true)
    expect(posts?.columns.find((column) => column.name === 'slug')?.foreignKey).toBe(false)
  })

  it('keeps column defaults and auto-increment, leaving out empty defaults', () => {
    const schema = schemaOf({
      tables: [
        {
          name: 'jobs',
          columns: [
            { name: 'id', type: 'bigint', primaryKey: true, increment: true },
            { name: 'status', type: 'text', defaultValue: "'queued'" },
            { name: 'note', type: 'text', defaultValue: '' },
          ],
        },
      ],
    })

    const [jobs] = toDatabaseSchema(applyDatabaseSchema(EMPTY, schema, 'replace')).tables

    expect(jobs.columns[0]).toMatchObject({ increment: true })
    expect(jobs.columns[1]).toMatchObject({ defaultValue: "'queued'" })
    expect(jobs.columns[2]).not.toHaveProperty('defaultValue')
  })

  it('keeps check constraints and their ids, leaving out blank ones', () => {
    const schema = schemaOf({
      tables: [
        {
          name: 'items',
          columns: [{ name: 'price', type: 'int' }],
          checks: [
            { expression: 'price > 0', name: 'positive_price' },
            { expression: 'price < 1000' },
          ],
        },
      ],
    })

    const first = applyDatabaseSchema(EMPTY, schema, 'replace')
    const second = applyDatabaseSchema(first, schema, 'replace')
    const checksOf = (document: DiagramDocument) =>
      (document.nodes[0].data as { checks: { id: string }[] }).checks

    expect(toDatabaseSchema(second).tables[0].checks).toEqual([
      { expression: 'price > 0', name: 'positive_price' },
      { expression: 'price < 1000' },
    ])
    expect(checksOf(second).map((check) => check.id)).toEqual(
      checksOf(first).map((check) => check.id),
    )

    const blank = {
      ...first.nodes[0],
      data: { ...(first.nodes[0].data as object), checks: [{ id: 'x', expression: '  ' }] },
    }
    expect(toDatabaseSchema({ nodes: [blank], edges: [] }).tables[0]).not.toHaveProperty('checks')
  })

  it('keeps expression indexes and their ids, leaving out empty ones', () => {
    const schema = schemaOf({
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'bigint' },
            { name: 'email', type: 'text' },
          ],
          indexes: [
            { type: 'unique', expressions: ['lower(email)'] },
            { type: 'index', columns: ['id'], expressions: ['lower(email)'] },
          ],
        },
      ],
    })

    const first = applyDatabaseSchema(EMPTY, schema, 'replace')
    const second = applyDatabaseSchema(first, schema, 'replace')
    const constraintsOf = (document: DiagramDocument) =>
      (document.nodes[0].data as { constraints: { id: string }[] }).constraints

    expect(toDatabaseSchema(second).tables[0].indexes).toEqual([
      { type: 'unique', columns: [], expressions: ['lower(email)'] },
      { type: 'index', columns: ['id'], expressions: ['lower(email)'] },
    ])
    expect(constraintsOf(second).map((constraint) => constraint.id)).toEqual(
      constraintsOf(first).map((constraint) => constraint.id),
    )

    const empty = {
      ...first.nodes[0],
      data: {
        ...(first.nodes[0].data as object),
        constraints: [{ id: 'x', type: 'index', columns: [], expressions: [' '] }],
      },
    }
    expect(toDatabaseSchema({ nodes: [empty], edges: [] }).tables[0]).not.toHaveProperty('indexes')
  })

  it('rejects an index without columns or expressions', () => {
    expect(() =>
      schemaOf({
        tables: [{ name: 'users', columns: [], indexes: [{ type: 'index', columns: [] }] }],
      }),
    ).toThrow('An index needs at least one column or expression')
  })

  describe('enums', () => {
    const STATUS = {
      name: 'status',
      values: [{ name: 'draft', note: 'Not published yet' }, { name: 'published' }],
    }

    it('reads back the given enums and keeps their ids by name', () => {
      const schema = schemaOf({ tables: [], enums: [STATUS] })

      const first = applyDatabaseSchema(EMPTY, schema, 'replace')
      const second = applyDatabaseSchema(
        first,
        schemaOf({ tables: [], enums: [{ ...STATUS, values: [...STATUS.values, { name: 'x' }] }] }),
        'replace',
      )

      expect(toDatabaseSchema(first).enums).toEqual([STATUS])
      expect(second.enums?.[0].id).toBe(first.enums?.[0].id)
      expect(second.enums?.[0].values.slice(0, 2).map((value) => value.id)).toEqual(
        first.enums?.[0].values.map((value) => value.id),
      )
    })

    it('merge keeps enums that are not mentioned, replace removes them', () => {
      const first = applyDatabaseSchema(EMPTY, schemaOf({ tables: [], enums: [STATUS] }), 'replace')
      const role = { name: 'role', values: [{ name: 'admin' }] }

      const merged = applyDatabaseSchema(first, schemaOf({ tables: [], enums: [role] }), 'merge')
      const replaced = applyDatabaseSchema(
        first,
        schemaOf({ tables: [], enums: [role] }),
        'replace',
      )

      expect(toDatabaseSchema(merged).enums?.map((item) => item.name)).toEqual(['status', 'role'])
      expect(toDatabaseSchema(replaced).enums?.map((item) => item.name)).toEqual(['role'])
    })

    it('leaves out blank enums and values', () => {
      const schema = toDatabaseSchema({
        nodes: [],
        edges: [],
        enums: [
          { id: 'a', name: ' ', values: [{ id: 'a1', name: 'x' }] },
          { id: 'b', name: 'empty', values: [{ id: 'b1', name: ' ' }] },
          {
            id: 'c',
            name: 'kind',
            values: [
              { id: 'c1', name: '' },
              { id: 'c2', name: 'big' },
            ],
          },
        ],
      })

      expect(schema.enums).toEqual([{ name: 'kind', values: [{ name: 'big' }] }])
    })

    it('reports repeated enum and value names once, so the result can be applied back', () => {
      const schema = toDatabaseSchema({
        nodes: [],
        edges: [],
        enums: [
          {
            id: 'a',
            name: 'status',
            values: [
              { id: 'a1', name: 'on' },
              { id: 'a2', name: ' on ' },
            ],
          },
          { id: 'b', name: ' status', values: [{ id: 'b1', name: 'off' }] },
        ],
      })

      expect(schema.enums).toEqual([{ name: 'status', values: [{ name: 'on' }] }])
      expect(() => applyDatabaseSchema(EMPTY, schema, 'replace')).not.toThrow()
    })

    it('merge matches enums by their trimmed name and replaces repeated ones', () => {
      const current = {
        ...EMPTY,
        enums: [
          { id: 'a', name: ' status ', values: [{ id: 'a1', name: 'draft' }] },
          { id: 'b', name: 'status', values: [{ id: 'b1', name: 'old' }] },
          { id: 'c', name: 'role', values: [{ id: 'c1', name: 'admin' }] },
        ],
      }

      const merged = applyDatabaseSchema(
        current,
        schemaOf({ tables: [], enums: [STATUS] }),
        'merge',
      )

      expect(merged.enums?.map((item) => [item.id, item.name])).toEqual([
        ['a', 'status'],
        ['c', 'role'],
      ])
      expect(merged.enums?.[0].values[0].id).toBe('a1')
    })

    it('rejects duplicate enums and values', () => {
      const schema = schemaOf({
        tables: [],
        enums: [STATUS, { name: 'status', values: [{ name: 'a' }, { name: 'a' }] }],
      })

      expect(() => applyDatabaseSchema(EMPTY, schema, 'replace')).toThrow(
        'Duplicate enums: status\nDuplicate values in enum status: a',
      )
    })
  })

  it('keeps ids, positions and colors of tables matched by name', () => {
    const first = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    const moved = {
      ...first,
      nodes: first.nodes.map((node) => ({ ...node, position: { x: 999, y: 777 } })),
    }

    const second = applyDatabaseSchema(moved, BLOG, 'replace')

    expect(second.nodes.map((node) => node.id)).toEqual(first.nodes.map((node) => node.id))
    expect(second.nodes.every((node) => node.position.x === 999)).toBe(true)
    expect(second.edges[0].id).toBe(first.edges[0].id)
    expect(second.summary.tablesUpdated).toEqual(['users', 'posts'])
  })

  it('merge keeps tables and relations that are not mentioned', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    const baseIds = new Set(base.nodes.map((node) => node.id))

    const merged = applyDatabaseSchema(
      base,
      schemaOf({ tables: [{ name: 'tags', columns: [{ name: 'id', type: 'int' }] }] }),
      'merge',
    )

    expect(toDatabaseSchema(merged).tables.map((table) => table.name)).toEqual([
      'users',
      'posts',
      'tags',
    ])
    expect(merged.edges).toHaveLength(1)
    // New tables are placed below the existing ones, not on top of them.
    const tags = merged.nodes.find((node) => !baseIds.has(node.id))
    expect(tags?.position.y).toBeGreaterThan(Math.max(...base.nodes.map((node) => node.position.y)))
  })

  it('replace removes tables that are not mentioned, with their relations', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    const replaced = applyDatabaseSchema(base, schemaOf({ tables: [BLOG.tables[0]] }), 'replace')

    expect(replaced.nodes).toHaveLength(1)
    expect(replaced.edges).toHaveLength(0)
    expect(replaced.summary.tablesRemoved).toEqual(['posts'])
  })

  it('merge drops relations whose column was removed from a redefined table', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    const merged = applyDatabaseSchema(
      base,
      schemaOf({ tables: [{ name: 'posts', columns: [{ name: 'id', type: 'bigint' }] }] }),
      'merge',
    )

    expect(merged.edges).toHaveLength(0)
  })

  it('merge flags a column of an untouched table that a new relation points at', () => {
    const base = applyDatabaseSchema(
      EMPTY,
      schemaOf({ tables: BLOG.tables.map((table) => ({ ...table, indexes: [] })) }),
      'replace',
    )

    const merged = applyDatabaseSchema(
      base,
      schemaOf({ tables: [BLOG.tables[0]], relations: BLOG.relations }),
      'merge',
    )

    const posts = toDatabaseSchema(merged).tables.find((table) => table.name === 'posts')
    expect(posts?.columns.find((column) => column.name === 'author_id')?.foreignKey).toBe(true)
    expect(posts?.columns.find((column) => column.name === 'slug')?.foreignKey).toBe(false)
    // The input diagram is not mutated.
    expect(toDatabaseSchema(base).tables[1].columns[1].foreignKey).toBe(false)
  })

  it('rejects redefining a table whose name several nodes share', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    const twin = { ...base.nodes[0], id: 'twin' }
    const duplicated = { ...base, nodes: [...base.nodes, twin] }

    for (const mode of ['replace', 'merge'] as const) {
      expect(() =>
        applyDatabaseSchema(duplicated, schemaOf({ tables: [BLOG.tables[0]] }), mode),
      ).toThrow(/several tables named users/)
    }
  })

  it('merge leaves duplicate tables alone but rejects relations to them', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    const duplicated = { ...base, nodes: [...base.nodes, { ...base.nodes[0], id: 'twin' }] }
    const tags = schemaOf({ tables: [{ name: 'tags', columns: [{ name: 'id', type: 'int' }] }] })

    expect(applyDatabaseSchema(duplicated, tags, 'merge').nodes).toHaveLength(4)
    expect(() =>
      applyDatabaseSchema(
        duplicated,
        schemaOf({
          ...tags,
          relations: [
            { from: { table: 'users', column: 'id' }, to: { table: 'tags', column: 'id' } },
          ],
        }),
        'merge',
      ),
    ).toThrow(/ambiguous/)
  })

  it('rejects relations to unknown columns', () => {
    const schema = schemaOf({
      tables: BLOG.tables,
      relations: [{ from: { table: 'users', column: 'id' }, to: { table: 'nope', column: 'x' } }],
    })

    expect(() => applyDatabaseSchema(EMPTY, schema, 'replace')).toThrow(
      /unknown or ambiguous tables or columns/,
    )
  })

  it('rejects duplicate tables and columns', () => {
    const schema = schemaOf({
      tables: [
        {
          name: 'a',
          columns: [
            { name: 'id', type: 'int' },
            { name: 'id', type: 'int' },
          ],
        },
        { name: 'a', columns: [] },
      ],
    })

    expect(() => applyDatabaseSchema(EMPTY, schema, 'replace')).toThrow(
      /Duplicate tables: a\nDuplicate columns in a: id/,
    )
  })
})

const tableNamed = (name: string, columns = 1) => ({
  name,
  columns: Array.from({ length: columns }, (_, i) => ({ name: `c${i}`, type: 'int' })),
})

const NOTE: DiagramDocument['nodes'][number] = {
  id: 'note',
  type: 'stickyNote',
  position: { x: 50, y: 20 },
  style: { height: 100 },
  data: { text: 'Not a table' },
}

describe('applyDatabaseSchema automatic layout', () => {
  it('starts an empty diagram at the origin and wraps after four tables per row', () => {
    const diagram = applyDatabaseSchema(
      EMPTY,
      schemaOf({
        tables: [
          tableNamed('t1'),
          tableNamed('t2', 3),
          tableNamed('t3'),
          tableNamed('t4'),
          tableNamed('t5'),
          tableNamed('t6'),
        ],
      }),
      'replace',
    )

    // Row height is the tallest table of the row (60 + 3 * 32) plus the 80px gap.
    expect(diagram.nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 0 },
      { x: 320, y: 0 },
      { x: 640, y: 0 },
      { x: 960, y: 0 },
      { x: 0, y: 236 },
      { x: 320, y: 236 },
    ])
  })

  it('places new tables below existing ones, aligned with the leftmost table', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    base.nodes[0].position = { x: 200, y: 0 }
    base.nodes[1].position = { x: 600, y: 300 }

    const merged = applyDatabaseSchema(base, schemaOf({ tables: [tableNamed('tags')] }), 'merge')

    // posts (3 columns) ends lowest: 300 + 60 + 3 * 32 = 456.
    expect(merged.nodes[2].position).toEqual({ x: 200, y: 536 })
  })

  it('prefers the editor size over the estimated height of existing tables', () => {
    const base = applyDatabaseSchema(EMPTY, schemaOf({ tables: [tableNamed('a')] }), 'replace')
    const tags = schemaOf({ tables: [tableNamed('tags')] })

    const styled = applyDatabaseSchema(
      { ...base, nodes: [{ ...base.nodes[0], style: { height: 500 } }] },
      tags,
      'merge',
    )
    const measured = applyDatabaseSchema(
      { ...base, nodes: [{ ...base.nodes[0], measured: { width: 280, height: 300 } }] },
      tags,
      'merge',
    )

    expect(styled.nodes[1].position.y).toBe(580)
    expect(measured.nodes[1].position.y).toBe(380)
  })

  it('replace ignores removed tables when placing new ones but not other nodes', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    base.nodes = base.nodes.map((node) => ({ ...node, position: { x: 0, y: 1000 } }))

    const replaced = applyDatabaseSchema(
      base,
      schemaOf({ tables: [tableNamed('tags')] }),
      'replace',
    )
    const withNote = applyDatabaseSchema(
      { ...base, nodes: [...base.nodes, NOTE] },
      schemaOf({ tables: [tableNamed('tags')] }),
      'replace',
    )

    expect(replaced.nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(withNote.nodes.map((node) => node.id)).toEqual(['note', withNote.nodes[1].id])
    expect(withNote.nodes[1].position).toEqual({ x: 50, y: 200 })
  })

  it('does not move redefined tables', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    base.nodes[1].position = { x: 640, y: 480 }

    const merged = applyDatabaseSchema(base, schemaOf({ tables: [BLOG.tables[1]] }), 'merge')

    expect(merged.nodes[1].position).toEqual({ x: 640, y: 480 })
  })
})

describe('applyDatabaseSchema merge / replace edge cases', () => {
  it('merge with an empty schema changes nothing', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    const merged = applyDatabaseSchema(base, schemaOf({ tables: [] }), 'merge')

    expect(merged.nodes).toEqual(base.nodes)
    expect(merged.edges).toEqual(base.edges)
    expect(merged.summary).toEqual({
      tablesCreated: [],
      tablesUpdated: [],
      tablesRemoved: [],
      relations: 1,
    })
  })

  it('replace with an empty schema removes all tables but keeps other nodes', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    const replaced = applyDatabaseSchema(
      { ...base, nodes: [...base.nodes, NOTE] },
      schemaOf({ tables: [] }),
      'replace',
    )

    expect(replaced.nodes).toEqual([NOTE])
    expect(replaced.edges).toEqual([])
    expect(replaced.summary.tablesRemoved).toEqual(['users', 'posts'])
  })

  it('replace drops relations that are not given and clears derived foreign keys', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    const replaced = applyDatabaseSchema(base, schemaOf({ tables: BLOG.tables }), 'replace')

    expect(replaced.edges).toEqual([])
    expect(replaced.summary.relations).toBe(0)
    const posts = toDatabaseSchema(replaced).tables[1]
    expect(posts.columns.find((column) => column.name === 'author_id')?.foreignKey).toBe(false)
  })

  it('merge updates a given relation in place and keeps its id', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')

    const merged = applyDatabaseSchema(
      base,
      schemaOf({
        tables: [],
        relations: [{ ...BLOG.relations[0], onDelete: 'SET NULL', nullable: true }],
      }),
      'merge',
    )

    expect(merged.edges).toHaveLength(1)
    expect(merged.edges[0]).toMatchObject({
      id: base.edges[0].id,
      sourceHandle: base.edges[0].sourceHandle,
      targetHandle: base.edges[0].targetHandle,
      data: { onDelete: 'SET NULL', nullable: true },
    })
  })

  it('merge keeps column ids by name, gives new columns new ids and drops removed ones', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    const before = new Map(
      (base.nodes[1].data as { values: { id: string; name: string }[] }).values.map((value) => [
        value.name,
        value.id,
      ]),
    )

    const merged = applyDatabaseSchema(
      base,
      schemaOf({
        tables: [
          {
            name: 'posts',
            columns: [
              { name: 'id', type: 'bigint', primaryKey: true },
              { name: 'author_id', type: 'bigint' },
              { name: 'title', type: 'text' },
            ],
          },
        ],
      }),
      'merge',
    )

    const values = (merged.nodes[1].data as { values: { id: string; name: string }[] }).values
    expect(values.map((value) => value.name)).toEqual(['id', 'author_id', 'title'])
    expect(values[0].id).toBe(before.get('id'))
    expect(values[1].id).toBe(before.get('author_id'))
    expect([...before.values()]).not.toContain(values[2].id)
    // The relation still points at author_id, which kept its id.
    expect(merged.edges).toHaveLength(1)
    // The unique index on (author_id, slug) is gone because it was not given again.
    expect(toDatabaseSchema(merged).tables[1]).not.toHaveProperty('indexes')
  })

  it('keeps color and description unless given, and an empty description clears it', () => {
    const base = applyDatabaseSchema(EMPTY, BLOG, 'replace')
    const color = toDatabaseSchema(base).tables[1].color

    const kept = applyDatabaseSchema(
      base,
      schemaOf({ tables: [{ ...BLOG.tables[1], description: undefined }] }),
      'merge',
    )
    const cleared = applyDatabaseSchema(
      base,
      schemaOf({ tables: [{ ...BLOG.tables[1], description: '', color: 'stone' }] }),
      'merge',
    )

    expect(toDatabaseSchema(kept).tables[1]).toMatchObject({ description: 'Blog posts', color })
    expect(toDatabaseSchema(cleared).tables[1]).not.toHaveProperty('description')
    expect(toDatabaseSchema(cleared).tables[1].color).toBe('stone')
  })

  it('an explicit foreignKey false wins over a relation pointing at the column', () => {
    const schema = schemaOf({
      tables: [
        BLOG.tables[0],
        {
          ...BLOG.tables[1],
          columns: BLOG.tables[1].columns.map((column) =>
            column.name === 'author_id' ? { ...column, foreignKey: false } : column,
          ),
        },
      ],
      relations: BLOG.relations,
    })

    const posts = toDatabaseSchema(applyDatabaseSchema(EMPTY, schema, 'replace')).tables[1]

    expect(posts.columns.find((column) => column.name === 'author_id')?.foreignKey).toBe(false)
  })
})
