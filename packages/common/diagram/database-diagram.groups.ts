import { estimateHeight } from './database-diagram.layout'
import {
  type AreaDiagramNode,
  asAreaNode,
  asTableNode,
  type DiagramNode,
  type TableNode,
} from './database-diagram.model'
import { AREA_NODE_MIN_SIZE, AREA_NODE_SIZE, TABLE_ESTIMATED_WIDTH } from './diagram-defaults'

/**
 * Table groups are areas drawn around tables. Areas don't store their members: a table
 * belongs to the area that contains its center, the smallest one when areas overlap.
 */

export type Rect = { x: number; y: number; width: number; height: number }

export const AREA_PADDING = 40
/** Extra room above the tables for the area's name. */
const AREA_LABEL_SPACE = 24

/**
 * Sizes not measured yet are estimated, so the server may see a table near an area's edge
 * on the other side of it than the editor does.
 */
export const tableRect = (node: DiagramNode): Rect => ({
  ...node.position,
  width: node.style?.width ?? node.measured?.width ?? TABLE_ESTIMATED_WIDTH,
  height: estimateHeight(node),
})

export const areaRect = (node: DiagramNode): Rect => ({
  ...node.position,
  width: node.style?.width ?? node.measured?.width ?? AREA_NODE_SIZE.width,
  height: node.style?.height ?? node.measured?.height ?? AREA_NODE_SIZE.height,
})

export const rectsOverlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

const contains = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height

export type TableGroup = { area: AreaDiagramNode; tables: TableNode[] }

/** The areas that contain at least one table, with their tables, in the order of `areas`. */
export const tableGroupsOf = (nodes: DiagramNode[], areas: DiagramNode[]): TableGroup[] => {
  const candidates = areas.flatMap((node) => {
    const area = asAreaNode(node)
    return area ? [{ area, rect: areaRect(area) }] : []
  })
  const tablesByArea = new Map<string, TableNode[]>()

  for (const node of nodes) {
    const table = asTableNode(node)
    if (!table) continue
    const rect = tableRect(table)
    const centerX = rect.x + rect.width / 2
    const centerY = rect.y + rect.height / 2
    const smallest = candidates
      .filter((candidate) => contains(candidate.rect, centerX, centerY))
      .reduce<(typeof candidates)[number] | undefined>(
        (best, candidate) =>
          !best || candidate.rect.width * candidate.rect.height < best.rect.width * best.rect.height
            ? candidate
            : best,
        undefined,
      )
    if (smallest)
      tablesByArea.set(smallest.area.id, [...(tablesByArea.get(smallest.area.id) ?? []), table])
  }

  return candidates.flatMap(({ area }) => {
    const tables = tablesByArea.get(area.id)
    return tables ? [{ area, tables }] : []
  })
}

/** The area rectangle around `tables`, with room for the name and the editor's minimum size. */
export const fitAreaRect = (tables: DiagramNode[]): Rect => {
  const rects = tables.map(tableRect)
  const left = Math.min(...rects.map((rect) => rect.x)) - AREA_PADDING
  const top = Math.min(...rects.map((rect) => rect.y)) - AREA_PADDING - AREA_LABEL_SPACE
  const right = Math.max(...rects.map((rect) => rect.x + rect.width)) + AREA_PADDING
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height)) + AREA_PADDING
  return {
    x: left,
    y: top,
    width: Math.max(right - left, AREA_NODE_MIN_SIZE.width),
    height: Math.max(bottom - top, AREA_NODE_MIN_SIZE.height),
  }
}
