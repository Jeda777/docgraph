import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ITEM_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T2'

const ITEM = {
  id: ITEM_ID,
  name: 'Readme',
  type: 'DOCUMENT',
  projectId: '01HZX3W5Y8K9M2N4P6Q7R8S9T0',
  createdAt: new Date(),
  updatedAt: new Date(),
  isArchived: true,
}

const api = vi.hoisted(() => ({
  getById: vi.fn(),
  update: { isPending: false, mutateAsync: vi.fn() },
  remove: {
    isPending: false,
    isSuccess: false,
    variables: undefined as { id: string } | undefined,
    mutateAsync: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => ({
  useItemGetById: api.getById,
  useItemUpdate: () => api.update,
  useItemDelete: () => api.remove,
}))

vi.mock('@/lib/error-toast', () => ({ showErrorToast: vi.fn() }))

const { ItemSettingsDialog } = await import('./item-settings-dialog')

beforeEach(() => {
  api.getById.mockReset().mockReturnValue({ data: ITEM })
  api.update.mutateAsync.mockReset().mockResolvedValue(undefined)
  api.remove.mutateAsync.mockReset().mockResolvedValue(undefined)
  Object.assign(api.remove, { isSuccess: false, variables: undefined })
})

afterEach(cleanup)

describe('ItemSettingsDialog', () => {
  it('stays closed and skips the query without an item', () => {
    api.getById.mockReturnValue({ data: undefined })
    render(<ItemSettingsDialog itemId={null} onClose={vi.fn()} />)

    expect(screen.queryByText('Item Settings')).not.toBeInTheDocument()
    expect(api.getById).toHaveBeenCalledWith('', false)
  })

  it('fills the form with the loaded item', async () => {
    render(<ItemSettingsDialog itemId={ITEM_ID} onClose={vi.fn()} />)

    expect(await screen.findByText('Item Settings')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Readme'))
    expect(screen.getByRole('checkbox', { name: 'Is Archived' })).toBeChecked()
    expect(api.getById).toHaveBeenCalledWith(ITEM_ID, true)
  })

  it('skips the query for the item it just deleted', () => {
    Object.assign(api.remove, { isSuccess: true, variables: ITEM })
    render(<ItemSettingsDialog itemId={ITEM_ID} onClose={vi.fn()} />)

    expect(api.getById).toHaveBeenLastCalledWith(ITEM_ID, false)
  })

  it('loads another item after deleting one', () => {
    Object.assign(api.remove, { isSuccess: true, variables: { ...ITEM, id: 'other' } })
    render(<ItemSettingsDialog itemId={ITEM_ID} onClose={vi.fn()} />)

    expect(api.getById).toHaveBeenLastCalledWith(ITEM_ID, true)
  })

  it('saves the renamed and restored item and closes', async () => {
    const onClose = vi.fn()
    render(<ItemSettingsDialog itemId={ITEM_ID} onClose={onClose} />)
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Readme'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Guide' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Is Archived' }))
    const save = screen.getByRole('button', { name: 'Save' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.update.mutateAsync).toHaveBeenCalledWith({
      id: ITEM_ID,
      name: 'Guide',
      isArchived: false,
    })
  })

  it('deletes the item after confirmation', async () => {
    const onClose = vi.fn()
    render(<ItemSettingsDialog itemId={ITEM_ID} onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    const confirmation = await screen.findByRole('alertdialog')
    expect(confirmation).toHaveTextContent(/The item and its content will be permanently deleted/)
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.remove.mutateAsync).toHaveBeenCalledWith(ITEM)
  })
})
