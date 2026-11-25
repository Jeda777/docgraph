import { type DatabaseSchemaInput, databaseSchemaSchema } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import { toDbml } from './dbml-export.helpers'

const schemaOf = (input: DatabaseSchemaInput) => databaseSchemaSchema.parse(input)

describe('toDbml', () => {
  it('writes tables, column settings, indexes and notes', () => {
    const dbml = toDbml(
      schemaOf({
        tables: [
          {
            name: 'posts',
            color: 'blue',
            description: 'Blog posts',
            columns: [
              { name: 'id', type: 'bigint', primaryKey: true },
              { name: 'author_id', type: 'bigint', index: true },
              { name: 'slug', type: 'varchar(100)', unique: true },
              { name: 'views', type: 'int', unsigned: true, nullable: true },
              { name: 'body', type: 'text', nullable: true, description: "It's markdown" },
            ],
            indexes: [{ type: 'unique', columns: ['author_id', 'slug'] }],
          },
        ],
      }),
    )

    expect(dbml).toBe(`Table posts [headercolor: #3b82f6] {
  id bigint [pk]
  author_id bigint [not null]
  slug varchar(100) [unique, not null]
  views "int unsigned"
  body text [note: 'It\\'s markdown']

  indexes {
    author_id
    (author_id, slug) [unique]
  }

  Note: 'Blog posts'
}
`)
  })

  it('writes auto-increment and each kind of default', () => {
    const dbml = toDbml(
      schemaOf({
        tables: [
          {
            name: 'jobs',
            columns: [
              { name: 'id', type: 'bigint', primaryKey: true, increment: true },
              { name: 'attempts', type: 'int', defaultValue: '0' },
              { name: 'ratio', type: 'decimal', defaultValue: '1.50' },
              { name: 'done', type: 'boolean', defaultValue: 'FALSE' },
              { name: 'status', type: 'text', defaultValue: "'it''s queued'" },
              { name: 'created_at', type: 'timestamp', defaultValue: 'now()' },
              { name: 'quoted', type: 'text', defaultValue: '`x`' },
              { name: 'blank', type: 'text', defaultValue: '  ' },
            ],
          },
        ],
      }),
    )

    expect(dbml).toContain('  id bigint [pk, increment]')
    expect(dbml).toContain('  attempts int [not null, default: 0]')
    expect(dbml).toContain('  ratio decimal [not null, default: `1.50`]')
    expect(dbml).toContain('  done boolean [not null, default: false]')
    expect(dbml).toContain("  status text [not null, default: 'it\\'s queued']")
    expect(dbml).toContain('  created_at timestamp [not null, default: `now()`]')
    expect(dbml).toContain('  quoted text [not null]')
    expect(dbml).toContain('  blank text [not null]')
  })

  it('writes checks after the indexes, leaving out expressions with a backtick', () => {
    const dbml = toDbml(
      schemaOf({
        tables: [
          {
            name: 'items',
            description: 'Stock',
            columns: [{ name: 'price', type: 'int', index: true }],
            checks: [
              { expression: 'price > 0', name: "it's positive" },
              { expression: 'price < 1000' },
              { expression: '`price` > 1' },
            ],
          },
        ],
      }),
    )

    expect(dbml).toBe(`Table items {
  price int [not null]

  indexes {
    price
  }

  checks {
    \`price > 0\` [name: 'it\\'s positive']
    \`price < 1000\`
  }

  Note: 'Stock'
}
`)
  })

  it('writes expression indexes after their columns, leaving out ones with a backtick', () => {
    const dbml = toDbml(
      schemaOf({
        tables: [
          {
            name: 'users',
            columns: [{ name: 'email', type: 'text' }],
            indexes: [
              { type: 'unique', expressions: ['lower(email)'] },
              { type: 'index', columns: ['email'], expressions: ['length(email)'] },
              { type: 'index', columns: ['email'], expressions: ['`email`'] },
            ],
          },
        ],
      }),
    )

    expect(dbml).toContain(`  indexes {
    \`lower(email)\` [unique]
    (email, \`length(email)\`)
  }`)
  })

  it('writes enums before the tables, quoting values that are not identifiers', () => {
    const dbml = toDbml(
      schemaOf({
        enums: [
          {
            name: 'auth.status',
            values: [{ name: 'active', note: 'Can sign in' }, { name: 'on hold' }],
          },
        ],
        tables: [{ name: 'users', columns: [{ name: 'status', type: 'auth.status' }] }],
      }),
    )

    expect(dbml).toContain(`Enum auth.status {
  active [note: 'Can sign in']
  "on hold"
}

Table users {
  status auth.status [not null]`)
  })

  it('writes each relation with its operator and referential actions', () => {
    const table = (name: string) => ({ name, columns: [{ name: 'id', type: 'int' }] })
    const dbml = toDbml(
      schemaOf({
        tables: ['a', 'b'].map(table),
        relations: [
          {
            from: { table: 'a', column: 'id' },
            to: { table: 'b', column: 'id' },
            onDelete: 'CASCADE',
            onUpdate: 'SET NULL',
          },
        ],
      }),
    )

    expect(dbml).toContain('Ref: a.id < b.id [delete: cascade, update: set null]')
  })

  it('quotes names and types DBML cannot read bare, and escapes them', () => {
    const dbml = toDbml(
      schemaOf({
        tables: [
          {
            name: 'order items',
            columns: [
              { name: 'note', type: 'text' },
              { name: 'say "hi"', type: 'timestamp with time zone' },
            ],
          },
        ],
      }),
    )

    expect(dbml).toContain('Table "order items" {')
    expect(dbml).toContain('  "note" text [not null]')
    expect(dbml).toContain('  "say \\"hi\\"" "timestamp with time zone" [not null]')
  })

  it('leaves out tables without columns and repeated relations', () => {
    const dbml = toDbml(
      schemaOf({
        tables: [
          { name: 'empty', columns: [] },
          { name: 'a', columns: [{ name: 'id', type: 'int' }] },
          { name: 'b', columns: [{ name: 'a_id', type: 'int' }] },
        ],
        relations: [
          { from: { table: 'a', column: 'id' }, to: { table: 'b', column: 'a_id' } },
          {
            from: { table: 'b', column: 'a_id' },
            to: { table: 'a', column: 'id' },
            relation: 'many-to-one',
          },
        ],
      }),
    )

    expect(dbml).toContain('// Tables without columns, left out: empty')
    expect(dbml).not.toContain('Table empty')
    expect(dbml.match(/^Ref:/gm)).toHaveLength(1)
  })
})
