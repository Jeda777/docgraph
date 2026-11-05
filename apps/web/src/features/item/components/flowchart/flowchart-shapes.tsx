import type { FlowchartNodeType } from '@docgraph/common/schemas'

/**
 * SVG drawing of flowchart shapes and connection previews. The tool registry
 * (`flowchart-tool-registry.ts`) only describes the tools and calls into these.
 */

export type FlowchartShapeGeometry =
  | 'rect'
  | 'diamond'
  | 'document'
  | 'multipleDocuments'
  | 'oval'
  | 'circle'
  | 'terminator'
  | 'preparation'
  | 'delay'
  | 'summingJunction'
  | 'orJunction'
  | 'loopLimit'
  | 'data'
  | 'database'
  | 'storedData'
  | 'internalStorage'
  | 'directData'
  | 'sequentialData'
  | 'card'
  | 'paperTape'
  | 'display'
  | 'manualInput'
  | 'manualOperation'
  | 'mergeOrStorage'
  | 'extractOrMeasurement'
  | 'collate'
  | 'sort'
  | 'onPageReference'
  | 'offPageReference'
  | 'predefinedProcess'
  | 'parallelMode'
  | 'transfer'
  | 'annotationBracket'
  | 'annotationCallout'

const strokeProps = {
  fill: 'var(--card)',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  vectorEffect: 'non-scaling-stroke' as const,
}

