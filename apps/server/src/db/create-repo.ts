import { eq, getTableName, type InferInsertModel, type InferSelectModel } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { InternalServerErrorException, NotFoundException } from '../errors'
import { type DbOrTx, db } from './client'

export const createRepo = <T extends PgTable & { id: PgColumn }>(table: T) => {
  type Row = InferSelectModel<T>
  type New = InferInsertModel<T>
  type Id = T['id']['_']['data']

  const name = getTableName(table)
  const t = table as PgTable

  return {
    async findById(id: Id, tx: DbOrTx = db): Promise<Row | undefined> {
      const [row] = await tx.select().from(t).where(eq(table.id, id)).limit(1)
      return row as Row | undefined
    },
    async getByIdOrThrow(id: Id, tx: DbOrTx = db): Promise<Row> {
      const row = await this.findById(id, tx)
      if (!row) throw new NotFoundException('NOT_FOUND', `${name} with id ${id} not found`)
      return row
    },
    async create(values: New, tx: DbOrTx = db): Promise<Row> {
      const [row] = (await tx.insert(t).values(values).returning()) as Row[]
      if (!row)
        throw new InternalServerErrorException('INTERNAL_SERVER_ERROR', `Failed to create ${name}`)
      return row
    },
    async update(id: Id, values: Partial<New>, tx: DbOrTx = db): Promise<Row> {
      const [row] = (await tx
        .update(t)
        .set(values as never)
        .where(eq(table.id, id))
        .returning()) as Row[]
      if (!row) throw new NotFoundException('NOT_FOUND', `${name} with id ${id} not found`)
      return row
    },
    async delete(id: Id, tx: DbOrTx = db): Promise<Row> {
      const [row] = (await tx.delete(t).where(eq(table.id, id)).returning()) as Row[]
      if (!row) throw new NotFoundException('NOT_FOUND', `${name} with id ${id} not found`)
      return row
    },
  }
}
