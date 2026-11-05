const DUPLICATION_POSITION_OFFSET = 32

type NodeLike = {
  id: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export const duplicateNode = <N extends NodeLike>(
  state: N[],
  nodeId: string,
  transform?: (source: N['data']) => N['data'],
): N[] => {
  const source = state.find((n) => n.id === nodeId)
  if (!source) return state

  return [
    ...state,
    {
      ...source,
      id: crypto.randomUUID(),
      selected: false,
      dragging: false,
      position: {
        x: source.position.x + DUPLICATION_POSITION_OFFSET,
        y: source.position.y + DUPLICATION_POSITION_OFFSET,
      },
      ...(transform ? { data: transform(source.data) } : {}),
    },
  ]
}
