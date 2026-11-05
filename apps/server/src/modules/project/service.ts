import type {
  ProjectCreateInput,
  ProjectGetByIdInput,
  ProjectUpdateInput,
} from '@docgraph/common/schemas'
import { closeProjectConnections } from '../../crdt'
import { db, type ProjectUpdate } from '../../db'
import type { Actor } from '../auth/actor'
import { itemRepository } from '../item/repo'
import { userRepository } from '../user/repo'
import { requireProjectAccess } from './access'
import { projectRepository } from './repo'

export const getProjectById = async (
  { id, getItems, getMembers }: ProjectGetByIdInput & { id: string },
  actor: Actor,
) => {
  const project = await requireProjectAccess(id, actor, { allowArchived: true })

  const members = getMembers ? await projectRepository.getMembers(id) : undefined

  const projectItems = getItems ? await itemRepository.findAllByProjectId(id) : undefined

  return { ...project, members, items: projectItems }
}

export const listProjects = async (actor: Actor) => projectRepository.findAllVisible(actor)

export const createProject = async ({ name, isForAllUsers, memberIds }: ProjectCreateInput) =>
  db.transaction(async (tx) => {
    const project = await projectRepository.create({ name, isForAllUsers }, tx)

    if (memberIds?.length) {
      await userRepository.assertExists(memberIds, tx)
      await projectRepository.addMembers(project.id, memberIds, tx)
    }

    return project
  })

export const updateProject = async ({
  id,
  name,
  isForAllUsers,
  memberIds,
  isArchived,
}: ProjectUpdateInput & { id: string }) => {
  const { project, archiveChanged, members } = await db.transaction(async (tx) => {
    const project = await projectRepository.getByIdOrThrow(id, tx)

    const changes: ProjectUpdate = {}
    if (project.name !== name) {
      changes.name = name
    }
    if (project.isForAllUsers !== isForAllUsers) {
      changes.isForAllUsers = isForAllUsers
    }
    if (project.isArchived !== isArchived) {
      changes.isArchived = isArchived
    }

    const previousMemberIds = (await projectRepository.getMembers(id, tx)).map(({ id }) => id)
    if (memberIds) {
      await userRepository.assertExists(memberIds, tx)
      await projectRepository.replaceMembers(id, memberIds, tx)
    }
    const memberIdSet = new Set(memberIds ?? previousMemberIds)

    // Only a project restricted to its members can lock anyone out: when it was just
    // restricted or a member was removed. Added members or opening the project to everyone
    // only widen access, so open editors are left alone.
    const lostAccess =
      !isForAllUsers &&
      (changes.isForAllUsers === false || previousMemberIds.some((id) => !memberIdSet.has(id)))

    return {
      project:
        Object.keys(changes).length > 0 ? await projectRepository.update(id, changes, tx) : project,
      archiveChanged: 'isArchived' in changes,
      members: lostAccess ? memberIdSet : undefined,
    }
  })

  // WebSockets check access only when they connect: make the affected editors reconnect, so
  // they are refused or get their new scope. Archiving or restoring switches everyone's scope.
  if (archiveChanged) closeProjectConnections(id)
  else if (members) closeProjectConnections(id, members)

  return project
}

export const deleteProject = async (id: string) => {
  await projectRepository.delete(id)
  closeProjectConnections(id)
}
