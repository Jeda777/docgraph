import { type ItemCreateInput, itemCreateInputSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { FormDialog } from '@/components/form/form-dialog'
import { FormInput } from '@/components/form/form-input'
import { ItemTypeTile } from '@/components/item-type/item-type-tile'
import { ITEM_TYPES_CONFIG } from '@/components/item-type/item-types.config'
import { Field, FieldContent, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useItemCreate } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'

export type ItemCreateDialogProps = {
  open: boolean
  onClose: () => void
  projectId?: string
}

export const ItemCreateDialog = ({ open, onClose, projectId }: ItemCreateDialogProps) => {
  const form = useForm<ItemCreateInput>({
    resolver: zodResolver(itemCreateInputSchema),
    defaultValues: {
      type: 'DOCUMENT',
      projectId: projectId ?? undefined,
    },
  })

  const { mutate, isPending } = useItemCreate()

  useEffect(() => {
    if (!projectId) {
      form.reset()
    } else {
      form.reset({
        projectId: projectId,
        type: 'DOCUMENT',
      })
    }
  }, [projectId, form.reset])

  const onSubmit = (data: ItemCreateInput) => {
    if (isPending) return

    mutate(data, {
      onSuccess: () => {
        onClose()
      },
      onError: (error) => showErrorToast('Could not create the item', error),
    })
  }

  return (
    <FormDialog
      open={!!projectId && open}
      onClose={onClose}
      title='Create Item'
      id='item-create-form'
      form={form}
      onSubmit={onSubmit}
      isPending={isPending}
    >
      <FormInput name='name' label='Name' />

      <Field>
        <Label htmlFor='type'>Type</Label>
        <Controller
          control={form.control}
          name='type'
          render={({ field: { value, onChange } }) => (
            <RadioGroup value={value} onValueChange={onChange} className='grid grid-cols-2 gap-2'>
              {Object.values(ITEM_TYPES_CONFIG).map((itemType) => (
                <FieldLabel
                  key={itemType.value}
                  htmlFor={itemType.value}
                  className='transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-accent/50'
                >
                  <Field orientation='horizontal' className='items-center gap-3'>
                    <ItemTypeTile type={itemType.value} className='size-9' />
                    <FieldContent>
                      <FieldTitle className='text-sm'>{itemType.label}</FieldTitle>
                    </FieldContent>
                    <RadioGroupItem
                      className='sr-only size-0'
                      value={itemType.value}
                      id={itemType.value}
                    />
                  </Field>
                </FieldLabel>
              ))}
            </RadioGroup>
          )}
        />
      </Field>
    </FormDialog>
  )
}
