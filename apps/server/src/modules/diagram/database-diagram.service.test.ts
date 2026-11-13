import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  actorOf,
  createItem,
  createProject,
  createUser,
  migrateTestDb,
  resetTestDb,
} from '../../test/db'
import { getItemDocumentAccess, loadItemDocument } from '../item/document-store'
import { updateDatabaseSchema } from './database-diagram.service'

// Wraps the real check so a test can make one call answer as if the item were still editable.
vi.mock('../item/document-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../item/document-store')>()
  return { ...actual, getItemDocumentAccess: vi.fn(actual.getItemDocumentAccess) }
})

const SCHEMA = {
  tables: [
    {
      name: 'users',
      columns: [
        {
          name: 'id',
          type: 'bigint',
          primaryKey: true,
          nullable: false,
          unique: false,
          index: false,
        },
      ],
    },
  ],
  relations: [],
}

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('updateDatabaseSchema', () => {
  it('rejects a schema that cannot be applied as a bad request', async () => {
    const user = await createUser()
    const project = await createProject({ isForAllUsers: true })
    const item = await createItem(project.id)

    await expect(
      updateDatabaseSchema(
        item.id,
        { tables: [...SCHEMA.tables, ...SCHEMA.tables], relations: [] },
        'replace',
        actorOf(user),
      ),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Duplicate tables/) })
  })

  it('reports an error when the item is archived while the update runs', async () => {
    const user = await createUser()
    const project = await createProject({ isForAllUsers: true })
    // Archived already, but the access check before the write still sees it as editable,
    // as if the archive landed between that check and the save.
    const item = await createItem(project.id, { isArchived: true })
    const access = await getItemDocumentAccess(item.id, actorOf(user))
    vi.mocked(getItemDocumentAccess).mockResolvedValueOnce({ ...access, readOnly: false })

    await expect(
      updateDatabaseSchema(item.id, SCHEMA, 'replace', actorOf(user)),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/not saved/) })
    expect(await loadItemDocument(item.id)).toBeNull()
  })
})
