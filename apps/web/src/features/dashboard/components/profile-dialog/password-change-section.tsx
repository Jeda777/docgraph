import { nonEmptyStringSchema, passwordSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useForm } from 'react-hook-form'
import { z } from 'zod'
import { PasswordField } from '@/components/form/password-field'
import { Button } from '@/components/ui/button'
import { FieldSet } from '@/components/ui/field'
import { toast } from '@/components/ui/toast'
import { getErrorMessage, isApiError, useAccountGetList, usePasswordChange } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'

const formSchema = z
  .object({
    currentPassword: nonEmptyStringSchema,
    newPassword: passwordSchema,
  })
  .superRefine(({ currentPassword, newPassword }, ctx) => {
    if (currentPassword === newPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'New password must be different from current password',
        path: ['newPassword'],
      })
    }
  })

type FormSchema = z.infer<typeof formSchema>

export const PasswordChangeSection = () => {
  const { data: accounts, isLoading } = useAccountGetList()
  const hasPassword = accounts?.some((account) => account.providerId === 'credential')
  const { mutate, isPending } = usePasswordChange()
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  })

  const onSubmit = (data: FormSchema) => {
    if (isPending || !accounts) return

    mutate(data, {
      onError: (error) => {
        if (isApiError(error, 'INVALID_PASSWORD')) {
          form.setError(
            'currentPassword',
            { message: getErrorMessage(error) },
            { shouldFocus: true },
          )
        } else {
          showErrorToast('Could not change the password', error)
        }
      },
      onSuccess: () => {
        // React Compiler memoizes `register`, so inputs would not re-register after a plain reset
        form.reset(undefined, { keepFieldsRef: true })
        toast.add({ type: 'success', title: 'Password changed' })
      },
    })
  }

  if (isLoading) return null

  if (!hasPassword)
    return <p className='text-muted-foreground'>To add a password, use Forgot password.</p>

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='py-1 w-full'>
        <FieldSet className='gap-2'>
          <PasswordField name='currentPassword' label='Current Password' />
          <PasswordField name='newPassword' label='New Password' autoComplete='new-password' />
          <Button type='submit' disabled={isPending}>
            Change Password
          </Button>
        </FieldSet>
      </form>
    </FormProvider>
  )
}
