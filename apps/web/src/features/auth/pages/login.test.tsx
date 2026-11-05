import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'

/** Location state handed to the page through react-router. */
const locationState = vi.hoisted(() => ({ current: undefined as unknown }))
/** Location search string (e.g. the `?redirect=` param). */
const locationSearch = vi.hoisted(() => ({ current: '' }))

const navigate = vi.hoisted(() => vi.fn())

const mutations = vi.hoisted(() => ({
  passwordLogin: { isPending: false, mutate: vi.fn() },
}))

vi.mock('@/lib/api', async () => ({
  // The real error helpers: components branch on the parsed server error
  ...(await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors')),
  usePasswordLogin: () => mutations.passwordLogin,
}))

vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
  useLocation: () => ({ state: locationState.current, search: locationSearch.current }),
}))

const { LoginPage } = await import('./login')

import { fillEmailAndPassword, submitButton, submitForm, typeEmail } from './test-utils'

/** Last options object passed to the login mutation's `mutate` call. */
const lastOptions = () =>
  mutations.passwordLogin.mutate.mock.calls.at(-1)?.[1] as
    | {
        onSuccess?: (data: unknown) => void
        onError?: (error: unknown) => void
      }
    | undefined

beforeEach(() => {
  localStorage.clear()
  locationState.current = undefined
  locationSearch.current = ''
  mutations.passwordLogin.isPending = false
  mutations.passwordLogin.mutate.mockReset()
  navigate.mockReset()
})

afterEach(cleanup)

describe('LoginPage', () => {
  it('renders the login form with email and password fields', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('prefills the email from the router location state', () => {
    locationState.current = { email: 'jane@example.com' }
    render(<LoginPage />)

    expect(screen.getByLabelText('Email')).toHaveValue('jane@example.com')
  })

  it('shows validation errors and does not submit an empty form', async () => {
    render(<LoginPage />)

    await submitForm()

    expect(mutations.passwordLogin.mutate).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getAllByRole('alert')).not.toHaveLength(0))
  })

  it('submits valid credentials through the login mutation', async () => {
    render(<LoginPage />)
    await fillEmailAndPassword('jane@example.com', 'sup3rsecret!', 'Log in')

    await submitForm(mutations.passwordLogin)

    expect(mutations.passwordLogin.mutate).toHaveBeenCalledWith(
      { email: 'jane@example.com', password: 'sup3rsecret!' },
      expect.anything(),
    )
  })

  it('navigates home after a successful login', async () => {
    render(<LoginPage />)
    await fillEmailAndPassword('jane@example.com', 'sup3rsecret!', 'Log in')
    await submitForm(mutations.passwordLogin)

    act(() => lastOptions()?.onSuccess?.(undefined))

    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows the backend message when credentials are rejected', async () => {
    render(<LoginPage />)
    await fillEmailAndPassword('jane@example.com', 'wrong-password', 'Log in')
    await submitForm(mutations.passwordLogin)

    act(() =>
      lastOptions()?.onError?.(
        apiAxiosError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
      ),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('keeps the submit button disabled while the login is pending', async () => {
    const { rerender } = render(<LoginPage />)
    await fillEmailAndPassword('jane@example.com', 'sup3rsecret!', 'Log in')
    expect(submitButton('Log in')).toBeEnabled()

    mutations.passwordLogin.isPending = true
    rerender(<LoginPage />)

    expect(submitButton('Log in')).toBeDisabled()
  })

  it('keeps the submit button disabled with an invalid email', async () => {
    render(<LoginPage />)
    typeEmail('not-an-email')

    await waitFor(() => expect(submitButton('Log in')).toBeDisabled())
  })

  it('navigates to the OTP login page carrying the typed email', async () => {
    render(<LoginPage />)
    typeEmail('jane@example.com')

    fireEvent.click(screen.getByRole('button', { name: 'Log in with a code' }))

    expect(navigate).toHaveBeenCalledWith('/login-otp', { state: { email: 'jane@example.com' } })
  })

  it('returns to the remembered page after logging in', async () => {
    locationSearch.current = '?redirect=%2Fprojects%2F7'
    render(<LoginPage />)
    await fillEmailAndPassword('jane@example.com', 'sup3rsecret!', 'Log in')
    await submitForm(mutations.passwordLogin)

    act(() => lastOptions()?.onSuccess?.(undefined))

    expect(navigate).toHaveBeenCalledWith('/projects/7', { replace: true })
  })

  it('keeps the remembered page when switching to the OTP login', () => {
    locationSearch.current = '?redirect=%2Fprojects%2F7'
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Log in with a code' }))

    expect(navigate).toHaveBeenCalledWith('/login-otp?redirect=%2Fprojects%2F7', expect.anything())
  })
})
