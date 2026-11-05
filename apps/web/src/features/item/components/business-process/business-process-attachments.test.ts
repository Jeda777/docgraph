import businessProcessFixture from '@docgraph/common/fixtures/business-process.json'
import { businessProcessSchema } from '@docgraph/common/schemas'
import { describe, expect, it } from 'vitest'
import {
  attachBoundaryEventToActivity,
  detachBoundaryEventFromActivity,
  detachBoundaryEventPosition,
  normalizeBoundaryEventAttachments,
} from './business-process-attachments'

const fixture = businessProcessSchema.parse(businessProcessFixture)

describe('business process boundary event attachment', () => {
  it('places the event centered over the activity bottom edge and parents it to the activity', () => {
    expect(
      attachBoundaryEventToActivity(
        'activity',
        { width: 160, height: 80 },
        { width: 72, height: 72 },
      ),
    ).toEqual({
      parentId: 'activity',
      extent: undefined,
      position: { x: 44, y: 44 },
    })
  })

  it('normalizes imported boundary events and remains stable after opening', () => {
    const nodes = fixture.nodes
    const normalized = normalizeBoundaryEventAttachments(nodes)
    const boundary = normalized.find((node) => node.id === 'boundary-timeout')

    expect(boundary?.parentId).toBe('validate-order')
    expect(boundary?.extent).toBeUndefined()
    expect(boundary?.position).toEqual({ x: 52, y: 52 })
    expect(normalizeBoundaryEventAttachments(normalized)).toBe(normalized)
  })

  it('does not treat an edge extension as part of the activity boundary', () => {
    const nodes = fixture.nodes
    const outsideSegment = nodes.map((node) =>
      node.id === 'boundary-timeout'
        ? { ...node, parentId: 'validate-order', extent: undefined, position: { x: 1000, y: 52 } }
        : node,
    )
    const normalized = normalizeBoundaryEventAttachments(outsideSegment)
    const boundary = normalized.find((node) => node.id === 'boundary-timeout')

    expect(boundary?.position).toEqual({ x: 52, y: 52 })
  })

  it('repositions an attached event when its activity is resized', () => {
    expect(
      attachBoundaryEventToActivity(
        'activity',
        { width: 260, height: 180 },
        { width: 56, height: 56 },
      ).position,
    ).toEqual({ x: 102, y: 152 })
  })

  it('converts the relative event position back to its activity container', () => {
    expect(detachBoundaryEventPosition({ x: 200, y: 100 }, { x: 44, y: 44 })).toEqual({
      x: 244,
      y: 144,
    })
  })

  it('returns the event to its activity sibling container when detached', () => {
    expect(
      detachBoundaryEventFromActivity(
        { parentId: 'lane', extent: 'parent', position: { x: 200, y: 100 } },
        { x: 44, y: 44 },
      ),
    ).toEqual({
      parentId: 'lane',
      extent: 'parent',
      position: { x: 244, y: 144 },
    })
  })
})
