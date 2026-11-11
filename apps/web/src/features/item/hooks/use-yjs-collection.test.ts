import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import {
  COLLECTION_WRITE_ORIGIN,
  useYjsCollection,
  type YjsCollectionOptions,
} from './use-yjs-collection'

type Item = {
  id: string
  label: string
  x?: number
  selected?: boolean
  dragging?: boolean
  measured?: { width: number; height: number }
}

const MAP_NAME = 'nodes'

// A real Y.Doc behind a minimal provider: everything the hook touches besides
// the network (which it never uses directly).
const provider = vi.hoisted(() => ({
  document: null as unknown as Y.Doc,
  authorizedScope: undefined as string | undefined,
  on: () => {},
  off: () => {},
}))

vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))

const map = () => provider.document.getMap<Item>(MAP_NAME)

const snapshot = () => Object.fromEntries(map().entries())

/** Apply an edit made by a peer: a second doc whose update arrives as non-local. */
const remote = (edit: (peerMap: Y.Map<Item>) => void) => {
  const peer = new Y.Doc()
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
  const before = Y.encodeStateVector(peer)
  edit(peer.getMap<Item>(MAP_NAME))
  act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))
}

/** Counts transactions that actually changed the map. */
const countWrites = () => {
  let writes = 0
  map().observe(() => {
    writes++
  })
  return () => writes
}

const renderCollection = (options?: YjsCollectionOptions<Item>) =>
  renderHook(() => useYjsCollection<Item>(MAP_NAME, options))

