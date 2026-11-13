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
