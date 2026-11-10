import { describe, expect, it } from 'vitest'
import type { FlowchartCanvasNode } from './flowchart'
import { fitNodesToText, fitNodeToText, getTextFitSize } from './flowchart-node-size.helpers'
import { getFlowchartTool } from './flowchart-tool-registry'

const TYPE = 'flowchartProcessNode'
const LONG_TEXT = 'x'.repeat(30)

const node = (text: string, size: Partial<FlowchartCanvasNode> = {}): FlowchartCanvasNode => ({
  id: 'a',
  type: TYPE,
  position: { x: 0, y: 0 },
  data: { text },
  ...size,
})

describe('flowchart node size', () => {
  it('fits short text into the minimum size, not the default one', () => {
    const tool = getFlowchartTool(TYPE)

    expect(getTextFitSize(TYPE, '')).toEqual({ width: tool.minWidth, height: tool.minHeight })
  })

  it('leaves a node that fits its text unchanged', () => {
    const small = node('', { style: { width: 90, height: 50 } })

    expect(fitNodeToText(small)).toBe(small)
  })

  it('grows a node from its style', () => {
    const fit = getTextFitSize(TYPE, LONG_TEXT)

    expect(fitNodeToText(node(LONG_TEXT, { style: { width: 100, height: 200 } }))).toMatchObject({
      style: { width: fit.width, height: 200 },
    })
  })

  it('grows the resized width and height too, which React Flow renders over the style', () => {
    const fit = getTextFitSize(TYPE, LONG_TEXT)

    const grown = fitNodeToText(
      node(LONG_TEXT, { width: 100, height: 200, style: { width: 400, height: 50 } }),
    )

    expect(grown).toMatchObject({
      width: fit.width,
      height: 200,
      style: { width: fit.width, height: 200 },
    })
  })

  it('fits every node of a local edit', () => {
    const nodes = fitNodesToText([node(LONG_TEXT, { width: 100, height: 100 })])

    expect(nodes[0].width).toBe(getTextFitSize(TYPE, LONG_TEXT).width)
  })
})
