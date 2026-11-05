import { ChevronLeft } from 'lucide-react'
import { Suspense, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { ItemTypeTile } from '@/components/item-type/item-type-tile'
import { ITEM_TYPES_CONFIG } from '@/components/item-type/item-types.config'
import { PageError } from '@/components/page-error'
import { PageSpinner } from '@/components/page-spinner'
import { SortableList } from '@/components/sortable-list'
import { getErrorStatus, useMe, useProjectGetById } from '@/lib/api'
import { lazyNamed } from '@/lib/lazy-named'
import { parseRouteId } from '@/lib/utils'

const ItemCreateDialog = lazyNamed(
  () => import('./components/item-create-dialog'),
  'ItemCreateDialog',
)

const ItemSettingsDialog = lazyNamed(
  () => import('./components/item-settings-dialog'),
  'ItemSettingsDialog',
)

export const ProjectDetailsPage = () => {
  const { isAdmin } = useMe()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const projectId = parseRouteId(useParams<{ projectId: string }>().projectId)

  const {
    data: project,
    error,
    isFetching,
    refetch,
  } = useProjectGetById(projectId ?? '', { getItems: true }, projectId !== null)

  // Only a project that doesn't exist sends the user away; other failures may pass on retry.
  if (projectId === null || getErrorStatus(error) === 404) {
    return <Navigate to='/' replace />
  }

  if (!project) {
    if (error && !isFetching) return <PageError error={error} onRetry={() => refetch()} />
    return <PageSpinner />
  }

  return (
    <>
      <SortableList
        breadcrumb={
          <Link
            to='/'
            className='-ml-1 flex w-max items-center gap-0.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            <ChevronLeft className='size-4' />
            Projects
          </Link>
        }
        title={
          <>
            {project.name}
            {project.isArchived && (
              <>
                {' '}
                <span className='ml-2 align-middle text-base font-normal text-muted-foreground'>
                  (archived)
                </span>
              </>
            )}
          </>
        }
        description={describeProject(project.items?.length ?? 0, project.isArchived)}
        emptyText={
          project.isArchived ? 'This project has no items.' : 'No items yet. Create the first one.'
        }
        renderIcon={(item) => <ItemTypeTile type={item.type} />}
        addButtonLabel='New Item'
        emptyAddButtonLabel='Create your first item'
        canAdd={!project.isArchived}
        canEdit={isAdmin}
        isLoading={false}
        items={project.items || []}
        linkToItem={(id) => `/item/${id}`}
        onAddClick={() => setIsCreateDialogOpen(true)}
        onEditClick={(id) => setEditItemId(id)}
        additionalColumns={[
          {
            key: 'type',
            label: 'Type',
            className: 'w-44',
            format: (item) => ITEM_TYPES_CONFIG[item.type].label,
          },
        ]}
      />

      <Suspense>
        <ItemCreateDialog
          open={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          projectId={projectId}
        />
      </Suspense>

      <Suspense>
        <ItemSettingsDialog itemId={editItemId} onClose={() => setEditItemId(null)} />
      </Suspense>
    </>
  )
}

const describeProject = (itemCount: number, isArchived: boolean) => {
  const count = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
  return isArchived ? `${count} · Read-only, unarchive the project to edit it` : count
}
