import { act, cleanup, renderHook } from '@testing-library/react'
import { useForm } from 'react-hook-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSendOtp } from './use-send-otp'

afterEach(cleanup)

const otpSend = vi.hoisted(() => ({ isPending: false, mutate: vi.fn() }))

vi.mock('@/lib/api', () => ({ useOtpSend: () => otpSend }))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

type MutateOptions = { onSuccess: () => void; onError: (error: unknown) => void }

const lastOptions = () => otpSend.mutate.mock.calls.at(-1)?.[1] as MutateOptions

const renderSendOtp = (email: string) =>
  renderHook(() => {
    const form = useForm({ defaultValues: { email, otp: '' } })
    return { form, ...useSendOtp(form, 'sign-in') }
  })

describe('useSendOtp', () => {
  beforeEach(() => {
    otpSend.isPending = false
    otpSend.mutate.mockReset()
    showErrorToast.mockReset()
  })

  it('reports an invalid email on the field without calling the API', () => {
    const { result } = renderSendOtp('not-an-email')

    act(() => result.current.sendOtp())

    expect(otpSend.mutate).not.toHaveBeenCalled()
    expect(result.current.form.getFieldState('email').error?.message).toBe(
      'Please enter a valid email address.',
    )
  })

  it('clears field errors and sends the code for a valid email', () => {
    const { result } = renderSendOtp('jane@example.com')
    act(() => {
      result.current.form.setError('email', { message: 'old' })
      result.current.form.setError('otp', { message: 'old' })
    })

    act(() => result.current.sendOtp())

    expect(otpSend.mutate).toHaveBeenCalledWith(
      { email: 'jane@example.com', type: 'sign-in' },
      expect.any(Object),
    )
    expect(result.current.form.getFieldState('email').error).toBeUndefined()
    expect(result.current.form.getFieldState('otp').error).toBeUndefined()
  })

  it('keeps firstAttempt until a code has been sent', () => {
    const { result } = renderSendOtp('jane@example.com')
    expect(result.current.firstAttempt).toBe(true)

    act(() => result.current.sendOtp())
    act(() => lastOptions().onError(new Error('boom')))
    expect(result.current.firstAttempt).toBe(true)

    act(() => result.current.sendOtp())
    act(() => lastOptions().onSuccess())
    expect(result.current.firstAttempt).toBe(false)
  })

  it('shows a toast when sending fails', () => {
    const error = new Error('boom')
    const { result } = renderSendOtp('jane@example.com')

    act(() => result.current.sendOtp())
    act(() => lastOptions().onError(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not send the code', error)
  })

  it('ignores calls while a code is being sent', () => {
    otpSend.isPending = true
    const { result } = renderSendOtp('jane@example.com')

    act(() => result.current.sendOtp())

    expect(otpSend.mutate).not.toHaveBeenCalled()
  })
})
