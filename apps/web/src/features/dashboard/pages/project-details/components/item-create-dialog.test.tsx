import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '01HZX3W5Y8K9M2N4P6Q7R8S9T0'

const mutations = vi.hoisted(() => ({
  itemCreate: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  useItemCreate: () => mutations.itemCreate,
}))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

const { ItemCreateDialog } = await import('./item-create-dialog')

/** Last options object passed to the mutation's `mutate` call. */
const lastOptions = () =>
  mutations.itemCreate.mutate.mock.calls.at(-1)?.[1] as
    | { onSuccess?: () => void; onError?: (error: unknown) => void }
    | undefined

const fillAndSave = async (name: string) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  const save = screen.getByRole('button', { name: 'Save' })
  await waitFor(() => expect(save).toBeEnabled())
  fireEvent.click(save)
  await waitFor(() => expect(mutations.itemCreate.mutate).toHaveBeenCalled())
}

beforeEach(() => {
  mutations.itemCreate.isPending = false
  mutations.itemCreate.mutate.mockReset()
  showErrorToast.mockReset()
})

afterEach(cleanup)

describe('ItemCreateDialog', () => {
  it('stays closed without a project', () => {
    render(<ItemCreateDialog open onClose={vi.fn()} />)

    expect(screen.queryByText('Create Item')).not.toBeInTheDocument()
  })

  it('offers every item type with Document selected', () => {
    render(<ItemCreateDialog open onClose={vi.fn()} projectId={PROJECT_ID} />)

    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const name of ['Business Process', 'Database', 'Flowchart']) {
      expect(screen.getByRole('radio', { name })).not.toBeChecked()
    }
    expect(screen.getByRole('radio', { name: 'Document' })).toBeChecked()
  })

  it('creates a document in the project and closes on success', async () => {
    const onClose = vi.fn()
    render(<ItemCreateDialog open onClose={onClose} projectId={PROJECT_ID} />)

    await fillAndSave('Readme')

    expect(mutations.itemCreate.mutate.mock.calls[0]?.[0]).toEqual({
      name: 'Readme',
      type: 'DOCUMENT',
      projectId: PROJECT_ID,
    })
    act(() => lastOptions()?.onSuccess?.())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('creates the selected item type', async () => {
    render(<ItemCreateDialog open onClose={vi.fn()} projectId={PROJECT_ID} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Flowchart' }))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Flowchart' })).toBeChecked())
    await fillAndSave('Checkout')

    expect(mutations.itemCreate.mutate.mock.calls[0]?.[0]).toMatchObject({ type: 'FLOWCHART' })
  })

  it('reports a failure in a toast and stays open', async () => {
    const onClose = vi.fn()
    render(<ItemCreateDialog open onClose={onClose} projectId={PROJECT_ID} />)
    await fillAndSave('Readme')

    const error = new Error('boom')
    act(() => lastOptions()?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not create the item', error)
    expect(onClose).not.toHaveBeenCalled()
  })
})
