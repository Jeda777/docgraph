import { cleanup, render } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BusinessProcessEdge, businessProcessEdgeMarkerShapes } from './business-process-edge'

vi.mock('@hocuspocus/provider-react', () => ({
  useHocuspocusProvider: () => ({
    authorizedScope: 'read-write',
    on: () => {},
    off: () => {},
  }),
}))

afterEach(cleanup)

describe('business process edge markers', () => {
  it('uses a filled end triangle for sequence flow', () => {
    expect(
      businessProcessEdgeMarkerShapes('businessProcessSequenceFlowEdge', {
        kind: 'sequenceFlow',
        text: '',
        isDefault: false,
      }),
    ).toEqual({ start: null, end: 'triangle-filled' })
  })

  it('uses a source circle and hollow end triangle for message flow', () => {
    expect(
      businessProcessEdgeMarkerShapes('businessProcessMessageFlowEdge', {
        kind: 'messageFlow',
        text: '',
        initiating: true,
      }),
    ).toEqual({ start: 'circle', end: 'triangle' })
  })

  it('renders conversation links without markers', () => {
    expect(
      businessProcessEdgeMarkerShapes('businessProcessConversationLinkEdge', {
        kind: 'conversationLink',
        text: '',
      }),
    ).toEqual({ start: null, end: null })
  })

  it('renders a double contour for conversation links', () => {
    const { container } = render(
      <svg aria-label='Conversation Link double contour' role='img'>
        <BusinessProcessEdge
          id='conversation-link'
          source='source'
          sourceX={20}
          sourceY={40}
          sourcePosition={Position.Right}
          target='target'
          targetX={260}
          targetY={40}
          targetPosition={Position.Left}
          type='businessProcessConversationLinkEdge'
          data={{ kind: 'conversationLink', text: '' }}
        />
      </svg>,
    )
    const contours = container.querySelectorAll('.react-flow__edge-path')

    expect(contours).toHaveLength(2)
    expect(contours[0].getAttribute('d')).toBe(contours[1].getAttribute('d'))
    expect((contours[0] as SVGPathElement).style.strokeWidth).toBe('4')
    expect((contours[1] as SVGPathElement).style.stroke).toBe('var(--background)')
    expect((contours[1] as SVGPathElement).style.strokeWidth).toBe('2')
  })

  it('keeps association direction semantics', () => {
    expect(
      businessProcessEdgeMarkerShapes('businessProcessAssociationEdge', {
        kind: 'association',
        text: '',
        direction: 'none',
      }),
    ).toEqual({ start: null, end: null })
    expect(
      businessProcessEdgeMarkerShapes('businessProcessAssociationEdge', {
        kind: 'association',
        text: '',
        direction: 'oneWay',
      }),
    ).toEqual({ start: null, end: 'arrow' })
    expect(
      businessProcessEdgeMarkerShapes('businessProcessAssociationEdge', {
        kind: 'association',
        text: '',
        direction: 'bidirectional',
      }),
    ).toEqual({ start: 'arrow', end: 'arrow' })
  })
})
