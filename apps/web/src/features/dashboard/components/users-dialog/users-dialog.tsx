import type { UserSummary } from '@docgraph/common/schemas'
import { useState } from 'react'
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useMe, useUserDelete, useUserGetList } from '@/lib/api'
import { showErrorToast } from '@/lib/error-toast'
import { UserAddForm } from './user-add-form'
import { UserRow } from './user-row'

export type UsersDialogProps = {
  isOpen: boolean
  setOpen: (open: boolean) => void
}

export const UsersDialog = ({ isOpen, setOpen }: UsersDialogProps) => {
  const { id: myId, isAdmin } = useMe()
  const { data: users = [], isLoading } = useUserGetList(isAdmin)
  const { mutate: remove, isPending: isDeleting } = useUserDelete()
  const [userToDelete, setUserToDelete] = useState<UserSummary>()

  if (!isAdmin) return null

  const onDelete = () => {
    if (!userToDelete || isDeleting) return

    remove(userToDelete.id, {
      onError: (error) => showErrorToast('Could not delete the user', error),
      onSuccess: () => {
        toast.add({ type: 'success', title: 'User deleted', description: userToDelete.email })
        setUserToDelete(undefined)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setOpen(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Users</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-4 mt-1'>
          {isLoading ? (
            <Spinner className='size-8 mx-auto' />
          ) : (
            <div className='flex max-h-60 min-h-32 flex-col gap-3 overflow-y-auto'>
              {users.length === 0 && (
                <p className='text-sm text-muted-foreground'>No users found.</p>
              )}
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === myId}
                  onDelete={setUserToDelete}
                />
              ))}
            </div>
          )}

          <Separator />

          <UserAddForm />
        </div>

        <ConfirmDeleteDialog
          open={Boolean(userToDelete)}
          onOpenChange={(open) => !open && setUserToDelete(undefined)}
          description={`${userToDelete?.name} (${userToDelete?.email}) will be deleted with their API keys and project memberships. This cannot be undone.`}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      </DialogContent>
    </Dialog>
  )
}
