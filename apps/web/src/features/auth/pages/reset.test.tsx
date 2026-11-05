import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'

/** Location state handed to the page through react-router. */
const locationState = vi.hoisted(() => ({ current: undefined as unknown }))

const navigate = vi.hoisted(() => vi.fn())

const mutations = vi.hoisted(() => ({
  otpSend: { isPending: false, mutate: vi.fn() },
  passwordReset: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', async () => ({
  // The real error helpers: components branch on the parsed server error
  ...(await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors')),
  useOtpSend: () => mutations.otpSend,
  usePasswordReset: () => mutations.passwordReset,
}))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
  useLocation: () => ({ state: locationState.current }),
}))

const { ResetPage } = await import('./reset')

import { submitButton, submitForm, typeEmail, typeOtp, typePassword } from './test-utils'

/** Last options object passed to a mutation's `mutate` call. */
const lastOptions = (mutation: { mutate: ReturnType<typeof vi.fn> }) =>
  mutation.mutate.mock.calls.at(-1)?.[1] as
    | {
        onSuccess?: (data: unknown) => void
        onError?: (error: unknown) => void
      }
    | undefined

/** Fills the whole reset form (the submit stays disabled until all three fields are valid). */
const fillResetForm = async (email: string, password: string, code: string) => {
  typeEmail(email)
  typePassword(password)
  typeOtp(code)
  await waitFor(() => expect(submitButton('Reset')).toBeEnabled())
}

beforeEach(() => {
  localStorage.clear()
  locationState.current = undefined
  mutations.otpSend.isPending = false
  mutations.otpSend.mutate.mockReset()
  mutations.passwordReset.isPending = false
  mutations.passwordReset.mutate.mockReset()
  navigate.mockReset()
  showErrorToast.mockReset()
})

afterEach(cleanup)

describe('ResetPage', () => {
  it('renders the reset form', () => {
    render(<ResetPage />)

    expect(screen.getByRole('heading', { name: 'Reset password' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
    expect(mutations.otpSend.mutate).not.toHaveBeenCalled()
  })

  it('prefills the email from the router location state', () => {
    locationState.current = { email: 'jane@example.com' }
    render(<ResetPage />)

    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })

  it('does not send a code when the email is empty', () => {
    render(<ResetPage />)

    act(() => screen.getByRole('button', { name: 'Send code' }).click())

    expect(mutations.otpSend.mutate).not.toHaveBeenCalled()
  })

  it('sends a reset code for a valid email', () => {
    render(<ResetPage />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())

    expect(mutations.otpSend.mutate).toHaveBeenCalledWith(
      { email: 'jane@example.com', type: 'forget-password' },
      expect.anything(),
    )
  })

  it('refuses to send a code for an invalid email and shows a manual error', () => {
    render(<ResetPage />)
    typeEmail('not-an-email')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())

    expect(mutations.otpSend.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.')
  })

  it('starts the resend cooldown after the code is sent', () => {
    render(<ResetPage />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())
    act(() => lastOptions(mutations.otpSend)?.onSuccess?.(() => {}))

    expect(screen.getByText('Resend available in 01:00')).toBeInTheDocument()
  })

  it('reports a failed send in a toast instead of on the code field', () => {
    render(<ResetPage />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())
    const error = apiAxiosError(500, 'EMAIL_DELIVERY_FAILED', 'Failed to send verification code')
    act(() => lastOptions(mutations.otpSend)?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not send the code', error)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resets the password and returns to the login page with the email', async () => {
    render(<ResetPage />)
    await fillResetForm('jane@example.com', 'newSecret123!', '123456')

    await submitForm(mutations.passwordReset)

    expect(mutations.passwordReset.mutate).toHaveBeenCalledWith(
      { email: 'jane@example.com', otp: '123456', password: 'newSecret123!' },
      expect.anything(),
    )

    act(() => lastOptions(mutations.passwordReset)?.onSuccess?.(() => {}))

    expect(navigate).toHaveBeenCalledWith('/login', { state: { email: 'jane@example.com' } })
  })

  it('shows the backend message when the reset is rejected', async () => {
    render(<ResetPage />)
    await fillResetForm('jane@example.com', 'newSecret123!', '000000')

    await submitForm(mutations.passwordReset)

    act(() =>
      lastOptions(mutations.passwordReset)?.onError?.(
        apiAxiosError(401, 'INVALID_OTP', 'Invalid or expired verification code'),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid or expired verification code',
    )
    expect(navigate).not.toHaveBeenCalled()
  })
})
