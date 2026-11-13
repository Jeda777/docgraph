import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { API_KEY_HEADER } from '@docgraph/common/schemas'
import { Copy, XIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'

const MCP_URL = `${location.origin}/mcp`

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ type: 'success', title: 'Copied to clipboard' })
  } catch {
    toast.add({ type: 'error', title: 'Could not copy', description: 'Copy the text manually.' })
  }
}

type CopyBlockProps = {
  label: string
  value: string
}

const CopyBlock = ({ label, value }: CopyBlockProps) => (
  <div className='flex flex-col gap-1'>
    <span className='text-xs text-muted-foreground'>{label}</span>
    <div className='flex items-start gap-1'>
      <code className='min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-xs'>
        {value}
      </code>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={`Copy ${label}`}
        onClick={() => copy(value)}
      >
        <Copy />
      </Button>
    </div>
  </div>
)

export type CreatedApiKeyDialogProps = {
  /** The plain key, shown only once right after it was created. */
  apiKey: string | undefined
  onClose: () => void
}

/**
 * Composed by hand instead of `DialogContent` because Base UI skips the backdrop of a dialog
 * opened inside another one unless it gets `forceRender` (see `ConfirmDeleteDialog`).
 * Popup classes mirror `DialogContent` — keep them in sync when `ui/` is regenerated.
 */
export const CreatedApiKeyDialog = ({ apiKey, onClose }: CreatedApiKeyDialogProps) => {
  // Keeps the key on screen while the closing animation runs, then forgets it
  const [shownKey, setShownKey] = useState(apiKey)
  if (apiKey && apiKey !== shownKey) setShownKey(apiKey)

  return (
    <Dialog
      open={Boolean(apiKey)}
      onOpenChange={(open) => !open && onClose()}
      onOpenChangeComplete={(open) => !open && setShownKey(undefined)}
    >
      <DialogPortal>
        <DialogOverlay forceRender onClick={onClose} />
        <DialogPrimitive.Popup
          data-slot='dialog-content'
          className='fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'
        >
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Copy the API key now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {shownKey && (
            <div className='flex flex-col gap-3'>
              <CopyBlock label='API key' value={shownKey} />
              <CopyBlock
                label='Claude Code'
                value={`claude mcp add --transport http docgraph ${MCP_URL} --header "${API_KEY_HEADER}: ${shownKey}"`}
              />
            </div>
          )}
          <DialogFooter>
            <Button type='button' onClick={onClose}>
              Done
            </Button>
          </DialogFooter>
          <DialogPrimitive.Close
            data-slot='dialog-close'
            render={<Button variant='ghost' className='absolute top-2 right-2' size='icon-sm' />}
          >
            <XIcon />
            <span className='sr-only'>Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
