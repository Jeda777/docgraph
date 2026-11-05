import { FLOWCHART_EDGE_TYPES } from '@docgraph/common/schemas'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AreaNode } from '../../base/area-node'
import type { FlowchartNode } from '../flowchart-node'
import { FlowchartSidebar } from './flowchart-sidebar'

vi.mock('@hocuspocus/provider-react', () => ({
  useHocuspocusProvider: () => ({
    awareness: null,
    authorizedScope: 'read-write',
    on: () => {},
    off: () => {},
  }),
}))

// The top bar's profile menu reads the session; it is not under test here.
vi.mock('@/components/account-menu', () => ({ AccountMenu: () => null }))

const processNode = (id: string, selected = false): FlowchartNode => ({
  id,
  type: 'flowchartProcessNode',
  position: { x: 100, y: 100 },
  style: { width: 180, height: 96 },
  data: { text: id },
  ...(selected ? { selected } : {}),
})

/** Latest nodes the sidebar wrote, read back after each interaction. */
let nodes: FlowchartNode[] = []

type HarnessProps = {
  initialNodes?: FlowchartNode[]
  readOnly?: boolean
}

/** Owns the collections like the diagram page does, so sidebar changes show up in the DOM. */
const Harness = ({ initialNodes = [], readOnly }: HarnessProps) => {
  const [nodeState, setNodes] = useState(initialNodes)
  const [areas, setAreas] = useState<AreaNode[]>([])
  nodes = nodeState

  return (
    <FlowchartSidebar
      nodes={nodeState}
      edges={[]}
      areas={areas}
      setNodes={setNodes}
      setAreas={setAreas}
      replaceDocument={vi.fn()}
      itemName='Checkout flow'
      activeEdgeType={FLOWCHART_EDGE_TYPES[0]}
      onEdgeTypeChange={vi.fn()}
      readOnly={readOnly}
    />
  )
}

const renderSidebar = (props: HarnessProps = {}) =>
  render(
    <MemoryRouter>
      <ReactFlowProvider>
        <Harness {...props} />
      </ReactFlowProvider>
    </MemoryRouter>,
  )

const duplicateButton = () => screen.getByRole('button', { name: 'Duplicate selected node' })

afterEach(cleanup)

describe('FlowchartSidebar', () => {
  it('filters shapes by search and keeps the query across tabs', () => {
    renderSidebar()
    const search = () => screen.getByRole('textbox', { name: 'Search flowchart shapes' })

    fireEvent.change(search(), { target: { value: 'decision' } })

    expect(screen.getByRole('button', { name: 'Decision' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Process' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Areas' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Shapes' }))
    expect(search()).toHaveValue('decision')

    fireEvent.change(search(), { target: { value: 'no such shape' } })
    expect(screen.getByText('No matching shapes.')).toBeInTheDocument()
  })

  it('duplicates the selected node', () => {
    renderSidebar({ initialNodes: [processNode('a', true)] })

    fireEvent.click(duplicateButton())

    expect(nodes).toHaveLength(2)
    expect(nodes[1]).toMatchObject({ data: { text: 'a' }, selected: false })
    expect(nodes[1].id).not.toBe('a')
  })

  it('cannot duplicate without a selection', () => {
    renderSidebar({ initialNodes: [processNode('a')] })

    expect(duplicateButton()).toBeDisabled()
  })

  it('disables the palette when read-only', () => {
    renderSidebar({ initialNodes: [processNode('a', true)], readOnly: true })

    expect(duplicateButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Process' })).toBeDisabled()
  })
})
