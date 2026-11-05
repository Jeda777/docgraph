import type {
  BUSINESS_PROCESS_TASK_TYPES,
  BusinessProcessEdgeType,
  BusinessProcessEventType,
  BusinessProcessGatewayType,
  BusinessProcessNodeData,
} from '@docgraph/common/schemas'

/**
 * SVG drawing of business process nodes and connection previews. The tool registry
 * (`business-process-tool-registry.ts`) only describes the tools and calls into these.
 */

export const COLORS = {
  ink: '#111827',
  activity: '#f1ee8b',
  start: '#8bdc63',
  intermediate: '#f3a266',
  end: '#ef7777',
  gateway: '#f2a153',
  data: '#8dd6e7',
  artifact: '#f5f0b0',
  white: '#fffdf0',
} as const

const markerProps = {
  fill: 'none',
  stroke: COLORS.ink,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  strokeWidth: 2,
  vectorEffect: 'non-scaling-stroke' as const,
}

const taskIcon = (
  taskType: (typeof BUSINESS_PROCESS_TASK_TYPES)[number],
  cx: number,
  cy: number,
) => {
  const scale = 0.62
  const transform = `translate(${cx - 20 * scale} ${cy - 20 * scale}) scale(${scale})`

  if (taskType === 'serviceTask') {
    return (
      <g transform={transform}>
        <circle cx='20' cy='20' r='6' {...markerProps} />
        <path
          d='M20 8 V12 M20 28 V32 M8 20 H12 M28 20 H32 M11.5 11.5 L14.5 14.5 M25.5 25.5 L28.5 28.5 M28.5 11.5 L25.5 14.5 M14.5 25.5 L11.5 28.5'
          {...markerProps}
        />
      </g>
    )
  }

  if (taskType === 'sendTask' || taskType === 'receiveTask') {
    return (
      <g transform={transform}>
        <path
          d='M8 12 H32 V28 H8 Z'
          {...markerProps}
          fill={taskType === 'sendTask' ? COLORS.ink : 'none'}
        />
        <path
          d='M9 13 L20 22 L31 13'
          {...markerProps}
          stroke={taskType === 'sendTask' ? COLORS.white : COLORS.ink}
        />
      </g>
    )
  }

  if (taskType === 'userTask') {
    return (
      <g transform={transform}>
        <circle cx='20' cy='13' r='4' fill={COLORS.ink} />
        <path d='M11 30 C11 23 14 20 20 20 C26 20 29 23 29 30' fill={COLORS.ink} />
      </g>
    )
  }

  if (taskType === 'manualTask') {
    return (
      <g transform={`translate(${cx - 12} ${cy - 12})`}>
        <path d='M18 11 V6 A2 2 0 0 0 14 6' {...markerProps} />
        <path d='M14 10 V4 A2 2 0 0 0 10 4 V6' {...markerProps} />
        <path d='M10 10.5 V6 A2 2 0 0 0 6 6 V14' {...markerProps} />
        <path
          d='M18 8 A2 2 0 1 1 22 8 V14 A8 8 0 0 1 14 22 H12 C9.2 22 7.5 21.14 6.01 19.66 L2.41 16.06 A2 2 0 0 1 5.24 13.24 L7 15'
          {...markerProps}
        />
      </g>
    )
  }

  if (taskType === 'businessRuleTask') {
    return (
      <g transform={transform}>
        <rect x='9' y='9' width='22' height='22' {...markerProps} />
        <path d='M9 15 H31 M9 22 H31 M16 9 V31 M24 9 V31' {...markerProps} />
      </g>
    )
  }

  if (taskType === 'scriptTask') {
    return (
      <g transform={transform}>
        <path d='M11 9 H29 L32 12 V31 H11 Z M29 9 V13 H32' {...markerProps} />
        <path d='M15 19 L18 22 L15 25 M21 25 H27' {...markerProps} />
      </g>
    )
  }

  if (taskType === 'embeddedSubProcess' || taskType === 'eventSubProcess') {
    return (
      <g transform={`translate(${cx - 8} ${cy + 5})`}>
        <rect x='-7' y='-7' width='14' height='14' {...markerProps} />
        <path d='M0 -4 V4 M-4 0 H4' {...markerProps} />
      </g>
    )
  }

  if (taskType === 'transactionSubProcess') {
    return (
      <g transform={`translate(${cx} ${cy + 5})`}>
        <rect x='-8' y='-7' width='16' height='14' {...markerProps} />
        <rect x='-5' y='-4' width='10' height='8' {...markerProps} />
      </g>
    )
  }

  if (taskType === 'adHocSubProcess') {
    return (
      <path
        d={`M${cx - 10} ${cy + 6} Q${cx - 5} ${cy - 2} ${cx} ${cy + 6} T${cx + 10} ${cy + 6}`}
        {...markerProps}
      />
    )
  }

  return null
}

