import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mutations = vi.hoisted(() => ({
  projectCreate: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', () => ({
  useProjectCreate: () => mutations.projectCreate,
  useUserGetList: () => ({ data: [] }),
}))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

const { ProjectCreateDialog } = await import('./project-create-dialog')

/** Last options object passed to the mutation's `mutate` call. */
const lastOptions = () =>
  mutations.projectCreate.mutate.mock.calls.at(-1)?.[1] as
    | { onSuccess?: () => void; onError?: (error: unknown) => void }
    | undefined

const fillAndSave = async (name: string) => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } })
  const save = screen.getByRole('button', { name: 'Save' })
  await waitFor(() => expect(save).toBeEnabled())
  fireEvent.click(save)
}

beforeEach(() => {
  mutations.projectCreate.isPending = false
  mutations.projectCreate.mutate.mockReset()
  showErrorToast.mockReset()
})

afterEach(cleanup)

describe('ProjectCreateDialog', () => {
  it('renders nothing while closed', () => {
    render(<ProjectCreateDialog open={false} onClose={vi.fn()} />)

    expect(screen.queryByText('Create Project')).not.toBeInTheDocument()
  })

  it('creates a project for all users by default and closes on success', async () => {
    const onClose = vi.fn()
    render(<ProjectCreateDialog open onClose={onClose} />)

    await fillAndSave('Shop')

    await waitFor(() => expect(mutations.projectCreate.mutate).toHaveBeenCalled())
    expect(mutations.projectCreate.mutate.mock.calls[0]?.[0]).toEqual({
      name: 'Shop',
      isForAllUsers: true,
      memberIds: [],
    })
    expect(onClose).not.toHaveBeenCalled()

    act(() => lastOptions()?.onSuccess?.())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends the unchecked "For All Users" flag', async () => {
    render(<ProjectCreateDialog open onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'For All Users' }))
    await fillAndSave('Private')

    await waitFor(() => expect(mutations.projectCreate.mutate).toHaveBeenCalled())
    expect(mutations.projectCreate.mutate.mock.calls[0]?.[0]).toMatchObject({
      isForAllUsers: false,
    })
  })

  it('does not submit a blank name', async () => {
    render(<ProjectCreateDialog open onClose={vi.fn()} />)

    await fillAndSave('   ')

    expect(await screen.findByText('This field is required')).toBeInTheDocument()
    expect(mutations.projectCreate.mutate).not.toHaveBeenCalled()
  })

  it('reports a failure in a toast and stays open', async () => {
    const onClose = vi.fn()
    render(<ProjectCreateDialog open onClose={onClose} />)
    await fillAndSave('Shop')
    await waitFor(() => expect(mutations.projectCreate.mutate).toHaveBeenCalled())

    const error = new Error('boom')
    act(() => lastOptions()?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not create the project', error)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ignores a submit while the creation is pending', async () => {
    mutations.projectCreate.isPending = true
    render(<ProjectCreateDialog open onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Shop' } })
    fireEvent.submit(document.getElementById('project-create-form') as HTMLFormElement)

    await act(() => Promise.resolve())
    expect(mutations.projectCreate.mutate).not.toHaveBeenCalled()
  })
})
