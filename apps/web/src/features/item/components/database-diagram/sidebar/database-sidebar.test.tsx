import {
  columnHandleId,
  DATABASE_DIAGRAM_EDGE_TYPE,
  DATABASE_DIAGRAM_NODE_TYPE,
} from '@docgraph/common/schemas'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AreaNode } from '../../base/area-node'
import type { DatabaseEdge } from '../database-edge'
import type { DatabaseNode } from '../database-node'
import { focusDiagramItem } from '../focus'
import { DatabaseSidebar } from './database-sidebar'

// Sidebar cards report which field is being edited through the provider's awareness;
// an inert stub keeps them renderable outside the app shell.
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

// Revealing a focused card scrolls and flashes it; jsdom implements neither,
// so stub them for the test and put the prototype back afterwards.
const originalScrollIntoView = Element.prototype.scrollIntoView
const originalAnimate = Element.prototype.animate

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.animate = vi.fn()
})

afterEach(() => {
  cleanup()
  Element.prototype.scrollIntoView = originalScrollIntoView
  Element.prototype.animate = originalAnimate
})

const column = (id: string, name: string, primaryKey = false) => ({
  id,
  name,
  value: 'int',
  primaryKey,
  foreignKey: false,
  index: false,
  unique: false,
  nullable: false,
})

const USERS: DatabaseNode = {
  id: 'users',
  type: DATABASE_DIAGRAM_NODE_TYPE,
  position: { x: 0, y: 0 },
  data: { name: 'users', color: 'red', values: [column('users-id', 'id', true)] },
}

const ORDERS: DatabaseNode = {
  id: 'orders',
  type: DATABASE_DIAGRAM_NODE_TYPE,
  position: { x: 300, y: 0 },
  data: {
    name: 'orders',
    color: 'blue',
    values: [column('orders-id', 'id', true), column('orders-user', 'user_id')],
  },
}

const RELATION: DatabaseEdge = {
  id: 'orders-users',
  source: 'orders',
  target: 'users',
  sourceHandle: columnHandleId('orders-user', 'left'),
  targetHandle: columnHandleId('users-id', 'right'),
  type: DATABASE_DIAGRAM_EDGE_TYPE,
}

const replaceDocument = vi.fn()

type HarnessProps = {
  nodes?: DatabaseNode[]
  edges?: DatabaseEdge[]
  readOnly?: boolean
}

/** Owns the collections like the diagram page does, so sidebar changes show up in the DOM. */
const Harness = ({ nodes: initialNodes = [USERS], edges = [], readOnly }: HarnessProps) => {
  const [nodes, setNodes] = useState(initialNodes)
  const [edgeState, setEdges] = useState(edges)
  const [areas, setAreas] = useState<AreaNode[]>([])

  return (
    <DatabaseSidebar
      nodes={nodes}
      edges={edgeState}
      areas={areas}
      setNodes={setNodes}
      setEdges={setEdges}
      setAreas={setAreas}
      replaceDocument={replaceDocument}
      itemName='Shop schema'
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

/** Names typed into the table cards, in sidebar order. */
const tableNames = () =>
  Array.from(document.querySelectorAll('[id^="sidebar-node-"]')).map(
    (card) => (card.querySelector('input[type="text"]') as HTMLInputElement).value,
  )

/** The "+" button next to the tabs, present only when the active tab can add elements. */
const addButton = () => screen.queryByRole('button', { name: 'Add' })

describe('DatabaseSidebar', () => {
  it('shows a card per table on the Tables tab', () => {
    renderSidebar({ nodes: [USERS, ORDERS] })

    expect(screen.getByRole('tab', { name: 'Tables', selected: true })).toBeInTheDocument()
    expect(tableNames()).toEqual(['users', 'orders'])
  })

  it('adds a new table from the "+" button', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(tableNames()).toEqual(['users', 'new_table'])
  })

  it('hides the add button and disables editing when read-only', () => {
    renderSidebar({ readOnly: true })

    expect(addButton()).toBeNull()
    expect(screen.getByDisplayValue('users')).toBeDisabled()
  })

  it('hints how to create a relation when there is none', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('tab', { name: 'Relations' }))

    expect(screen.getByText('Drag between columns to create a relation.')).toBeInTheDocument()
    expect(addButton()).toBeNull()
  })

  it('lists relations by table and column', () => {
    renderSidebar({ nodes: [USERS, ORDERS], edges: [RELATION] })

    fireEvent.click(screen.getByRole('tab', { name: 'Relations' }))

    expect(screen.queryByText(/Drag between columns/)).not.toBeInTheDocument()
    expect(screen.getByText('orders.user_id')).toBeInTheDocument()
    expect(screen.getByText('users.id')).toBeInTheDocument()
  })

  it('hints how to use areas when there is none', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('tab', { name: 'Areas' }))

    expect(screen.getByText(/Add an area to mark/)).toBeInTheDocument()
  })

  it('switches to the tab of an element focused on the canvas', async () => {
    renderSidebar({ nodes: [USERS, ORDERS], edges: [RELATION] })

    act(() => focusDiagramItem({ kind: 'relation', id: RELATION.id }))

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Relations', selected: true })).toBeInTheDocument(),
    )
  })
})
