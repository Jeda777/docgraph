import type {
  BUSINESS_PROCESS_TASK_TYPES,
  BusinessProcessEventContext,
  BusinessProcessEventType,
  BusinessProcessGatewayType,
} from '@docgraph/common/schemas'

/** Display labels for the business process values shown in the sidebar dropdowns. */
export const businessProcessTaskTypeLabels: Record<
  (typeof BUSINESS_PROCESS_TASK_TYPES)[number],
  string
> = {
  task: 'Task',
  serviceTask: 'Service task',
  sendTask: 'Send task',
  receiveTask: 'Receive task',
  userTask: 'User task',
  manualTask: 'Manual task',
  businessRuleTask: 'Business rule task',
  scriptTask: 'Script task',
  callActivity: 'Call activity',
  embeddedSubProcess: 'Embedded sub-process',
  eventSubProcess: 'Event sub-process',
  transactionSubProcess: 'Transaction sub-process',
  adHocSubProcess: 'Ad-hoc sub-process',
}

export const businessProcessEventContextLabels: Record<BusinessProcessEventContext, string> = {
  start: 'Start',
  intermediateCatch: 'Intermediate catch',
  boundary: 'Boundary',
  intermediateThrow: 'Intermediate throw',
  end: 'End',
}

export const businessProcessEventTypeLabels: Record<BusinessProcessEventType, string> = {
  none: 'None',
  message: 'Message',
  timer: 'Timer',
  conditional: 'Conditional',
  link: 'Link',
  signal: 'Signal',
  multiple: 'Multiple',
  parallelMultiple: 'Parallel multiple',
  escalation: 'Escalation',
  error: 'Error',
  cancel: 'Cancel',
  compensation: 'Compensation',
  terminate: 'Terminate',
}

export const businessProcessGatewayTypeLabels: Record<BusinessProcessGatewayType, string> = {
  exclusive: 'Exclusive',
  inclusive: 'Inclusive',
  parallel: 'Parallel',
  complex: 'Complex',
  exclusiveEventBased: 'Exclusive event-based',
  parallelEventBased: 'Parallel event-based',
  instantiatingExclusiveEventBased: 'Instantiating exclusive event-based',
  instantiatingParallelEventBased: 'Instantiating parallel event-based',
}
