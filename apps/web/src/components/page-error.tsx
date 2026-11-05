import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'

export type PageErrorProps = {
  error: unknown
  onRetry: () => void
  /** Fill the whole screen (pages without a layout) instead of the parent box. */
  fullScreen?: boolean
}

/**
 * Shown when a page's data failed to load for a reason that may pass (server error, no network),
 * so the user stays on the page and can try again instead of being sent elsewhere.
 */
export const PageError = ({ error, onRetry, fullScreen = false }: PageErrorProps) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center gap-4 text-center',
      fullScreen ? 'min-h-screen bg-background' : 'w-full h-full',
    )}
  >
    <p className='text-muted-foreground'>{getErrorMessage(error)}</p>
    <Button variant='outline' onClick={onRetry}>
      Try again
    </Button>
  </div>
)
