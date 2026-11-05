import { type UserCreateInput, userCreateInputSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { FormProvider, useForm } from 'react-hook-form'
import { EmailField } from '@/components/form/email-field'
import { FormInput } from '@/components/form/form-input'
import { Button } from '@/components/ui/button'
import { FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { getErrorMessage, isApiError, useUserCreate } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'

export const UserAddForm = () => {
  const { mutate, isPending } = useUserCreate()

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateInputSchema),
  })

  const onSubmit = (data: UserCreateInput) => {
    if (isPending) return

    mutate(data, {
      onError: (error) => {
        if (isApiError(error, 'USER_ALREADY_EXISTS')) {
          form.setError('email', { message: getErrorMessage(error) }, { shouldFocus: true })
        } else {
          showErrorToast('Could not invite the user', error)
        }
      },
      onSuccess: () => {
        // React Compiler memoizes `register`, so inputs would not re-register after a plain reset
        form.reset(undefined, { keepFieldsRef: true })
        toast.add({ type: 'success', title: 'User invited', description: data.email })
      },
    })
  }
  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FieldSet className='gap-2'>
          <FormInput name='name' label='Name' size='sm' />
          <EmailField name='email' size='sm' />
          <Button type='submit' disabled={isPending} size='sm'>
            {isPending ? (
              <Spinner className='size-4' />
            ) : (
              <>
                <Plus className='size-4' /> Invite User
              </>
            )}
          </Button>
        </FieldSet>
      </form>
    </FormProvider>
  )
}
