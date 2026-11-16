import { applyDatabaseSchema, toDatabaseSchema } from '@docgraph/common/diagram'
import { type DatabaseSchemaInput, databaseSchemaSchema } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import { toDbml } from './dbml-export.helpers'
import { parseDbml } from './dbml-import.helpers'

const parse = (source: string) => {
  const result = parseDbml(source)
  if (!result.ok) throw new Error(result.error)
  return result.schema
}

describe('parseDbml', () => {
  it('reads tables, columns, indexes and notes', () => {
    const schema = parse(`
      Table auth.users [headercolor: #3B82F6, note: 'People'] {
        id bigint [pk, increment]
        email "varchar(255)" [unique, not null, note: 'Login']
        balance "int unsigned" [not null]
        nickname text
        a int
        b int

        indexes {
          (a, b) [unique]
          nickname
          a [unique]
          \`lower(email)\`
        }
      }
    `)

    expect(schema.tables).toEqual([
      {
        name: 'auth.users',
        description: 'People',
        color: 'blue',
        columns: [
          expect.objectContaining({
            name: 'id',
            type: 'bigint',
            primaryKey: true,
            nullable: false,
          }),
          expect.objectContaining({
            name: 'email',
            type: 'varchar(255)',
            unique: true,
            nullable: false,
            description: 'Login',
          }),
          expect.objectContaining({ name: 'balance', type: 'int', unsigned: true }),
          expect.objectContaining({ name: 'nickname', nullable: true, index: true }),
          expect.objectContaining({ name: 'a', unique: true }),
          expect.objectContaining({ name: 'b', unique: false, index: false }),
        ],
        indexes: [{ type: 'unique', columns: ['a', 'b'] }],
      },
    ])
  })

  it('adds the columns, indexes and color of table partials where they are injected', () => {
    const [table] = parse(`
      TablePartial timestamps [headercolor: #ef4444] {
        id int [pk]
        created_at timestamp
        indexes {
          created_at
        }
      }
      Table users {
        name text
        ~timestamps
        created_at date
      }
    `).tables

    expect(table.color).toBe('red')
    expect(table.columns.map((column) => [column.name, column.type])).toEqual([
      ['name', 'text'],
      ['id', 'int'],
      ['created_at', 'date'],
    ])
    expect(table.columns[1].primaryKey).toBe(true)
    expect(table.columns[2].index).toBe(true)
  })

  it('keeps the references written in table partial columns', () => {
    const schema = parse(`
      TablePartial audit {
        created_by int [not null, ref: > users.id]
      }
      Table users {
        id int [pk]
      }
      Table posts {
        id int [pk]
        ~audit
      }
    `)

    expect(schema.relations).toEqual([
      expect.objectContaining({
        from: { table: 'users', column: 'id' },
        to: { table: 'posts', column: 'created_by' },
        relation: 'one-to-many',
        nullable: false,
      }),
    ])
    expect(schema.tables[1].columns[1]).toMatchObject({ name: 'created_by', foreignKey: true })
  })

  it('points same-table partial refs at the table and skips refs written twice', () => {
    const schema = parse(`
      TablePartial tree {
        id int [pk]
        parent_id int [ref: > id]
        owner_id int [ref: > users.id]
      }
      Table users {
        id int [pk]
      }
      Table folders {
        ~tree
      }
      Ref: folders.owner_id > users.id
    `)

    expect(schema.relations.map(({ from, to }) => [from, to])).toEqual([
      [
        { table: 'folders', column: 'owner_id' },
        { table: 'users', column: 'id' },
      ],
      [
        { table: 'folders', column: 'id' },
        { table: 'folders', column: 'parent_id' },
      ],
    ])
  })

  it('drops the default schema from table names', () => {
    expect(parse('Table public.users {\n  id int\n}').tables[0].name).toBe('users')
  })

  it('marks the columns of a composite primary key', () => {
    const [table] = parse(`
      Table memberships {
        user_id int
        group_id int
        indexes {
          (user_id, group_id) [pk]
        }
      }
    `).tables

    expect(table.columns.every((column) => column.primaryKey && !column.nullable)).toBe(true)
  })

  it('reads relations in their written direction and marks the foreign keys', () => {
    const schema = parse(`
      Table users {
        id int [pk]
      }
      Table posts {
        id int [pk]
        author_id int [ref: > users.id]
        editor_id int [not null]
      }
      Table profiles {
        user_id int [not null]
      }
      Ref: posts.editor_id > users.id [delete: cascade, update: set null]
      Ref: users.id - profiles.user_id
    `)

    expect(schema.relations).toEqual([
      expect.objectContaining({
        from: { table: 'users', column: 'id' },
        to: { table: 'posts', column: 'author_id' },
        relation: 'one-to-many',
        nullable: true,
      }),
      {
        from: { table: 'posts', column: 'editor_id' },
        to: { table: 'users', column: 'id' },
        relation: 'many-to-one',
        nullable: false,
        onDelete: 'CASCADE',
        onUpdate: 'SET NULL',
      },
      expect.objectContaining({
        from: { table: 'users', column: 'id' },
        to: { table: 'profiles', column: 'user_id' },
        relation: 'one-to-one',
      }),
    ])

    const foreignKeys = schema.tables.flatMap((table) =>
      table.columns.filter((column) => column.foreignKey).map((c) => `${table.name}.${c.name}`),
    )
    expect(foreignKeys).toEqual(['posts.author_id', 'posts.editor_id', 'profiles.user_id'])
  })

  it('splits a composite reference into one relation per column pair', () => {
    const schema = parse(`
      Table a {
        x int
        y int
      }
      Table b {
        x int
        y int
      }
      Ref: a.(x, y) <> b.(x, y)
    `)

    expect(schema.relations.map(({ from, to, relation }) => [from, to, relation])).toEqual([
      [{ table: 'a', column: 'x' }, { table: 'b', column: 'x' }, 'many-to-many'],
      [{ table: 'a', column: 'y' }, { table: 'b', column: 'y' }, 'many-to-many'],
    ])
    expect(schema.tables.flatMap((table) => table.columns).some((c) => c.foreignKey)).toBe(false)
  })

  it('reports syntax and reference errors with their line', () => {
    const result = parseDbml('Table users {\n  id int\n}\nRef: users.id > posts.id\n')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/^Line 4: /)
  })

  it('round-trips a schema through its DBML export', () => {
    const input: DatabaseSchemaInput = {
      tables: [
        {
          name: 'users',
          color: 'emerald',
          description: "Line one\nIt's line two",
          columns: [
            { name: 'id', type: 'bigint', primaryKey: true, foreignKey: false },
            { name: 'note', type: 'decimal(10,2)', unsigned: true, foreignKey: false },
          ],
        },
        {
          name: 'posts',
          color: 'rose',
          columns: [
            { name: 'id', type: 'bigint', primaryKey: true, foreignKey: false },
            { name: 'author id', type: 'bigint', nullable: true, foreignKey: true, index: true },
            { name: 'slug', type: 'varchar(100)', unique: true, foreignKey: false },
          ],
          indexes: [{ type: 'index', columns: ['author id', 'slug'] }],
        },
      ],
      relations: [
        {
          from: { table: 'users', column: 'id' },
          to: { table: 'posts', column: 'author id' },
          nullable: true,
          onDelete: 'CASCADE',
        },
      ],
    }
    const schema = databaseSchemaSchema.parse(input)

    expect(parse(toDbml(schema))).toEqual(schema)
  })

  it('keeps the layout of tables matched by name when applied to the diagram', () => {
    const before = applyDatabaseSchema(
      { nodes: [], edges: [] },
      parse('Table users {\n  id int [pk]\n}'),
      'replace',
    )
    const moved = { ...before.nodes[0], position: { x: 500, y: 300 } }

    const after = applyDatabaseSchema(
      { nodes: [moved], edges: [] },
      parse(
        `${toDbml(toDatabaseSchema({ nodes: [moved], edges: [] }))}\nTable tags {\n  id int\n}`,
      ),
      'replace',
    )

    expect(after.nodes[0]).toMatchObject({ id: moved.id, position: { x: 500, y: 300 } })
    expect(after.nodes.map((node) => (node.data as { name: string }).name)).toEqual([
      'users',
      'tags',
    ])
  })
})
