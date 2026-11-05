import { type ProjectCreateInput, projectCreateInputSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FormDialog } from '@/components/form/form-dialog'
import { useProjectCreate } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { ProjectBaseForm } from './project-base-form'

export type ProjectCreateDialogProps = {
  open: boolean
  onClose: () => void
}

export const ProjectCreateDialog = ({ open, onClose }: ProjectCreateDialogProps) => {
  const form = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateInputSchema),
    defaultValues: {
      isForAllUsers: true,
      memberIds: [],
    },
  })

  const { mutate, isPending } = useProjectCreate()

  useEffect(() => {
    if (!open) {
      form.reset()
    }
  }, [open, form.reset])

  const onSubmit = (data: ProjectCreateInput) => {
    if (isPending) return

    mutate(data, {
      onSuccess: onClose,
      onError: (error) => showErrorToast('Could not create the project', error),
    })
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title='Create Project'
      id='project-create-form'
      form={form}
      onSubmit={onSubmit}
      isPending={isPending}
    >
      <ProjectBaseForm isDialogOpen={open} />
    </FormDialog>
  )
}
