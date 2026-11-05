import type { Edge } from '@xyflow/react'

/**
 * Read/patch/delete helpers for a single edge card in the sidebar. `defaults`
 * fills the gaps of edges imported before a field existed.
 */
export const edgeMutations = <E extends Edge>(
  edge: E,
  setEdges: React.Dispatch<React.SetStateAction<E[]>>,
  defaults: NonNullable<E['data']>,
) => ({
  data: (edge.data ?? defaults) as NonNullable<E['data']>,

  update: (patch: Partial<NonNullable<E['data']>>) =>
    setEdges((state) =>
      state.map((e) =>
        e.id === edge.id ? ({ ...e, data: { ...defaults, ...e.data, ...patch } } as E) : e,
      ),
    ),

  handleDelete: () => setEdges((state) => state.filter((e) => e.id !== edge.id)),
})
