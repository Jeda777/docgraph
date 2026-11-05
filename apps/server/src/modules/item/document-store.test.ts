import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, items, projects } from '../../db'
import {
  actorOf,
  addMember,
  createItem,
  createProject,
  createUser,
  MISSING_ID,
  migrateTestDb,
  openTransaction,
  resetTestDb,
  waitForLockWaits,
} from '../../test/db'
import {
  getItemDocumentAccess,
  isItemReadOnly,
  loadItemDocument,
  saveItemDocument,
} from './document-store'

/** Structural shape of errors thrown by services, for assertions. */
type ExpectedError = { status: number; message: string }

const captureError = async (promise: Promise<unknown>): Promise<ExpectedError> =>
  promise.then(
    () => {
      throw new Error('Expected the promise to reject')
    },
    (error) => error as ExpectedError,
  )

const storedDocument = async (itemId: string): Promise<Uint8Array | null> => {
  const [row] = await db
    .select({ document: items.document })
    .from(items)
    .where(eq(items.id, itemId))
  return row?.document ? new Uint8Array(row.document) : null
}

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('unknown document names', () => {
  const unknownNames = ['', 'abc', MISSING_ID]

  for (const name of unknownNames) {
    it(`rejects the document name "${name}" with 404 and drops saves to it`, async () => {
      const error = await captureError(loadItemDocument(name))
      expect(error.status).toBe(404)

      const accessError = await captureError(
        getItemDocumentAccess(name, { id: MISSING_ID, isAdmin: true }),
      )
      expect(accessError.status).toBe(404)
      expect((await captureError(isItemReadOnly(name))).status).toBe(404)

      // A deleted item still gets its last store when its open connections are closed.
      await expect(saveItemDocument(name, new Uint8Array([1]))).resolves.toBe(false)
    })
  }
})

describe('loadItemDocument', () => {
  it('returns null while no CRDT state has been stored', async () => {
    const project = await createProject()
    const item = await createItem(project.id)

    await expect(loadItemDocument(item.id)).resolves.toBeNull()
  })

  it('returns the persisted CRDT state', async () => {
    const project = await createProject()
    const item = await createItem(project.id)
    const state = new Uint8Array([10, 20, 30])
    await saveItemDocument(item.id, state)

    const loaded = await loadItemDocument(item.id)

    // The blob round-trips as a Buffer (a Uint8Array subclass); compare byte-wise.
    expect([...(loaded ?? [])]).toEqual([...state])
  })
})

describe('saveItemDocument', () => {
  it('persists the raw state for an active item and reports success', async () => {
    const project = await createProject()
    const item = await createItem(project.id)

    await expect(saveItemDocument(item.id, new Uint8Array([1, 2]))).resolves.toBe(true)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([1, 2]))

    // Later saves overwrite the previous state.
    await expect(saveItemDocument(item.id, new Uint8Array([3, 4, 5]))).resolves.toBe(true)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([3, 4, 5]))
  })

  it('drops saves for archived items without overwriting the stored state', async () => {
    const project = await createProject()
    const item = await createItem(project.id)
    await saveItemDocument(item.id, new Uint8Array([1]))

    // The item gets archived after the last successful save.
    await db.update(items).set({ isArchived: true }).where(eq(items.id, item.id))

    const saved = await saveItemDocument(item.id, new Uint8Array([9, 9, 9]))
    expect(saved).toBe(false)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([1]))
  })

  it('drops saves when the parent project has been archived', async () => {
    const project = await createProject()
    const item = await createItem(project.id)
    await saveItemDocument(item.id, new Uint8Array([7]))

    // The project gets archived after the last successful save.
    await db.update(projects).set({ isArchived: true }).where(eq(projects.id, project.id))

    const saved = await saveItemDocument(item.id, new Uint8Array([8, 8, 8]))
    expect(saved).toBe(false)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([7]))
  })
})

/*
 * An archive that runs while a save is in flight: the save's row locks make it wait for the
 * archive to commit and then see the archived row, instead of writing past it.
 */
describe('saveItemDocument during an archive', () => {
  it('waits for an uncommitted item archive and then drops the save', async () => {
    const project = await createProject()
    const item = await createItem(project.id)
    await saveItemDocument(item.id, new Uint8Array([1]))
    const archive = await openTransaction()
    await archive.tx.update(items).set({ isArchived: true }).where(eq(items.id, item.id))

    const save = saveItemDocument(item.id, new Uint8Array([2]))
    await waitForLockWaits()
    await archive.commit()

    await expect(save).resolves.toBe(false)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([1]))
  })

  it('waits for an uncommitted project archive and then drops the save', async () => {
    const project = await createProject()
    const item = await createItem(project.id)
    await saveItemDocument(item.id, new Uint8Array([1]))
    const archive = await openTransaction()
    await archive.tx.update(projects).set({ isArchived: true }).where(eq(projects.id, project.id))

    const save = saveItemDocument(item.id, new Uint8Array([2]))
    await waitForLockWaits()
    await archive.commit()

    await expect(save).resolves.toBe(false)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([1]))
  })

  it('saves after an uncommitted change that leaves the document writable', async () => {
    const project = await createProject()
    const item = await createItem(project.id)
    const rename = await openTransaction()
    await rename.tx.update(items).set({ name: 'renamed' }).where(eq(items.id, item.id))

    const save = saveItemDocument(item.id, new Uint8Array([2]))
    await waitForLockWaits()
    await rename.commit()

    await expect(save).resolves.toBe(true)
    await expect(storedDocument(item.id)).resolves.toEqual(new Uint8Array([2]))
  })
})

const readOnlyFor = async (itemId: string, actor: Parameters<typeof getItemDocumentAccess>[1]) =>
  (await getItemDocumentAccess(itemId, actor)).readOnly

describe('getItemDocumentAccess', () => {
  it('is writable while both the item and its project are active', async () => {
    const user = await createUser()
    const project = await createProject()
    const item = await createItem(project.id)
    await addMember(project.id, user.id)

    await expect(readOnlyFor(item.id, actorOf(user))).resolves.toBe(false)
  })

  it('is read-only when the item itself is archived', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id, { isArchived: true })

    await expect(readOnlyFor(item.id, actorOf(admin))).resolves.toBe(true)
  })

  it('is read-only when the parent project is archived', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject({ isArchived: true })
    const item = await createItem(project.id)

    await expect(readOnlyFor(item.id, actorOf(admin))).resolves.toBe(true)
  })

  it('still verifies access at connect time even for archived documents', async () => {
    const stranger = await createUser()
    const project = await createProject({ isArchived: true })
    const item = await createItem(project.id)

    const error = await captureError(getItemDocumentAccess(item.id, actorOf(stranger)))
    expect(error.status).toBe(404)
  })

  it('does not reveal the project of an item the actor cannot see', async () => {
    const stranger = await createUser()
    const project = await createProject()
    const item = await createItem(project.id)

    const error = await captureError(getItemDocumentAccess(item.id, actorOf(stranger)))
    expect(error.message).toBe(`Item with id ${item.id} not found`)
  })
})

describe('isItemReadOnly', () => {
  it('follows the archive state of the item and its project', async () => {
    const project = await createProject()
    const active = await createItem(project.id)
    const archived = await createItem(project.id, { isArchived: true })
    const archivedProject = await createProject({ isArchived: true })
    const inArchivedProject = await createItem(archivedProject.id)

    await expect(isItemReadOnly(active.id)).resolves.toBe(false)
    await expect(isItemReadOnly(archived.id)).resolves.toBe(true)
    await expect(isItemReadOnly(inArchivedProject.id)).resolves.toBe(true)
  })
})
