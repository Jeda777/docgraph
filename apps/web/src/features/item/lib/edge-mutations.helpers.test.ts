import type { Edge } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { edgeMutations } from './edge-mutations.helpers'

type TestEdgeData = { label: string; optional: boolean }
type TestEdge = Edge<TestEdgeData>

const DEFAULTS: TestEdgeData = { label: '', optional: false }

const EDGE: TestEdge = {
  id: 'e1',
  source: 'a',
  target: 'b',
  data: { label: 'has', optional: true },
}
const OTHER: TestEdge = {
  id: 'e2',
  source: 'b',
  target: 'c',
  data: { label: 'owns', optional: false },
}

/** Runs the mutations against a local edge list, like `setEdges` would. */
const setup = (edge: TestEdge, initial: TestEdge[] = [edge, OTHER]) => {
  let edges = initial
  const setEdges: React.Dispatch<React.SetStateAction<TestEdge[]>> = (action) => {
    edges = typeof action === 'function' ? action(edges) : action
  }
  return { mutations: edgeMutations(edge, setEdges, DEFAULTS), edges: () => edges }
}

describe('edgeMutations', () => {
  it('exposes the edge data', () => {
    expect(setup(EDGE).mutations.data).toBe(EDGE.data)
  })

  it('falls back to the defaults for edges imported without data', () => {
    const legacy: TestEdge = { id: 'e1', source: 'a', target: 'b' }

    expect(setup(legacy).mutations.data).toEqual(DEFAULTS)
  })

  it('patches only the given edge', () => {
    const { mutations, edges } = setup(EDGE)

    mutations.update({ label: 'belongs to' })

    expect(edges()).toEqual([{ ...EDGE, data: { label: 'belongs to', optional: true } }, OTHER])
  })

  it('fills missing fields from the defaults when patching', () => {
    const legacy = { id: 'e1', source: 'a', target: 'b', data: { label: 'old' } } as TestEdge
    const { mutations, edges } = setup(legacy)

    mutations.update({ optional: true })

    expect(edges()[0].data).toEqual({ label: 'old', optional: true })
  })

  it('patches the latest state, not the edge it was created from', () => {
    const { mutations, edges } = setup(EDGE)

    mutations.update({ label: 'first' })
    mutations.update({ optional: false })

    expect(edges()[0].data).toEqual({ label: 'first', optional: false })
  })

  it('deletes only the given edge', () => {
    const { mutations, edges } = setup(EDGE)

    mutations.handleDelete()

    expect(edges()).toEqual([OTHER])
  })
})
