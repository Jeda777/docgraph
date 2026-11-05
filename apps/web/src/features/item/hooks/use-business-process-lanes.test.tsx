import { minimumParticipantNodeSize } from '@docgraph/common/diagram'
import type { BusinessProcessNodeData } from '@docgraph/common/schemas'
import { act, cleanup, renderHook } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { BusinessProcessNode } from '../components/business-process/business-process-node'
import { useBusinessProcessLanes } from './use-business-process-lanes'

type Orientation = 'horizontal' | 'vertical'

const participant = (
  id: string,
  participantType: 'pool' | 'lane',
  position: { x: number; y: number },
  { parentId, orientation = 'horizontal' }: { parentId?: string; orientation?: Orientation } = {},
): BusinessProcessNode => ({
  id,
  type: 'businessProcessParticipantNode',
  position,
  style: { width: 400, height: 120 },
  ...(parentId ? { parentId } : {}),
  data: { kind: 'participant', text: id, participantType, orientation, blackBox: false },
})

const annotation = (id: string, parentId?: string): BusinessProcessNode => ({
  id,
  type: 'businessProcessArtifactNode',
  position: { x: 10, y: 10 },
  ...(parentId ? { parentId } : {}),
  data: { kind: 'artifact', text: id, artifactType: 'textAnnotation' },
})

const POOL = participant('pool', 'pool', { x: 0, y: 0 })
const LANE_BOTTOM = participant('lane-bottom', 'lane', { x: 0, y: 240 }, { parentId: 'pool' })
const LANE_TOP = participant('lane-top', 'lane', { x: 0, y: 0 }, { parentId: 'pool' })
const LANE_MIDDLE = participant('lane-middle', 'lane', { x: 0, y: 120 }, { parentId: 'pool' })
const NOTE = annotation('note', 'lane-top')
const NODES = [POOL, LANE_BOTTOM, LANE_TOP, LANE_MIDDLE, NOTE]

type HookProps = { id: string; data: BusinessProcessNodeData; parentId?: string }

/**
 * Renders the hook inside a React Flow store seeded with `nodes`. Also exposes
 * the store so tests can push node or viewport updates, and counts renders to
 * verify the selector's equality check.
 */
const renderLanes = (initialProps: HookProps, nodes: BusinessProcessNode[] = NODES) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReactFlowProvider initialNodes={nodes}>{children}</ReactFlowProvider>
  )
  let renders = 0
  const hook = renderHook(
    ({ id, data, parentId }: HookProps) => {
      renders++
      return { lanes: useBusinessProcessLanes(id, data, parentId), store: useStoreApi() }
    },
    { initialProps, wrapper },
  )
  const setNodes = (next: BusinessProcessNode[]) =>
    act(() => hook.result.current.store.getState().setNodes(next))
  return { ...hook, setNodes, renders: () => renders }
}

const ids = (nodes: readonly { id: string }[]) => nodes.map((node) => node.id)

