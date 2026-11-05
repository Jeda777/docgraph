import { describe, expect, it } from 'vitest'
import type { BusinessProcessNodeType } from '../schemas'
import {
  businessProcessNodeSize,
  businessProcessNodeZIndex,
  layoutAllParticipantLanes,
  layoutParticipantLanes,
  MIN_PARTICIPANT_LANE_SIZE,
  minimumParticipantNodeSize,
  type ParticipantLayoutNode,
  resizeAdjacentParticipantLanes,
  sizeParticipantContainerForLanes,
} from './business-process-lanes'

/** A stored node shape the layout accepts, with the node type tests set for readability. */
type BusinessProcessNode = ParticipantLayoutNode & { type: BusinessProcessNodeType }

const lane = (
  id: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
): BusinessProcessNode => ({
  id,
  type: 'businessProcessParticipantNode',
  position,
  style: size,
  parentId: 'pool',
  data: {
    kind: 'participant',
    text: id,
    participantType: 'lane',
    orientation: 'horizontal',
    blackBox: false,
  },
})

describe('business process lane layout', () => {
  it('stacks pools below lanes and leaves regular nodes above both', () => {
    const pool: BusinessProcessNode = {
      id: 'pool',
      type: 'businessProcessParticipantNode',
      position: { x: 0, y: 0 },
      data: {
        kind: 'participant',
        text: 'Orders',
        participantType: 'pool',
        orientation: 'horizontal',
        blackBox: false,
      },
    }

    expect(businessProcessNodeZIndex(pool)).toBe(-2)
    expect(
      businessProcessNodeZIndex(lane('sales', { x: 0, y: 0 }, { width: 100, height: 100 })),
    ).toBe(-1)
  })

  it('uses live React Flow dimensions rather than stale initial styles', () => {
    const pool: BusinessProcessNode = {
      id: 'pool',
      type: 'businessProcessParticipantNode',
      position: { x: 0, y: 0 },
      width: 520,
      height: 320,
      style: { width: 420, height: 180 },
      data: {
        kind: 'participant',
        text: 'Orders',
        participantType: 'pool',
        orientation: 'horizontal',
        blackBox: false,
      },
    }

    expect(businessProcessNodeSize(pool)).toEqual({ width: 520, height: 320 })
  })

  it('fills the pool interior with horizontal lanes', () => {
    const lanes = layoutParticipantLanes(
      [
        { ...lane('sales', { x: 0, y: 0 }, { width: 120, height: 60 }), extent: 'parent' },
        { ...lane('support', { x: 0, y: 0 }, { width: 120, height: 60 }), extent: 'parent' },
      ],
      { width: 420, height: 300 },
      'horizontal',
      [1, 1],
    )

    expect(lanes.map(({ position, style }) => ({ position, style }))).toEqual([
      { position: { x: 34, y: 2 }, style: { width: 384, height: 148 } },
      { position: { x: 34, y: 150 }, style: { width: 384, height: 148 } },
    ])
    expect(lanes.every((entry) => entry.extent === undefined)).toBe(true)
  })

  it('lays out vertical lanes along the pool width', () => {
    const lanes = layoutParticipantLanes(
      [
        lane('sales', { x: 0, y: 0 }, { width: 60, height: 120 }),
        lane('support', { x: 0, y: 0 }, { width: 60, height: 120 }),
      ],
      { width: 420, height: 300 },
      'vertical',
      [1, 1],
    )

    expect(lanes.map(({ position, style }) => ({ position, style }))).toEqual([
      { position: { x: 2, y: 28 }, style: { width: 208, height: 270 } },
      { position: { x: 210, y: 28 }, style: { width: 208, height: 270 } },
    ])
  })

  it('preserves lane proportions when the pool changes size', () => {
    const lanes = layoutParticipantLanes(
      [
        lane('sales', { x: 34, y: 2 }, { width: 384, height: 60 }),
        lane('support', { x: 34, y: 62 }, { width: 384, height: 120 }),
      ],
      { width: 420, height: 420 },
      'horizontal',
    )

    expect(Number(lanes[0].style?.height)).toBeCloseTo(138.67)
    expect(Number(lanes[1].style?.height)).toBeCloseTo(277.33)
    expect(lanes[1].position.y).toBe(lanes[0].position.y + Number(lanes[0].style?.height))
  })

  it('moves a divider by resizing only its adjacent lanes', () => {
    const lanes = resizeAdjacentParticipantLanes(
      [
        lane('sales', { x: 34, y: 2 }, { width: 384, height: 120 }),
        lane('support', { x: 34, y: 122 }, { width: 384, height: 120 }),
      ],
      'sales',
      160,
      'horizontal',
    )

    expect(lanes.map((entry) => entry.style?.height)).toEqual([160, 80])
    expect(lanes.map((entry) => entry.height)).toEqual([160, 80])
    expect(lanes[1].position.y).toBe(162)
  })

  it('expands a pool when more lanes need the minimum share', () => {
    expect(sizeParticipantContainerForLanes({ width: 420, height: 140 }, 2, 'horizontal')).toEqual({
      width: 420,
      height: 148,
    })
  })

  it('keeps ordinary and nested children inside a lane minimum', () => {
    const sales = lane('sales', { x: 34, y: 2 }, { width: 384, height: 148 })
    const task: BusinessProcessNode = {
      id: 'task',
      type: 'businessProcessActivityNode',
      parentId: sales.id,
      position: { x: 100, y: 20 },
      style: { width: 160, height: 80 },
      data: { kind: 'activity', text: 'Review', taskType: 'task', markers: [] },
    }
    const boundary: BusinessProcessNode = {
      id: 'boundary',
      type: 'businessProcessEventNode',
      parentId: task.id,
      position: { x: 44, y: 44 },
      style: { width: 72, height: 72 },
      data: {
        kind: 'event',
        text: 'Timeout',
        context: 'boundary',
        eventType: 'timer',
        attachedToId: task.id,
      },
    }
    const minimum = minimumParticipantNodeSize(sales, [sales, task, boundary], 'vertical')

    expect(minimum).toEqual({ width: 260, height: 136 })
    expect(
      sizeParticipantContainerForLanes({ width: 180, height: 420 }, 2, 'vertical', [
        minimum,
        minimum,
      ]),
    ).toEqual({ width: 524, height: 420 })
  })

  it('uses content minimums when resizing adjacent vertical lanes', () => {
    const sales = lane('sales', { x: 2, y: 28 }, { width: 260, height: 300 })
    const support = lane('support', { x: 262, y: 28 }, { width: 100, height: 300 })
    const task: BusinessProcessNode = {
      id: 'task',
      type: 'businessProcessActivityNode',
      parentId: sales.id,
      position: { x: 100, y: 20 },
      style: { width: 160, height: 80 },
      data: { kind: 'activity', text: 'Review', taskType: 'task', markers: [] },
    }
    const salesMinimum = minimumParticipantNodeSize(sales, [sales, support, task], 'vertical').width
    const resized = resizeAdjacentParticipantLanes([sales, support], sales.id, 72, 'vertical', [
      salesMinimum,
      MIN_PARTICIPANT_LANE_SIZE,
    ])

    expect(resized.map((lane) => businessProcessNodeSize(lane).width)).toEqual([260, 100])
  })

  it('propagates nested lane minimums until the whole hierarchy settles', () => {
    const pool: BusinessProcessNode = {
      id: 'pool',
      type: 'businessProcessParticipantNode',
      position: { x: 0, y: 0 },
      style: { width: 420, height: 180 },
      data: {
        kind: 'participant',
        text: 'Pool',
        participantType: 'pool',
        orientation: 'horizontal',
        blackBox: false,
      },
    }
    const outerSales = {
      ...lane('sales', { x: 34, y: 2 }, { width: 384, height: 120 }),
      parentId: pool.id,
    }
    const outerSupport = {
      ...lane('support', { x: 34, y: 122 }, { width: 384, height: 60 }),
      parentId: pool.id,
    }
    const nestedFirst = {
      ...lane('sales-a', { x: 34, y: 2 }, { width: 348, height: 60 }),
      parentId: outerSales.id,
    }
    const nestedSecond = {
      ...lane('sales-b', { x: 34, y: 62 }, { width: 348, height: 60 }),
      parentId: outerSales.id,
    }
    expect(
      minimumParticipantNodeSize(outerSales, [
        pool,
        outerSales,
        outerSupport,
        nestedFirst,
        nestedSecond,
      ]),
    ).toEqual({ width: 108, height: 148 })
    expect(
      minimumParticipantNodeSize(
        outerSales,
        [pool, outerSales, outerSupport, nestedFirst, nestedSecond],
        'vertical',
      ),
    ).toEqual({ width: 148, height: 102 })

    const normalize = (input: BusinessProcessNode[]) => {
      let current = input
      for (const container of input) {
        if (container.data.kind !== 'participant') continue
        const orientation = container.data.orientation
        const children = current.filter(
          (node) => node.parentId === container.id && node.data.kind === 'participant',
        )
        if (!children.length) continue

        const laneMinimums = children.map((child) =>
          minimumParticipantNodeSize(child, current, orientation),
        )
        const size = sizeParticipantContainerForLanes(
          businessProcessNodeSize(container),
          children.length,
          orientation,
          laneMinimums,
        )
        const laidOut = layoutParticipantLanes(children, size, orientation, undefined, laneMinimums)
        const lanesById = new Map(laidOut.map((child) => [child.id, child]))
        current = current.map((node) => {
          if (node.id === container.id) {
            return { ...node, ...size, style: { ...node.style, ...size } }
          }
          return lanesById.get(node.id) ?? node
        })
      }
      return current
    }

    const firstPass = normalize([pool, outerSales, outerSupport, nestedFirst, nestedSecond])
    const settled = normalize(firstPass)
    const settledPool = settled.find((node) => node.id === pool.id)
    const settledSales = settled.find((node) => node.id === outerSales.id)
    const settledSupport = settled.find((node) => node.id === outerSupport.id)

    expect(settledPool && businessProcessNodeSize(settledPool)).toEqual({ width: 420, height: 224 })
    expect(settledSales && businessProcessNodeSize(settledSales).height).toBe(148)
    expect(settledSupport && businessProcessNodeSize(settledSupport).height).toBe(72)
    expect(settled).toEqual(firstPass)
  })

  describe('layoutAllParticipantLanes', () => {
    const pool = (size: { width: number; height: number }): BusinessProcessNode => ({
      id: 'pool',
      type: 'businessProcessParticipantNode',
      position: { x: 0, y: 0 },
      width: size.width,
      height: size.height,
      style: size,
      data: {
        kind: 'participant',
        text: 'Orders',
        participantType: 'pool',
        orientation: 'horizontal',
        blackBox: false,
      },
    })

    it('stacks lanes inside their pool and is stable once laid out', () => {
      const nodes = [
        pool({ width: 400, height: 204 }),
        lane('sales', { x: 0, y: 0 }, { width: 100, height: 100 }),
        lane('billing', { x: 0, y: 150 }, { width: 100, height: 100 }),
      ]
      const laidOut = layoutAllParticipantLanes(nodes)
      const sales = laidOut.find((node) => node.id === 'sales')
      const billing = laidOut.find((node) => node.id === 'billing')

      expect(sales?.position).toEqual({ x: 34, y: 2 })
      expect(billing?.position).toEqual({ x: 34, y: 102 })
      expect(layoutAllParticipantLanes(laidOut)).toBe(laidOut)
    })

    it('grows the pool when its lanes need more room', () => {
      const laidOut = layoutAllParticipantLanes([
        pool({ width: 400, height: 100 }),
        lane('sales', { x: 0, y: 0 }, { width: 100, height: 100 }),
        lane('billing', { x: 0, y: 150 }, { width: 100, height: 100 }),
      ])

      expect(businessProcessNodeSize(laidOut[0]).height).toBe(2 * MIN_PARTICIPANT_LANE_SIZE + 4)
    })

    it('returns the same array when there are no lanes', () => {
      const nodes = [pool({ width: 400, height: 200 })]
      expect(layoutAllParticipantLanes(nodes)).toBe(nodes)
    })
  })
})
