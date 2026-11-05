import { type ProjectUpdateInput, projectUpdateInputSchema } from '@docgraph/common/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { FormCheckbox } from '@/components/form/form-checkbox'
import { SettingsDialog } from '@/components/form/settings-dialog'
import { useProjectDelete, useProjectGetById, useProjectUpdate } from '@/lib/api'
import { ProjectBaseForm } from './project-base-form'

export type ProjectSettingsDialogProps = {
  /** Project being edited; `null` keeps the dialog closed. */
  projectId: string | null
  onClose: () => void
}

export const ProjectSettingsDialog = ({ projectId, onClose }: ProjectSettingsDialogProps) => {
  const form = useForm<ProjectUpdateInput>({
    resolver: zodResolver(projectUpdateInputSchema),
  })

  const update = useProjectUpdate()
  const remove = useProjectDelete()
  // Keeps the still-mounted dialog from refetching the project it just deleted into a 404. The
  // dialog stays mounted for the next project, so only this project's deletion turns the query off.
  const isDeleted = remove.isSuccess && remove.variables === projectId
  const { data } = useProjectGetById(
    projectId ?? '',
    { getMembers: true },
    !!projectId && !isDeleted,
  )

  useEffect(() => {
    if (data) {
      form.reset({
        name: data.name,
        isForAllUsers: data.isForAllUsers,
        memberIds: data.members?.map((member) => member.id) || [],
        isArchived: data.isArchived,
      })
    }
  }, [data, form.reset])

  const isOpen = !!projectId && !!data

  return (
    <SettingsDialog
      open={isOpen}
      onClose={onClose}
      title='Project Settings'
      id='project-settings-form'
      entityLabel='project'
      form={form}
      onSave={(formData) =>
        data
          ? update.mutateAsync({ ...formData, id: data.id })
          : Promise.reject(new Error('Project is not loaded'))
      }
      isSaving={update.isPending}
      onDelete={() =>
        data ? remove.mutateAsync(data.id) : Promise.reject(new Error('Project is not loaded'))
      }
      isDeleting={remove.isPending}
      deleteScope='and all its items'
    >
      <ProjectBaseForm isDialogOpen={isOpen} />

      <FormCheckbox name='isArchived' label='Is Archived' />
    </SettingsDialog>
  )
}
