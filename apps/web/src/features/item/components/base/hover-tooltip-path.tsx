import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_OFFSET = 12

export type HoverTooltipPathProps = {
  edgePath: string
  /** Content rendered in the floating tooltip while the pointer is over the path. */
  renderTooltip?: () => ReactNode
  onDoubleClick?: () => void
}

/**
 * Invisible wide stroke drawn over the edge path: the hover/double-click hit
 * target shared by every edge component. While hovered, it portals a small
 * tooltip next to the cursor.
 */
export const HoverTooltipPath = ({
  edgePath,
  renderTooltip,
  onDoubleClick,
}: HoverTooltipPathProps) => {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const tooltipId = useId()
  const showTooltip = tip && renderTooltip

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: invisible edge hover/double-click target */}
      <path
        d={edgePath}
        fill='none'
        stroke='transparent'
        aria-describedby={showTooltip ? tooltipId : undefined}
        strokeWidth={20}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseMove={(e) => renderTooltip && setTip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTip(null)}
        onDoubleClick={onDoubleClick}
      />
      {showTooltip &&
        createPortal(
          <div
            id={tooltipId}
            role='tooltip'
            className='fixed z-100 flex flex-col pointer-events-none rounded-md bg-popover text-popover-foreground text-xs px-2 py-1 shadow-md ring-1 ring-foreground/10'
            style={{ left: tip.x + TOOLTIP_OFFSET, top: tip.y + TOOLTIP_OFFSET }}
          >
            {renderTooltip()}
          </div>,
          document.body,
        )}
    </>
  )
}
