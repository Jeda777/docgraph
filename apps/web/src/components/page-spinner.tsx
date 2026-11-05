import { cn } from '@/lib/utils'
import { Spinner } from './ui/spinner'

export type PageSpinnerProps = {
  /** Fill the whole screen (before any layout is rendered) instead of the parent box. */
  fullScreen?: boolean
}

/** The loading state of a whole page or of the main area inside a layout. */
export const PageSpinner = ({ fullScreen = false }: PageSpinnerProps) => (
  <div
    className={cn(
      'flex items-center justify-center',
      fullScreen ? 'min-h-screen bg-background' : 'w-full h-full',
    )}
  >
    <Spinner className='size-16' />
  </div>
)
