import '@testing-library/jest-dom/vitest'
import databaseFixtureJson from '@docgraph/common/fixtures/database-diagram.json'
import { databaseDiagramSchema } from '@docgraph/common/schemas'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Panel, Position, ReactFlow, ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatabaseEdge } from './database-diagram/database-edge'
import { FlowchartEdge } from './flowchart/flowchart-edge'

vi.mock('@hocuspocus/provider-react', () => ({
  useHocuspocusProvider: () => ({
    awareness: null,
    authorizedScope: 'read-write',
    on: () => {},
    off: () => {},
  }),
}))

afterEach(cleanup)

/** Parsed through the schema so edge data gets its real (narrow) types instead of JSON-widened strings. */
const databaseFixture = databaseDiagramSchema.parse(databaseFixtureJson)

/** Any geometry that produces a well-formed bezier path. */
const GEOMETRY = {
  source: 'fabricated-source',
  target: 'fabricated-target',
  sourceX: 20,
  sourceY: 40,
  targetX: 260,
  targetY: 280,
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
} as const

/**
 * Mounts edges directly: React Flow's renderer skips them until nodes have measured handles.
 * A real `<ReactFlow>` is still needed for the label layer `EdgeLabelRenderer` portals into.
 */
const renderEdges = (edges: ReactNode) =>
  render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={[]} edges={[]} proOptions={{ hideAttribution: true }}>
          <Panel position='top-left'>
            <svg data-testid='edge-testbed'>
              <title>Edge test bed</title>
              {edges}
            </svg>
          </Panel>
        </ReactFlow>
      </div>
    </ReactFlowProvider>,
  )

const hoverEdge = (container: HTMLElement) => {
  const hitPath = container.querySelector('path[stroke="transparent"]')
  if (!hitPath) throw new Error('edge hover target not found')
  fireEvent.mouseMove(hitPath)
  return hitPath
}

const FIXTURE_EDGE_TOOLTIPS = [
  {
    id: 'rel-1',
    lines: ['one-to-many', 'nullable', 'on delete: SET NULL', 'on update: CASCADE'],
  },
  { id: 'rel-2', lines: ['many-to-many', 'on delete: NO ACTION', 'on update: NO ACTION'] },
]

describe('database edge', () => {
  it('covers every golden fixture edge', () => {
    expect(databaseFixture.edges.map((edge) => edge.id)).toEqual(
      FIXTURE_EDGE_TOOLTIPS.map((edge) => edge.id),
    )
  })

  it.each(FIXTURE_EDGE_TOOLTIPS)(
    'shows the golden fixture $id relation in its hover tooltip',
    ({ id, lines }) => {
      const edge = databaseFixture.edges.find((entry) => entry.id === id)
      if (!edge) throw new Error(`Missing fixture edge: ${id}`)
      const { container } = renderEdges(
        <DatabaseEdge id={edge.id} {...GEOMETRY} data={edge.data} />,
      )

      const hitPath = hoverEdge(container)

      const tooltip = screen.getByRole('tooltip')
      expect(hitPath).toHaveAttribute('aria-describedby', tooltip.id)
      expect(
        within(tooltip)
          .getAllByRole('paragraph')
          .map((line) => line.textContent),
      ).toEqual(lines)
    },
  )

  it('renders the edge path itself', () => {
    const { container } = renderEdges(
      <DatabaseEdge
        id='db-plain'
        {...GEOMETRY}
        data={{ relation: 'one-to-one', nullable: false, onDelete: 'CASCADE', onUpdate: 'CASCADE' }}
      />,
    )

    const path = container.querySelector('.react-flow__edge-path')
    expect(path?.getAttribute('d')).toMatch(/^M20,40/)
  })
})

describe('flowchart edge', () => {
  it('routes around the canvas and does not show a hover tooltip', () => {
    const { container } = renderEdges(
      <FlowchartEdge
        id='flow-route'
        {...GEOMETRY}
        data={{ text: '' }}
        type='flowchartFlowLineEdge'
      />,
    )

    const path = container.querySelector('.react-flow__edge-path')
    expect(path?.getAttribute('d')).toContain('L')

    hoverEdge(container)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
