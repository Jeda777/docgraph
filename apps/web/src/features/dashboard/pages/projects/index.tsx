import { Suspense, useState } from 'react'
import { SortableList } from '@/components/sortable-list'
import { useMe, useProjectGetList } from '@/lib/api'
import { lazyNamed } from '@/lib/lazy-named'
import { ProjectMark } from '../../components/project-mark'

const ProjectSettingsDialog = lazyNamed(
  () => import('./components/project-settings-dialog'),
  'ProjectSettingsDialog',
)
const ProjectCreateDialog = lazyNamed(
  () => import('./components/project-create-dialog'),
  'ProjectCreateDialog',
)

export const ProjectsPage = () => {
  const { isAdmin } = useMe()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)

  const { data: projects = [], isLoading } = useProjectGetList()

  return (
    <>
      <SortableList
        title='Projects'
        description={
          isLoading
            ? undefined
            : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'} you can open`
        }
        emptyText='No projects yet.'
        defaultView='grid'
        renderIcon={(project) => (
          <ProjectMark
            seed={project.id}
            name={project.name}
            className='size-9 rounded-lg text-sm'
          />
        )}
        additionalColumns={[
          {
            key: 'isForAllUsers',
            label: 'Access',
            className: 'w-36',
            format: (project) => (project.isForAllUsers ? 'All users' : 'Members only'),
          },
        ]}
        addButtonLabel='New Project'
        emptyAddButtonLabel='Create your first project'
        canAdd={isAdmin}
        canEdit={isAdmin}
        isLoading={isLoading}
        items={projects}
        linkToItem={(id) => `/projects/${id}`}
        onAddClick={() => setIsCreateDialogOpen(true)}
        onEditClick={(id) => setEditProjectId(id)}
      />

      <Suspense>
        <ProjectSettingsDialog projectId={editProjectId} onClose={() => setEditProjectId(null)} />
      </Suspense>

      <Suspense>
        <ProjectCreateDialog
          open={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
        />
      </Suspense>
    </>
  )
}
