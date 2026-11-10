import type { FlowchartNodeData, FlowchartNodeType } from '@docgraph/common/schemas'
import type { Node } from '@xyflow/react'
import { getAutoSize } from '../base/editable-node-text'
import { getFlowchartTool } from './flowchart-tool-registry'

type FlowchartNode = Node<FlowchartNodeData, FlowchartNodeType>

const toSize = (value: number | string | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

/** Smallest size that fits the text. Unlike auto-size on a text edit, it ignores the default size. */
export const getTextFitSize = (type: FlowchartNodeType, text: string) => {
  const tool = getFlowchartTool(type)
  return getAutoSize(text, {
    defaultWidth: tool.minWidth,
    defaultHeight: tool.minHeight,
    minWidth: tool.minWidth,
    minHeight: tool.minHeight,
    preserveAspectRatio: tool.preserveAspectRatio,
  })
}

/**
 * Grows a node that is smaller than its text, or returns it unchanged. React Flow renders
 * `width`/`height` (set by resizing) over `style`, so both grow.
 */
export const fitNodeToText = <N extends FlowchartNode>(node: N): N => {
  if (!node.type) return node
  const tool = getFlowchartTool(node.type)
  const fit = getTextFitSize(node.type, node.data.text)
  const width = node.width ?? toSize(node.style?.width) ?? node.measured?.width ?? tool.defaultWidth
  const height =
    node.height ?? toSize(node.style?.height) ?? node.measured?.height ?? tool.defaultHeight
  if (width >= fit.width && height >= fit.height) return node

  const grown = { width: Math.max(width, fit.width), height: Math.max(height, fit.height) }
  return {
    ...node,
    ...(node.width === undefined ? {} : { width: grown.width }),
    ...(node.height === undefined ? {} : { height: grown.height }),
    style: { ...node.style, ...grown },
  }
}

/** `normalizeNodes` of the flowchart: a local edit never leaves a node smaller than its text. */
export const fitNodesToText = <N extends FlowchartNode>(nodes: N[]) => nodes.map(fitNodeToText)
