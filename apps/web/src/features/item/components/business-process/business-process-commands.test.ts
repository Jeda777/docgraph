import { describe, expect, it } from 'vitest'
import {
  addBusinessProcessNode,
  attachBusinessProcessBoundaryEvent,
  canDuplicateBusinessProcessNode,
  changeBusinessProcessEventContext,
  changeBusinessProcessEventDefinition,
  changeBusinessProcessParticipantOrientation,
  duplicateBusinessProcessNode,
  findPoolAncestor,
  updateBusinessProcessNodeData,
} from './business-process-commands'
import type { BusinessProcessNode } from './business-process-node'
import {
  type BusinessProcessNodeTool,
  getBusinessProcessTool,
} from './business-process-tool-registry'

const nodeTool = (id: string) => getBusinessProcessTool(id) as BusinessProcessNodeTool

const CENTER = { x: 500, y: 300 }

const pool = (id: string, overrides: Partial<BusinessProcessNode> = {}): BusinessProcessNode => ({
  id,
  type: 'businessProcessParticipantNode',
  position: { x: 0, y: 0 },
  style: { width: 600, height: 240 },
  data: {
    kind: 'participant',
    text: id,
    participantType: 'pool',
    orientation: 'horizontal',
    blackBox: false,
  },
  ...overrides,
})

const activity = (
  id: string,
  overrides: Partial<BusinessProcessNode> = {},
): BusinessProcessNode => ({
  id,
  type: 'businessProcessActivityNode',
  position: { x: 100, y: 100 },
  style: { width: 160, height: 80 },
  data: { kind: 'activity', text: id, taskType: 'task', markers: [] },
  ...overrides,
})

const boundaryEvent = (id: string, activityId: string): BusinessProcessNode => ({
  id,
  type: 'businessProcessEventNode',
  parentId: activityId,
  position: { x: 44, y: 44 },
  style: { width: 72, height: 72 },
  data: {
    kind: 'event',
    text: id,
    context: 'boundary',
    eventType: 'timer',
    interrupting: true,
    attachedToId: activityId,
  },
})

const byId = (nodes: BusinessProcessNode[] | string, id: string) => {
  if (typeof nodes === 'string') throw new Error(nodes)
  return nodes.find((node) => node.id === id)
}

