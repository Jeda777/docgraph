import { describe, expect, it } from 'vitest'
import { Doc } from 'yjs'
import { writeCollection } from './item-document'

type Element = { id: string; value: number }

// `syncCollection` itself is tested with a plain `Map`; this checks it against a real `Y.Map`.
describe('writeCollection', () => {
  it('sets only new and changed elements and deletes missing ones', () => {
    const doc = new Doc()
    writeCollection<Element>(doc, 'nodes', [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
    ])
    const changed: string[] = []
    doc.getMap('nodes').observe((event) => changed.push(...event.keysChanged))

    writeCollection<Element>(doc, 'nodes', [
      { id: 'a', value: 1 },
      { id: 'b', value: 20 },
      { id: 'd', value: 4 },
    ])

    expect(changed.sort()).toEqual(['b', 'c', 'd'])
    expect(doc.getMap('nodes').toJSON()).toEqual({
      a: { id: 'a', value: 1 },
      b: { id: 'b', value: 20 },
      d: { id: 'd', value: 4 },
    })
  })

  it('does not rewrite an element whose keys are reordered', () => {
    const doc = new Doc()
    writeCollection(doc, 'nodes', [{ id: 'a', value: 1 }])
    const changed: string[] = []
    doc.getMap('nodes').observe((event) => changed.push(...event.keysChanged))

    writeCollection(doc, 'nodes', [{ value: 1, id: 'a' }])

    expect(changed).toEqual([])
  })
})
