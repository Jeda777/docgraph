import { otpCodeSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm, useFormState } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { EmailField } from '@/components/form/email-field'
import { Button } from '@/components/ui/button'
import { FieldSet } from '@/components/ui/field'
import { getErrorMessage, isApiError, useOtpLogin } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { AuthPanel } from '../components/auth-panel'
import { OtpField } from '../components/otp-field'
import { useAuthRedirect } from '../hooks/use-auth-redirect'
import { useSendOtp } from '../hooks/use-send-otp'

const formSchema = z.object({
  email: z.email('Email is invalid'),
  otp: otpCodeSchema,
})
type FormType = z.infer<typeof formSchema>

export const LoginOtp = () => {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const defaultEmail =
    ((location.state as { email?: string })?.email ?? params.get('email')) || undefined
  const navigate = useNavigate()
  const { redirectTo, redirectSearch } = useAuthRedirect()

  const otpLogin = useOtpLogin()

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultEmail,
    },
  })
  const { isValid } = useFormState({ control: form.control })
  const { sendOtp, firstAttempt } = useSendOtp(form, 'sign-in')

  const handleSubmit = form.handleSubmit((data) => {
    otpLogin.mutate(data, {
      onSuccess: () => navigate(redirectTo, { replace: true }),
      onError: (error) => {
        if (isApiError(error, 'INVALID_OTP', 'OTP_ATTEMPTS_EXCEEDED')) {
          form.setError('otp', { type: 'manual', message: getErrorMessage(error) })
        } else {
          showErrorToast('Login failed', error)
        }
      },
    })
  })

  return (
    <AuthPanel
      title='Log in with a code'
      description='We email you a one-time code, no password needed.'
    >
      <FormProvider {...form}>
        <form onSubmit={handleSubmit}>
          <FieldSet>
            <EmailField name='email' />
            <OtpField name='otp' onResend={sendOtp} firstAttempt={firstAttempt} />
            <Button
              size='lg'
              className='h-10'
              disabled={otpLogin.isPending || !isValid}
              type='submit'
            >
              Log in
            </Button>
            <Button
              variant='link'
              size='xs'
              onClick={() =>
                navigate(`/login${redirectSearch}`, { state: { email: form.getValues('email') } })
              }
              className='mx-auto w-max text-muted-foreground hover:text-primary'
            >
              Log in with a password
            </Button>
          </FieldSet>
        </form>
      </FormProvider>
    </AuthPanel>
  )
}