describe('useBusinessProcessLanes', () => {
  afterEach(() => {
    cleanup()
  })

  describe('non-participants', () => {
    it('return an empty state', () => {
      const { result } = renderLanes({ id: NOTE.id, data: NOTE.data, parentId: NOTE.parentId })

      expect(result.current.lanes).toEqual({
        node: undefined,
        lanes: [],
        laneMinimums: [],
        siblingLanes: [],
      })
    })

    it('share one empty state and never re-render on node changes', () => {
      const first = renderLanes({ id: NOTE.id, data: NOTE.data })
      const second = renderLanes({ id: 'other', data: annotation('other').data })
      expect(first.result.current.lanes).toBe(second.result.current.lanes)

      const rendersBefore = first.renders()
      first.setNodes([
        ...NODES,
        participant('lane-new', 'lane', { x: 0, y: 360 }, { parentId: 'pool' }),
      ])

      expect(first.renders()).toBe(rendersBefore)
    })
  })

  describe('pools', () => {
    it('return the node itself and its lanes ordered top to bottom', () => {
      const { result } = renderLanes({ id: POOL.id, data: POOL.data })
      const state = result.current.lanes

      expect(state.node).toBe(POOL)
      expect(ids(state.lanes)).toEqual(['lane-top', 'lane-middle', 'lane-bottom'])
      expect(state.siblingLanes).toEqual([])
    })

    it('order vertical lanes left to right', () => {
      const pool = participant('pool', 'pool', { x: 0, y: 0 }, { orientation: 'vertical' })
      const lane = (id: string, x: number) =>
        participant(id, 'lane', { x, y: 0 }, { parentId: 'pool', orientation: 'vertical' })
      const { result } = renderLanes({ id: pool.id, data: pool.data }, [
        pool,
        lane('right', 300),
        lane('left', 0),
        lane('center', 150),
      ])

      expect(ids(result.current.lanes.lanes)).toEqual(['left', 'center', 'right'])
    })

    it('compute one minimum size per lane from the lane content', () => {
      const { result } = renderLanes({ id: POOL.id, data: POOL.data })
      const { lanes, laneMinimums } = result.current.lanes

      expect(laneMinimums).toEqual(
        lanes.map((lane) => minimumParticipantNodeSize(lane, NODES, 'horizontal')),
      )
    })

    it('ignore children that are not lanes and lanes of other pools', () => {
      const otherPool = participant('pool-2', 'pool', { x: 0, y: 500 })
      const foreignLane = participant('foreign', 'lane', { x: 0, y: 0 }, { parentId: 'pool-2' })
      const { result } = renderLanes({ id: POOL.id, data: POOL.data }, [
        ...NODES,
        annotation('pool-note', 'pool'),
        otherPool,
        foreignLane,
      ])

      expect(ids(result.current.lanes.lanes)).toEqual(['lane-top', 'lane-middle', 'lane-bottom'])
    })
  })

  describe('lanes', () => {
    it('return the ordered lanes sharing their parent, themselves included', () => {
      const { result } = renderLanes({
        id: LANE_MIDDLE.id,
        data: LANE_MIDDLE.data,
        parentId: 'pool',
      })

      expect(result.current.lanes.node).toBe(LANE_MIDDLE)
      expect(result.current.lanes.lanes).toEqual([])
      expect(ids(result.current.lanes.siblingLanes)).toEqual([
        'lane-top',
        'lane-middle',
        'lane-bottom',
      ])
    })

    it('return nested lanes as their own lanes', () => {
      const nested = (id: string, y: number) =>
        participant(id, 'lane', { x: 0, y }, { parentId: 'lane-top' })
      const { result } = renderLanes({ id: LANE_TOP.id, data: LANE_TOP.data, parentId: 'pool' }, [
        ...NODES,
        nested('sub-b', 60),
        nested('sub-a', 0),
      ])

      expect(ids(result.current.lanes.lanes)).toEqual(['sub-a', 'sub-b'])
    })

    it('have no siblings without a parent', () => {
      const { result } = renderLanes({ id: LANE_TOP.id, data: LANE_TOP.data })

      expect(result.current.lanes.siblingLanes).toEqual([])
    })
  })

  describe('re-rendering', () => {
    it('skips viewport changes', () => {
      const { result, renders } = renderLanes({ id: POOL.id, data: POOL.data })
      const before = result.current.lanes
      const rendersBefore = renders()

      act(() => result.current.store.setState({ transform: [100, 50, 2] }))

      expect(renders()).toBe(rendersBefore)
      expect(result.current.lanes).toBe(before)
    })

    it('skips node changes that leave the lanes untouched', () => {
      const { result, renders, setNodes } = renderLanes({ id: POOL.id, data: POOL.data })
      const before = result.current.lanes
      const rendersBefore = renders()

      setNodes([...NODES, annotation('elsewhere')])

      expect(renders()).toBe(rendersBefore)
      expect(result.current.lanes).toBe(before)
    })

    it('updates when a lane moves', () => {
      const { result, setNodes } = renderLanes({ id: POOL.id, data: POOL.data })

      setNodes([POOL, { ...LANE_BOTTOM, position: { x: 0, y: -50 } }, LANE_TOP, LANE_MIDDLE, NOTE])

      expect(ids(result.current.lanes.lanes)).toEqual(['lane-bottom', 'lane-top', 'lane-middle'])
    })

    it('updates when a lane is added or removed', () => {
      const { result, setNodes } = renderLanes({ id: POOL.id, data: POOL.data })

      setNodes([POOL, LANE_TOP, NOTE])
      expect(ids(result.current.lanes.lanes)).toEqual(['lane-top'])

      setNodes([...NODES, participant('lane-last', 'lane', { x: 0, y: 360 }, { parentId: 'pool' })])
      expect(ids(result.current.lanes.lanes)).toEqual([
        'lane-top',
        'lane-middle',
        'lane-bottom',
        'lane-last',
      ])
    })

    it('updates the node when the participant itself changes', () => {
      const { result, setNodes } = renderLanes({ id: POOL.id, data: POOL.data })
      const resized = { ...POOL, style: { width: 800, height: 360 } }

      setNodes([resized, LANE_BOTTOM, LANE_TOP, LANE_MIDDLE, NOTE])

      expect(result.current.lanes.node).toBe(resized)
    })

    it('recomputes when the orientation prop changes', () => {
      const lane = (id: string, x: number, y: number) =>
        participant(id, 'lane', { x, y }, { parentId: 'pool' })
      const nodes = [POOL, lane('a', 200, 0), lane('b', 0, 100)]
      const { result, rerender } = renderLanes({ id: POOL.id, data: POOL.data }, nodes)
      expect(ids(result.current.lanes.lanes)).toEqual(['a', 'b'])

      rerender({
        id: POOL.id,
        data: { ...POOL.data, orientation: 'vertical' } as BusinessProcessNodeData,
      })

      expect(ids(result.current.lanes.lanes)).toEqual(['b', 'a'])
    })
  })
})
