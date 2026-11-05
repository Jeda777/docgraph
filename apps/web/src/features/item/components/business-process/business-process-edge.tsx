import type { BusinessProcessEdgeData, BusinessProcessEdgeType } from '@docgraph/common/schemas'
import { BaseEdge, type Edge, type EdgeProps, getSmoothStepPath } from '@xyflow/react'
import { memo, useState } from 'react'
import { useDocumentReadOnly } from '../../hooks/use-document-read-only'
import { EdgeLabel } from '../base/edge-label'
import { EdgeMarkerDefs, type EdgeMarkerShape } from '../base/edge-markers'
import { EdgeTextEditor } from '../base/edge-text-editor'
import { HoverTooltipPath } from '../base/hover-tooltip-path'

export type BusinessProcessEdge = Edge<BusinessProcessEdgeData, BusinessProcessEdgeType>

export const businessProcessEdgeMarkerShapes = (
  type: BusinessProcessEdgeType,
  data?: BusinessProcessEdgeData,
): { start: EdgeMarkerShape | null; end: EdgeMarkerShape | null } => {
  if (type === 'businessProcessSequenceFlowEdge') return { start: null, end: 'triangle-filled' }
  if (type === 'businessProcessMessageFlowEdge') return { start: 'circle', end: 'triangle' }
  if (type === 'businessProcessConversationLinkEdge') return { start: null, end: null }
  if (type === 'businessProcessAssociationEdge') {
    if (data?.kind !== 'association' || data.direction === 'none') return { start: null, end: null }
    return { start: data.direction === 'bidirectional' ? 'arrow' : null, end: 'arrow' }
  }
  return { start: null, end: 'arrow' }
}

export const BusinessProcessEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    data,
    style,
    type,
  }: EdgeProps<BusinessProcessEdge>) => {
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
    const markerId = `business-process-marker-${id}`
    const edgeData = data
    const markerShapes = businessProcessEdgeMarkerShapes(
      type ?? 'businessProcessSequenceFlowEdge',
      edgeData,
    )
    const sourceMarkerId = `${markerId}-source`
    const dashed =
      type === 'businessProcessMessageFlowEdge' ||
      type === 'businessProcessAssociationEdge' ||
      type === 'businessProcessDataAssociationEdge'
    const edgeStyle = { ...style, strokeDasharray: dashed ? '6 4' : undefined }
    const conversationLink = type === 'businessProcessConversationLinkEdge'

    return (
      <>
        {markerShapes.end && <EdgeMarkerDefs id={markerId} shape={markerShapes.end} />}
        {markerShapes.start && (
          <EdgeMarkerDefs
            id={sourceMarkerId}
            shape={markerShapes.start}
            orient='auto-start-reverse'
          />
        )}
        {conversationLink ? (
          <>
            <BaseEdge id={id} path={edgePath} style={{ ...edgeStyle, strokeWidth: 4 }} />
            <BaseEdge
              id={`${id}-inner-contour`}
              path={edgePath}
              style={{ ...edgeStyle, stroke: 'var(--background)', strokeWidth: 2 }}
            />
          </>
        ) : (
          <BaseEdge
            id={id}
            path={edgePath}
            markerStart={markerShapes.start ? `url(#${sourceMarkerId})` : undefined}
            markerEnd={markerShapes.end ? `url(#${markerId})` : undefined}
            style={edgeStyle}
          />
        )}
        <HoverTooltipPath edgePath={edgePath} onDoubleClick={() => !readOnly && setEditing(true)} />
        {editing ? (
          <EdgeTextEditor
            edgeId={id}
            value={edgeData?.text ?? ''}
            x={labelX}
            y={labelY}
            readOnly={readOnly}
            onCommit={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          edgeData?.text && (
            <EdgeLabel x={labelX} y={labelY}>
              {edgeData.text}
            </EdgeLabel>
          )
        )}
      </>
    )
  },
)
