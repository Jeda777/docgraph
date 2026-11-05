import { FolderKanban, Lock } from 'lucide-react'
import { Link, NavLink } from 'react-router'
import { AccountMenu } from '@/components/account-menu'
import { AppLogo } from '@/components/app-logo'
import { useProjectGetList } from '@/lib/api'
import { cn, compareNames } from '@/lib/utils'
import { ProjectMark } from './project-mark'

export type AppSidebarProps = {
  /** Opens user management from the account menu; only given to admins. */
  onOpenUsersDialog?: () => void
  onOpenProfileDialog: () => void
  /** Called after a link is followed, so the mobile drawer can close. */
  onNavigate?: () => void
}

const NAV_ITEM_CLASS_NAME =
  'flex h-8 items-center gap-2.5 rounded-lg px-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring'

export const AppSidebar = ({
  onOpenUsersDialog,
  onOpenProfileDialog,
  onNavigate,
}: AppSidebarProps) => {
  const { data: projects = [] } = useProjectGetList()

  // Active projects first, each group alphabetically, so the list reads like a stable index.
  const sortedProjects = [...projects].sort(
    (a, b) => Number(a.isArchived) - Number(b.isArchived) || compareNames(a.name, b.name),
  )

  return (
    <div className='flex h-full flex-col gap-6 bg-sidebar px-3 py-4 text-sidebar-foreground'>
      <Link
        to='/'
        onClick={onNavigate}
        className='flex items-center gap-2 rounded-lg px-1.5 text-[0.9375rem] font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring'
      >
        <AppLogo className='size-7' />
        DocGraph
      </Link>

      <nav aria-label='Main' className='flex flex-col gap-0.5'>
        <NavLink
          to='/'
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              NAV_ITEM_CLASS_NAME,
              isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
            )
          }
        >
          <FolderKanban className='size-4 text-muted-foreground' />
          All projects
        </NavLink>
      </nav>

      <nav aria-label='Projects' className='flex min-h-0 flex-1 flex-col gap-1'>
        <h2 className='px-2 text-xs font-medium text-muted-foreground'>Projects</h2>
        <ul className='-mx-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto px-1'>
          {sortedProjects.map((project) => (
            <li key={project.id}>
              <NavLink
                to={`/projects/${project.id}`}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    NAV_ITEM_CLASS_NAME,
                    project.isArchived && 'text-muted-foreground',
                    isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                  )
                }
              >
                <ProjectMark
                  seed={project.id}
                  name={project.name}
                  className={cn(project.isArchived && 'opacity-60 grayscale')}
                />
                <span className='truncate'>{project.name}</span>
                {!project.isForAllUsers && (
                  <Lock
                    aria-label='Members only'
                    className='ml-auto size-3 shrink-0 text-muted-foreground'
                  />
                )}
              </NavLink>
            </li>
          ))}
          {sortedProjects.length === 0 && (
            <li className='px-2 py-1 text-xs text-muted-foreground'>No projects yet.</li>
          )}
        </ul>
      </nav>

      <div className='border-t border-sidebar-border pt-3'>
        <AccountMenu
          variant='sidebar'
          handleOpenUsersDialog={onOpenUsersDialog}
          handleOpenProfileDialog={onOpenProfileDialog}
        />
      </div>
    </div>
  )
}
