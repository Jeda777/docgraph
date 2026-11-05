import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useMe } from '@/lib/api'
import { getUserInitials } from '@/lib/utils'
import { ApiKeysSection } from './api-keys-section'
import { PasswordChangeSection } from './password-change-section'

export type ProfileDialogProps = {
  isOpen: boolean
  setOpen: (open: boolean) => void
}

export const ProfileDialog = ({ isOpen, setOpen }: ProfileDialogProps) => {
  const { name, email } = useMe()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setOpen(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-5'>
          <div className='flex items-center gap-3'>
            <Avatar className='size-12'>
              <AvatarFallback>{name && getUserInitials(name)}</AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <p className='truncate font-semibold'>{name}</p>
              <p className='truncate text-sm text-muted-foreground'>{email}</p>
            </div>
          </div>
          <Separator />
          <PasswordChangeSection />
          <Separator />
          <ApiKeysSection />
        </div>
      </DialogContent>
    </Dialog>
  )
}