const activityMarkerTypes = [
  'parallelMultiInstance',
  'sequentialMultiInstance',
  'loop',
  'compensation',
  'adhoc',
  'collapsed',
] as const

type ActivityMarker = (typeof activityMarkerTypes)[number]

const renderActivityMarker = (marker: ActivityMarker) => {
  if (marker === 'parallelMultiInstance') {
    return <path d='M-10 -5 L-4 5 M-3 -5 L3 5 M4 -5 L10 5' {...markerProps} />
  }
  if (marker === 'sequentialMultiInstance') {
    return <path d='M-9 -5 H9 M-9 0 H9 M-9 5 H9' {...markerProps} />
  }
  if (marker === 'loop') {
    return <path d='M-8 4 C-13 -5 7 -8 8 0 M8 0 L4 -3 M8 0 L3 1' {...markerProps} />
  }
  if (marker === 'compensation') {
    return <path d='M8 -6 L-1 0 L8 6 M-1 -6 L-10 0 L-1 6' {...markerProps} />
  }
  if (marker === 'adhoc') {
    return <path d='M-10 3 Q-5 -5 0 3 T10 3' {...markerProps} />
  }
  return (
    <g>
      <rect
        x='-6'
        y='-6'
        width='12'
        height='12'
        fill={COLORS.white}
        stroke={COLORS.ink}
        strokeWidth='2'
      />
      <path d='M0 -3 V3 M-3 0 H3' {...markerProps} />
    </g>
  )
}

const activityMarkers = (markers: string[], cx: number, width: number, height: number) => {
  const visibleMarkers = activityMarkerTypes.filter((marker) => markers.includes(marker))
  if (!visibleMarkers.length) return null

  const scale = Math.min(1, (width - 16) / (visibleMarkers.length * 22 - 2))
  const spacing = 22 * scale
  const firstMarkerX = cx - ((visibleMarkers.length - 1) * spacing) / 2
  const y = height - 12

  return (
    <g>
      {visibleMarkers.map((marker, index) => (
        <g
          key={marker}
          transform={`translate(${firstMarkerX + index * spacing} ${y}) scale(${scale})`}
        >
          {renderActivityMarker(marker)}
        </g>
      ))}
    </g>
  )
}

