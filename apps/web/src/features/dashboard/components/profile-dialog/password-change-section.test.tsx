import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'

const CURRENT = 'OldPassword1!'
const NEXT = 'NewPassword1!'

const api = vi.hoisted(() => ({
  accountGetList: { data: undefined as unknown, isLoading: false },
  passwordChange: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', async () => ({
  // The real error helpers: the section branches on the parsed server error
  ...(await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors')),
  useAccountGetList: () => api.accountGetList,
  usePasswordChange: () => api.passwordChange,
}))

const showErrorToast = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ add: vi.fn() }))

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))
vi.mock('@/components/ui/toast', () => ({ toast }))

const { PasswordChangeSection } = await import('./password-change-section')

const lastOptions = () =>
  api.passwordChange.mutate.mock.calls.at(-1)?.[1] as
    | { onSuccess?: () => void; onError?: (error: unknown) => void }
    | undefined

const fillAndSubmit = (current: string, next: string) => {
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: current } })
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: next } })
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }))
}

beforeEach(() => {
  api.accountGetList.data = [{ providerId: 'credential' }]
  api.accountGetList.isLoading = false
  api.passwordChange.isPending = false
  api.passwordChange.mutate.mockReset()
  showErrorToast.mockReset()
  toast.add.mockReset()
})

afterEach(cleanup)

describe('PasswordChangeSection', () => {
  it('renders nothing while the accounts load', () => {
    api.accountGetList.isLoading = true
    const { container } = render(<PasswordChangeSection />)

    expect(container).toBeEmptyDOMElement()
  })

  it('points users without a password to the reset flow', () => {
    api.accountGetList.data = [{ providerId: 'email-otp' }]
    render(<PasswordChangeSection />)

    expect(screen.getByText(/use Forgot password/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument()
  })

  it('changes the password and clears the form', async () => {
    render(<PasswordChangeSection />)

    fillAndSubmit(CURRENT, NEXT)

    await waitFor(() => expect(api.passwordChange.mutate).toHaveBeenCalled())
    expect(api.passwordChange.mutate.mock.calls[0]?.[0]).toEqual({
      currentPassword: CURRENT,
      newPassword: NEXT,
    })
    act(() => lastOptions()?.onSuccess?.())
    expect(toast.add).toHaveBeenCalledWith({ type: 'success', title: 'Password changed' })
    await waitFor(() => expect(screen.getByLabelText('Current Password')).toHaveValue(''))
  })

  it('rejects a new password equal to the current one', async () => {
    render(<PasswordChangeSection />)

    fillAndSubmit(CURRENT, CURRENT)

    expect(
      await screen.findByText('New password must be different from current password'),
    ).toBeInTheDocument()
    expect(api.passwordChange.mutate).not.toHaveBeenCalled()
  })

  it('rejects a weak new password', async () => {
    render(<PasswordChangeSection />)

    fillAndSubmit(CURRENT, 'short')

    expect(await screen.findByText(/at least 8 characters/)).toBeInTheDocument()
    expect(api.passwordChange.mutate).not.toHaveBeenCalled()
  })

  it('puts a wrong current password on its field', async () => {
    render(<PasswordChangeSection />)
    fillAndSubmit(CURRENT, NEXT)
    await waitFor(() => expect(api.passwordChange.mutate).toHaveBeenCalled())

    act(() => lastOptions()?.onError?.(apiAxiosError(400, 'INVALID_PASSWORD', 'Invalid password')))

    expect(screen.getByText('Invalid password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Current Password')).toHaveAttribute('aria-invalid', 'true')
    expect(showErrorToast).not.toHaveBeenCalled()
  })

  it('reports any other failure in a toast', async () => {
    render(<PasswordChangeSection />)
    fillAndSubmit(CURRENT, NEXT)
    await waitFor(() => expect(api.passwordChange.mutate).toHaveBeenCalled())

    const error = apiAxiosError(500, 'INTERNAL_SERVER_ERROR', 'boom')
    act(() => lastOptions()?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not change the password', error)
    expect(screen.getByLabelText('Current Password')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('disables the button while the change is pending', () => {
    api.passwordChange.isPending = true
    render(<PasswordChangeSection />)

    expect(screen.getByRole('button', { name: 'Change Password' })).toBeDisabled()
  })
})