const renderShapeGeometry = (geometry: FlowchartShapeGeometry, width: number, height: number) => {
  const inset = 1
  const midX = width / 2
  const midY = height / 2
  const rounded = Math.min(14, height / 2)

  switch (geometry) {
    case 'rect':
      return <rect x={inset} y={inset} width={width - 2} height={height - 2} {...strokeProps} />
    case 'diamond':
      return (
        <polygon
          points={`${midX},${inset} ${width - inset},${midY} ${midX},${height - inset} ${inset},${midY}`}
          {...strokeProps}
        />
      )
    case 'document':
      return (
        <path
          d={`M${inset} ${inset} H${width - inset} V${height * 0.76} Q${width * 0.82} ${height * 0.98} ${width * 0.64} ${height * 0.8} Q${width * 0.42} ${height * 0.58} ${inset} ${height * 0.82} Z`}
          {...strokeProps}
        />
      )
    case 'multipleDocuments':
      return (
        <path
          d={`M${width * 0.12} ${height * 0.12} H${width * 0.88} V${height * 0.76} Q${width * 0.72} ${height * 0.98} ${width * 0.56} ${height * 0.8} Q${width * 0.36} ${height * 0.58} ${width * 0.12} ${height * 0.82} Z M${width * 0.06} ${height * 0.2} V${height * 0.88} H${width * 0.78}`}
          {...strokeProps}
        />
      )
    case 'oval':
      return (
        <ellipse
          cx={midX}
          cy={midY}
          rx={Math.max(2, midX - inset)}
          ry={Math.max(2, midY - inset)}
          {...strokeProps}
        />
      )
    case 'circle':
      return (
        <ellipse
          cx={midX}
          cy={midY}
          rx={Math.min(midX, midY) - inset}
          ry={Math.min(midX, midY) - inset}
          {...strokeProps}
        />
      )
    case 'terminator':
      return (
        <rect
          x={inset}
          y={inset}
          width={width - 2}
          height={height - 2}
          rx={rounded}
          {...strokeProps}
        />
      )
    case 'preparation':
      return (
        <polygon
          points={`${width * 0.14},${inset} ${width * 0.86},${inset} ${width - inset},${midY} ${width * 0.86},${height - inset} ${width * 0.14},${height - inset} ${inset},${midY}`}
          {...strokeProps}
        />
      )
    case 'delay':
      return (
        <path
          d={`M${inset} ${inset} H${width * 0.72} A${height / 2} ${height / 2} 0 0 1 ${width * 0.72} ${height - inset} H${inset} Z`}
          {...strokeProps}
        />
      )
    case 'summingJunction':
      return (
        <g>
          <ellipse
            cx={midX}
            cy={midY}
            rx={Math.min(midX, midY) - inset}
            ry={Math.min(midX, midY) - inset}
            {...strokeProps}
          />
          <path
            d={`M${midX - height * 0.24} ${midY - height * 0.24} L${midX + height * 0.24} ${midY + height * 0.24} M${midX + height * 0.24} ${midY - height * 0.24} L${midX - height * 0.24} ${midY + height * 0.24}`}
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
          />
        </g>
      )
    case 'orJunction':
      return (
        <g>
          <ellipse
            cx={midX}
            cy={midY}
            rx={Math.min(midX, midY) - inset}
            ry={Math.min(midX, midY) - inset}
            {...strokeProps}
          />
          <path
            d={`M${midX - height * 0.22} ${midY} H${midX + height * 0.22}`}
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
          />
        </g>
      )
    case 'loopLimit':
      return (
        <polygon
          points={`${width * 0.18},${inset} ${width * 0.82},${inset} ${width - inset},${midY} ${width * 0.82},${height - inset} ${width * 0.18},${height - inset} ${inset},${midY}`}
          {...strokeProps}
        />
      )
    case 'data':
      return (
        <polygon
          points={`${width * 0.16},${inset} ${width - inset},${inset} ${width * 0.84},${height - inset} ${inset},${height - inset}`}
          {...strokeProps}
        />
      )
    case 'database':
      return (
        <path
          d={`M${inset} ${height * 0.2} A${midX - inset} ${height * 0.2} 0 0 0 ${width - inset} ${height * 0.2} V${height * 0.8} A${midX - inset} ${height * 0.2} 0 0 1 ${inset} ${height * 0.8} Z M${inset} ${height * 0.2} A${midX - inset} ${height * 0.2} 0 0 1 ${width - inset} ${height * 0.2}`}
          {...strokeProps}
        />
      )
    case 'storedData':
      return (
        <path
          d={`M${width * 0.16} ${inset} H${width * 0.84} Q${width - inset} ${inset} ${width - inset} ${height * 0.2} V${height * 0.8} Q${width - inset} ${height - inset} ${width * 0.84} ${height - inset} H${width * 0.16} Q${inset} ${height - inset} ${inset} ${height * 0.8} V${height * 0.2} Q${inset} ${inset} ${width * 0.16} ${inset} Z`}
          {...strokeProps}
        />
      )
    case 'internalStorage':
      return (
        <g>
          <rect x={inset} y={inset} width={width - 2} height={height - 2} {...strokeProps} />
          <path
            d={`M${width * 0.3} ${inset} V${height - inset} M${width * 0.3} ${height * 0.25} H${width - inset}`}
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
          />
        </g>
      )
    case 'directData':
      return (
        <path
          d={`M${inset} ${inset} H${width * 0.7} A${height / 2} ${height / 2} 0 0 1 ${width * 0.7} ${height - inset} H${inset} Z`}
          {...strokeProps}
        />
      )
    case 'sequentialData':
      return (
        <path
          d={`M${inset} ${inset} H${width * 0.76} Q${width - inset} ${inset} ${width - inset} ${height * 0.2} V${height * 0.8} Q${width - inset} ${height - inset} ${width * 0.76} ${height - inset} H${inset} Z`}
          {...strokeProps}
        />
      )
    case 'card':
      return (
        <path
          d={`M${inset} ${height * 0.24} L${width * 0.26} ${inset} H${width - inset} V${height - inset} H${inset} Z`}
          {...strokeProps}
        />
      )
    case 'paperTape':
      return (
        <path
          d={`M${inset} ${height * 0.2} Q${width * 0.2} ${inset} ${width * 0.4} ${height * 0.2} T${width * 0.8} ${height * 0.2} T${width - inset} ${height * 0.2} V${height * 0.8} Q${width * 0.8} ${height - inset} ${width * 0.6} ${height * 0.8} T${width * 0.2} ${height * 0.8} T${inset} ${height * 0.8} Z`}
          {...strokeProps}
        />
      )
    case 'display':
      return (
        <path
          d={`M${width * 0.16} ${inset} H${width * 0.84} L${width - inset} ${midY} L${width * 0.84} ${height - inset} H${width * 0.16} L${inset} ${midY} Z`}
          {...strokeProps}
        />
      )
    case 'manualInput':
      return (
        <polygon
          points={`${width * 0.16},${inset} ${width - inset},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
          {...strokeProps}
        />
      )
    case 'manualOperation':
      return (
        <polygon
          points={`${width * 0.18},${inset} ${width * 0.82},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
          {...strokeProps}
        />
      )
    case 'mergeOrStorage':
      return (
        <polygon
          points={`${midX},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`}
          {...strokeProps}
        />
      )
    case 'extractOrMeasurement':
      return (
        <path
          d={`M${inset} ${inset} H${width - inset} L${width * 0.78} ${height - inset} H${width * 0.22} Z`}
          {...strokeProps}
        />
      )
    case 'collate':
      return (
        <path
          d={`M${inset} ${inset} H${width * 0.38} L${midX} ${midY} L${width * 0.38} ${height - inset} H${inset} L${width * 0.28} ${midY} Z M${width - inset} ${inset} H${width * 0.62} L${midX} ${midY} L${width * 0.62} ${height - inset} H${width - inset} L${width * 0.72} ${midY} Z`}
          {...strokeProps}
        />
      )
    case 'sort':
      return (
        <polygon
          points={`${inset},${inset} ${width - inset},${inset} ${midX},${height - inset}`}
          {...strokeProps}
        />
      )
    case 'onPageReference':
      return <circle cx={midX} cy={midY} r={Math.min(midX, midY) - inset} {...strokeProps} />
    case 'offPageReference':
      return (
        <polygon
          points={`${inset},${inset} ${width - inset},${inset} ${width - inset},${height * 0.72} ${midX},${height - inset} ${inset},${height * 0.72}`}
          {...strokeProps}
        />
      )
    case 'predefinedProcess':
      return (
        <g>
          <rect x={inset} y={inset} width={width - 2} height={height - 2} {...strokeProps} />
          <path
            d={`M${width * 0.14} ${inset} V${height - inset} M${width * 0.86} ${inset} V${height - inset}`}
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
          />
        </g>
      )
    case 'parallelMode':
      return (
        <g>
          <polygon
            points={`${width * 0.18},${inset} ${width * 0.82},${inset} ${width - inset},${midY} ${width * 0.82},${height - inset} ${width * 0.18},${height - inset} ${inset},${midY}`}
            {...strokeProps}
          />
          <path
            d={`M${midX} ${inset} V${height - inset}`}
            fill='none'
            stroke='currentColor'
            strokeWidth='1.5'
          />
        </g>
      )
    case 'transfer':
      return (
        <polygon
          points={`${inset},${height * 0.3} ${width * 0.68},${height * 0.3} ${width * 0.68},${inset} ${width - inset},${midY} ${width * 0.68},${height - inset} ${width * 0.68},${height * 0.7} ${inset},${height * 0.7}`}
          {...strokeProps}
        />
      )
    case 'annotationBracket':
      return (
        <path
          d={`M${width * 0.3} ${inset} H${width * 0.7} M${width * 0.3} ${inset} V${height - inset} M${width * 0.3} ${height - inset} H${width * 0.7}`}
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
        />
      )
    case 'annotationCallout':
      return (
        <path
          d={`M${width * 0.3} ${inset} H${width * 0.7} M${width * 0.3} ${inset} V${height * 0.72} H${width * 0.7} M${width * 0.7} ${height * 0.72} L${width - inset} ${height - inset}`}
          fill='none'
          stroke='currentColor'
          strokeWidth='1.5'
        />
      )
  }
}

export const flowchartShapeGeometry: Record<FlowchartNodeType, FlowchartShapeGeometry> = {
  flowchartProcessNode: 'rect',
  flowchartDecisionNode: 'diamond',
  flowchartDocumentNode: 'document',
  flowchartMultipleDocumentsNode: 'multipleDocuments',
  flowchartStartOvalNode: 'oval',
  flowchartStartCircleNode: 'circle',
  flowchartTerminatorNode: 'terminator',
  flowchartPreparationNode: 'preparation',
  flowchartDelayNode: 'delay',
  flowchartSummingJunctionNode: 'summingJunction',
  flowchartOrJunctionNode: 'orJunction',
  flowchartLoopLimitNode: 'loopLimit',
  flowchartDataNode: 'data',
  flowchartDatabaseNode: 'database',
  flowchartStoredDataNode: 'storedData',
  flowchartInternalStorageNode: 'internalStorage',
  flowchartDirectDataNode: 'directData',
  flowchartSequentialDataNode: 'sequentialData',
  flowchartCardNode: 'card',
  flowchartPaperTapeNode: 'paperTape',
  flowchartDisplayNode: 'display',
  flowchartManualInputNode: 'manualInput',
  flowchartManualOperationNode: 'manualOperation',
  flowchartMergeOrStorageNode: 'mergeOrStorage',
  flowchartExtractOrMeasurementNode: 'extractOrMeasurement',
  flowchartCollateNode: 'collate',
  flowchartSortNode: 'sort',
  flowchartOnPageReferenceNode: 'onPageReference',
  flowchartOffPageReferenceNode: 'offPageReference',
  flowchartPredefinedProcessNode: 'predefinedProcess',
  flowchartParallelModeNode: 'parallelMode',
  flowchartTransferNode: 'transfer',
  flowchartAnnotationBracketNode: 'annotationBracket',
  flowchartAnnotationCalloutNode: 'annotationCallout',
}

export const renderFlowchartShape = (
  type: FlowchartNodeType,
  width: number,
  height: number,
  label: string,
  preview = false,
) => (
  <svg
    aria-label={label}
    className={preview ? 'size-10 overflow-visible' : 'h-full w-full overflow-visible'}
    role='img'
    viewBox={`0 0 ${width} ${height}`}
    preserveAspectRatio={preview ? 'xMidYMid meet' : 'none'}
  >
    <title>{label}</title>
    {renderShapeGeometry(flowchartShapeGeometry[type], width, height)}
  </svg>
)

export const renderFlowchartEdgePreview = (bidirectional: boolean) => (
  <svg
    aria-label={bidirectional ? 'Bidirectional Flow Line' : 'Flow Line'}
    className='size-10'
    viewBox='0 0 48 34'
    role='img'
  >
    <title>{bidirectional ? 'Bidirectional Flow Line' : 'Flow Line'}</title>
    <defs>
      <marker
        id={bidirectional ? 'flowchart-preview-bidirectional' : 'flowchart-preview-forward'}
        markerHeight='6'
        markerWidth='6'
        orient='auto'
        refX='5'
        refY='3'
        viewBox='0 0 6 6'
      >
        <path d='M0 0 L6 3 L0 6 Z' fill='currentColor' />
      </marker>
    </defs>
    <path
      d='M4 17 H44'
      fill='none'
      markerEnd={`url(#${bidirectional ? 'flowchart-preview-bidirectional' : 'flowchart-preview-forward'})`}
      stroke='currentColor'
      strokeWidth='1.5'
    />
    {bidirectional && (
      <path
        d='M44 17 H4'
        fill='none'
        markerEnd='url(#flowchart-preview-bidirectional)'
        stroke='currentColor'
        strokeWidth='1.5'
      />
    )}
  </svg>
)
