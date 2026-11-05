import {
  type FieldValues,
  FormProvider,
  type SubmitHandler,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { FieldSet } from '../ui/field'

export type FormDialogProps<T extends FieldValues> = {
  open: boolean
  onClose: () => void
  title: string
  id: string
  onDelete?: () => void
  children: React.ReactNode
  form: UseFormReturn<T>
  onSubmit: SubmitHandler<T, unknown>
  isPending?: boolean
}

export const FormDialog = <T extends FieldValues>({
  open,
  onClose,
  children,
  id,
  onDelete,
  title,
  form,
  onSubmit,
  isPending,
}: FormDialogProps<T>) => {
  const { isDirty } = useFormState({ control: form.control })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form id={id} onSubmit={form.handleSubmit(onSubmit)}>
            <FieldSet>{children}</FieldSet>
          </form>
        </FormProvider>

        <DialogFooter>
          {onDelete && (
            <Button type='button' variant='destructive' onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button type='submit' form={id} disabled={isPending || !isDirty}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