const eventMarker = (
  eventType: BusinessProcessEventType,
  cx: number,
  cy: number,
  size: number,
  filled: boolean,
) => {
  const s = Math.max(0.55, size / 24)
  const transform = `translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})`
  const fill = filled ? COLORS.ink : 'none'

  if (eventType === 'message') {
    return (
      <g transform={transform}>
        <path d='M4 7 H20 V17 H4 Z M4 8 L12 14 L20 8' {...markerProps} fill={fill} />
      </g>
    )
  }
  if (eventType === 'timer') {
    return (
      <g transform={transform}>
        <circle cx='12' cy='12' r='8' {...markerProps} />
        <path d='M12 7 V12 L16 14' {...markerProps} />
      </g>
    )
  }
  if (eventType === 'conditional') {
    return (
      <g transform={transform}>
        <path d='M5 5 H19 M5 10 H19 M5 15 H19 M5 20 H19' {...markerProps} />
      </g>
    )
  }
  if (eventType === 'link') {
    return (
      <g transform={transform}>
        <path d='M5 12 H19 M13 6 L19 12 L13 18' {...markerProps} />
      </g>
    )
  }
  if (eventType === 'signal') {
    return (
      <g transform={transform}>
        <path d='M12 4 L20 20 H4 Z' {...markerProps} fill={fill} />
      </g>
    )
  }
  if (eventType === 'multiple') {
    return (
      <g transform={transform}>
        <path
          d='M12 4 L14 9 L19 8 L17 13 L21 16 L16 17 L16 22 L12 18 L8 22 L8 17 L3 16 L7 13 L5 8 L10 9 Z'
          {...markerProps}
          fill={fill}
        />
      </g>
    )
  }
  if (eventType === 'parallelMultiple') {
    return (
      <g transform={transform}>
        <path d='M8 4 V20 M16 4 V20 M4 12 H20' {...markerProps} />
      </g>
    )
  }
  if (eventType === 'escalation') {
    return (
      <g transform={transform}>
        <path d='M4 19 L12 5 L20 19 M8 15 L12 9 L16 15' {...markerProps} />
      </g>
    )
  }
  if (eventType === 'error') {
    return (
      <g transform={transform}>
        <path d='M13 3 L5 13 H11 L9 21 L19 10 H13 Z' {...markerProps} fill={fill} />
      </g>
    )
  }
  if (eventType === 'cancel') {
    return (
      <g transform={transform}>
        <circle cx='12' cy='12' r='8' {...markerProps} />
        <path d='M8 8 L16 16 M16 8 L8 16' {...markerProps} />
      </g>
    )
  }
  if (eventType === 'compensation') {
    return (
      <g transform={transform}>
        <path d='M19 4 L11 12 L19 20 M13 4 L5 12 L13 20' {...markerProps} fill={fill} />
      </g>
    )
  }
  if (eventType === 'terminate') {
    return (
      <g transform={transform}>
        <circle cx='12' cy='12' r='8' fill={COLORS.ink} />
      </g>
    )
  }
  return null
}

const gatewayMarker = (gatewayType: BusinessProcessGatewayType, cx: number, cy: number) => {
  if (gatewayType === 'exclusive')
    return (
      <path
        d={`M${cx - 9} ${cy - 9} L${cx + 9} ${cy + 9} M${cx + 9} ${cy - 9} L${cx - 9} ${cy + 9}`}
        {...markerProps}
      />
    )
  if (gatewayType === 'inclusive') return <circle cx={cx} cy={cy} r='9' {...markerProps} />
  if (gatewayType === 'parallel')
    return (
      <path d={`M${cx} ${cy - 10} V${cy + 10} M${cx - 10} ${cy} H${cx + 10}`} {...markerProps} />
    )
  if (gatewayType === 'complex')
    return (
      <path
        d={`M${cx} ${cy - 11} L${cx + 3} ${cy - 4} L${cx + 11} ${cy - 3} L${cx + 5} ${cy + 3} L${cx + 7} ${cy + 11} L${cx} ${cy + 6} L${cx - 7} ${cy + 11} L${cx - 5} ${cy + 3} L${cx - 11} ${cy - 3} L${cx - 3} ${cy - 4} Z`}
        {...markerProps}
      />
    )
  if (gatewayType.includes('EventBased'))
    return (
      <g>
        <path
          d={`M${cx} ${cy - 12} L${cx + 10} ${cy - 4} L${cx + 7} ${cy + 8} L${cx - 7} ${cy + 8} L${cx - 10} ${cy - 4} Z`}
          {...markerProps}
        />
        <circle
          cx={cx}
          cy={cy}
          r='5'
          fill={gatewayType.startsWith('instantiating') ? COLORS.ink : COLORS.white}
          stroke={COLORS.ink}
          strokeWidth='2'
        />
        {gatewayType.toLowerCase().includes('parallel') && (
          <path
            d={`M${cx} ${cy - 2.5} V${cy + 2.5} M${cx - 2.5} ${cy} H${cx + 2.5}`}
            fill='none'
            stroke={gatewayType.startsWith('instantiating') ? COLORS.white : COLORS.ink}
            strokeWidth='1.5'
          />
        )}
      </g>
    )
  return <circle cx={cx} cy={cy} r='5' fill={COLORS.ink} />
}

