import { beforeEach, describe, expect, it } from 'vitest'
import {
  actorOf,
  addMember,
  createItem,
  createProject,
  createUser,
  MISSING_ID,
  migrateTestDb,
  resetTestDb,
} from '../../test/db'
import { itemRepository } from './repo'
import { createItem as createItemService, deleteItem, getItemById, updateItem } from './service'

/** Structural shape of errors thrown by services, for assertions. */
type ExpectedError = { status: number; message: string }

const captureError = async (promise: Promise<unknown>): Promise<ExpectedError> =>
  promise.then(
    () => {
      throw new Error('Expected the promise to reject')
    },
    (error) => error as ExpectedError,
  )

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('createItem', () => {
  it('creates an item for a user with project access', async () => {
    const member = await createUser()
    const project = await createProject()
    await addMember(project.id, member.id)

    const item = await createItemService(
      { name: 'Diagram', type: 'DATABASE_DIAGRAM', projectId: project.id },
      actorOf(member),
    )

    expect(item).toMatchObject({ name: 'Diagram', type: 'DATABASE_DIAGRAM' })
    expect(item.isArchived).toBe(false)
  })

  it('lets admins create items in any project', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()

    await expect(
      createItemService(
        { name: 'Admin item', type: 'DATABASE_DIAGRAM', projectId: project.id },
        actorOf(admin),
      ),
    ).resolves.toMatchObject({ name: 'Admin item' })
  })

  it('rejects item creation in restricted projects with a 404', async () => {
    const stranger = await createUser()
    const project = await createProject()

    const error = await captureError(
      createItemService(
        { name: 'Nope', type: 'DATABASE_DIAGRAM', projectId: project.id },
        actorOf(stranger),
      ),
    )
    expect(error.status).toBe(404)
  })
})

describe('getItemById', () => {
  it('never exposes the CRDT document blob', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id)
    await itemRepository.update(item.id, { document: Buffer.from([1, 2, 3]) })

    const result = await getItemById(item.id, actorOf(admin))

    expect('document' in result).toBe(false)
  })

  it('returns 404 for a missing item, even for a stranger', async () => {
    const stranger = await createUser()

    const error = await captureError(getItemById(MISSING_ID, actorOf(stranger)))
    expect(error.status).toBe(404)
  })

  it('lets assigned members read items of their projects', async () => {
    const member = await createUser()
    const project = await createProject()
    await addMember(project.id, member.id)
    const item = await createItem(project.id)

    await expect(getItemById(item.id, actorOf(member))).resolves.toMatchObject({ id: item.id })
  })

  it('requires project access even for archived projects', async () => {
    const stranger = await createUser()
    const archived = await createProject({ isArchived: true })
    const item = await createItem(archived.id)

    const error = await captureError(getItemById(item.id, actorOf(stranger)))
    expect(error.status).toBe(404)
  })
})

describe('updateItem', () => {
  it('renames an item', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id)

    const updated = await updateItem(
      { id: item.id, name: 'Renamed', isArchived: false },
      actorOf(admin),
    )

    expect(updated.name).toBe('Renamed')
  })

  it('archives and restores via the soft-delete flag', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id)

    const archived = await updateItem(
      { id: item.id, name: item.name, isArchived: true },
      actorOf(admin),
    )
    expect(archived.isArchived).toBe(true)

    const restored = await updateItem(
      { id: archived.id, name: archived.name, isArchived: false },
      actorOf(admin),
    )
    expect(restored.isArchived).toBe(false)
  })

  it('requires project access to update', async () => {
    const stranger = await createUser()
    const project = await createProject()
    const item = await createItem(project.id)

    const error = await captureError(
      updateItem({ id: item.id, name: 'New', isArchived: false }, actorOf(stranger)),
    )
    expect(error.status).toBe(404)
  })
})

describe('deleteItem', () => {
  it('hard-deletes the item for users with access', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()
    const item = await createItem(project.id)

    await expect(deleteItem(item.id, actorOf(admin))).resolves.toBeUndefined()
    await expect(itemRepository.findById(item.id)).resolves.toBeUndefined()
  })

  it('requires project access to delete', async () => {
    const stranger = await createUser()
    const project = await createProject()
    const item = await createItem(project.id)

    const error = await captureError(deleteItem(item.id, actorOf(stranger)))
    expect(error.status).toBe(404)

    // The item must survive the denied attempt.
    await expect(itemRepository.findById(item.id)).resolves.toMatchObject({ id: item.id })
  })
})
