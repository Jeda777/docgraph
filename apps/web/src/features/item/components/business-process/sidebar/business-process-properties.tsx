import {
  BUSINESS_PROCESS_EVENT_CONTEXTS,
  BUSINESS_PROCESS_GATEWAY_TYPES,
  BUSINESS_PROCESS_TASK_TYPES,
  type BusinessProcessEventContext,
  type BusinessProcessEventType,
  type BusinessProcessGatewayType,
  type BusinessProcessNodeData,
  type BusinessProcessTaskType,
  businessProcessEventTypesByContext,
} from '@docgraph/common/schemas'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SidebarHint } from '../../base/sidebar-hint'
import type { ParticipantOrientation } from '../business-process-commands'
import type { BusinessProcessEdge } from '../business-process-edge'
import {
  businessProcessEventContextLabels,
  businessProcessEventTypeLabels,
  businessProcessGatewayTypeLabels,
  businessProcessTaskTypeLabels,
} from '../business-process-labels'
import type { BusinessProcessNode } from '../business-process-node'

const titleForKind = (data: BusinessProcessNodeData) => {
  if (data.kind === 'activity') return data.taskType
  if (data.kind === 'event') return `${data.context} ${data.eventType}`
  if (data.kind === 'gateway') return data.gatewayType
  if (data.kind === 'participant') return `${data.participantType} participant`
  if (data.kind === 'data') return data.dataType
  if (data.kind === 'artifact') return data.artifactType
  if (data.kind === 'choreography') return data.choreographyType
  return data.conversationType
}

export type BusinessProcessPropertiesProps = {
  nodes: BusinessProcessNode[]
  selectedNode?: BusinessProcessNode
  selectedEdge?: BusinessProcessEdge
  onNodeDataChange: (updater: (data: BusinessProcessNodeData) => BusinessProcessNodeData) => void
  onEdgeTextChange: (text: string) => void
  onEventContextChange: (context: BusinessProcessEventContext) => void
  onEventDefinitionChange: (eventType: BusinessProcessEventType) => void
  onBoundaryAttachmentChange: (activityId: string) => void
  onParticipantOrientationChange: (orientation: ParticipantOrientation) => void
  readOnly?: boolean
}

/** Property form of the selected business process element or connection. */
export const BusinessProcessProperties = ({
  nodes,
  selectedNode,
  selectedEdge,
  onNodeDataChange,
  onEdgeTextChange,
  onEventContextChange,
  onEventDefinitionChange,
  onBoundaryAttachmentChange,
  onParticipantOrientationChange,
  readOnly,
}: BusinessProcessPropertiesProps) => {
  if (selectedEdge && !selectedNode) {
    return (
      <div className='flex flex-col gap-3 px-2'>
        <div className='text-xs font-semibold text-muted-foreground'>Connection</div>
        <Label>
          Label
          <Input
            disabled={readOnly}
            value={selectedEdge.data?.text ?? ''}
            onChange={(event) => onEdgeTextChange(event.target.value)}
          />
        </Label>
      </div>
    )
  }

  if (!selectedNode) {
    return <SidebarHint>Select an element to edit its business process properties.</SidebarHint>
  }

  const { data } = selectedNode

  return (
    <div className='flex flex-col gap-3 px-2'>
      <div className='text-xs font-semibold text-muted-foreground'>{titleForKind(data)}</div>
      <Label>
        Label
        <Input
          disabled={readOnly}
          value={data.text}
          onChange={(event) =>
            onNodeDataChange((current) => ({ ...current, text: event.target.value }))
          }
        />
      </Label>
      {data.kind === 'participant' && (
        <Label>
          Orientation
          <Select
            disabled={readOnly}
            value={data.orientation}
            onValueChange={(value) => {
              if (value === 'horizontal' || value === 'vertical') {
                onParticipantOrientationChange(value)
              }
            }}
          >
            <SelectTrigger>
              <SelectValue>
                {data.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='horizontal'>Horizontal</SelectItem>
              <SelectItem value='vertical'>Vertical</SelectItem>
            </SelectContent>
          </Select>
        </Label>
      )}
      {data.kind === 'activity' && (
        <Label>
          Task type
          <Select
            disabled={readOnly}
            value={data.taskType}
            onValueChange={(value) =>
              onNodeDataChange((current) =>
                current.kind === 'activity'
                  ? { ...current, taskType: value as BusinessProcessTaskType }
                  : current,
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_PROCESS_TASK_TYPES.map((value) => (
                <SelectItem key={businessProcessTaskTypeLabels[value]} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
      )}
      {data.kind === 'event' && (
        <>
          <Label>
            Context
            <Select
              disabled={readOnly}
              value={data.context}
              onValueChange={(value) => onEventContextChange(value as BusinessProcessEventContext)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUSINESS_PROCESS_EVENT_CONTEXTS.map((value) => (
                  <SelectItem key={businessProcessEventContextLabels[value]} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label>
            Event definition
            <Select
              disabled={readOnly}
              value={data.eventType}
              onValueChange={(value) => onEventDefinitionChange(value as BusinessProcessEventType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businessProcessEventTypesByContext[data.context].map((value) => (
                  <SelectItem key={businessProcessEventTypeLabels[value]} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
        </>
      )}
      {data.kind === 'gateway' && (
        <Label>
          Gateway type
          <Select
            disabled={readOnly}
            value={data.gatewayType}
            onValueChange={(value) =>
              onNodeDataChange((current) =>
                current.kind === 'gateway'
                  ? { ...current, gatewayType: value as BusinessProcessGatewayType }
                  : current,
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_PROCESS_GATEWAY_TYPES.map((value) => (
                <SelectItem key={businessProcessGatewayTypeLabels[value]} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
      )}
      {data.kind === 'event' && data.context === 'boundary' && (
        <Label>
          Attached activity
          <Select
            disabled={readOnly}
            value={data.attachedToId ?? ''}
            onValueChange={(value) => {
              if (value) onBoundaryAttachmentChange(value)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select an activity' />
            </SelectTrigger>
            <SelectContent>
              {nodes
                .filter((node) => node.data.kind === 'activity')
                .map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.data.text || activity.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Label>
      )}
    </div>
  )
}
