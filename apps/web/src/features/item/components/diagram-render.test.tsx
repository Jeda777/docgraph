import '@testing-library/jest-dom/vitest'
import { businessProcessNodeZIndex, layoutAllParticipantLanes } from '@docgraph/common/diagram'
import businessProcessFixture from '@docgraph/common/fixtures/business-process.json'
import databaseFixture from '@docgraph/common/fixtures/database-diagram.json'
import flowchartFixture from '@docgraph/common/fixtures/flowchart.json'
import {
  AREA_NODE_TYPE,
  BUSINESS_PROCESS_NODE_TYPES,
  businessProcessSchema,
  DATABASE_DIAGRAM_NODE_TYPE,
  databaseDiagramSchema,
  FLOWCHART_NODE_TYPES,
  flowchartSchema,
} from '@docgraph/common/schemas'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Edge, EdgeTypes, Node, NodeTypes, ZIndexMode } from '@xyflow/react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AreaNode } from './base/area-node'
import { DiagramMutationContext } from './base/diagram-canvas'
import type { BusinessProcessNode as BusinessProcessNodeElement } from './business-process/business-process-node'
import { BusinessProcessNode } from './business-process/business-process-node'
import { DatabaseNode } from './database-diagram/database-node'
import { FlowchartNode } from './flowchart/flowchart-node'

// Diagram components read collaborative state through the hocuspocus provider;
// an inert stub keeps them renderable outside the app shell.
vi.mock('@hocuspocus/provider-react', () => ({
  useHocuspocusProvider: () => ({
    awareness: null,
    authorizedScope: 'read-write',
    on: () => {},
    off: () => {},
    document: {
      getMap: () => ({ keys: () => [], values: () => [] }),
      transact: (fn: () => void) => fn(),
    },
  }),
}))

