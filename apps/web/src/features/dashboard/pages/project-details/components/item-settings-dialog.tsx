import { type ItemUpdateInput, itemUpdateInputSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FormCheckbox } from '@/components/form/form-checkbox'
import { FormInput } from '@/components/form/form-input'
import { SettingsDialog } from '@/components/form/settings-dialog'
import { useItemDelete, useItemGetById, useItemUpdate } from '@/lib/api'

export type ItemSettingsDialogProps = {
  /** Item being edited; `null` keeps the dialog closed. */
  itemId: string | null
  onClose: () => void
}

export const ItemSettingsDialog = ({ itemId, onClose }: ItemSettingsDialogProps) => {
  const form = useForm<ItemUpdateInput>({
    resolver: zodResolver(itemUpdateInputSchema),
  })

  const update = useItemUpdate()
  const remove = useItemDelete()
  // Keeps the still-mounted dialog from refetching the item it just deleted into a 404. The
  // dialog stays mounted for the next item, so only this item's deletion turns the query off.
  const isDeleted = remove.isSuccess && remove.variables.id === itemId
  const { data } = useItemGetById(itemId ?? '', !!itemId && !isDeleted)

  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name,
        isArchived: data.isArchived,
      })
    }
  }, [data, form.reset])

  return (
    <SettingsDialog
      open={!!itemId && !!data}
      onClose={onClose}
      title='Item Settings'
      id='item-settings-form'
      entityLabel='item'
      form={form}
      onSave={(formData) =>
        data
          ? update.mutateAsync({ ...formData, id: data.id })
          : Promise.reject(new Error('Item is not loaded'))
      }
      isSaving={update.isPending}
      onDelete={() =>
        data ? remove.mutateAsync(data) : Promise.reject(new Error('Item is not loaded'))
      }
      isDeleting={remove.isPending}
      deleteScope='and its content'
    >
      <FormInput name='name' label='Name' />

      <FormCheckbox name='isArchived' label='Is Archived' />
    </SettingsDialog>
  )
}
