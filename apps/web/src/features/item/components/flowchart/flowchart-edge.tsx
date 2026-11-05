import {
  FLOWCHART_EDGE_TYPES,
  type FlowchartEdgeData,
  type FlowchartEdgeType,
} from '@docgraph/common/schemas'
import { BaseEdge, type Edge, type EdgeProps, getSmoothStepPath } from '@xyflow/react'
import { memo, useState } from 'react'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { EdgeLabel } from '../base/edge-label'
import { EdgeMarkerDefs } from '../base/edge-markers'
import { EdgeTextEditor } from '../base/edge-text-editor'
import { HoverTooltipPath } from '../base/hover-tooltip-path'

export type FlowchartEdge = Edge<FlowchartEdgeData, FlowchartEdgeType>

const FORWARD_EDGE_TYPE = FLOWCHART_EDGE_TYPES[0]

export const FlowchartEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    style,
    type = FORWARD_EDGE_TYPE,
  }: EdgeProps<FlowchartEdge>) => {
    const readOnly = useDocumentReadOnly()
    const [editing, setEditing] = useState(false)
    const [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
      offset: 8,
    })
    const edgeText = data?.text ?? ''
    const markerId = `flowchart-marker-${id}`
    const sourceMarkerId = `${markerId}-source`
    const bidirectional = type === FLOWCHART_EDGE_TYPES[1]

    const openEditor = () => {
      if (!readOnly) setEditing(true)
    }

    return (
      <>
        <EdgeMarkerDefs id={markerId} shape='arrow' />
        {bidirectional && (
          <EdgeMarkerDefs id={sourceMarkerId} shape='arrow' orient='auto-start-reverse' />
        )}
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={`url(#${markerId})`}
          markerStart={bidirectional ? `url(#${sourceMarkerId})` : undefined}
          style={style}
        />
        <HoverTooltipPath edgePath={edgePath} onDoubleClick={openEditor} />
        {editing ? (
          <EdgeTextEditor
            edgeId={id}
            value={edgeText}
            x={labelX}
            y={labelY}
            readOnly={readOnly}
            onCommit={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          edgeText && (
            <EdgeLabel x={labelX} y={labelY}>
              {edgeText}
            </EdgeLabel>
          )
        )}
      </>
    )
  },
)
