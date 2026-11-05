import { describe, expect, it } from 'vitest'
import { type CollectionMap, isJsonEqual, syncCollection } from './collection-sync'

type Element = { id: string; value: number }

/** A `Map` that records which keys were set or deleted. */
const trackedMap = <T>(entries: [string, T][] = []) => {
  const map = new Map(entries)
  const changed: string[] = []
  const tracked: CollectionMap<T> = {
    keys: () => map.keys(),
    get: (key) => map.get(key),
    set: (key, value) => {
      changed.push(key)
      return map.set(key, value)
    },
    delete: (key) => {
      changed.push(key)
      return map.delete(key)
    },
  }
  return { map, tracked, changed }
}

describe('syncCollection', () => {
  it('sets only new and changed elements and deletes missing ones', () => {
    const { map, tracked, changed } = trackedMap<Element>([
      ['a', { id: 'a', value: 1 }],
      ['b', { id: 'b', value: 2 }],
      ['c', { id: 'c', value: 3 }],
    ])

    syncCollection(tracked, [
      { id: 'a', value: 1 },
      { id: 'b', value: 20 },
      { id: 'd', value: 4 },
    ])

    expect(changed.sort()).toEqual(['b', 'c', 'd'])
    expect(Object.fromEntries(map)).toEqual({
      a: { id: 'a', value: 1 },
      b: { id: 'b', value: 20 },
      d: { id: 'd', value: 4 },
    })
  })

  it('does not rewrite an element whose keys are reordered', () => {
    const { tracked, changed } = trackedMap([['a', { id: 'a', value: 1 }]])

    syncCollection(tracked, [{ value: 1, id: 'a' }])

    expect(changed).toEqual([])
  })

  it('compares and stores the result of toStored', () => {
    type Node = Element & { selected?: boolean }
    const { map, tracked, changed } = trackedMap<Node>([['a', { id: 'a', value: 1 }]])
    const strip = ({ selected: _, ...rest }: Node) => rest

    syncCollection(tracked, [{ id: 'a', value: 1, selected: true }], strip)
    expect(changed).toEqual([])

    syncCollection(tracked, [{ id: 'b', value: 2, selected: true }], strip)
    expect(map.get('b')).toEqual({ id: 'b', value: 2 })
  })
})

describe('isJsonEqual', () => {
  it('ignores object key order', () => {
    expect(isJsonEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true)
  })

  it('treats undefined keys as missing', () => {
    expect(isJsonEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })

  it('detects differing values, array order and types', () => {
    expect(isJsonEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(isJsonEqual([1, 2], [2, 1])).toBe(false)
    expect(isJsonEqual({ 0: 1 }, [1])).toBe(false)
    expect(isJsonEqual(null, {})).toBe(false)
  })
})
