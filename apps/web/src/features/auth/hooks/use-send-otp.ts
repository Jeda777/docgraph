import { useState } from 'react'
import type { Path, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { useOtpSend } from '@/lib/api'
import type { authClient } from '@/lib/api/auth'
import { showErrorToast } from '@/lib/error-toast'

type OtpFormValues = { email: string; otp: string }

/**
 * Sends a one-time code to the email entered in `form`. An invalid email is reported on the
 * field instead of calling the API. `firstAttempt` stays true until a code has been sent, so
 * the code field can offer "Send code" before "Resend".
 */
export const useSendOtp = <T extends OtpFormValues>(
  form: UseFormReturn<T>,
  type: Parameters<typeof authClient.emailOtp.sendVerificationOtp>[0]['type'],
) => {
  const [firstAttempt, setFirstAttempt] = useState(true)
  const otpSend = useOtpSend()
  const emailField = 'email' as Path<T>
  const otpField = 'otp' as Path<T>

  const sendOtp = () => {
    if (otpSend.isPending) return
    const email = form.getValues(emailField) as string
    if (!z.email().safeParse(email).success) {
      form.setError(emailField, { type: 'manual', message: 'Please enter a valid email address.' })
      return
    }
    form.clearErrors([otpField, emailField])
    otpSend.mutate(
      { email, type },
      {
        onSuccess: () => setFirstAttempt(false),
        onError: (error) => showErrorToast('Could not send the code', error),
      },
    )
  }

  return { sendOtp, firstAttempt, isPending: otpSend.isPending }
}
