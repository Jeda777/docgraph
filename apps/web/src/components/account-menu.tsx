import { ChevronsUpDown, LogOut, Moon, Sun, User, Users } from 'lucide-react'
import { useLogout, useMe } from '@/lib/api'
import { useUiStore } from '@/lib/stores'
import { getUserInitials } from '@/lib/utils'
import { Avatar, AvatarFallback } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

export type AccountMenuProps = {
  handleOpenUsersDialog?: () => void
  handleOpenProfileDialog?: () => void
  /** `avatar` for compact top bars (editors), `sidebar` for the full-width account row. */
  variant?: 'avatar' | 'sidebar'
}

export const AccountMenu = ({
  handleOpenUsersDialog,
  handleOpenProfileDialog,
  variant = 'avatar',
}: AccountMenuProps) => {
  const { name, email } = useMe()
  const theme = useUiStore((state) => state.theme)
  const toggleTheme = useUiStore((state) => state.toggleTheme)

  const { mutate: logout } = useLogout()

  const avatar = (
    <Avatar className='cursor-pointer'>
      <AvatarFallback className='bg-accent text-accent-foreground text-xs font-semibold'>
        {getUserInitials(name || '')}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <DropdownMenu>
      {variant === 'sidebar' ? (
        <DropdownMenuTrigger
          aria-label='Account menu'
          className='flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring aria-expanded:bg-sidebar-accent'
        >
          {avatar}
          <span className='flex min-w-0 flex-1 flex-col leading-tight'>
            <span className='truncate text-sm font-medium'>{name}</span>
            <span className='truncate text-xs text-muted-foreground'>{email}</span>
          </span>
          <ChevronsUpDown className='size-4 shrink-0 text-muted-foreground' />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger aria-label='Account menu' className='rounded-full'>
          {avatar}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        side={variant === 'sidebar' ? 'top' : 'bottom'}
        align={variant === 'sidebar' ? 'start' : 'end'}
        className='min-w-56'
      >
        {variant === 'avatar' && (
          <>
            <div className='flex flex-col px-1.5 py-1 text-xs text-muted-foreground'>
              <span className='truncate text-sm font-medium text-foreground'>{name}</span>
              <span className='truncate'>{email}</span>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {handleOpenProfileDialog && (
          <DropdownMenuItem onClick={handleOpenProfileDialog}>
            <User /> Profile
          </DropdownMenuItem>
        )}
        {handleOpenUsersDialog && (
          <DropdownMenuItem onClick={handleOpenUsersDialog}>
            <Users /> Users
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => toggleTheme()}>
          {theme === 'light' ? (
            <>
              <Moon /> Dark Mode
            </>
          ) : (
            <>
              <Sun /> Light Mode
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
