import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SortableListCard } from './sortable-list-card'
import type { SortableItemBase } from './types'

afterEach(cleanup)

type Item = SortableItemBase & { count: number }

const baseItem: Item = {
  id: '7',
  name: 'Billing',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T10:00:00.000Z',
  isArchived: false,
  count: 4,
}

const renderCard = (item: Item, canEdit = true) => {
  const onEditClick = vi.fn()
  render(
    <MemoryRouter>
      <ul>
        <SortableListCard
          item={item}
          additionalColumns={[{ key: 'count', label: 'Items', format: (i) => `${i.count} items` }]}
          canEdit={canEdit}
          onEditClick={onEditClick}
          linkToItem={(id) => `/projects/${id}`}
          renderIcon={() => <span data-testid='icon' />}
        />
      </ul>
    </MemoryRouter>,
  )
  return { onEditClick }
}

describe('SortableListCard', () => {
  it('links to the item and shows its details and icon', () => {
    renderCard(baseItem)

    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute('href', '/projects/7')
    expect(screen.getByText('4 items')).toBeInTheDocument()
    expect(screen.getByText(/^Updated/)).toBeInTheDocument()
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('opens the settings of its own item', () => {
    const { onEditClick } = renderCard(baseItem)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(onEditClick).toHaveBeenCalledWith('7')
  })

  it('hides the settings button when the user cannot edit', () => {
    renderCard(baseItem, false)

    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('marks archived items for sight and for screen readers', () => {
    renderCard({ ...baseItem, isArchived: true })

    expect(screen.getByRole('link', { name: 'Billing (archived)' })).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })
})
