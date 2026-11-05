import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SortableListItem } from './sortable-list-item'
import type { SortableItemBase } from './types'

afterEach(cleanup)

type Item = SortableItemBase & { count: number }

const baseItem: Item = {
  id: '1',
  name: 'Users table',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  isArchived: false,
  count: 3,
}

const renderItem = (item: Item, canEdit = true) =>
  render(
    <MemoryRouter>
      <table>
        <tbody>
          <SortableListItem
            item={item}
            additionalColumns={[{ key: 'count', label: 'Count', format: (i) => `${i.count}x` }]}
            canEdit={canEdit}
            onEditClick={() => {}}
            linkToItem={(id) => `/projects/1/items/${id}`}
          />
        </tbody>
      </table>
    </MemoryRouter>,
  )

describe('SortableListItem', () => {
  it('renders the name as a link built from linkToItem', () => {
    renderItem(baseItem)

    const link = screen.getByRole('link', { name: /users table/i })
    expect(link).toHaveAttribute('href', '/projects/1/items/1')
  })

  it('marks archived items', () => {
    renderItem({ ...baseItem, isArchived: true })

    expect(screen.getByRole('link', { name: /users table/i })).toHaveTextContent('(archived)')
  })

  it('renders additional columns through their formatter', () => {
    renderItem(baseItem)

    expect(screen.getByRole('cell', { name: '3x' })).toBeInTheDocument()
  })

  it('hides the settings button when the user cannot edit', () => {
    renderItem(baseItem, false)

    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('requests editing of its own row on settings click', () => {
    const onEditClick = vi.fn()
    render(
      <MemoryRouter>
        <table>
          <tbody>
            <SortableListItem
              item={baseItem}
              canEdit
              onEditClick={onEditClick}
              linkToItem={(id) => `/projects/1/items/${id}`}
            />
          </tbody>
        </table>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(onEditClick).toHaveBeenCalledWith('1')
  })
})