describe('business process commands', () => {
  describe('addBusinessProcessNode', () => {
    it('adds a top-level element at the given center', () => {
      const result = addBusinessProcessNode([], {
        id: 'new',
        tool: nodeTool('activity:task'),
        center: CENTER,
      })

      expect(byId(result, 'new')).toMatchObject({
        position: CENTER,
        style: { width: 160, height: 80 },
        data: { kind: 'activity', taskType: 'task' },
      })
    })

    it('puts an element into the selected participant', () => {
      const result = addBusinessProcessNode([pool('pool')], {
        id: 'new',
        tool: nodeTool('activity:task'),
        selectedNodeId: 'pool',
        center: CENTER,
      })

      expect(byId(result, 'new')).toMatchObject({ parentId: 'pool', extent: 'parent' })
    })

    it('rejects elements inside a black-box pool', () => {
      const blackBox = pool('pool')
      if (blackBox.data.kind === 'participant') blackBox.data.blackBox = true

      expect(
        addBusinessProcessNode([blackBox], {
          id: 'new',
          tool: nodeTool('activity:task'),
          selectedNodeId: 'pool',
          center: CENTER,
        }),
      ).toBe('Black-box pools cannot contain diagram elements.')
    })

    it('attaches a boundary event to the selected activity', () => {
      const result = addBusinessProcessNode([activity('task')], {
        id: 'event',
        tool: nodeTool('event:boundary:timer'),
        selectedNodeId: 'task',
        center: CENTER,
      })

      expect(byId(result, 'event')).toMatchObject({
        parentId: 'task',
        position: { x: 44, y: 44 },
        data: { context: 'boundary', attachedToId: 'task' },
      })
    })

    it('requires an activity for a boundary event', () => {
      expect(
        addBusinessProcessNode([], {
          id: 'event',
          tool: nodeTool('event:boundary:timer'),
          center: CENTER,
        }),
      ).toBe('Select an activity before adding a boundary event.')
    })

    it('adds a lane to the only pool and lays it out across the pool', () => {
      const result = addBusinessProcessNode([pool('pool')], {
        id: 'lane',
        tool: nodeTool('participant:lane'),
        center: CENTER,
      })
      const lane = byId(result, 'lane')

      expect(lane?.parentId).toBe('pool')
      expect(lane?.data).toMatchObject({ participantType: 'lane', orientation: 'horizontal' })
      expect(lane?.position.x).toBeGreaterThan(0)
    })

    it('requires a pool for a lane when several pools exist', () => {
      expect(
        addBusinessProcessNode([pool('a'), pool('b')], {
          id: 'lane',
          tool: nodeTool('participant:lane'),
          center: CENTER,
        }),
      ).toBe('Select a white-box pool before adding a lane.')
    })
  })

  describe('duplicateBusinessProcessNode', () => {
    it('copies an element next to the original', () => {
      const result = duplicateBusinessProcessNode([activity('task')], 'task')

      expect(result).toHaveLength(2)
      expect(result[1]).toMatchObject({ position: { x: 132, y: 132 }, selected: false })
      expect(result[1]?.id).not.toBe('task')
    })

    it('drops the default flow of a copied gateway', () => {
      const gateway: BusinessProcessNode = {
        id: 'gateway',
        type: 'businessProcessGatewayNode',
        position: { x: 0, y: 0 },
        data: {
          kind: 'gateway',
          text: '',
          gatewayType: 'exclusive',
          direction: 'diverging',
          defaultFlowId: 'edge',
        },
      }
      const [, copy] = duplicateBusinessProcessNode([gateway], 'gateway')

      expect(copy?.data).not.toHaveProperty('defaultFlowId')
    })

    it('does not duplicate boundary events', () => {
      const nodes = [activity('task'), boundaryEvent('event', 'task')]

      expect(canDuplicateBusinessProcessNode(nodes[1])).toBe(false)
      expect(duplicateBusinessProcessNode(nodes, 'event')).toBe(nodes)
    })
  })

  it('updates the data of a single element', () => {
    const result = updateBusinessProcessNodeData([activity('a'), activity('b')], 'b', (data) => ({
      ...data,
      text: 'Renamed',
    }))

    expect(result.map((node) => node.data.text)).toEqual(['a', 'Renamed'])
  })

  describe('changeBusinessProcessEventContext', () => {
    it('detaches a boundary event next to its activity', () => {
      const nodes = [activity('task'), boundaryEvent('event', 'task')]
      const event = byId(
        changeBusinessProcessEventContext(nodes, 'event', 'intermediateCatch'),
        'event',
      )

      expect(event?.position).toEqual({ x: 144, y: 144 })
      expect(event?.parentId).toBeUndefined()
      expect(event?.data).toMatchObject({ context: 'intermediateCatch', attachedToId: 'task' })
    })

    it('reattaches an event that remembers its activity', () => {
      const nodes = [activity('task'), boundaryEvent('event', 'task')]
      const detached = changeBusinessProcessEventContext(nodes, 'event', 'intermediateCatch')
      if (typeof detached === 'string') throw new Error(detached)
      const event = byId(changeBusinessProcessEventContext(detached, 'event', 'boundary'), 'event')

      expect(event).toMatchObject({ parentId: 'task', position: { x: 44, y: 44 } })
    })

    it('rejects a boundary event without an activity', () => {
      const event: BusinessProcessNode = {
        id: 'event',
        type: 'businessProcessEventNode',
        position: { x: 0, y: 0 },
        data: { kind: 'event', text: '', context: 'start', eventType: 'none', interrupting: true },
      }

      expect(changeBusinessProcessEventContext([event], 'event', 'boundary')).toBe(
        'Boundary events must be attached to an activity.',
      )
    })
  })

  it('changes the event definition', () => {
    const nodes = [activity('task'), boundaryEvent('event', 'task')]

    expect(
      byId(changeBusinessProcessEventDefinition(nodes, 'event', 'message'), 'event')?.data,
    ).toMatchObject({ eventType: 'message' })
  })

  it('moves a boundary event to another activity', () => {
    const nodes = [
      activity('first'),
      activity('second', { style: { width: 200, height: 100 } }),
      boundaryEvent('event', 'first'),
    ]
    const event = byId(attachBusinessProcessBoundaryEvent(nodes, 'event', 'second'), 'event')

    expect(event).toMatchObject({
      parentId: 'second',
      position: { x: 64, y: 64 },
      data: { attachedToId: 'second' },
    })
  })

  it('does not attach an event outside the boundary context', () => {
    const event: BusinessProcessNode = {
      id: 'event',
      type: 'businessProcessEventNode',
      position: { x: 0, y: 0 },
      data: { kind: 'event', text: '', context: 'start', eventType: 'none', interrupting: true },
    }
    const nodes = [activity('task'), event]

    expect(attachBusinessProcessBoundaryEvent(nodes, 'event', 'task')).toBe(nodes)
  })

  it('rotates a pool and swaps its size', () => {
    const result = changeBusinessProcessParticipantOrientation([pool('pool')], 'pool', 'vertical')
    const rotated = byId(result, 'pool')

    expect(rotated?.data).toMatchObject({ orientation: 'vertical' })
    expect(rotated?.style).toMatchObject({ width: 240, height: 600 })
  })

  it('finds the pool of a nested element', () => {
    const nodes = [pool('pool'), activity('task', { parentId: 'pool' })]

    expect(findPoolAncestor(nodes[1] as BusinessProcessNode, nodes)?.id).toBe('pool')
  })
})
