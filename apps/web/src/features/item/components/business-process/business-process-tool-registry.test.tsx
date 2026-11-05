import type { BusinessProcessNodeData } from '@docgraph/common/schemas'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  COLORS,
  renderBusinessProcessEdgePreview,
  renderBusinessProcessShape,
} from './business-process-shapes'
import {
  businessProcessEdgeToolRegistry,
  businessProcessNodeToolRegistry,
  businessProcessToolRegistry,
} from './business-process-tool-registry'

const renderNode = (data: BusinessProcessNodeData) =>
  renderToStaticMarkup(renderBusinessProcessShape(data, 160, 80, 'Test node'))

/** A node tool's symbol with a fixed label, so only the notation itself can differ. */
const nodeSymbol = (id: string) => {
  const tool = businessProcessNodeToolRegistry.find((entry) => entry.id === id)
  if (!tool) throw new Error(`Missing business process tool: ${id}`)
  return renderNode(tool.createData())
}

/** An edge tool's preview with a fixed label and marker id, parsed so its parts can be queried. */
const edgePreview = (id: string) => {
  const tool = businessProcessEdgeToolRegistry.find((entry) => entry.id === id)
  if (!tool) throw new Error(`Missing business process edge tool: ${id}`)
  const markup = renderToStaticMarkup(
    renderBusinessProcessEdgePreview(tool.edgeType, 'marker', 'Edge'),
  )
  const container = document.createElement('div')
  container.innerHTML = markup
  const svg = container.firstElementChild
  if (!svg) throw new Error(`Empty preview for ${id}`)
  return {
    lines: [...svg.querySelectorAll(':scope > path')],
    arrow: svg.querySelector('marker path'),
    startCircle: svg.querySelector(':scope > circle'),
  }
}

const expectDistinct = (symbols: string[]) => {
  expect(new Set(symbols).size).toBe(symbols.length)
}

describe('business process tool registry', () => {
  it('combines node and edge tools', () => {
    expect(businessProcessToolRegistry).toEqual([
      ...businessProcessNodeToolRegistry,
      ...businessProcessEdgeToolRegistry,
    ])
  })

  it('uses unique tool ids', () => {
    const ids = businessProcessToolRegistry.map((tool) => tool.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(businessProcessToolRegistry)('labels the $id tool', (tool) => {
    expect(tool.label.trim()).not.toBe('')
  })

  it.each(businessProcessToolRegistry)('renders the $id preview as an svg', (tool) => {
    expect(renderToStaticMarkup(tool.preview())).toMatch(/^<svg\b/)
  })

  it('renders Text Annotation without placeholder text lines', () => {
    const annotation = businessProcessNodeToolRegistry.find(
      (tool) => tool.id === 'artifact:annotation',
    )
    if (!annotation) throw new Error('Missing Text Annotation tool')
    expect(renderToStaticMarkup(annotation.preview()).match(/<path/g)).toHaveLength(1)
  })

  it('renders a distinct preview for every connection type', () => {
    expectDistinct(
      businessProcessEdgeToolRegistry.map((tool) =>
        renderToStaticMarkup(renderBusinessProcessEdgePreview(tool.edgeType, 'marker', 'Edge')),
      ),
    )
  })

  it('draws sequence flow as a solid line with a filled arrow', () => {
    const { lines, arrow } = edgePreview('edge:sequence')
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toHaveAttribute('stroke-dasharray')
    expect(arrow?.getAttribute('fill')).toBe(lines[0].getAttribute('stroke'))
  })

  it('draws message flow as a dashed line with a hollow start circle and arrow', () => {
    const { lines, arrow, startCircle } = edgePreview('edge:message')
    expect(lines[0]).toHaveAttribute('stroke-dasharray')
    expect(startCircle).toHaveAttribute('fill', COLORS.white)
    expect(arrow).toHaveAttribute('fill', COLORS.white)
  })

  it('draws conversation link as a solid double line without an arrow', () => {
    const { lines, arrow } = edgePreview('edge:conversation')
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      expect(line).not.toHaveAttribute('stroke-dasharray')
      expect(line).not.toHaveAttribute('marker-end')
    }
    expect(arrow).toBeNull()
  })

  it('fills the send task envelope and leaves the receive task one empty', () => {
    const inkFill = `fill="${COLORS.ink}"`
    expect(nodeSymbol('activity:sendTask')).toContain(inkFill)
    expect(nodeSymbol('activity:receiveTask')).not.toContain(inkFill)
  })

  it('distinguishes event sub-processes from embedded ones', () => {
    expectDistinct([
      nodeSymbol('activity:embeddedSubProcess'),
      nodeSymbol('activity:eventSubProcess'),
    ])
  })

  it('distinguishes plain, sub and call choreographies', () => {
    expectDistinct([
      nodeSymbol('advanced:choreography:task'),
      nodeSymbol('advanced:choreography:subChoreography'),
      nodeSymbol('advanced:choreography:callChoreography'),
    ])
  })

  it('distinguishes plain, sub and call conversations', () => {
    expectDistinct([
      nodeSymbol('advanced:conversation:conversation'),
      nodeSymbol('advanced:conversation:subConversation'),
      nodeSymbol('advanced:conversation:callConversation'),
    ])
  })

  it('changes the activity symbol with each added marker', () => {
    const renderActivity = (
      markers: Extract<BusinessProcessNodeData, { kind: 'activity' }>['markers'],
    ) => renderNode({ kind: 'activity', text: '', taskType: 'task', markers })

    expectDistinct([
      renderActivity([]),
      renderActivity(['loop']),
      renderActivity(['loop', 'compensation']),
      renderActivity(['loop', 'compensation', 'collapsed']),
    ])
  })

  it('renders distinct exclusive, parallel, and instantiating event gateways', () => {
    const renderGateway = (
      gatewayType: Extract<BusinessProcessNodeData, { kind: 'gateway' }>['gatewayType'],
    ) => renderNode({ kind: 'gateway', text: '', gatewayType, direction: 'unspecified' })

    expectDistinct([
      renderGateway('exclusiveEventBased'),
      renderGateway('parallelEventBased'),
      renderGateway('instantiatingExclusiveEventBased'),
      renderGateway('instantiatingParallelEventBased'),
    ])
  })
})
