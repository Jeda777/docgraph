export type EdgeMarkerShape =
  | 'arrow'
  | 'triangle'
  | 'triangle-filled'
  | 'diamond'
  | 'diamond-filled'
  | 'circle'

export type EdgeMarkerDefsProps = {
  id: string
  /** Line ending shape; `null` renders a plain line with no marker. */
  shape: EdgeMarkerShape | null
  orient?: 'auto' | 'auto-start-reverse'
}

/**
 * SVG marker definitions for diagram line endings. Every React Flow edge
 * renders inside its own svg, so a per-edge marker id is safe; consume with
 * `markerEnd={`url(#${id})`}`.
 */
export const EdgeMarkerDefs = ({ id, shape, orient = 'auto' }: EdgeMarkerDefsProps) => {
  if (!shape) return null

  return (
    <defs>
      <marker
        id={id}
        viewBox='0 0 16 16'
        markerWidth='14'
        markerHeight='14'
        refX={shape === 'diamond' || shape === 'diamond-filled' ? '14' : '13'}
        refY='8'
        orient={orient}
        markerUnits='userSpaceOnUse'
      >
        {shape === 'arrow' && (
          <path
            d='M2 2 L13 8 L2 14'
            fill='none'
            strokeWidth='1.5'
            style={{ stroke: 'var(--muted-foreground)' }}
          />
        )}
        {(shape === 'triangle' || shape === 'triangle-filled') && (
          <path
            d='M2 2 L14 8 L2 14 Z'
            style={{
              fill: shape === 'triangle' ? 'var(--card)' : 'var(--muted-foreground)',
              stroke: 'var(--muted-foreground)',
            }}
          />
        )}
        {(shape === 'diamond' || shape === 'diamond-filled') && (
          <path
            d='M1 8 L8 3 L15 8 L8 13 Z'
            style={{
              fill: shape === 'diamond' ? 'var(--card)' : 'var(--muted-foreground)',
              stroke: 'var(--muted-foreground)',
            }}
          />
        )}
        {shape === 'circle' && (
          <circle
            cx='7'
            cy='8'
            r='4'
            style={{ fill: 'var(--card)', stroke: 'var(--muted-foreground)' }}
            strokeWidth='1.5'
          />
        )}
      </marker>
    </defs>
  )
}
