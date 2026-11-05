import { beforeEach, describe, expect, it } from 'vitest'
import { db, projects } from '../../db'
import {
  actorOf,
  addMember,
  createProject,
  createUser,
  MISSING_ID,
  migrateTestDb,
  resetTestDb,
} from '../../test/db'
import { requireProjectAccess, visibilityWhere } from './access'

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

describe('requireProjectAccess', () => {
  it('throws NOT_FOUND when the project does not exist', async () => {
    const admin = await createUser({ isAdmin: true })

    const error = await captureError(requireProjectAccess(MISSING_ID, actorOf(admin)))
    expect(error.status).toBe(404)
  })

  it('lets admins see restricted projects without an assignment', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()

    await expect(requireProjectAccess(project.id, actorOf(admin))).resolves.toMatchObject({
      id: project.id,
    })
  })

  it('lets anyone see projects shared with all users', async () => {
    const stranger = await createUser()
    const shared = await createProject({ isForAllUsers: true })

    await expect(requireProjectAccess(shared.id, actorOf(stranger))).resolves.toMatchObject({
      id: shared.id,
    })
  })

  it('lets assigned members see restricted projects', async () => {
    const member = await createUser()
    const project = await createProject()
    await addMember(project.id, member.id)

    await expect(requireProjectAccess(project.id, actorOf(member))).resolves.toMatchObject({
      id: project.id,
    })
  })

  it('hides restricted projects from unassigned users behind a 404', async () => {
    const stranger = await createUser()
    const project = await createProject()

    const error = await captureError(requireProjectAccess(project.id, actorOf(stranger)))
    expect(error.status).toBe(404)
  })

  it('treats archived projects as missing unless allowArchived is set', async () => {
    const admin = await createUser({ isAdmin: true })
    const archived = await createProject({
      isArchived: true,
      isForAllUsers: true,
    })

    const denied = await captureError(requireProjectAccess(archived.id, actorOf(admin)))
    expect(denied.status).toBe(404)

    await expect(
      requireProjectAccess(archived.id, actorOf(admin), { allowArchived: true }),
    ).resolves.toMatchObject({ id: archived.id })
  })
})

describe('visibilityWhere', () => {
  it('is undefined for admins (no restriction)', () => {
    expect(visibilityWhere({ id: MISSING_ID, isAdmin: true })).toBeUndefined()
  })

  it('restricts non-admins to their assignments or shared projects', () => {
    const { sql } = db
      .select()
      .from(projects)
      .where(visibilityWhere({ id: MISSING_ID, isAdmin: false }))
      .toSQL()

    expect(sql).toContain('"projects_to_users"."user_id"')
    expect(sql).toContain('"projects"."is_for_all_users"')
    expect(sql).toContain(' or ')
  })
})
