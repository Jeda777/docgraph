import { eq, type InferInsertModel } from 'drizzle-orm'
import { createRepo, type DbOrTx, db, items } from '../../db'
import { InternalServerErrorException, NotFoundException } from '../../errors'

/** Item columns without `document` (the CRDT blob is only handled by hocuspocus). */
const itemColumns = {
  id: items.id,
  name: items.name,
  projectId: items.projectId,
  type: items.type,
  createdAt: items.createdAt,
  updatedAt: items.updatedAt,
  isArchived: items.isArchived,
}

export const itemNotFound = (id: string) =>
  new NotFoundException('NOT_FOUND', `Item with id ${id} not found`)

export const itemRepository = {
  ...createRepo(items),

  /** The one read shape used everywhere outside the CRDT handler. */
  async getByIdWithoutDocument(id: string, tx: DbOrTx = db) {
    const [row] = await tx.select(itemColumns).from(items).where(eq(items.id, id))
    if (!row) throw itemNotFound(id)
    return row
  },

  async findAllByProjectId(projectId: string, tx: DbOrTx = db) {
    return tx.select(itemColumns).from(items).where(eq(items.projectId, projectId))
  },

  // `create`, `update` and `delete` override the generic ones so `RETURNING` skips the CRDT
  // blob — documents are saved about once per second and would otherwise be read back, and
  // the rows they return go straight into API responses, which never carry the document.
  async create(values: InferInsertModel<typeof items>, tx: DbOrTx = db) {
    const [row] = await tx.insert(items).values(values).returning(itemColumns)
    if (!row)
      throw new InternalServerErrorException('INTERNAL_SERVER_ERROR', 'Failed to create item')
    return row
  },

  async update(id: string, values: Partial<InferInsertModel<typeof items>>, tx: DbOrTx = db) {
    const [row] = await tx.update(items).set(values).where(eq(items.id, id)).returning(itemColumns)
    if (!row) throw itemNotFound(id)
    return row
  },

  async delete(id: string, tx: DbOrTx = db) {
    const [row] = await tx.delete(items).where(eq(items.id, id)).returning(itemColumns)
    if (!row) throw itemNotFound(id)
    return row
  },
}
