import { useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { showErrorToast } from '@/lib/error-toast'
import { FormDialog } from './form-dialog'

export type SettingsDialogProps<T extends FieldValues> = {
  open: boolean
  onClose: () => void
  title: string
  id: string
  /** Lowercase name of the edited entity, used in error toasts and the delete confirmation. */
  entityLabel: string
  form: UseFormReturn<T>
  onSave: (data: T) => Promise<unknown>
  isSaving: boolean
  onDelete: () => Promise<unknown>
  isDeleting: boolean
  /** What else the delete removes, e.g. `'and all its items'`. */
  deleteScope?: string
  children: React.ReactNode
}

/**
 * Edit dialog of an existing entity: a form saved with `onSave` plus a confirmed delete.
 * Both close the dialog on success and report failures with a toast. Deleting removes the
 * entity for good (archiving is the reversible option), so the confirmation says so.
 */
export const SettingsDialog = <T extends FieldValues>({
  open,
  onClose,
  title,
  id,
  entityLabel,
  form,
  onSave,
  isSaving,
  onDelete,
  isDeleting,
  deleteScope,
  children,
}: SettingsDialogProps<T>) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const handleSave = (data: T) => {
    if (isSaving) return
    onSave(data).then(onClose, (error) =>
      showErrorToast(`Could not save the ${entityLabel}`, error),
    )
  }

  const handleDelete = () => {
    if (isDeleting) return
    onDelete().then(
      () => {
        setIsConfirmingDelete(false)
        onClose()
      },
      (error) => showErrorToast(`Could not delete the ${entityLabel}`, error),
    )
  }

  return (
    <>
      <FormDialog
        open={open}
        onClose={onClose}
        title={title}
        id={id}
        onDelete={() => setIsConfirmingDelete(true)}
        form={form}
        onSubmit={handleSave}
        isPending={isSaving}
      >
        {children}
      </FormDialog>

      <ConfirmDeleteDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        description={[
          'This action cannot be undone.',
          `The ${entityLabel}${deleteScope ? ` ${deleteScope}` : ''} will be permanently deleted.`,
          `To keep it read-only instead, archive the ${entityLabel}.`,
        ].join(' ')}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  )
}
