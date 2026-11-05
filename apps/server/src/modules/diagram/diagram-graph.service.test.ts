import type { DiagramGraphUpdate } from '@docgraph/common/schemas'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db'
import { items } from '../../db/schema'
import {
  actorOf,
  createItem,
  createProject,
  createUser,
  migrateTestDb,
  resetTestDb,
} from '../../test/db'
import { loadItemDocument } from '../item/document-store'
import { createDiagram, getDiagramGraph, updateDiagramGraph } from './diagram-graph.service'

const update = (partial: Partial<DiagramGraphUpdate>): DiagramGraphUpdate => ({
  nodes: [],
  edges: [],
  removeNodeIds: [],
  removeEdgeIds: [],
  ...partial,
})

const FLOW = update({
  nodes: [
    { id: 'start', type: 'terminator', text: 'Start' },
    { id: 'work', type: 'process', text: 'Work' },
  ],
  edges: [{ source: 'start', target: 'work' }],
})

const setup = async () => {
  const user = await createUser()
  const project = await createProject({ isForAllUsers: true })
  return { actor: actorOf(user), project }
}

const itemsOf = (projectId: string) => db.select().from(items).where(eq(items.projectId, projectId))

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('getDiagramGraph', () => {
  it('returns an empty graph for a diagram that was never edited', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })

    const { item: read, graph } = await getDiagramGraph(item.id, actor)

    expect(read).toMatchObject({ id: item.id, type: 'FLOWCHART' })
    expect(graph).toEqual({ nodes: [], edges: [], areas: [] })
  })

  it('refuses items that are not flowcharts or business processes', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'DATABASE_DIAGRAM' })

    await expect(getDiagramGraph(item.id, actor)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/not a FLOWCHART or BUSINESS_PROCESS/),
    })
  })

  it('hides diagrams of projects the actor cannot access', async () => {
    const { actor } = await setup()
    const hidden = await createProject({ isForAllUsers: false })
    const item = await createItem(hidden.id, { type: 'FLOWCHART' })

    await expect(getDiagramGraph(item.id, actor)).rejects.toMatchObject({ status: 404 })
  })
})

describe('updateDiagramGraph', () => {
  it('persists the update so it can be read back', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })

    const { summary } = await updateDiagramGraph(item.id, FLOW, 'merge', actor)

    expect(summary).toMatchObject({ nodesCreated: ['start', 'work'], nodesRemoved: [] })
    expect(summary.edgesCreated).toHaveLength(1)
    expect(await loadItemDocument(item.id)).not.toBeNull()

    const { graph } = await getDiagramGraph(item.id, actor)
    // Y.Map does not keep insertion order, so compare as a set.
    expect(graph.nodes.map((node) => [node.id, node.type, node.text])).toEqual(
      expect.arrayContaining([
        ['start', 'terminator', 'Start'],
        ['work', 'process', 'Work'],
      ]),
    )
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toMatchObject([{ type: 'flowLine', source: 'start', target: 'work' }])
  })

  it('keeps existing nodes in merge mode and drops them in replace mode', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })
    await updateDiagramGraph(item.id, FLOW, 'merge', actor)
    const extra = update({ nodes: [{ id: 'end', type: 'terminator', text: 'End' }] })

    const merged = await updateDiagramGraph(item.id, extra, 'merge', actor)
    expect(merged.summary.nodesRemoved).toEqual([])
    const mergedIds = (await getDiagramGraph(item.id, actor)).graph.nodes.map((node) => node.id)
    expect(mergedIds.sort()).toEqual(['end', 'start', 'work'])

    const replaced = await updateDiagramGraph(item.id, extra, 'replace', actor)
    expect(replaced.summary).toMatchObject({ nodesUpdated: ['end'] })
    expect(replaced.summary.nodesRemoved.sort()).toEqual(['start', 'work'])
    const { graph } = await getDiagramGraph(item.id, actor)
    expect(graph.nodes.map((node) => node.id)).toEqual(['end'])
    expect(graph.edges).toEqual([])
  })

  it('refuses to write into archived diagrams', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART', isArchived: true })

    await expect(updateDiagramGraph(item.id, FLOW, 'merge', actor)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/read-only/),
    })
    expect(await loadItemDocument(item.id)).toBeNull()
  })

  it('rejects an invalid graph without saving anything', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })

    await expect(
      updateDiagramGraph(
        item.id,
        update({ edges: [{ source: 'start', target: 'missing' }] }),
        'merge',
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 })
    expect((await getDiagramGraph(item.id, actor)).graph.edges).toEqual([])
  })
})

describe('createDiagram', () => {
  it('creates an empty diagram without writing a document', async () => {
    const { actor, project } = await setup()

    const { item, summary } = await createDiagram(
      { projectId: project.id, name: 'Empty', type: 'FLOWCHART', graph: update({}) },
      actor,
    )

    expect(item).toMatchObject({ name: 'Empty', type: 'FLOWCHART', projectId: project.id })
    expect(summary).toBeUndefined()
    expect(await loadItemDocument(item.id)).toBeNull()
  })

  it('creates a diagram with its initial graph', async () => {
    const { actor, project } = await setup()

    const { item, summary } = await createDiagram(
      { projectId: project.id, name: 'Flow', type: 'FLOWCHART', graph: FLOW },
      actor,
    )

    expect(summary?.nodesCreated).toEqual(['start', 'work'])
    const { graph } = await getDiagramGraph(item.id, actor)
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
  })

  it('creates no item when the initial graph is invalid', async () => {
    const { actor, project } = await setup()

    await expect(
      createDiagram(
        {
          projectId: project.id,
          name: 'Broken',
          type: 'BUSINESS_PROCESS',
          graph: update({
            nodes: [{ id: 'task', type: 'activity', data: { taskType: 'nope' } }],
          }),
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/node "task"/) })
    expect(await itemsOf(project.id)).toEqual([])
  })
})
