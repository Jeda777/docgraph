import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'

/** Location state handed to the page through react-router. */
const locationState = vi.hoisted(() => ({ current: undefined as unknown }))

const searchParamsEmail = vi.hoisted(() => ({ current: '' }))

const navigate = vi.hoisted(() => vi.fn())

const mutations = vi.hoisted(() => ({
  otpSend: { isPending: false, mutate: vi.fn() },
  otpLogin: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', async () => ({
  // The real error helpers: components branch on the parsed server error
  ...(await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors')),
  useOtpSend: () => mutations.otpSend,
  useOtpLogin: () => mutations.otpLogin,
}))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
  useLocation: () => ({
    state: locationState.current,
    search: searchParamsEmail.current ? `?email=${searchParamsEmail.current}` : '',
  }),
}))

const { LoginOtp } = await import('./login-otp')

import { submitButton, submitForm, typeEmail, typeOtp } from './test-utils'

/** Last options object passed to a mutation's `mutate` call. */
const lastOptions = (mutation: { mutate: ReturnType<typeof vi.fn> }) =>
  mutation.mutate.mock.calls.at(-1)?.[1] as
    | {
        onSuccess?: (data: unknown) => void
        onError?: (error: unknown) => void
      }
    | undefined

beforeEach(() => {
  localStorage.clear()
  locationState.current = undefined
  searchParamsEmail.current = ''
  mutations.otpSend.isPending = false
  mutations.otpSend.mutate.mockReset()
  mutations.otpLogin.isPending = false
  mutations.otpLogin.mutate.mockReset()
  navigate.mockReset()
  showErrorToast.mockReset()
})

afterEach(cleanup)

describe('LoginOtp', () => {
  it('renders the OTP login form', () => {
    render(<LoginOtp />)

    expect(screen.getByRole('heading', { name: 'Log in with a code' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument()
    expect(mutations.otpSend.mutate).not.toHaveBeenCalled()
  })

  it('prefills the email from the router location state', () => {
    locationState.current = { email: 'jane@example.com' }
    render(<LoginOtp />)

    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })

  it('prefills the email from the ?email= query parameter', () => {
    searchParamsEmail.current = encodeURIComponent('jane@example.com')
    render(<LoginOtp />)

    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })

  it('sends a login code on demand', async () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())

    expect(mutations.otpSend.mutate).toHaveBeenCalledWith(
      { email: 'jane@example.com', type: 'sign-in' },
      expect.anything(),
    )
  })

  it('refuses to send a code for an invalid email and shows a manual error', () => {
    render(<LoginOtp />)
    typeEmail('not-an-email')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())

    expect(mutations.otpSend.mutate).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address.')
  })

  it('starts the resend cooldown after the code is sent', () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())
    act(() => lastOptions(mutations.otpSend)?.onSuccess?.(() => {}))

    expect(screen.getByText('Resend available in 01:00')).toBeInTheDocument()
  })

  it('blocks resending while the cooldown is running', () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())
    act(() => lastOptions(mutations.otpSend)?.onSuccess?.(() => {}))

    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument()
  })

  it('reports a failed send in a toast instead of on the code field', () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Send code' }).click())
    const error = apiAxiosError(500, 'EMAIL_DELIVERY_FAILED', 'Failed to send verification code')
    act(() => lastOptions(mutations.otpSend)?.onError?.(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not send the code', error)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('logs in with the code and navigates home', async () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')
    typeOtp('123456')
    await waitFor(() => expect(submitButton('Log in')).toBeEnabled())

    await submitForm(mutations.otpLogin)

    expect(mutations.otpLogin.mutate).toHaveBeenCalledWith(
      { email: 'jane@example.com', otp: '123456' },
      expect.anything(),
    )

    act(() => lastOptions(mutations.otpLogin)?.onSuccess?.(undefined))

    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows the backend message when the code is rejected', async () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')
    typeOtp('000000')
    await waitFor(() => expect(submitButton('Log in')).toBeEnabled())

    await submitForm(mutations.otpLogin)

    act(() =>
      lastOptions(mutations.otpLogin)?.onError?.(
        apiAxiosError(401, 'INVALID_OTP', 'Invalid or expired verification code'),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid or expired verification code',
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates to the password login page carrying the typed email', () => {
    render(<LoginOtp />)
    typeEmail('jane@example.com')

    act(() => screen.getByRole('button', { name: 'Log in with a password' }).click())

    expect(navigate).toHaveBeenCalledWith('/login', { state: { email: 'jane@example.com' } })
  })
})
