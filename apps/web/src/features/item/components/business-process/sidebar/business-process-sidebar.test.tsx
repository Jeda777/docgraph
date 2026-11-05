import { BUSINESS_PROCESS_EDGE_TYPES, type BusinessProcessEdgeType } from '@docgraph/common/schemas'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaNode } from '../../base/area-node'
import type { BusinessProcessEdge } from '../business-process-edge'
import type { BusinessProcessNode } from '../business-process-node'
import { BusinessProcessSidebar } from './business-process-sidebar'

const toast = vi.hoisted(() => ({ add: vi.fn() }))

vi.mock('@/components/ui/toast', () => ({ toast }))

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

const [SEQUENCE_FLOW] = BUSINESS_PROCESS_EDGE_TYPES

const activity = (id: string, selected = false): BusinessProcessNode => ({
  id,
  type: 'businessProcessActivityNode',
  position: { x: 100, y: 100 },
  style: { width: 160, height: 80 },
  data: { kind: 'activity', text: id, taskType: 'task', markers: [] },
  ...(selected ? { selected } : {}),
})

const catchEvent = (id: string, selected = false): BusinessProcessNode => ({
  id,
  type: 'businessProcessEventNode',
  position: { x: 400, y: 100 },
  style: { width: 48, height: 48 },
  data: {
    kind: 'event',
    text: id,
    context: 'intermediateCatch',
    eventType: 'message',
    interrupting: true,
  },
  ...(selected ? { selected } : {}),
})

const sequenceFlow = (
  id: string,
  source: string,
  target: string,
  selected = false,
): BusinessProcessEdge => ({
  id,
  source,
  target,
  type: SEQUENCE_FLOW,
  data: { kind: 'sequenceFlow', text: '', isDefault: false },
  ...(selected ? { selected } : {}),
})

/** Latest collections the sidebar wrote, read back after each interaction. */
let nodes: BusinessProcessNode[] = []
let edges: BusinessProcessEdge[] = []

const onEdgeTypeChange = vi.fn()

type HarnessProps = {
  initialNodes?: BusinessProcessNode[]
  initialEdges?: BusinessProcessEdge[]
  activeEdgeType?: BusinessProcessEdgeType
  readOnly?: boolean
}

/** Owns the collections like the diagram page does, so sidebar changes show up in the DOM. */
const Harness = ({
  initialNodes = [],
  initialEdges = [],
  activeEdgeType = SEQUENCE_FLOW,
  readOnly,
}: HarnessProps) => {
  const [nodeState, setNodes] = useState(initialNodes)
  const [edgeState, setEdges] = useState(initialEdges)
  const [areas, setAreas] = useState<AreaNode[]>([])
  nodes = nodeState
  edges = edgeState

  return (
    <BusinessProcessSidebar
      nodes={nodeState}
      edges={edgeState}
      areas={areas}
      setNodes={setNodes}
      setEdges={setEdges}
      setAreas={setAreas}
      replaceDocument={vi.fn()}
      itemName='Order process'
      activeEdgeType={activeEdgeType}
      onEdgeTypeChange={onEdgeTypeChange}
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

const openProperties = () => fireEvent.click(screen.getByRole('tab', { name: 'Properties' }))

/**
 * Picks `option` from the select whose label starts with `label`. Base UI only accepts a mouse
 * click on an option that started with a pointer press on it, so send both like a browser would.
 */
const choose = (label: string, option: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: new RegExp(`^${label}`) }))
  const item = screen.getByRole('option', { name: option })
  fireEvent.pointerDown(item, { pointerType: 'mouse' })
  fireEvent.click(item)
}

beforeEach(() => {
  toast.add.mockReset()
  onEdgeTypeChange.mockReset()
})

afterEach(cleanup)

