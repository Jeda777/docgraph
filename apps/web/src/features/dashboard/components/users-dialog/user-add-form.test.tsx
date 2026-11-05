import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'

const mutations = vi.hoisted(() => ({
  userCreate: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', async () => ({
  // The real error helpers: components branch on the parsed server error
  ...(await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors')),
  useUserCreate: () => mutations.userCreate,
}))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

const { UserAddForm } = await import('./user-add-form')

/** Last options object passed to the mutation's `mutate` call. */
const lastOptions = () =>
  mutations.userCreate.mutate.mock.calls.at(-1)?.[1] as
    | {
        onSuccess?: (data: unknown) => void
        onError?: (error: unknown) => void
      }
    | undefined

const fillForm = async () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'john' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } })
  await waitFor(() => expect(screen.getByRole('button', { name: /invite user/i })).toBeEnabled())
}

const submit = async () => {
  const form = document.querySelector('form')
  if (!form) throw new Error('No form rendered')
  fireEvent.submit(form)
  await waitFor(() => expect(mutations.userCreate.mutate).toHaveBeenCalled())
}

beforeEach(() => {
  localStorage.clear()
  mutations.userCreate.isPending = false
  mutations.userCreate.mutate.mockReset()
  showErrorToast.mockReset()
})

afterEach(cleanup)

describe('UserAddForm', () => {
  it('submits valid data through the create mutation', async () => {
    render(<UserAddForm />)
    await fillForm()

    await submit()

    expect(mutations.userCreate.mutate).toHaveBeenCalledWith(
      { name: 'john', email: 'john@example.com' },
      expect.anything(),
    )
  })

  it('maps an existing-user backend error onto the email field', async () => {
    render(<UserAddForm />)
    await fillForm()
    await submit()

    act(() =>
      lastOptions()?.onError?.(apiAxiosError(409, 'USER_ALREADY_EXISTS', 'User already exists')),
    )

    expect(screen.getByText('User already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(showErrorToast).not.toHaveBeenCalled()
  })

  it('reports any other failure in a toast', async () => {
    render(<UserAddForm />)
    await fillForm()
    await submit()

    const error = apiAxiosError(500, 'EMAIL_DELIVERY_FAILED', 'Failed to send invite email')
    act(() => lastOptions()?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not invite the user', error)
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('disables the submit button and hides its label while pending', () => {
    mutations.userCreate.isPending = true
    render(<UserAddForm />)

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.queryByText('Invite User')).not.toBeInTheDocument()
  })
})
