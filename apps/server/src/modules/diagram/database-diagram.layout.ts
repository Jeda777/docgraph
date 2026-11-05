import { TABLE_HEADER_HEIGHT, TABLE_ROW_HEIGHT } from '@docgraph/common/diagram'
import { asTableNode, type DiagramNode } from './database-diagram.model'

// Grid used to place tables that are new to the diagram.
const GRID_COLUMNS = 4
const GRID_GAP_X = 320
const GRID_GAP_Y = 80

/** Estimated height of a table with `columns` rows, before the editor measures it. */
export const tableHeight = (columns: number) => TABLE_HEADER_HEIGHT + columns * TABLE_ROW_HEIGHT

const estimateHeight = (node: DiagramNode) => {
  if (node.style?.height !== undefined) return node.style.height
  if (node.measured?.height !== undefined) return node.measured.height
  return tableHeight(asTableNode(node)?.data.values.length ?? 1)
}

/** Positions for `count` new tables, laid out in a grid below the existing content. */
export const gridPositions = (existing: DiagramNode[], heights: number[]) => {
  const top = existing.length
    ? Math.max(...existing.map((node) => node.position.y + estimateHeight(node))) + GRID_GAP_Y
    : 0
  const left = existing.length ? Math.min(...existing.map((node) => node.position.x)) : 0

  const positions: { x: number; y: number }[] = []
  let rowY = top
  for (let row = 0; row * GRID_COLUMNS < heights.length; row++) {
    const rowHeights = heights.slice(row * GRID_COLUMNS, (row + 1) * GRID_COLUMNS)
    rowHeights.forEach((_, col) => {
      positions.push({ x: left + col * GRID_GAP_X, y: rowY })
    })
    rowY += Math.max(...rowHeights) + GRID_GAP_Y
  }
  return positions
}