const renderDataShape = (
  data: Extract<BusinessProcessNodeData, { kind: 'data' }>,
  width: number,
  height: number,
) => {
  const inset = 2
  if (data.dataType === 'store' || data.dataType === 'storeReference') {
    const strokeDasharray = data.dataType === 'storeReference' ? '5 3' : undefined
    return (
      <g>
        <ellipse
          cx={width / 2}
          cy={8}
          rx={width * 0.34}
          ry='6'
          fill={COLORS.data}
          stroke={COLORS.ink}
          strokeDasharray={strokeDasharray}
          strokeWidth='2'
        />
        <path
          d={`M${width * 0.16} 8 V${height - 8} M${width * 0.84} 8 V${height - 8}`}
          fill={COLORS.data}
          stroke={COLORS.ink}
          strokeDasharray={strokeDasharray}
          strokeWidth='2'
        />
        <path
          d={`M${width * 0.16} ${height - 8} C${width * 0.16} ${height + 2} ${width * 0.84} ${height + 2} ${width * 0.84} ${height - 8}`}
          fill={COLORS.data}
          stroke={COLORS.ink}
          strokeDasharray={strokeDasharray}
          strokeWidth='2'
        />
      </g>
    )
  }

  return (
    <g>
      <path
        d={`M${inset} ${inset} H${width - 18} L${width - inset} 14 V${height - inset} H${inset} Z`}
        fill={COLORS.data}
        stroke={COLORS.ink}
        strokeDasharray={data.dataType === 'objectReference' ? '5 3' : undefined}
        strokeWidth='2'
      />
      <path
        d={`M${width - 18} ${inset} V14 H${width - inset}`}
        fill='none'
        stroke={COLORS.ink}
        strokeWidth='2'
      />
      {data.dataType === 'input' && (
        <path
          d={`M${width - 18} ${height / 2} H${width - 5} M${width - 10} ${height / 2 - 5} L${width - 5} ${height / 2} L${width - 10} ${height / 2 + 5}`}
          {...markerProps}
        />
      )}
      {data.dataType === 'output' && (
        <path
          d={`M5 ${height / 2} H18 M13 ${height / 2 - 5} L18 ${height / 2} L13 ${height / 2 + 5}`}
          {...markerProps}
        />
      )}
      {data.collection && (
        <path
          d={`M${width / 2 - 10} ${height - 12} H${width / 2 + 10} M${width / 2 - 10} ${height - 8} H${width / 2 + 10}`}
          {...markerProps}
        />
      )}
    </g>
  )
}

const conversationMarker = (cx: number, cy: number) => (
  <g
    fill={COLORS.white}
    stroke={COLORS.ink}
    strokeLinecap='round'
    strokeLinejoin='round'
    strokeWidth='1.5'
    vectorEffect='non-scaling-stroke'
  >
    <path
      d={`M${cx - 10} ${cy - 7} H${cx + 2} Q${cx + 5} ${cy - 7} ${cx + 5} ${cy - 4} V${cy + 1} Q${cx + 5} ${cy + 4} ${cx + 2} ${cy + 4} H${cx - 3} L${cx - 7} ${cy + 7} V${cy + 4} H${cx - 10} Q${cx - 13} ${cy + 4} ${cx - 13} ${cy + 1} V${cy - 4} Q${cx - 13} ${cy - 7} ${cx - 10} ${cy - 7} Z`}
    />
    <path
      d={`M${cx - 1} ${cy - 2} H${cx + 8} Q${cx + 11} ${cy - 2} ${cx + 11} ${cy + 1} V${cy + 5} Q${cx + 11} ${cy + 8} ${cx + 8} ${cy + 8} H${cx + 4} L${cx + 1} ${cy + 11} V${cy + 8} H${cx - 1} Q${cx - 4} ${cy + 8} ${cx - 4} ${cy + 5} V${cy + 1} Q${cx - 4} ${cy - 2} ${cx - 1} ${cy - 2} Z`}
    />
  </g>
)

