import { otpCodeSchema, passwordSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm, useFormState } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { EmailField } from '@/components/form/email-field'
import { PasswordField } from '@/components/form/password-field'
import { Button } from '@/components/ui/button'
import { FieldSet } from '@/components/ui/field'
import { getErrorMessage, isApiError, usePasswordReset } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { AuthPanel } from '../components/auth-panel'
import { OtpField } from '../components/otp-field'
import { useAuthRedirect } from '../hooks/use-auth-redirect'
import { useSendOtp } from '../hooks/use-send-otp'

const formSchema = z.object({
  email: z.email('Email is invalid'),
  otp: otpCodeSchema,
  password: passwordSchema,
})
type FormType = z.infer<typeof formSchema>

export const ResetPage = () => {
  const defaultEmail = (useLocation().state as { email?: string })?.email
  const navigate = useNavigate()
  const { redirectSearch } = useAuthRedirect()

  const passwordReset = usePasswordReset()

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultEmail,
    },
  })
  const { isValid } = useFormState({ control: form.control })
  const { sendOtp, firstAttempt } = useSendOtp(form, 'forget-password')

  const handleSubmit = form.handleSubmit((data) => {
    passwordReset.mutate(data, {
      onSuccess: () => navigate(`/login${redirectSearch}`, { state: { email: data.email } }),
      onError: (error) => {
        if (isApiError(error, 'INVALID_OTP', 'OTP_ATTEMPTS_EXCEEDED')) {
          form.setError('otp', { type: 'manual', message: getErrorMessage(error) })
        } else {
          showErrorToast('Password reset failed', error)
        }
      },
    })
  })

  return (
    <AuthPanel title='Reset password' description='Get a code by email and choose a new password.'>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit}>
          <FieldSet>
            <EmailField name='email' />
            <PasswordField name='password' autoComplete='new-password' />
            <OtpField name='otp' onResend={sendOtp} firstAttempt={firstAttempt} />
            <Button
              size='lg'
              className='h-10'
              disabled={passwordReset.isPending || !isValid}
              type='submit'
            >
              Reset
            </Button>
            <Button
              variant='link'
              size='xs'
              onClick={() =>
                navigate(`/login${redirectSearch}`, { state: { email: form.getValues('email') } })
              }
              className='mx-auto w-max text-muted-foreground hover:text-primary'
            >
              Back to login
            </Button>
          </FieldSet>
        </form>
      </FormProvider>
    </AuthPanel>
  )
}
