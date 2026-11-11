import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { useYjsCollection } from './use-yjs-collection'
import { useYjsUndo } from './use-yjs-undo'

type Item = { id: string; label: string; x?: number }

const MAP_NAME = 'nodes'
const MAP_NAMES = [MAP_NAME]

// A real Y.Doc behind a minimal provider, so the real `useYjsCollection` runs underneath.
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

const renderWithUndo = () =>
  renderHook(() => {
    const collection = useYjsCollection<Item>(MAP_NAME)
    const history = useYjsUndo(MAP_NAMES, {
      flushPending: collection.flush,
      held: collection.held,
    })
    return { ...collection, history }
  })

describe('useYjsUndo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    provider.document = new Y.Doc()
    provider.authorizedScope = undefined
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('undoes and redoes local edits in the document and in local state', () => {
    map().set('a', { id: 'a', label: 'A' })
    const { result } = renderWithUndo()
    expect(result.current.history).toMatchObject({ canUndo: false, canRedo: false })

    act(() => result.current.setItems([{ id: 'a', label: 'B' }]))
    expect(result.current.history).toMatchObject({ canUndo: true, canRedo: false })

    act(() => result.current.history.undo())
    expect(result.current.items).toEqual([{ id: 'a', label: 'A' }])
    expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
    expect(result.current.history).toMatchObject({ canUndo: false, canRedo: true })

    act(() => result.current.history.redo())
    expect(result.current.items).toEqual([{ id: 'a', label: 'B' }])
    expect(snapshot()).toEqual({ a: { id: 'a', label: 'B' } })
  })

  it('never reverts a peer edit', () => {
    map().set('b', { id: 'b', label: 'B' })
    const { result } = renderWithUndo()
    act(() => result.current.setItems((prev) => [...prev, { id: 'a', label: 'A' }]))

    remote((peerMap) => peerMap.set('b', { id: 'b', label: 'B from peer' }))
    act(() => result.current.history.undo())

    expect(snapshot()).toEqual({ b: { id: 'b', label: 'B from peer' } })
    expect(result.current.history.canUndo).toBe(false)
  })

  // Yjs restores the value this client overwrote, even if a peer deleted the item since.
  // Documents that behavior: other maps the peer changed with the deletion stay as they are.
  it('brings back an item a peer deleted after this client edited it', () => {
    map().set('a', { id: 'a', label: 'A', x: 0 })
    const { result } = renderWithUndo()
    act(() => result.current.setItems([{ id: 'a', label: 'A', x: 5 }]))

    remote((peerMap) => peerMap.delete('a'))
    act(() => result.current.history.undo())

    expect(snapshot()).toEqual({ a: { id: 'a', label: 'A', x: 0 } })
    expect(result.current.items).toEqual([{ id: 'a', label: 'A', x: 0 }])
  })

  // Yjs reads time through lib0, which fake timers don't reach, so every write here falls in
  // one capture window. Splitting steps by time is Yjs behavior and isn't tested here.
  it('makes one step of a burst of edits', () => {
    map().set('a', { id: 'a', label: 'A' })
    const { result } = renderWithUndo()
    for (const label of ['B', 'C', 'D']) {
      act(() => result.current.setItems([{ id: 'a', label }]))
      act(() => vi.advanceTimersByTime(60))
    }

    act(() => result.current.history.undo())

    expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
  })

  it('writes a pending throttled edit before undoing it', () => {
    map().set('a', { id: 'a', label: 'A' })
    const { result } = renderWithUndo()
    act(() => result.current.setItems([{ id: 'a', label: 'B' }]))
    act(() => result.current.setItems([{ id: 'a', label: 'pending' }]))

    act(() => result.current.history.undo())
    act(() => vi.runAllTimers())

    expect(result.current.items).toEqual([{ id: 'a', label: 'A' }])
    expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
  })

  it('drops the redo history on a new edit', () => {
    const { result } = renderWithUndo()
    act(() => result.current.setItems([{ id: 'a', label: 'A' }]))
    act(() => result.current.history.undo())

    act(() => result.current.setItems([{ id: 'b', label: 'B' }]))
    act(() => vi.runAllTimers())

    expect(result.current.history).toMatchObject({ canUndo: true, canRedo: false })
  })

  it('is off while a drag is held', () => {
    map().set('a', { id: 'a', label: 'A', x: 0 })
    const { result } = renderWithUndo()
    act(() => result.current.setItems([{ id: 'a', label: 'B', x: 0 }]))
    act(() => result.current.hold(['a']))
    act(() => result.current.setItems([{ id: 'a', label: 'B', x: 5 }]))

    expect(result.current.history.canUndo).toBe(false)

    act(() => result.current.history.undo())

    expect(result.current.items).toEqual([{ id: 'a', label: 'B', x: 5 }])
    expect(snapshot()).toEqual({ a: { id: 'a', label: 'B', x: 0 } })

    act(() => result.current.hold([]))
    expect(result.current.history.canUndo).toBe(true)
    act(() => result.current.history.undo())

    expect(snapshot()).toEqual({ a: { id: 'a', label: 'A', x: 0 } })
  })

  it('does nothing in a read-only document', () => {
    map().set('a', { id: 'a', label: 'A' })
    provider.authorizedScope = 'readonly'
    const { result } = renderWithUndo()

    act(() => result.current.history.undo())

    expect(result.current.history).toMatchObject({ canUndo: false, canRedo: false })
    expect(snapshot()).toEqual({ a: { id: 'a', label: 'A' } })
  })
})