/** Full-size SVG of a business process node; palette previews pass a smaller `className`. */
export const renderBusinessProcessShape = (
  data: BusinessProcessNodeData,
  width: number,
  height: number,
  label: string,
  className = 'h-full w-full',
) => {
  const cx = width / 2
  const cy = height / 2
  const inset = 2
  const choreographyMessageCy =
    data.kind === 'choreography' && data.choreographyType === 'subChoreography' ? cy - 3 : cy
  // Theme-filled participants need a theme stroke: fixed ink vanishes on a dark card.
  const participantStroke =
    data.kind === 'participant' && !data.blackBox ? 'var(--foreground)' : COLORS.ink
  const annotationArm = Math.min(20, width * 0.25)

  return (
    <svg
      aria-label={label}
      className={`${className} overflow-visible`}
      role='img'
      viewBox={`0 0 ${width} ${height}`}
    >
      <title>{label}</title>
      {data.kind === 'activity' ? (
        <g>
          <rect
            x={inset}
            y={inset}
            width={width - 2 * inset}
            height={height - 2 * inset}
            rx='8'
            fill={COLORS.activity}
            stroke={COLORS.ink}
            strokeDasharray={data.taskType === 'eventSubProcess' ? '5 3' : undefined}
            strokeWidth={data.taskType === 'callActivity' ? 3 : 2}
          />
          {data.taskType === 'transactionSubProcess' && (
            <rect
              x='5'
              y='5'
              width={width - 10}
              height={height - 10}
              rx='6'
              fill='none'
              stroke={COLORS.ink}
              strokeWidth='1.5'
            />
          )}
          {taskIcon(
            data.taskType,
            Math.max(16, Math.min(24, width * 0.14)),
            Math.max(15, Math.min(21, height * 0.24)),
          )}
          {activityMarkers(data.markers, cx, width, height)}
        </g>
      ) : data.kind === 'event' ? (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={Math.max(8, Math.min(cx, cy) - 2)}
            fill={
              data.context === 'start'
                ? COLORS.start
                : data.context === 'end'
                  ? COLORS.end
                  : COLORS.intermediate
            }
            stroke={COLORS.ink}
            strokeDasharray={
              data.context === 'boundary' && data.interrupting === false ? '5 3' : undefined
            }
            strokeWidth={data.context === 'end' ? 3 : 2}
          />
          {(data.context === 'intermediateCatch' ||
            data.context === 'intermediateThrow' ||
            data.context === 'boundary') && (
            <circle
              cx={cx}
              cy={cy}
              r={Math.max(5, Math.min(cx, cy) - 7)}
              fill='none'
              stroke={COLORS.ink}
              strokeWidth='1.5'
            />
          )}
          {eventMarker(
            data.eventType,
            cx,
            cy,
            Math.min(width, height) * 0.55,
            data.context === 'intermediateThrow' || data.context === 'end',
          )}
        </g>
      ) : data.kind === 'gateway' ? (
        <g>
          <polygon
            points={`${cx},${inset} ${width - inset},${cy} ${cx},${height - inset} ${inset},${cy}`}
            fill={COLORS.gateway}
            stroke={COLORS.ink}
            strokeWidth='2'
          />
          {gatewayMarker(data.gatewayType, cx, cy)}
        </g>
      ) : data.kind === 'participant' ? (
        <g>
          <rect
            x={inset}
            y={inset}
            width={width - 2 * inset}
            height={height - 2 * inset}
            fill={data.blackBox ? COLORS.white : 'var(--card)'}
            stroke={participantStroke}
            strokeWidth='2'
          />
          {data.orientation === 'horizontal' ? (
            <path
              d={`M${Math.min(34, width * 0.2)} ${inset} V${height - inset}`}
              fill='none'
              stroke={participantStroke}
              strokeWidth='2'
            />
          ) : (
            <path
              d={`M${inset} ${Math.min(28, height * 0.24)} H${width - inset}`}
              fill='none'
              stroke={participantStroke}
              strokeWidth='2'
            />
          )}
        </g>
      ) : data.kind === 'data' ? (
        renderDataShape(data, width, height)
      ) : data.kind === 'artifact' ? (
        <g>
          {/* Unfilled bracket (text annotation) so the theme text color stays readable. */}
          <path
            d={`M${inset + annotationArm} ${inset} H${inset} V${height - inset} H${inset + annotationArm}`}
            fill='none'
            stroke='var(--foreground)'
            strokeWidth='2'
          />
        </g>
      ) : data.kind === 'choreography' ? (
        <g>
          <rect
            x={inset}
            y={inset}
            width={width - 2 * inset}
            height={height - 2 * inset}
            rx='8'
            fill={COLORS.activity}
            stroke={COLORS.ink}
            strokeWidth={data.choreographyType === 'callChoreography' ? 3 : 2}
          />
          <path
            d={`M${inset} ${height * 0.26} H${width - inset} M${inset} ${height * 0.74} H${width - inset}`}
            {...markerProps}
          />
          <path
            d={`M${cx - 10} ${choreographyMessageCy - 5} H${cx + 10} V${choreographyMessageCy + 6} H${cx - 10} Z M${cx - 10} ${choreographyMessageCy - 4} L${cx} ${choreographyMessageCy + 3} L${cx + 10} ${choreographyMessageCy - 4}`}
            {...markerProps}
          />
          {data.choreographyType === 'subChoreography' &&
            activityMarkers(['collapsed'], cx, width, height)}
        </g>
      ) : (
        <g>
          <polygon
            points={`${width * 0.16},${inset} ${width * 0.84},${inset} ${width - inset},${cy} ${width * 0.84},${height - inset} ${width * 0.16},${height - inset} ${inset},${cy}`}
            fill={COLORS.artifact}
            stroke={COLORS.ink}
            strokeWidth={data.conversationType === 'callConversation' ? 3 : 2}
          />
          {conversationMarker(cx, cy - (data.conversationType === 'subConversation' ? 8 : 0))}
          {data.conversationType === 'subConversation' &&
            activityMarkers(['collapsed'], cx, width, height)}
        </g>
      )}
    </svg>
  )
}

