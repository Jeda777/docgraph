import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SortableList, type SortableListProps } from './sortable-list'
import type { SortableItemBase } from './types'

afterEach(cleanup)

const items: SortableItemBase[] = [
  {
    id: '1',
    name: 'Billing',
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-03T10:00:00.000Z',
    isArchived: false,
  },
  {
    id: '2',
    name: 'Accounts',
    createdAt: '2026-01-02T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    isArchived: false,
  },
]

const renderList = (
  props: Partial<SortableListProps<SortableItemBase>> = {},
  entry = '/projects',
) => {
  const onAddClick = vi.fn()
  render(
    <MemoryRouter initialEntries={[entry]}>
      <SortableList
        title='Projects'
        isLoading={false}
        items={items}
        canAdd
        addButtonLabel='New Project'
        emptyAddButtonLabel='Create your first project'
        onAddClick={onAddClick}
        canEdit={false}
        onEditClick={() => {}}
        linkToItem={(id) => `/projects/${id}`}
        emptyText='No projects yet'
        {...props}
      />
    </MemoryRouter>,
  )
  return { onAddClick }
}

const linkNames = () => screen.getAllByRole('link').map((link) => link.textContent)

describe('SortableList', () => {
  it('starts in the default view and switches between grid and table', () => {
    renderList({ defaultView: 'grid' })

    expect(screen.getByRole('button', { name: 'Grid view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'List view' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'List view' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('reads the view from the URL', () => {
    renderList({ defaultView: 'table' }, '/projects?view=grid')

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(linkNames()).toEqual(['Billing', 'Accounts'])
  })

  it('shows the sort menu only in the grid, where there are no column headers', () => {
    renderList({ defaultView: 'table' })
    expect(screen.queryByRole('button', { name: /^Sort by/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Grid view' }))
    expect(screen.getByRole('button', { name: 'Sort by Last updated' })).toBeInTheDocument()
  })

  it('sorts the grid through the sort menu', () => {
    renderList({ defaultView: 'grid' })
    expect(linkNames()).toEqual(['Billing', 'Accounts'])

    fireEvent.click(screen.getByRole('button', { name: 'Sort by Last updated' }))
    // Radio items keep the menu open, so the order is picked in the same pass.
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Ascending' }))

    expect(linkNames()).toEqual(['Accounts', 'Billing'])
  })

  it('sorts names like people read them, the same way as the sidebar', () => {
    const named = (id: string, name: string) => ({ ...items[0], id, name }) as SortableItemBase
    renderList(
      {
        defaultView: 'grid',
        items: [named('1', 'Project 10'), named('2', 'beta'), named('3', 'Project 2')],
      },
      '/projects?sort=name&direction=asc',
    )

    expect(linkNames()).toEqual(['beta', 'Project 2', 'Project 10'])
  })

  it('offers the add action in the empty grid', () => {
    const { onAddClick } = renderList({ defaultView: 'grid', items: [] })

    expect(screen.getByText('No projects yet')).toBeInTheDocument()
    // Named apart from the header button, so each one is found on its own.
    expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create your first project' }))
    expect(onAddClick).toHaveBeenCalledOnce()
  })

  it('tells a search with no match apart from an empty list', () => {
    renderList({ defaultView: 'grid' }, '/projects?search=zzz')

    expect(screen.getByText('Nothing matches your search.')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create your first project' }),
    ).not.toBeInTheDocument()
  })

  it('shows a loading placeholder in the shape of the current view', () => {
    renderList({ defaultView: 'table', isLoading: true })

    const placeholder = screen.getByRole('list', { name: 'Loading' })
    expect(placeholder).toHaveAttribute('aria-busy', 'true')
    expect(placeholder).not.toHaveClass('grid')
    expect(within(placeholder).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
