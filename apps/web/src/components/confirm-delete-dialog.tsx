import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Button } from './ui/button'

export type ConfirmDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  description: string
  onDelete: () => void
  isDeleting?: boolean
}

/**
 * Composed by hand instead of `AlertDialogContent` because Base UI skips the backdrop
 * of a dialog opened inside another one unless it gets `forceRender`, and an alert dialog
 * never closes on a backdrop click by itself.
 * Popup classes mirror `AlertDialogContent` — keep them in sync when `ui/` is regenerated.
 */
export const ConfirmDeleteDialog = ({
  open,
  onOpenChange,
  description,
  onDelete,
  isDeleting = false,
}: ConfirmDeleteDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay forceRender onClick={() => onOpenChange(false)} />
        <AlertDialogPrimitive.Popup
          data-slot='alert-dialog-content'
          data-size='default'
          className='group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full max-w-xs -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type='button' variant='destructive' onClick={onDelete} disabled={isDeleting}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPortal>
    </AlertDialog>
  )
}
