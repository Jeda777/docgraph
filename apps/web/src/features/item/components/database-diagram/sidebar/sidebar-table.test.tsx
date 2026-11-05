import { DATABASE_DIAGRAM_NODE_TYPE } from '@docgraph/common/schemas'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseNode } from '../database-node'
import { SidebarTable } from './sidebar-table'

const awareness = vi.hoisted(() => ({ setLocalStateField: vi.fn() }))

vi.mock('@hocuspocus/provider-react', () => ({
  useHocuspocusProvider: () => ({ awareness }),
}))

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
  data: {
    name: 'users',
    color: 'red',
    values: [column('users-id', 'id', true), column('users-email', 'email')],
  },
}

const OTHER: DatabaseNode = {
  id: 'other',
  type: DATABASE_DIAGRAM_NODE_TYPE,
  position: { x: 300, y: 0 },
  data: { name: 'other', color: 'blue', values: [column('other-id', 'id', true)] },
}

/** Latest nodes the card wrote, read back after each interaction. */
let nodes: DatabaseNode[] = []

/** Owns the node list like the sidebar does and renders the card of the first node. */
const Harness = ({ initial, readOnly }: { initial: DatabaseNode[]; readOnly?: boolean }) => {
  const [state, setState] = useState(initial)
  nodes = state
  const [first] = state

  if (!first) return null
  return (
    <SidebarTable nodeId={first.id} data={first.data} setNodes={setState} readOnly={readOnly} />
  )
}

const renderTable = ({
  initial = [USERS, OTHER],
  readOnly,
}: {
  initial?: DatabaseNode[]
  readOnly?: boolean
} = {}) => render(<Harness initial={initial} readOnly={readOnly} />)

const users = () => nodes.find((node) => node.id === 'users')

const addConstraint = (type: 'Unique' | 'Index') => {
  fireEvent.click(screen.getByRole('button', { name: 'Add constraint' }))
  fireEvent.click(screen.getByRole('menuitem', { name: type }))
}

beforeEach(() => {
  awareness.setLocalStateField.mockReset()
})

afterEach(cleanup)

describe('SidebarTable', () => {
  it('renames the table without touching other tables', () => {
    renderTable()

    fireEvent.change(screen.getByRole('textbox', { name: 'Table name' }), {
      target: { value: 'accounts' },
    })

    expect(users()?.data.name).toBe('accounts')
    expect(nodes.find((node) => node.id === 'other')).toBe(OTHER)
  })

  it('edits the description', () => {
    renderTable()

    fireEvent.change(screen.getByPlaceholderText('Description'), {
      target: { value: 'Registered users' },
    })

    expect(users()?.data.description).toBe('Registered users')
  })

  it('appends a varchar column', () => {
    renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Add column' }))

    expect(users()?.data.values.map((value) => [value.name, value.value])).toEqual([
      ['id', 'int'],
      ['email', 'int'],
      ['name', 'varchar'],
    ])
    expect(screen.getAllByRole('textbox', { name: 'Column name' })).toHaveLength(3)
  })

  it('deletes the table', () => {
    renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Delete table' }))

    expect(nodes.map((node) => node.id)).toEqual(['other'])
  })

  it('duplicates the table with fresh column ids and remapped constraints', () => {
    renderTable({
      initial: [
        {
          ...USERS,
          data: {
            ...USERS.data,
            constraints: [{ id: 'uq', type: 'unique', columns: ['users-email'] }],
          },
        },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate table' }))

    const [original, copy] = nodes
    expect(copy.id).not.toBe(original.id)
    expect(copy.data.name).toBe('users_copy')
    expect(copy.position).toEqual({ x: 32, y: 32 })

    const copiedIds = copy.data.values.map((value) => value.id)
    expect(copy.data.values.map((value) => value.name)).toEqual(['id', 'email'])
    expect(copiedIds).not.toContain('users-id')
    expect(copiedIds).not.toContain('users-email')

    // The constraint follows the copied `email` column, not the original one.
    const [constraint] = copy.data.constraints ?? []
    expect(constraint.id).not.toBe('uq')
    expect(constraint.columns).toEqual([copiedIds[1]])
    expect(original.data.constraints?.[0].columns).toEqual(['users-email'])
  })

  describe('constraints', () => {
    it('adds an empty constraint of the chosen type', () => {
      renderTable()

      addConstraint('Index')

      expect(users()?.data.constraints).toEqual([
        { id: expect.any(String), type: 'index', columns: [] },
      ])
      expect(screen.getByText('index')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'columns' })).toBeInTheDocument()
    })

    it('toggles columns of a constraint and lists them on its trigger', () => {
      renderTable()
      addConstraint('Unique')

      fireEvent.click(screen.getByRole('button', { name: 'columns' }))
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'email' }))

      expect(users()?.data.constraints?.[0].columns).toEqual(['users-email'])
      expect(screen.getByRole('button', { name: 'email' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'id' }))
      expect(users()?.data.constraints?.[0].columns).toEqual(['users-email', 'users-id'])

      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'email' }))
      expect(users()?.data.constraints?.[0].columns).toEqual(['users-id'])
    })

    it('deletes a constraint', () => {
      renderTable()
      addConstraint('Unique')
      addConstraint('Index')

      fireEvent.click(screen.getByRole('button', { name: 'Delete unique constraint' }))

      expect(users()?.data.constraints?.map((constraint) => constraint.type)).toEqual(['index'])
    })

    it('treats a constraint whose columns were all removed as empty', () => {
      renderTable({
        initial: [
          {
            ...USERS,
            data: {
              ...USERS.data,
              constraints: [{ id: 'uq', type: 'unique', columns: ['deleted-column'] }],
            },
          },
        ],
      })

      expect(screen.getByRole('button', { name: 'columns' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Delete unique constraint' })).toBeInTheDocument()
    })

    it('names delete buttons by columns so same-type constraints are distinguishable', () => {
      renderTable()
      addConstraint('Unique')
      addConstraint('Unique')
      fireEvent.click(screen.getAllByRole('button', { name: 'columns' })[0])
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'email' }))

      fireEvent.click(screen.getByRole('button', { name: 'Delete unique constraint (email)' }))

      expect(users()?.data.constraints).toEqual([
        { id: expect.any(String), type: 'unique', columns: [] },
      ])
    })
  })

  it('broadcasts which field is being edited', () => {
    renderTable()
    const name = screen.getByRole('textbox', { name: 'Table name' })

    fireEvent.focus(name)
    expect(awareness.setLocalStateField).toHaveBeenLastCalledWith('editing', {
      nodeId: 'users',
      field: 'name',
    })

    fireEvent.blur(name)
    expect(awareness.setLocalStateField).toHaveBeenLastCalledWith('editing', null)

    fireEvent.focus(screen.getByPlaceholderText('Description'))
    expect(awareness.setLocalStateField).toHaveBeenLastCalledWith('editing', {
      nodeId: 'users',
      field: 'description',
    })
  })

  it('disables every control when read-only', () => {
    renderTable({
      initial: [
        {
          ...USERS,
          data: {
            ...USERS.data,
            constraints: [{ id: 'uq', type: 'unique', columns: ['users-email'] }],
          },
        },
      ],
      readOnly: true,
    })

    expect(screen.getByRole('textbox', { name: 'Table name' })).toBeDisabled()
    expect(screen.getByPlaceholderText('Description')).toBeDisabled()
    for (const name of [
      'Add column',
      'Add constraint',
      'Duplicate table',
      'Delete table',
      // The constraint's column picker and its delete button.
      'email',
      'Delete unique constraint (email)',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
  })
})
