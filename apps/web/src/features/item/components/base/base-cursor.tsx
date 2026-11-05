import { MousePointer2, Move } from 'lucide-react'

export type BaseCursorProps = {
  position: { x: number; y: number }
  name: string
  color?: string
  /** Swap the pointer for a move icon while this user drags a node. */
  dragging?: boolean
}

export const BaseCursor = ({ position, name, color, dragging }: BaseCursorProps) => {
  const words = name.trim().split(' ')
  const initials = `${words[0]?.charAt(0) ?? ''}${words[1]?.charAt(0) ?? ''}`.toUpperCase() || '?'

  return (
    <div
      className='absolute pointer-events-none transition-all duration-25'
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',

        zIndex: 100,
      }}
    >
      {dragging ? (
        <Move
          aria-hidden='true'
          className='size-6 absolute -left-1.5 -top-1.5'
          style={{ color: color || 'red' }}
        />
      ) : (
        <MousePointer2
          fill='currentColor'
          aria-hidden='true'
          className='size-6 absolute -left-1.5 -top-1.5'
          style={{ color: color || 'red' }}
        />
      )}
      <div
        style={{ background: color || 'red' }}
        className='absolute left-2 top-2 size-5 flex items-center justify-center text-white rounded-full text-xs'
      >
        {initials}
      </div>
    </div>
  )
}
