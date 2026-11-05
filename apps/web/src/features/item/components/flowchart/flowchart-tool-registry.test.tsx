import { FLOWCHART_EDGE_TYPES, FLOWCHART_NODE_TYPES } from '@docgraph/common/schemas'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  flowchartEdgeToolRegistry,
  flowchartNodeToolRegistry,
  flowchartToolRegistry,
} from './flowchart-tool-registry'

describe('flowchart tool registry', () => {
  it('has one tool per schema type, in schema order', () => {
    expect(flowchartNodeToolRegistry.map((tool) => tool.type)).toEqual(FLOWCHART_NODE_TYPES)
    expect(flowchartEdgeToolRegistry.map((tool) => tool.type)).toEqual(FLOWCHART_EDGE_TYPES)
  })

  it('lists node tools before edge tools', () => {
    expect(flowchartToolRegistry).toEqual([
      ...flowchartNodeToolRegistry,
      ...flowchartEdgeToolRegistry,
    ])
  })

  it('uses unique tool types', () => {
    const types = flowchartToolRegistry.map((tool) => tool.type)
    expect(new Set(types).size).toBe(types.length)
  })

  it.each(flowchartToolRegistry)('labels the $type tool', (tool) => {
    expect(tool.label.trim()).not.toBe('')
  })

  it.each(flowchartToolRegistry)('renders the $type preview as an svg', (tool) => {
    expect(renderToStaticMarkup(tool.preview())).toMatch(/^<svg\b/)
  })

  it.each(flowchartNodeToolRegistry)('renders the full-size $type shape as an svg', (tool) => {
    expect(renderToStaticMarkup(tool.render(tool.width, tool.height))).toMatch(/^<svg\b/)
  })
})