describe('useYjsCollection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    provider.document = new Y.Doc()
    provider.authorizedScope = undefined
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts empty for an empty document', () => {
      const { result } = renderCollection()
      expect(result.current.items).toEqual([])
    })

    it('loads items already present in the document', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })

      const { result } = renderCollection()

      expect(result.current.items).toEqual([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ])
    })
  })

  describe('throttled flush', () => {
    it('writes the first change to the document immediately', () => {
      const { result } = renderCollection()

      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))

      expect(result.current.items).toEqual([{ id: 'a', label: 'A' }])
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
    })

    it('updates local state right away but batches a burst into one trailing write', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A', x: 0 }]))
      const writes = countWrites()

      for (let x = 1; x <= 5; x++) {
        act(() => result.current.setItems((prev) => prev.map((item) => ({ ...item, x }))))
        expect(result.current.items[0].x).toBe(x)
      }

      // Still inside the throttle window: the document lags behind.
      expect(map().get('a')?.x).toBe(0)
      expect(writes()).toBe(0)

      act(() => vi.advanceTimersByTime(50))

      expect(map().get('a')?.x).toBe(5)
      expect(writes()).toBe(1)
    })

    it('flushes immediately again once the interval has passed', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))

      act(() => vi.advanceTimersByTime(60))
      act(() => result.current.setItems([{ id: 'a', label: 'B' }]))

      expect(map().get('a')?.label).toBe('B')
    })

    it('chains functional updaters within one synchronous burst', () => {
      const { result } = renderCollection()

      act(() => {
        result.current.setItems((prev) => [...prev, { id: 'a', label: 'A' }])
        result.current.setItems((prev) => [...prev, { id: 'b', label: 'B' }])
      })
      act(() => vi.runAllTimers())

      expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b'])
      expect(Object.keys(snapshot()).sort()).toEqual(['a', 'b'])
    })

    it('deletes items removed locally from the document', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()

      act(() => result.current.setItems((prev) => prev.filter((item) => item.id !== 'a')))

      expect(snapshot()).toEqual({ b: { id: 'b', label: 'B' } })
    })

    it('does not rewrite items whose persisted fields are unchanged', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()
      const changedKeys: string[] = []
      map().observe((event) => changedKeys.push(...event.keysChanged))

      act(() =>
        result.current.setItems((prev) =>
          prev.map((item) => (item.id === 'b' ? { ...item, label: 'B2' } : item)),
        ),
      )

      expect(changedKeys).toEqual(['b'])
    })

    it('flushes pending changes on unmount', () => {
      const { result, unmount } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
      act(() => result.current.setItems([{ id: 'a', label: 'last' }]))
      expect(map().get('a')?.label).toBe('A')

      unmount()

      expect(map().get('a')?.label).toBe('last')
    })

    it('flushes pending changes when the page is unloaded', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
      act(() => result.current.setItems([{ id: 'a', label: 'last' }]))
      expect(map().get('a')?.label).toBe('A')

      window.dispatchEvent(new Event('pagehide'))

      expect(map().get('a')?.label).toBe('last')
    })

    it('flushes pending changes when the tab is hidden', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
      act(() => result.current.setItems([{ id: 'a', label: 'last' }]))
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

      document.dispatchEvent(new Event('visibilitychange'))

      expect(map().get('a')?.label).toBe('last')
      visibility.mockRestore()
    })

    it('does not write on unload while a drag is held', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A', x: 0 }]))
      act(() => result.current.hold(['a']))
      act(() => result.current.setItems([{ id: 'a', label: 'A', x: 5 }]))

      window.dispatchEvent(new Event('pagehide'))

      expect(map().get('a')?.x).toBe(0)
    })
  })

  describe('volatile keys', () => {
    it('never writes React Flow UI state to the document', () => {
      const { result } = renderCollection()

      act(() =>
        result.current.setItems([
          {
            id: 'a',
            label: 'A',
            selected: true,
            dragging: true,
            measured: { width: 10, height: 20 },
          },
        ]),
      )

      expect(result.current.items[0].selected).toBe(true)
      expect(map().get('a')).toEqual({ id: 'a', label: 'A' })
    })

    it('treats a selection-only change as no document change', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result } = renderCollection()
      const writes = countWrites()

      act(() =>
        result.current.setItems((prev) => prev.map((item) => ({ ...item, selected: true }))),
      )
      act(() => vi.runAllTimers())

      expect(result.current.items[0].selected).toBe(true)
      expect(writes()).toBe(0)
    })

    it('keeps the local selection when a peer edits the same item', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result } = renderCollection()
      act(() =>
        result.current.setItems((prev) => prev.map((item) => ({ ...item, selected: true }))),
      )

      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'from peer' }))

      expect(result.current.items).toEqual([{ id: 'a', label: 'from peer', selected: true }])
    })
  })

  describe('remote sync', () => {
    it('picks up items added, changed and deleted by a peer', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()

      remote((peerMap) => {
        peerMap.set('a', { id: 'a', label: 'A2' })
        peerMap.delete('b')
        peerMap.set('c', { id: 'c', label: 'C' })
      })

      expect(result.current.items).toEqual([
        { id: 'a', label: 'A2' },
        { id: 'c', label: 'C' },
      ])
    })

    it('ignores its own writes (already applied optimistically)', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
      const pending = [{ id: 'a', label: 'not written yet' }]
      act(() => result.current.setItems(pending))

      // Our own write of an older snapshot must not overwrite newer local state.
      act(() =>
        provider.document.transact(
          () => map().set('a', { id: 'a', label: 'stale' }),
          COLLECTION_WRITE_ORIGIN,
        ),
      )

      expect(result.current.items).toBe(pending)
    })

    it('mirrors other local transactions, e.g. undo', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A', selected: true }]))

      act(() => map().set('a', { id: 'a', label: 'written locally' }))

      expect(result.current.items).toEqual([{ id: 'a', label: 'written locally', selected: true }])
    })

    it('bases later functional updates on the remote state', () => {
      const { result } = renderCollection()
      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'A' }))

      act(() => result.current.setItems((prev) => [...prev, { id: 'b', label: 'B' }]))
      act(() => vi.runAllTimers())

      expect(Object.keys(snapshot()).sort()).toEqual(['a', 'b'])
    })

    it('keeps local edits not written yet when a peer edits other items', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      map().set('c', { id: 'c', label: 'C' })
      const { result } = renderCollection()
      act(() => result.current.setItems((prev) => prev.map((item) => ({ ...item, x: 1 }))))

      // Inside the throttle window: edit `a`, add `d`, delete `c`
      act(() =>
        result.current.setItems((prev) => [
          ...prev
            .filter((item) => item.id !== 'c')
            .map((item) => (item.id === 'a' ? { ...item, label: 'A local' } : item)),
          { id: 'd', label: 'D' },
        ]),
      )
      remote((peerMap) => peerMap.set('b', { id: 'b', label: 'B remote', x: 1 }))

      const expected = [
        { id: 'a', label: 'A local', x: 1 },
        { id: 'b', label: 'B remote', x: 1 },
        { id: 'd', label: 'D' },
      ]
      expect(result.current.items).toEqual(expected)
      act(() => vi.runAllTimers())
      expect(Object.values(snapshot())).toEqual(expect.arrayContaining(expected))
      expect(map().size).toBe(3)
    })

    it('drops an item a peer deletes while its local edit is not written yet', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'b', label: 'B' }, ...result.current.items]))
      act(() =>
        result.current.setItems((prev) =>
          prev.map((item) => (item.id === 'a' ? { ...item, label: 'A local' } : item)),
        ),
      )

      remote((peerMap) => peerMap.delete('a'))
      act(() => vi.runAllTimers())

      expect(result.current.items).toEqual([{ id: 'b', label: 'B' }])
      expect(snapshot()).toEqual({ b: { id: 'b', label: 'B' } })
    })

    it('lets a peer edit win over a selection change not written yet', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'b', label: 'B' }, ...result.current.items]))
      act(() =>
        result.current.setItems((prev) => prev.map((item) => ({ ...item, selected: true }))),
      )

      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'A remote' }))
      act(() => vi.runAllTimers())

      expect(map().get('a')).toEqual({ id: 'a', label: 'A remote' })
      expect(result.current.items).toContainEqual({ id: 'a', label: 'A remote', selected: true })
    })

    it('keeps a local delete not written yet when a peer edits the same item', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()
      act(() => result.current.setItems((prev) => prev.map((item) => ({ ...item, x: 1 }))))
      act(() => result.current.setItems((prev) => prev.filter((item) => item.id !== 'b')))

      remote((peerMap) => peerMap.set('b', { id: 'b', label: 'B remote' }))
      expect(result.current.items).toEqual([{ id: 'a', label: 'A', x: 1 }])
      act(() => vi.runAllTimers())

      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A', x: 1 } })
    })

    it('writes the document version instead of local edits canWrite rejects', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection({ canWrite: (item) => item.label !== 'invalid' })
      act(() => result.current.setItems((prev) => prev.map((item) => ({ ...item, x: 1 }))))

      // Inside the throttle window: an edit and a new item the check rejects, one it accepts
      act(() =>
        result.current.setItems((prev) => [
          ...prev.map((item) => (item.id === 'a' ? { ...item, label: 'invalid' } : item)),
          { id: 'c', label: 'invalid' },
          { id: 'd', label: 'D' },
        ]),
      )
      remote((peerMap) => peerMap.set('b', { id: 'b', label: 'B remote', x: 1 }))
      act(() => vi.runAllTimers())

      const expected = {
        a: { id: 'a', label: 'A', x: 1 },
        b: { id: 'b', label: 'B remote', x: 1 },
        d: { id: 'd', label: 'D' },
      }
      expect(result.current.items).toEqual(Object.values(expected))
      expect(snapshot()).toEqual(expected)
    })

    it('stops listening after unmount', () => {
      const { result, unmount } = renderCollection()
      unmount()

      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'A' }))

      expect(result.current.items).toEqual([])
    })
  })

  describe('hold', () => {
    it('keeps held changes local until released, then flushes them at once', () => {
      map().set('a', { id: 'a', label: 'A', x: 0 })
      const { result } = renderCollection()

      act(() => result.current.hold(['a']))
      for (let x = 1; x <= 3; x++) {
        act(() => result.current.setItems((prev) => prev.map((item) => ({ ...item, x }))))
      }
      act(() => vi.runAllTimers())

      expect(result.current.items[0].x).toBe(3)
      expect(map().get('a')?.x).toBe(0)

      act(() => result.current.hold([]))

      expect(map().get('a')?.x).toBe(3)
    })

    it('withholds every change while something is held, not only the held ids', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()

      act(() => result.current.hold(['a']))
      act(() =>
        result.current.setItems((prev) =>
          prev.map((item) => (item.id === 'b' ? { ...item, label: 'B2' } : item)),
        ),
      )
      act(() => vi.runAllTimers())

      expect(map().get('b')?.label).toBe('B')

      act(() => result.current.hold([]))

      expect(map().get('b')?.label).toBe('B2')
    })

    it('keeps the local version of a held item when a peer edits it', () => {
      map().set('a', { id: 'a', label: 'A', x: 0 })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()
      act(() => result.current.hold(['a']))
      act(() =>
        result.current.setItems((prev) =>
          prev.map((item) => (item.id === 'a' ? { ...item, x: 42, dragging: true } : item)),
        ),
      )

      remote((peerMap) => {
        peerMap.set('a', { id: 'a', label: 'A', x: -1 })
        peerMap.set('b', { id: 'b', label: 'B from peer' })
      })

      expect(result.current.items).toEqual([
        { id: 'a', label: 'A', x: 42, dragging: true },
        { id: 'b', label: 'B from peer' },
      ])

      act(() => result.current.hold([]))

      expect(snapshot()).toEqual({
        a: { id: 'a', label: 'A', x: 42 },
        b: { id: 'b', label: 'B from peer' },
      })
    })
  })

  describe('hold and remote sync', () => {
    it('keeps an edit of an item not held when a peer update arrives during the hold', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      map().set('c', { id: 'c', label: 'C' })
      const { result } = renderCollection()
      act(() => result.current.hold(['a']))
      act(() =>
        result.current.setItems((prev) =>
          prev.map((item) => (item.id === 'b' ? { ...item, label: 'B local' } : item)),
        ),
      )

      remote((peerMap) => peerMap.set('c', { id: 'c', label: 'C remote' }))
      expect(result.current.items).toContainEqual({ id: 'b', label: 'B local' })
      act(() => result.current.hold([]))

      expect(snapshot()).toEqual({
        a: { id: 'a', label: 'A' },
        b: { id: 'b', label: 'B local' },
        c: { id: 'c', label: 'C remote' },
      })
    })
  })

  describe('replaceItems', () => {
    it('replaces the map synchronously, dropping missing ids and volatile keys', () => {
      map().set('old', { id: 'old', label: 'Old' })
      const { result } = renderCollection()

      act(() => result.current.replaceItems([{ id: 'new', label: 'New', selected: true }]))

      expect(result.current.items).toEqual([{ id: 'new', label: 'New', selected: true }])
      expect(snapshot()).toEqual({ new: { id: 'new', label: 'New' } })
    })

    it('cancels a pending trailing flush so it cannot overwrite the replacement', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
      act(() => result.current.setItems([{ id: 'a', label: 'stale' }]))

      act(() => result.current.replaceItems([{ id: 'b', label: 'B' }]))
      act(() => vi.runAllTimers())

      expect(snapshot()).toEqual({ b: { id: 'b', label: 'B' } })
    })

    it('keeps a concurrent peer edit of an item the re-import leaves unchanged', () => {
      // Concurrent writes to one key are won by the higher client id. Ours is
      // higher, so rewriting an unchanged item would overwrite the peer's edit.
      provider.document.clientID = 2
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()

      // The peer edits `b` before it has seen the re-import.
      const peer = new Y.Doc()
      peer.clientID = 1
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
      const before = Y.encodeStateVector(peer)
      peer.getMap<Item>(MAP_NAME).set('b', { id: 'b', label: 'B (peer)' })

      act(() =>
        result.current.replaceItems([
          { id: 'a', label: 'A2' },
          { id: 'b', label: 'B' },
        ]),
      )
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))

      expect(snapshot()).toEqual({
        a: { id: 'a', label: 'A2' },
        b: { id: 'b', label: 'B (peer)' },
      })
    })

    it('joins an outer transaction for atomic multi-collection imports', () => {
      const { result } = renderCollection()
      const writes = countWrites()

      act(() =>
        provider.document.transact(() => {
          result.current.replaceItems([{ id: 'a', label: 'A' }])
          provider.document.getMap('edges').set('e', { id: 'e' })
        }),
      )

      expect(writes()).toBe(1)
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
    })
  })

  describe('repairItems', () => {
    it('writes only the items it changes or removes, right away', () => {
      provider.document.clientID = 2
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      map().set('c', { id: 'c', label: 'C' })
      const { result } = renderCollection()
      // A peer edit of `b` that arrives later must survive the repair of `a`.
      const peer = new Y.Doc()
      peer.clientID = 1
      Y.applyUpdate(peer, Y.encodeStateAsUpdate(provider.document))
      const before = Y.encodeStateVector(peer)
      peer.getMap<Item>(MAP_NAME).set('b', { id: 'b', label: 'B (peer)' })

      act(() =>
        result.current.repairItems((prev) =>
          prev
            .filter((item) => item.id !== 'c')
            .map((item) => (item.id === 'a' ? { ...item, x: 1 } : item)),
        ),
      )
      act(() => Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(peer, before)))

      expect(snapshot()).toEqual({
        a: { id: 'a', label: 'A', x: 1 },
        b: { id: 'b', label: 'B (peer)' },
      })
      expect(result.current.items).toEqual([
        { id: 'a', label: 'A', x: 1 },
        { id: 'b', label: 'B (peer)' },
      ])
    })

    it('writes a pending edit first, in its own transaction', () => {
      const { result } = renderCollection()
      act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
      act(() => result.current.setItems([{ id: 'a', label: 'A2' }]))
      const origins: unknown[] = []
      provider.document.on('afterTransaction', (transaction) => origins.push(transaction.origin))

      act(() => result.current.repairItems((prev) => prev.map((item) => ({ ...item, x: 1 }))))

      expect(origins).toHaveLength(2)
      expect(origins[0]).toBe(COLLECTION_WRITE_ORIGIN)
      expect(origins[1]).not.toBe(COLLECTION_WRITE_ORIGIN)
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A2', x: 1 } })
    })

    it('keeps held items local until released', () => {
      map().set('a', { id: 'a', label: 'A', x: 0 })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()
      act(() => result.current.hold(['a', 'b']))

      act(() =>
        result.current.repairItems((prev) =>
          prev.filter((item) => item.id !== 'b').map((item) => ({ ...item, x: 1 })),
        ),
      )

      expect(result.current.items).toEqual([{ id: 'a', label: 'A', x: 1 }])
      expect(snapshot()).toEqual({
        a: { id: 'a', label: 'A', x: 0 },
        b: { id: 'b', label: 'B' },
      })

      act(() => result.current.hold([]))

      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A', x: 1 } })
    })
  })

  describe('read-only document', () => {
    beforeEach(() => {
      provider.authorizedScope = 'readonly'
    })

    it('ignores every write but still mirrors remote changes', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result, unmount } = renderCollection()

      act(() => result.current.setItems([]))
      act(() => result.current.replaceItems([]))
      act(() => vi.runAllTimers())

      expect(result.current.items).toEqual([{ id: 'a', label: 'A' }])
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })

      remote((peerMap) => peerMap.set('b', { id: 'b', label: 'B' }))
      expect(result.current.items.map((item) => item.id)).toEqual(['a', 'b'])

      unmount()
      expect(Object.keys(snapshot())).toEqual(['a', 'b'])
    })
  })
})
