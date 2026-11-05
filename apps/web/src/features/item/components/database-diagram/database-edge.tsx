import {
  DATABASE_DIAGRAM_DEFAULT_EDGE_DATA,
  type DATABASE_DIAGRAM_EDGE_TYPE,
  type DatabaseDiagramEdgeData,
} from '@docgraph/common/schemas'
import { BaseEdge, type Edge, type EdgeProps, getBezierPath } from '@xyflow/react'
import { HoverTooltipPath } from '../base/hover-tooltip-path'

export type DatabaseEdge = Edge<DatabaseDiagramEdgeData, typeof DATABASE_DIAGRAM_EDGE_TYPE>

export const DatabaseEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<DatabaseEdge>) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const edgeData = data ?? DATABASE_DIAGRAM_DEFAULT_EDGE_DATA

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <HoverTooltipPath
        edgePath={edgePath}
        renderTooltip={() => (
          <>
            <p>{edgeData.relation}</p>
            {edgeData.nullable && <p>nullable</p>}
            <p>on delete: {edgeData.onDelete}</p>
            <p>on update: {edgeData.onUpdate}</p>
          </>
        )}
      />
    </>
  )
}
