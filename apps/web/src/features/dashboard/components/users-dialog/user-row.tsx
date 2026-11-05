import type { UserSummary } from '@docgraph/common/schemas'
import { EllipsisVertical, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toast'
import { useUserUpdate } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { getUserInitials } from '@/lib/utils'

export type UserRowProps = {
  user: UserSummary
  /** The signed-in admin: no actions, so they can't lock themselves out. */
  isSelf: boolean
  onDelete: (user: UserSummary) => void
}

export const UserRow = ({ user, isSelf, onDelete }: UserRowProps) => {
  const { mutate: update, isPending } = useUserUpdate()

  const toggleAdmin = () => {
    const isAdmin = !user.isAdmin
    update(
      { id: user.id, isAdmin },
      {
        onError: (error) => showErrorToast('Could not change the role', error),
        onSuccess: () =>
          toast.add({
            type: 'success',
            title: isAdmin ? 'User is now an admin' : 'Admin rights removed',
            description: user.email,
          }),
      },
    )
  }

  return (
    <div className='flex items-center gap-3'>
      <Avatar className='size-8'>
        <AvatarFallback>{getUserInitials(user.name)}</AvatarFallback>
      </Avatar>
      <div className='min-w-0 flex-1'>
        <p className='flex items-center gap-1.5 text-sm font-medium'>
          <span className='truncate'>{user.name}</span>
          {isSelf && <span className='text-xs font-normal text-muted-foreground'>(you)</span>}
          {user.isAdmin && (
            <span className='rounded-sm bg-muted px-1.5 py-px text-[10px] font-medium uppercase text-muted-foreground'>
              Admin
            </span>
          )}
        </p>
        <p className='truncate text-xs text-muted-foreground'>{user.email}</p>
      </div>
      {!isSelf && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label={`Manage ${user.name}`}
                disabled={isPending}
              />
            }
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={toggleAdmin}>
              {user.isAdmin ? (
                <>
                  <ShieldOff /> Remove admin rights
                </>
              ) : (
                <>
                  <ShieldCheck /> Make admin
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant='destructive' onClick={() => onDelete(user)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
