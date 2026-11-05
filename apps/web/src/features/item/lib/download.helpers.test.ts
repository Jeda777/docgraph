import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { getAbsoluteNodesBounds } from './download.helpers'

describe('getAbsoluteNodesBounds', () => {
  it('includes parent positions when calculating image bounds', () => {
    const nodes: Node[] = [
      {
        id: 'pool',
        type: 'businessProcessParticipantNode',
        position: { x: 1000, y: 1000 },
        width: 0,
        height: 0,
        data: {},
      },
      {
        id: 'activity',
        type: 'businessProcessActivityNode',
        parentId: 'pool',
        position: { x: 0, y: 0 },
        width: 160,
        height: 80,
        data: {},
      },
      {
        id: 'boundary',
        type: 'businessProcessEventNode',
        parentId: 'activity',
        position: { x: 44, y: 44 },
        width: 72,
        height: 72,
        data: {},
      },
    ]

    expect(getAbsoluteNodesBounds(nodes)).toEqual({
      x: 1000,
      y: 1000,
      width: 160,
      height: 116,
    })
  })
})