/**
 * Text color for a node label. Shapes with a fixed light fill need dark ink in every theme;
 * theme-filled or unfilled shapes return `undefined` so the label follows the theme foreground.
 */
export const businessProcessTextColor = (data: BusinessProcessNodeData) => {
  if (data.kind === 'artifact') return undefined
  if (data.kind === 'participant' && !data.blackBox) return undefined
  return COLORS.ink
}

export const renderBusinessProcessEdgePreview = (
  edgeType: BusinessProcessEdgeType,
  markerId: string,
  label: string,
) => {
  const isSequenceFlow = edgeType === 'businessProcessSequenceFlowEdge'
  const isMessageFlow = edgeType === 'businessProcessMessageFlowEdge'
  const isAssociation = edgeType === 'businessProcessAssociationEdge'
  const isDataAssociation = edgeType === 'businessProcessDataAssociationEdge'
  const isConversationLink = edgeType === 'businessProcessConversationLinkEdge'
  const dashed = isMessageFlow || isAssociation || isDataAssociation
  const hasArrow = isSequenceFlow || isMessageFlow || isDataAssociation
  const stroke = edgeType === 'businessProcessDataAssociationEdge' ? '#4aafc8' : COLORS.ink
  const path = isConversationLink ? 'M4 15 H48' : 'M4 17 H48'
  return (
    <svg aria-label={label} className='size-12' role='img' viewBox='0 0 52 34'>
      <title>{label}</title>
      <path
        d={path}
        fill='none'
        markerEnd={hasArrow ? `url(#${markerId})` : undefined}
        stroke={stroke}
        strokeDasharray={dashed ? '5 4' : undefined}
        strokeWidth='2'
      />
      {isConversationLink && <path d='M4 19 H48' fill='none' stroke={stroke} strokeWidth='2' />}
      {isMessageFlow && (
        <circle cx='4' cy='17' r='3.5' fill={COLORS.white} stroke={stroke} strokeWidth='1.5' />
      )}
      <defs>
        {hasArrow && (
          <marker
            id={markerId}
            markerHeight='7'
            markerWidth='7'
            orient='auto'
            refX='6'
            refY='3.5'
            viewBox='0 0 7 7'
          >
            <path
              d={isSequenceFlow || isMessageFlow ? 'M0 0 L7 3.5 L0 7 Z' : 'M0 0 L7 3.5 L0 7'}
              fill={isSequenceFlow ? stroke : isMessageFlow ? COLORS.white : 'none'}
              stroke={stroke}
              strokeWidth='0.8'
            />
          </marker>
        )}
      </defs>
    </svg>
  )
}