describe('BusinessProcessSidebar', () => {
  describe('palette', () => {
    it('opens on the element palette with the active connection type', () => {
      renderSidebar()

      expect(screen.getByRole('tab', { name: 'Elements', selected: true })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /^Active connection/ })).toHaveTextContent(
        'Sequence Flow',
      )
    })

    it('reports a new active connection type', () => {
      renderSidebar()

      choose('Active connection', 'Message Flow')

      expect(onEdgeTypeChange).toHaveBeenCalledWith(BUSINESS_PROCESS_EDGE_TYPES[1])
    })

    it('adds the clicked element to the diagram', () => {
      renderSidebar()

      fireEvent.click(screen.getByRole('button', { name: 'Task' }))

      expect(nodes).toHaveLength(1)
      expect(nodes[0]).toMatchObject({
        type: 'businessProcessActivityNode',
        data: { kind: 'activity', taskType: 'task' },
      })
    })

    it('warns instead of adding a boundary event without a selected activity', () => {
      renderSidebar()

      fireEvent.click(screen.getByRole('button', { name: 'Boundary: timer' }))

      expect(nodes).toEqual([])
      expect(toast.add).toHaveBeenCalledWith({
        type: 'warning',
        title: 'Select an activity before adding a boundary event.',
      })
    })

    it('attaches a boundary event to the selected activity', () => {
      renderSidebar({ initialNodes: [activity('a', true)] })

      fireEvent.click(screen.getByRole('button', { name: 'Boundary: timer' }))

      expect(toast.add).not.toHaveBeenCalled()
      expect(nodes[1]?.data).toMatchObject({ context: 'boundary', attachedToId: 'a' })
    })

    it('filters elements by search and keeps the query across tabs', () => {
      renderSidebar()
      const search = () => screen.getByRole('textbox', { name: 'Search business process elements' })

      fireEvent.change(search(), { target: { value: 'gateway' } })

      expect(screen.queryByRole('button', { name: 'Task' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Gateways' })).toBeInTheDocument()

      openProperties()
      fireEvent.click(screen.getByRole('tab', { name: 'Elements' }))
      expect(search()).toHaveValue('gateway')

      fireEvent.change(search(), { target: { value: 'no such element' } })
      expect(screen.getByText('No matching elements.')).toBeInTheDocument()
    })

    it('duplicates the selected element', () => {
      renderSidebar({ initialNodes: [activity('a', true)] })

      fireEvent.click(screen.getByRole('button', { name: 'Duplicate selected element' }))

      expect(nodes).toHaveLength(2)
      expect(nodes[1]).toMatchObject({ data: { text: 'a' }, selected: false })
      expect(nodes[1].id).not.toBe('a')
    })

    it('cannot duplicate without a selection', () => {
      renderSidebar({ initialNodes: [activity('a')] })

      expect(screen.getByRole('button', { name: 'Duplicate selected element' })).toBeDisabled()
    })
  })

  describe('properties', () => {
    it('hints to select an element when nothing is selected', () => {
      renderSidebar({ initialNodes: [activity('a')] })

      openProperties()

      expect(screen.getByText(/Select an element to edit/)).toBeInTheDocument()
    })

    it('edits the label of the selected element', () => {
      renderSidebar({ initialNodes: [activity('a', true), activity('b')] })
      openProperties()

      fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), {
        target: { value: 'Ship order' },
      })

      expect(nodes.map((node) => node.data.text)).toEqual(['Ship order', 'b'])
    })

    it('edits the label of the selected connection', () => {
      renderSidebar({
        initialNodes: [activity('a'), catchEvent('e')],
        initialEdges: [sequenceFlow('flow', 'a', 'e', true)],
      })
      openProperties()

      expect(screen.getByText('Connection')).toBeInTheDocument()
      fireEvent.change(screen.getByRole('textbox', { name: 'Label' }), {
        target: { value: 'paid' },
      })

      expect(edges[0].data?.text).toBe('paid')
    })

    it('rejects an event context that breaks existing connections', () => {
      const initialNodes = [activity('a'), catchEvent('e', true)]
      renderSidebar({ initialNodes, initialEdges: [sequenceFlow('flow', 'a', 'e')] })
      openProperties()

      // A start event cannot have an incoming sequence flow.
      choose('Context', 'start')

      expect(nodes).toEqual(initialNodes)
      expect(toast.add).toHaveBeenCalledWith({
        type: 'warning',
        title: 'This event context is incompatible with its existing connections.',
      })
    })

    it('applies an event context compatible with existing connections', () => {
      renderSidebar({
        initialNodes: [activity('a'), catchEvent('e', true)],
        initialEdges: [sequenceFlow('flow', 'a', 'e')],
      })
      openProperties()

      choose('Context', 'end')

      expect(toast.add).not.toHaveBeenCalled()
      expect(nodes[1].data).toMatchObject({ kind: 'event', context: 'end' })
    })
  })

  describe('read-only', () => {
    it('disables the palette and leaves the diagram untouched', () => {
      const initialNodes = [activity('a', true)]
      renderSidebar({ initialNodes, readOnly: true })

      expect(screen.getByRole('button', { name: 'Task' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Duplicate selected element' })).toBeDisabled()
      expect(screen.getByRole('combobox', { name: /^Active connection/ })).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: 'Task' }))
      fireEvent.click(screen.getByRole('button', { name: 'Duplicate selected element' }))

      expect(nodes).toEqual(initialNodes)
    })

    it('disables property fields', () => {
      renderSidebar({ initialNodes: [activity('a', true)], readOnly: true })

      openProperties()

      expect(screen.getByRole('textbox', { name: 'Label' })).toBeDisabled()
    })
  })
})
