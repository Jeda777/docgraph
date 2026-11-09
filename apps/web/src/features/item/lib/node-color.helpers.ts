import { NODE_COLORS, type NodeColor, nodeColorAt } from '@docgraph/common/schemas'

const isNodeColor = (value: unknown): value is NodeColor => NODE_COLORS.includes(value as NodeColor)

/**
 * CSS color for a node color name. The name may come from another client's
 * awareness state, so anything unknown falls back to gray instead of being
 * interpolated into a style.
 */
export const nodeColorVar = (color: unknown) =>
  `var(--color-${isNodeColor(color) ? color : 'gray'}-500)`

/** CSS color of a collaborator's cursor and caret, stable for their awareness client id. */
export const collaboratorColor = (clientId: number) => nodeColorVar(nodeColorAt(clientId))

export const colorClasses: Record<NodeColor, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-500',
  lime: 'bg-lime-500',
  emerald: 'bg-emerald-500',
  cyan: 'bg-cyan-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  fuchsia: 'bg-fuchsia-500',
  pink: 'bg-pink-500',
  rose: 'bg-rose-500',
  gray: 'bg-gray-500',
  stone: 'bg-stone-500',
}
