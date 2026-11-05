import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, projects } from '../../db'
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
import { projectRepository } from './repo'
import { createProject as createProjectService, getProjectById, updateProject } from './service'

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('createProject', () => {
  it('creates the project and assigns the given members in one transaction', async () => {
    const member = await createUser()

    const project = await createProjectService({
      name: 'Apollo',
      isForAllUsers: false,
      memberIds: [member.id],
    })

    expect(project.name).toBe('Apollo')
    expect(project.isForAllUsers).toBe(false)
    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.id)).toEqual([member.id])
  })

  it('creates a project without members when none are given', async () => {
    const project = await createProjectService({ name: 'Solo', isForAllUsers: true })

    expect(project.isForAllUsers).toBe(true)
    await expect(projectRepository.getMembers(project.id)).resolves.toEqual([])
  })

  it('rejects unknown member ids with 404 and rolls back the project', async () => {
    const member = await createUser()

    await expect(
      createProjectService({
        name: 'Ghost',
        isForAllUsers: false,
        memberIds: [member.id, MISSING_ID],
      }),
    ).rejects.toMatchObject({ status: 404, message: `Users with ids ${MISSING_ID} not found` })

    await expect(db.select().from(projects).where(eq(projects.name, 'Ghost'))).resolves.toEqual([])
  })

  // Regression: duplicates used to fail the existence check or hit the primary key (500)
  it('adds a member listed twice only once', async () => {
    const member = await createUser()

    const project = await createProjectService({
      name: 'Twice',
      isForAllUsers: false,
      memberIds: [member.id, member.id],
    })

    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.id)).toEqual([member.id])
  })

  it('names a duplicated unknown member id once in the 404', async () => {
    const member = await createUser()

    await expect(
      createProjectService({
        name: 'Ghost',
        isForAllUsers: false,
        memberIds: [member.id, member.id, MISSING_ID, MISSING_ID],
      }),
    ).rejects.toMatchObject({ status: 404, message: `Users with ids ${MISSING_ID} not found` })
  })
})

describe('getProjectById', () => {
  it('returns the project with members and items when requested', async () => {
    const admin = await createUser({ isAdmin: true })
    const member = await createUser()
    const project = await createProject()
    await addMember(project.id, member.id)
    const item = await createItem(project.id)

    const result = await getProjectById(
      { id: project.id, getItems: true, getMembers: true },
      actorOf(admin),
    )

    expect(result.id).toBe(project.id)
    expect(result.members?.map((row) => row.id)).toEqual([member.id])
    expect(result.items?.map((row) => row.id)).toEqual([item.id])
    expect(result.items?.[0]).not.toHaveProperty('document')
  })

  it('omits members and items when not requested', async () => {
    const admin = await createUser({ isAdmin: true })
    const project = await createProject()

    const result = await getProjectById(
      { id: project.id, getItems: false, getMembers: false },
      actorOf(admin),
    )

    expect(result.members).toBeUndefined()
    expect(result.items).toBeUndefined()
  })

  it('lets assigned members read their projects, active or archived', async () => {
    const member = await createUser()
    const active = await createProject()
    await addMember(active.id, member.id)

    await expect(
      getProjectById({ id: active.id, getItems: false, getMembers: false }, actorOf(member)),
    ).resolves.toMatchObject({ id: active.id })

    // Archived projects are still readable (allowArchived), e.g. for their documents.
    const archived = await createProject({ isArchived: true })
    await addMember(archived.id, member.id)
    await expect(
      getProjectById({ id: archived.id, getItems: false, getMembers: false }, actorOf(member)),
    ).resolves.toMatchObject({ id: archived.id })
  })

  it('hides restricted projects from unassigned users behind a 404', async () => {
    const stranger = await createUser()
    const project = await createProject()

    await expect(
      getProjectById({ id: project.id, getItems: false, getMembers: false }, actorOf(stranger)),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('updateProject', () => {
  it('writes nothing when no field actually changed', async () => {
    const project = await createProject({ name: 'Original', isForAllUsers: true })
    const before = await projectRepository.getByIdOrThrow(project.id)

    const updated = await updateProject({
      id: project.id,
      name: 'Original',
      isForAllUsers: true,
      isArchived: false,
    })

    expect(updated.name).toBe('Original')
    const [row] = await db.select().from(projects).where(eq(projects.id, project.id))
    expect(row.updatedAt?.getTime()).toBe(before.updatedAt?.getTime())
    expect(row.isForAllUsers).toBe(true)
    expect(row.isArchived).toBe(false)
  })

  it('renames and toggles sharing', async () => {
    const project = await createProject({ name: 'Original', isForAllUsers: false })

    const updated = await updateProject({
      id: project.id,
      name: 'Renamed',
      isForAllUsers: true,
      isArchived: false,
    })

    expect(updated.name).toBe('Renamed')
    expect(updated.isForAllUsers).toBe(true)
  })

  it('archives and restores through isArchived', async () => {
    const project = await createProject()

    const archived = await updateProject({
      id: project.id,
      name: project.name,
      isForAllUsers: false,
      isArchived: true,
    })
    expect(archived.isArchived).toBe(true)

    const restored = await updateProject({
      id: project.id,
      name: project.name,
      isForAllUsers: false,
      isArchived: false,
    })
    expect(restored.isArchived).toBe(false)
  })

  it('replaces the member set when memberIds are given', async () => {
    const project = await createProject()
    const first = await createUser()
    const second = await createUser()
    await projectRepository.addMembers(project.id, [first.id])

    await updateProject({
      id: project.id,
      name: project.name,
      isForAllUsers: false,
      isArchived: false,
      memberIds: [second.id],
    })

    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.id)).toEqual([second.id])
  })

  it('replaces the member set with a member listed twice only once', async () => {
    const project = await createProject()
    const kept = await createUser()
    const added = await createUser()
    await projectRepository.addMembers(project.id, [kept.id])

    await updateProject({
      id: project.id,
      name: project.name,
      isForAllUsers: false,
      isArchived: false,
      memberIds: [kept.id, added.id, added.id, kept.id],
    })

    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.id).sort()).toEqual([kept.id, added.id].sort())
  })

  it('rejects unknown member ids with 404 and keeps the current members', async () => {
    const project = await createProject()
    const member = await createUser()
    await projectRepository.addMembers(project.id, [member.id])

    await expect(
      updateProject({
        id: project.id,
        name: project.name,
        isForAllUsers: false,
        isArchived: false,
        memberIds: [MISSING_ID],
      }),
    ).rejects.toMatchObject({ status: 404 })

    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.id)).toEqual([member.id])
  })
})