const renderCanvas = (
  nodes: Node[],
  edges: Edge[],
  nodeTypes: NodeTypes,
  edgeTypes: EdgeTypes,
  zIndexMode?: ZIndexMode,
) =>
  render(
    <ReactFlowProvider>
      <div style={{ width: 1600, height: 1200 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          zIndexMode={zIndexMode}
        />
      </div>
    </ReactFlowProvider>,
  )

/** Every fixture element (areas included) must end up as a canvas node. */
const expectNodeCount = (
  container: HTMLElement,
  fixture: { nodes: unknown[]; areas: unknown[] },
) => {
  const rendered = container.querySelectorAll('.react-flow__node')
  expect(rendered).toHaveLength(fixture.nodes.length + fixture.areas.length)
}

/** Matches an element by its whole text, for text split across inline elements. */
const wholeText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text

const tableNode = (name: string) => {
  const node = screen.getByRole('heading', { name }).closest<HTMLElement>('.react-flow__node')
  if (!node) throw new Error(`Table ${name} is not inside a canvas node`)
  return within(node)
}

/** Every paragraph in a column's row other than its `name: type` label is a flag. */
const columnFlags = (table: ReturnType<typeof within>, column: string) => {
  const label = table.getByText(wholeText(column))
  const row = label.parentElement
  if (!row) throw new Error(`Column ${column} has no row`)
  return within(row)
    .getAllByRole('paragraph')
    .filter((paragraph) => paragraph !== label)
    .map((flag) => flag.textContent)
}

/** React Flow hides nodes until measured and jsdom measures nothing, so give them a size up front. */
const withInitialSize = <T extends Node>(nodes: T[]) =>
  nodes.map((node) => ({ initialWidth: 240, initialHeight: 120, ...node }))

const database = databaseDiagramSchema.parse(databaseFixture)
const flowchart = flowchartSchema.parse(flowchartFixture)
const businessProcess = businessProcessSchema.parse(businessProcessFixture)

const AREA_NODE_TYPES: NodeTypes = { [AREA_NODE_TYPE]: AreaNode }
const BUSINESS_PROCESS_NODE_COMPONENTS: NodeTypes = {
  ...AREA_NODE_TYPES,
  ...Object.fromEntries(BUSINESS_PROCESS_NODE_TYPES.map((type) => [type, BusinessProcessNode])),
}

type MutableCanvasProps = {
  initialNodes: Node[]
}

const MutableCanvas = ({ initialNodes }: MutableCanvasProps) => {
  const [nodes, setNodes] = useState(initialNodes)
  const [edges, setEdges] = useState<Edge[]>([])

  return (
    <DiagramMutationContext.Provider value={{ setNodes, setEdges }}>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={BUSINESS_PROCESS_NODE_COMPONENTS}
          edgeTypes={{}}
          zIndexMode='manual'
        />
      </div>
      <button
        type='button'
        // Local edits run through the diagram's `normalizeNodes`, as in `DiagramCanvas`.
        onClick={() =>
          setNodes((current) =>
            layoutAllParticipantLanes(
              current.filter((node) => node.id !== 'lane-sales') as BusinessProcessNodeElement[],
            ),
          )
        }
      >
        Delete first lane
      </button>
    </DiagramMutationContext.Provider>
  )
}

describe('database diagram rendering', () => {
  it('covers every golden-fixture table and area', () => {
    expect(database.nodes.map((node) => node.data.name)).toEqual(['orders', 'customers'])
    expect(database.areas.map((area) => area.data.name)).toEqual(['Sales module'])
  })

  it('renders every golden-fixture node with its data', () => {
    const { container } = renderCanvas(
      withInitialSize([...database.areas, ...database.nodes]),
      database.edges,
      { ...AREA_NODE_TYPES, [DATABASE_DIAGRAM_NODE_TYPE]: DatabaseNode },
      {},
    )

    expectNodeCount(container, database)
    expect(screen.getByText('Sales module')).toBeInTheDocument()

    const orders = tableNode('orders')
    expect(orders.getByText('Customer orders')).toBeInTheDocument()
    // The constraint keyword is uppercased visually via CSS, not in the DOM.
    expect(orders.getByText(wholeText('unique (id, customer_id)'))).toBeInTheDocument()
    expect(orders.getByText(wholeText('index (customer_id)'))).toBeInTheDocument()
    expect(columnFlags(orders, 'id: uuid')).toEqual(['PK', 'I', 'UN', 'U'])
    expect(orders.getByText('Order identifier')).toBeInTheDocument()
    expect(columnFlags(orders, 'customer_id: bigint(20)')).toEqual(['FK', 'N'])

    const customers = tableNode('customers')
    expect(columnFlags(customers, 'id: bigint')).toEqual(['PK'])
  })
})

describe('flowchart rendering', () => {
  it('renders every registered shape with one multiline text control', () => {
    const { container } = renderCanvas(
      [...flowchart.areas, ...flowchart.nodes],
      flowchart.edges,
      {
        [AREA_NODE_TYPE]: AreaNode,
        ...Object.fromEntries(FLOWCHART_NODE_TYPES.map((type) => [type, FlowchartNode])),
      },
      {},
    )

    expectNodeCount(container, flowchart)
    expect(container.querySelectorAll('textarea')).toHaveLength(0)
    const processHandles = container.querySelectorAll(
      '.react-flow__node-flowchartProcessNode .react-flow__handle',
    )
    expect(processHandles).toHaveLength(4)
    expect((processHandles[0] as HTMLElement).style.zIndex).toBe('20')
    expect((processHandles[0] as HTMLElement).style.top).toBe('4px')
    expect(container.querySelectorAll('svg title').length).toBeGreaterThanOrEqual(
      flowchart.nodes.length,
    )

    const text = Array.from(container.querySelectorAll<HTMLElement>('[aria-label]')).find(
      (element) => element.textContent === 'Request\nrecord',
    )
    expect(text).toBeDefined()
    if (!text) throw new Error('Flowchart text surface was not rendered')
    fireEvent.doubleClick(text)
    expect(container.querySelectorAll('textarea')).toHaveLength(1)
  })
})

describe('business process rendering', () => {
  it('opens lane text editing when double-clicking its label or body', () => {
    const areaNodes = businessProcess.areas
    const diagramNodes = businessProcess.nodes.map((node) => {
      const zIndex = businessProcessNodeZIndex(node)
      return { ...node, ...(zIndex === undefined ? {} : { zIndex }) }
    })
    const nodes = [
      ...areaNodes.map((node, index) => ({ ...node, zIndex: index - areaNodes.length - 2 })),
      ...diagramNodes,
    ]
    const { container } = renderCanvas(nodes, [], BUSINESS_PROCESS_NODE_COMPONENTS, {}, 'manual')
    const lane = container.querySelector<HTMLElement>('.react-flow__node[data-id="lane-sales"]')

    expect(lane).not.toBeNull()
    if (!lane) throw new Error('Sales lane did not render')
    expect(lane.style.zIndex).toBe('-1')
    expect(container.querySelector<HTMLElement>('[data-id="pool-order"]')?.style.zIndex).toBe('-2')
    expect(
      container.querySelector<HTMLElement>('[data-id="area-collaboration"]')?.style.zIndex,
    ).toBe('-3')
    expect(container.querySelector<HTMLElement>('[data-id="order-data"]')?.style.zIndex).toBe('0')
    const laneSurface = lane.querySelector<HTMLElement>('.group')
    expect(laneSurface).not.toBeNull()
    if (!laneSurface) throw new Error('Sales lane surface did not render')

    const laneLabel = lane.querySelector<HTMLButtonElement>('button')
    expect(laneLabel).not.toBeNull()
    if (!laneLabel) throw new Error('Sales lane label did not render')

    fireEvent.doubleClick(laneLabel)

    const textAreaSelector = '.react-flow__node[data-id="lane-sales"] textarea'
    const textArea = container.querySelector<HTMLTextAreaElement>(textAreaSelector)
    expect(textArea).toBeInTheDocument()
    if (!textArea) throw new Error('Sales lane editor did not open')

    fireEvent.keyDown(textArea, { key: 'Escape' })
    fireEvent.doubleClick(laneSurface)
    expect(container.querySelector(textAreaSelector)).toBeInTheDocument()
  })

  it('reflows the remaining lane when a local edit removes another lane', async () => {
    const pool: BusinessProcessNodeElement = {
      id: 'pool',
      type: 'businessProcessParticipantNode',
      position: { x: 40, y: 40 },
      style: { width: 420, height: 300 },
      data: {
        kind: 'participant',
        text: 'Orders',
        participantType: 'pool',
        orientation: 'horizontal',
        blackBox: false,
      },
    }
    const lane = (id: string, y: number): BusinessProcessNodeElement => ({
      id,
      type: 'businessProcessParticipantNode',
      parentId: 'pool',
      position: { x: 34, y },
      style: { width: 384, height: 148 },
      data: {
        kind: 'participant',
        text: id,
        participantType: 'lane',
        orientation: 'horizontal',
        blackBox: false,
      },
    })
    const initialNodes: Node[] = [pool, lane('lane-sales', 2), lane('lane-support', 150)]

    const { container } = render(
      <ReactFlowProvider>
        <MutableCanvas initialNodes={initialNodes} />
      </ReactFlowProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete first lane' }))

    await waitFor(() => {
      const remainingLane = container.querySelector<HTMLElement>(
        '.react-flow__node[data-id="lane-support"]',
      )
      expect(remainingLane?.style.height).toBe('296px')
      expect(remainingLane?.style.transform).toContain('2px')
    })
  })
})
