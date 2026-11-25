import { DATABASE_DIAGRAM_NODE_TYPE, type DatabaseDiagramEnum } from '@docgraph/common/schemas'
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
type HarnessProps = {
  initial: DatabaseNode[]
  enums?: DatabaseDiagramEnum[]
  readOnly?: boolean
}

const Harness = ({ initial, enums, readOnly }: HarnessProps) => {
  const [state, setState] = useState(initial)
  nodes = state
  const [first] = state

  if (!first) return null
  return (
    <SidebarTable
      nodeId={first.id}
      data={first.data}
      setNodes={setState}
      enums={enums}
      readOnly={readOnly}
    />
  )
}

const renderTable = ({ initial = [USERS, OTHER], ...props }: Partial<HarnessProps> = {}) =>
  render(<Harness initial={initial} {...props} />)

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
  it('picks the default of an enum column from its values', () => {
    const status: DatabaseDiagramEnum = {
      id: 'status',
      name: 'order_status',
      values: [
        { id: 'pending', name: 'pending' },
        { id: 'shipped', name: 'shipped' },
      ],
    }
    const orders: DatabaseNode = {
      ...USERS,
      data: {
        ...USERS.data,
        values: [
          { ...column('users-id', 'state'), value: 'order_status', defaultValue: "'shipped'" },
        ],
      },
    }
    renderTable({ initial: [orders], enums: [status] })

    const select = screen.getByRole('combobox', { name: 'Column default' })
    expect(select).toHaveTextContent('shipped')

    fireEvent.click(select)
    const option = screen.getByRole('option', { name: 'pending' })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)

    expect(users()?.data.values[0].defaultValue).toBe("'pending'")
  })

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

  it('adds and edits a column default', () => {
    renderTable()

    fireEvent.click(screen.getAllByRole('button', { name: 'Column options' })[1])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add default' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Column default' }), {
      target: { value: 'now()' },
    })

    expect(users()?.data.values.map((value) => value.defaultValue)).toEqual([undefined, 'now()'])

    // "Add default" keeps the menu open, so "Remove default" is already there.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove default' }))

    expect(users()?.data.values[1]).not.toHaveProperty('defaultValue')
    expect(screen.queryByRole('textbox', { name: 'Column default' })).toBeNull()
  })

  it('adds, edits and removes a column description', () => {
    renderTable()

    fireEvent.click(screen.getAllByRole('button', { name: 'Column options' })[1])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add description' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Column description' }), {
      target: { value: 'Login address' },
    })

    expect(users()?.data.values.map((value) => value.description)).toEqual([
      undefined,
      'Login address',
    ])

    // "Add description" keeps the menu open, so "Remove description" is already there.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove description' }))

    expect(users()?.data.values[1]).not.toHaveProperty('description')
    expect(screen.queryByRole('textbox', { name: 'Column description' })).toBeNull()
  })

  it('toggles auto-increment of a numeric column', () => {
    renderTable()

    fireEvent.click(screen.getAllByRole('button', { name: 'Column options' })[0])
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Auto Increment' }))

    expect(users()?.data.values[0].increment).toBe(true)
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

  it('adds, edits and deletes a check', () => {
    renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Add constraint' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Check' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Check expression' }), {
      target: { value: 'id > 0' },
    })

    expect(users()?.data.checks).toEqual([{ id: expect.any(String), expression: 'id > 0' }])

    fireEvent.click(screen.getByRole('button', { name: 'Delete check (id > 0)' }))

    expect(users()?.data.checks).toEqual([])
    expect(screen.queryByRole('textbox', { name: 'Check expression' })).toBeNull()
  })

  it('duplicates checks under fresh ids', () => {
    renderTable({
      initial: [
        { ...USERS, data: { ...USERS.data, checks: [{ id: 'ck', expression: 'id > 0' }] } },
      ],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate table' }))

    const [, copy] = nodes
    expect(copy.data.checks).toEqual([{ id: expect.any(String), expression: 'id > 0' }])
    expect(copy.data.checks?.[0].id).not.toBe('ck')
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

    it('adds, edits and deletes an expression of a constraint', () => {
      renderTable()
      addConstraint('Unique')

      fireEvent.click(screen.getByRole('button', { name: 'columns' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add expression' }))
      fireEvent.change(screen.getByRole('textbox', { name: 'Index expression' }), {
        target: { value: 'lower(email)' },
      })

      expect(users()?.data.constraints?.[0].expressions).toEqual(['lower(email)'])
      expect(
        screen.getByRole('button', { name: 'Delete unique constraint (lower(email))' }),
      ).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Delete expression (lower(email))' }))

      expect(users()?.data.constraints?.[0].expressions).toEqual([])
      expect(screen.queryByRole('textbox', { name: 'Index expression' })).toBeNull()
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
