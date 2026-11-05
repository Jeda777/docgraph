import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SortableTableHead } from './sortable-table-head'
import type { SortState } from './use-url-table-state'

afterEach(cleanup)

type Column = 'name' | 'createdAt'

/** Renders the head inside a real table so DOM nesting stays valid. */
const renderHead = (sort: SortState<Column>, onSort: (by: Column) => void) =>
  render(
    <table>
      <thead>
        <tr>
          <SortableTableHead by='name' sort={sort} onSort={onSort}>
            Name
          </SortableTableHead>
        </tr>
      </thead>
    </table>,
  )

describe('SortableTableHead', () => {
  it('marks an inactive column as unsorted', () => {
    renderHead({ by: 'createdAt', direction: 'asc' }, () => {})

    const th = screen.getByRole('columnheader')
    expect(th).not.toHaveAttribute('aria-sort')
  })

  it('exposes the active column direction through aria-sort', () => {
    renderHead({ by: 'name', direction: 'asc' }, () => {})
    expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'ascending')

    renderHead({ by: 'name', direction: 'desc' }, () => {})
    expect(screen.getAllByRole('columnheader')[1]).toHaveAttribute('aria-sort', 'descending')
  })

  it('requests sorting of its own column on click', () => {
    const onSort = vi.fn()
    renderHead({ by: 'name', direction: 'asc' }, onSort)

    fireEvent.click(screen.getByRole('button', { name: /name/i }))

    expect(onSort).toHaveBeenCalledWith('name')
  })
})
