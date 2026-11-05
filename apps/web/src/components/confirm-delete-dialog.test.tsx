import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDeleteDialog } from './confirm-delete-dialog'

afterEach(cleanup)

describe('ConfirmDeleteDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDeleteDialog
        open={false}
        onOpenChange={() => {}}
        description='d'
        onDelete={() => {}}
      />,
    )

    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument()
  })

  it('shows the title and the description when open', () => {
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        description='This will remove Project X.'
        onDelete={() => {}}
      />,
    )

    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByText('This will remove Project X.')).toBeInTheDocument()
  })

  it('closes on cancel without deleting', () => {
    const onOpenChange = vi.fn()
    const onDelete = vi.fn()
    render(
      <ConfirmDeleteDialog open onOpenChange={onOpenChange} description='d' onDelete={onDelete} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete and disables the button while deleting', () => {
    const onDelete = vi.fn()
    const { rerender } = render(
      <ConfirmDeleteDialog open onOpenChange={() => {}} description='d' onDelete={onDelete} />,
    )

    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    expect(deleteButton).toBeEnabled()

    fireEvent.click(deleteButton)
    expect(onDelete).toHaveBeenCalledTimes(1)

    rerender(
      <ConfirmDeleteDialog
        open
        isDeleting
        onOpenChange={() => {}}
        description='d'
        onDelete={onDelete}
      />,
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })
})
