import { describe, expect, it } from 'vitest'
import { duplicateNode } from './duplicate-node.helpers'

type TestNode = {
  id: string
  position: { x: number; y: number }
  data: { label: string }
  selected?: boolean
  dragging?: boolean
  parentId?: string
}

const SOURCE: TestNode = {
  id: 'source',
  position: { x: 100, y: 50 },
  data: { label: 'Orders' },
  selected: true,
  dragging: true,
  parentId: 'area',
}
const OTHER: TestNode = { id: 'other', position: { x: 0, y: 0 }, data: { label: 'Users' } }

describe('duplicateNode', () => {
  it('appends an offset, unselected copy with a fresh id', () => {
    const state = [SOURCE, OTHER]

    const next = duplicateNode(state, 'source')

    expect(next).toHaveLength(3)
    expect(next.slice(0, 2)).toEqual(state)
    const copy = next[2]
    expect(copy.id).not.toBe(SOURCE.id)
    expect(copy).toEqual({
      ...SOURCE,
      id: copy.id,
      selected: false,
      dragging: false,
      position: { x: 132, y: 82 },
    })
  })

  it('gives every copy its own id', () => {
    const once = duplicateNode([SOURCE], 'source')
    const twice = duplicateNode(once, 'source')

    expect(new Set(twice.map((node) => node.id)).size).toBe(3)
  })

  it('keeps the source data when no transform is given', () => {
    const [, copy] = duplicateNode([SOURCE], 'source')

    expect(copy.data).toBe(SOURCE.data)
  })

  it('replaces the copy data with the transform result', () => {
    const [source, copy] = duplicateNode([SOURCE], 'source', (data) => ({
      label: `${data.label} copy`,
    }))

    expect(copy.data).toEqual({ label: 'Orders copy' })
    expect(source.data).toEqual({ label: 'Orders' })
  })

  it('returns the same state when the node does not exist', () => {
    const state = [SOURCE]

    expect(duplicateNode(state, 'missing')).toBe(state)
  })
})
