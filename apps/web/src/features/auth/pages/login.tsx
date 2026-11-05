import { nonEmptyStringSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm, useFormState } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { EmailField } from '@/components/form/email-field'
import { PasswordField } from '@/components/form/password-field'
import { Button } from '@/components/ui/button'
import { FieldSet } from '@/components/ui/field'
import { getErrorMessage, isApiError, usePasswordLogin } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { AuthPanel } from '../components/auth-panel'
import { useAuthRedirect } from '../hooks/use-auth-redirect'

const formSchema = z.object({
  email: z.email('Email is invalid'),
  password: nonEmptyStringSchema,
})
type FormType = z.infer<typeof formSchema>

export const LoginPage = () => {
  const defaultEmail = (useLocation().state as { email?: string })?.email
  const navigate = useNavigate()
  const { redirectTo, redirectSearch } = useAuthRedirect()

  const passwordLogin = usePasswordLogin()

  const form = useForm<FormType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultEmail,
    },
  })
  const { isValid } = useFormState({ control: form.control })

  const handleSubmit = form.handleSubmit((data) => {
    passwordLogin.mutate(data, {
      onSuccess: () => navigate(redirectTo, { replace: true }),
      onError: (error) => {
        if (isApiError(error, 'INVALID_CREDENTIALS')) {
          form.setError('password', { type: 'manual', message: getErrorMessage(error) })
        } else {
          showErrorToast('Login failed', error)
        }
      },
    })
  })

  return (
    <AuthPanel title='Log in' description='Use your DocGraph account.'>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit}>
          <FieldSet>
            <EmailField name='email' />
            <PasswordField name='password' />

            <Button
              size='lg'
              className='h-10'
              disabled={passwordLogin.isPending || !isValid}
              type='submit'
            >
              Log in
            </Button>
            <div className='flex items-center gap-3 text-xs text-muted-foreground'>
              <span className='h-px flex-1 bg-border' />
              or
              <span className='h-px flex-1 bg-border' />
            </div>
            <Button
              variant='outline'
              size='lg'
              className='h-10'
              onClick={() =>
                navigate(`/login-otp${redirectSearch}`, {
                  state: { email: form.getValues('email') },
                })
              }
            >
              Log in with a code
            </Button>
            <Button
              variant='link'
              size='xs'
              onClick={() =>
                navigate(`/reset${redirectSearch}`, {
                  state: { email: form.getValues('email') },
                })
              }
              className='mx-auto w-max text-muted-foreground hover:text-primary'
            >
              Reset password
            </Button>
          </FieldSet>
        </form>
      </FormProvider>
    </AuthPanel>
  )
}
