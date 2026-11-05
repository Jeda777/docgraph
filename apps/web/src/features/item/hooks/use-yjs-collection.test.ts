import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useYjsCollection } from './use-yjs-collection'

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

const renderCollection = () => renderHook(() => useYjsCollection<Item>(MAP_NAME))

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
      expect(result.current[0]).toEqual([])
    })

    it('loads items already present in the document', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })

      const { result } = renderCollection()

      expect(result.current[0]).toEqual([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ])
    })
  })

  describe('throttled flush', () => {
    it('writes the first change to the document immediately', () => {
      const { result } = renderCollection()

      act(() => result.current[1]([{ id: 'a', label: 'A' }]))

      expect(result.current[0]).toEqual([{ id: 'a', label: 'A' }])
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
    })

    it('updates local state right away but batches a burst into one trailing write', () => {
      const { result } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A', x: 0 }]))
      const writes = countWrites()

      for (let x = 1; x <= 5; x++) {
        act(() => result.current[1]((prev) => prev.map((item) => ({ ...item, x }))))
        expect(result.current[0][0].x).toBe(x)
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
      act(() => result.current[1]([{ id: 'a', label: 'A' }]))

      act(() => vi.advanceTimersByTime(60))
      act(() => result.current[1]([{ id: 'a', label: 'B' }]))

      expect(map().get('a')?.label).toBe('B')
    })

    it('chains functional updaters within one synchronous burst', () => {
      const { result } = renderCollection()

      act(() => {
        result.current[1]((prev) => [...prev, { id: 'a', label: 'A' }])
        result.current[1]((prev) => [...prev, { id: 'b', label: 'B' }])
      })
      act(() => vi.runAllTimers())

      expect(result.current[0].map((item) => item.id)).toEqual(['a', 'b'])
      expect(Object.keys(snapshot()).sort()).toEqual(['a', 'b'])
    })

    it('deletes items removed locally from the document', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()

      act(() => result.current[1]((prev) => prev.filter((item) => item.id !== 'a')))

      expect(snapshot()).toEqual({ b: { id: 'b', label: 'B' } })
    })

    it('does not rewrite items whose persisted fields are unchanged', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()
      const changedKeys: string[] = []
      map().observe((event) => changedKeys.push(...event.keysChanged))

      act(() =>
        result.current[1]((prev) =>
          prev.map((item) => (item.id === 'b' ? { ...item, label: 'B2' } : item)),
        ),
      )

      expect(changedKeys).toEqual(['b'])
    })

    it('flushes pending changes on unmount', () => {
      const { result, unmount } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A' }]))
      act(() => result.current[1]([{ id: 'a', label: 'last' }]))
      expect(map().get('a')?.label).toBe('A')

      unmount()

      expect(map().get('a')?.label).toBe('last')
    })

    it('flushes pending changes when the page is unloaded', () => {
      const { result } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A' }]))
      act(() => result.current[1]([{ id: 'a', label: 'last' }]))
      expect(map().get('a')?.label).toBe('A')

      window.dispatchEvent(new Event('pagehide'))

      expect(map().get('a')?.label).toBe('last')
    })

    it('flushes pending changes when the tab is hidden', () => {
      const { result } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A' }]))
      act(() => result.current[1]([{ id: 'a', label: 'last' }]))
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

      document.dispatchEvent(new Event('visibilitychange'))

      expect(map().get('a')?.label).toBe('last')
      visibility.mockRestore()
    })

    it('does not write on unload while a drag is held', () => {
      const { result } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A', x: 0 }]))
      act(() => result.current[2](['a']))
      act(() => result.current[1]([{ id: 'a', label: 'A', x: 5 }]))

      window.dispatchEvent(new Event('pagehide'))

      expect(map().get('a')?.x).toBe(0)
    })
  })

  describe('volatile keys', () => {
    it('never writes React Flow UI state to the document', () => {
      const { result } = renderCollection()

      act(() =>
        result.current[1]([
          {
            id: 'a',
            label: 'A',
            selected: true,
            dragging: true,
            measured: { width: 10, height: 20 },
          },
        ]),
      )

      expect(result.current[0][0].selected).toBe(true)
      expect(map().get('a')).toEqual({ id: 'a', label: 'A' })
    })

    it('treats a selection-only change as no document change', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result } = renderCollection()
      const writes = countWrites()

      act(() => result.current[1]((prev) => prev.map((item) => ({ ...item, selected: true }))))
      act(() => vi.runAllTimers())

      expect(result.current[0][0].selected).toBe(true)
      expect(writes()).toBe(0)
    })

    it('keeps the local selection when a peer edits the same item', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result } = renderCollection()
      act(() => result.current[1]((prev) => prev.map((item) => ({ ...item, selected: true }))))

      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'from peer' }))

      expect(result.current[0]).toEqual([{ id: 'a', label: 'from peer', selected: true }])
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

      expect(result.current[0]).toEqual([
        { id: 'a', label: 'A2' },
        { id: 'c', label: 'C' },
      ])
    })

    it('ignores local transactions (already applied optimistically)', () => {
      const { result } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A', selected: true }]))

      // A local write that bypasses the hook must not replace local state.
      act(() => map().set('a', { id: 'a', label: 'written locally' }))

      expect(result.current[0]).toEqual([{ id: 'a', label: 'A', selected: true }])
    })

    it('bases later functional updates on the remote state', () => {
      const { result } = renderCollection()
      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'A' }))

      act(() => result.current[1]((prev) => [...prev, { id: 'b', label: 'B' }]))
      act(() => vi.runAllTimers())

      expect(Object.keys(snapshot()).sort()).toEqual(['a', 'b'])
    })

    it('stops listening after unmount', () => {
      const { result, unmount } = renderCollection()
      unmount()

      remote((peerMap) => peerMap.set('a', { id: 'a', label: 'A' }))

      expect(result.current[0]).toEqual([])
    })
  })

  describe('hold', () => {
    it('keeps held changes local until released, then flushes them at once', () => {
      map().set('a', { id: 'a', label: 'A', x: 0 })
      const { result } = renderCollection()

      act(() => result.current[2](['a']))
      for (let x = 1; x <= 3; x++) {
        act(() => result.current[1]((prev) => prev.map((item) => ({ ...item, x }))))
      }
      act(() => vi.runAllTimers())

      expect(result.current[0][0].x).toBe(3)
      expect(map().get('a')?.x).toBe(0)

      act(() => result.current[2]([]))

      expect(map().get('a')?.x).toBe(3)
    })

    it('withholds every change while something is held, not only the held ids', () => {
      map().set('a', { id: 'a', label: 'A' })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()

      act(() => result.current[2](['a']))
      act(() =>
        result.current[1]((prev) =>
          prev.map((item) => (item.id === 'b' ? { ...item, label: 'B2' } : item)),
        ),
      )
      act(() => vi.runAllTimers())

      expect(map().get('b')?.label).toBe('B')

      act(() => result.current[2]([]))

      expect(map().get('b')?.label).toBe('B2')
    })

    it('keeps the local version of a held item when a peer edits it', () => {
      map().set('a', { id: 'a', label: 'A', x: 0 })
      map().set('b', { id: 'b', label: 'B' })
      const { result } = renderCollection()
      act(() => result.current[2](['a']))
      act(() =>
        result.current[1]((prev) =>
          prev.map((item) => (item.id === 'a' ? { ...item, x: 42, dragging: true } : item)),
        ),
      )

      remote((peerMap) => {
        peerMap.set('a', { id: 'a', label: 'A', x: -1 })
        peerMap.set('b', { id: 'b', label: 'B from peer' })
      })

      expect(result.current[0]).toEqual([
        { id: 'a', label: 'A', x: 42, dragging: true },
        { id: 'b', label: 'B from peer' },
      ])

      act(() => result.current[2]([]))

      expect(snapshot()).toEqual({
        a: { id: 'a', label: 'A', x: 42 },
        b: { id: 'b', label: 'B from peer' },
      })
    })
  })

  describe('replaceItems', () => {
    it('replaces the map synchronously, dropping missing ids and volatile keys', () => {
      map().set('old', { id: 'old', label: 'Old' })
      const { result } = renderCollection()

      act(() => result.current[3]([{ id: 'new', label: 'New', selected: true }]))

      expect(result.current[0]).toEqual([{ id: 'new', label: 'New', selected: true }])
      expect(snapshot()).toEqual({ new: { id: 'new', label: 'New' } })
    })

    it('cancels a pending trailing flush so it cannot overwrite the replacement', () => {
      const { result } = renderCollection()
      act(() => result.current[1]([{ id: 'a', label: 'A' }]))
      act(() => result.current[1]([{ id: 'a', label: 'stale' }]))

      act(() => result.current[3]([{ id: 'b', label: 'B' }]))
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
        result.current[3]([
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
          result.current[3]([{ id: 'a', label: 'A' }])
          provider.document.getMap('edges').set('e', { id: 'e' })
        }),
      )

      expect(writes()).toBe(1)
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
    })
  })

  describe('read-only document', () => {
    beforeEach(() => {
      provider.authorizedScope = 'readonly'
    })

    it('ignores every write but still mirrors remote changes', () => {
      map().set('a', { id: 'a', label: 'A' })
      const { result, unmount } = renderCollection()

      act(() => result.current[1]([]))
      act(() => result.current[3]([]))
      act(() => vi.runAllTimers())

      expect(result.current[0]).toEqual([{ id: 'a', label: 'A' }])
      expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })

      remote((peerMap) => peerMap.set('b', { id: 'b', label: 'B' }))
      expect(result.current[0].map((item) => item.id)).toEqual(['a', 'b'])

      unmount()
      expect(Object.keys(snapshot())).toEqual(['a', 'b'])
    })
  })
})
