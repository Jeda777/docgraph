import { beforeEach, describe, expect, it } from 'vitest'
import {
  actorOf,
  addMember,
  createProject,
  createUser,
  migrateTestDb,
  resetTestDb,
} from '../../test/db'
import { projectRepository } from './repo'

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('projectRepository.findAllVisible', () => {
  it('returns every project for admins', async () => {
    const admin = await createUser({ isAdmin: true })
    await createProject({ name: 'a' })
    await createProject({ name: 'b', isForAllUsers: true })

    const visible = await projectRepository.findAllVisible(actorOf(admin))

    expect(visible.map((row) => row.name).sort()).toEqual(['a', 'b'])
  })

  it('returns shared and assigned projects for regular users', async () => {
    const member = await createUser()
    const assigned = await createProject({ name: 'assigned' })
    const shared = await createProject({ name: 'shared', isForAllUsers: true })
    await createProject({ name: 'hidden' })
    await addMember(assigned.id, member.id)

    const visible = await projectRepository.findAllVisible(actorOf(member))

    expect(visible.map((row) => row.name).sort()).toEqual(['assigned', 'shared'])
    expect(visible.find((row) => row.id === assigned.id)?.name).toBe('assigned')
    expect(visible.find((row) => row.id === shared.id)?.name).toBe('shared')
  })

  it('returns only shared projects for users without assignments', async () => {
    const stranger = await createUser()
    await createProject({ name: 'hidden' })
    await createProject({ name: 'shared', isForAllUsers: true })

    const visible = await projectRepository.findAllVisible(actorOf(stranger))

    expect(visible.map((row) => row.name)).toEqual(['shared'])
  })

  it('lists a project once even when several members are assigned to it', async () => {
    const viewer = await createUser()
    const otherMember = await createUser()
    const shared = await createProject({ name: 'shared', isForAllUsers: true })
    const assigned = await createProject({ name: 'assigned' })
    await addMember(shared.id, viewer.id)
    await addMember(shared.id, otherMember.id)
    await addMember(assigned.id, viewer.id)
    await addMember(assigned.id, otherMember.id)

    const visible = await projectRepository.findAllVisible(actorOf(viewer))

    expect(visible.map((row) => row.name).sort()).toEqual(['assigned', 'shared'])
  })
})

describe('projectRepository.addMembers / replaceMembers / getMembers', () => {
  it('adds members and lists their identity fields', async () => {
    const first = await createUser({ name: 'w1' })
    const second = await createUser({ name: 'w2' })
    const project = await createProject()

    const assignments = await projectRepository.addMembers(project.id, [first.id, second.id])
    expect(assignments).toHaveLength(2)

    const members = await projectRepository.getMembers(project.id)
    expect(members.map((member) => member.name).sort()).toEqual(['w1', 'w2'])
    for (const member of members) {
      expect(Object.keys(member).sort()).toEqual(['email', 'id', 'name'])
    }
  })

  it('ignores duplicate user ids', async () => {
    const member = await createUser({ name: 'dup' })
    const project = await createProject()

    const assignments = await projectRepository.addMembers(project.id, [member.id, member.id])
    expect(assignments).toHaveLength(1)

    await projectRepository.replaceMembers(project.id, [member.id, member.id])
    const members = await projectRepository.getMembers(project.id)
    expect(members.map((row) => row.name)).toEqual(['dup'])
  })

  it('short-circuits on an empty assignment list', async () => {
    const project = await createProject()

    await expect(projectRepository.addMembers(project.id, [])).resolves.toEqual([])
    await expect(projectRepository.getMembers(project.id)).resolves.toEqual([])
  })

  it('replaceMembers swaps the whole member set', async () => {
    const oldMember = await createUser({ name: 'old' })
    const newMember = await createUser({ name: 'new' })
    const project = await createProject()
    await projectRepository.addMembers(project.id, [oldMember.id])

    await projectRepository.replaceMembers(project.id, [newMember.id])

    const members = await projectRepository.getMembers(project.id)
    expect(members.map((member) => member.name)).toEqual(['new'])
  })

  it('replaceMembers with an empty list clears all members', async () => {
    const member = await createUser()
    const project = await createProject()
    await projectRepository.addMembers(project.id, [member.id])

    await projectRepository.replaceMembers(project.id, [])

    await expect(projectRepository.getMembers(project.id)).resolves.toEqual([])
  })
})
