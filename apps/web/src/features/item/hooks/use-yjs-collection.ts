import { isJsonEqual, syncCollection } from '@docgraph/common/diagram'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Transaction, YMapEvent } from 'yjs'
import { useDocumentReadOnly } from './use-document-read-only'

/** How often pending local changes are flushed to the shared document. */
const FLUSH_INTERVAL_MS = 50

/**
 * Transaction origin of every collection write. Undo history tracks only this origin, so it
 * reverts only this client's edits and doesn't overwrite a peer's newer value; an item a peer
 * deleted after this client edited it does come back. Outer transactions wrapping `replaceItems`
 * must pass it too. Writing to the map directly with it would skip the local-state sync.
 */
export const COLLECTION_WRITE_ORIGIN = Symbol('yjs-collection-write')

/** Transaction origin of `repairItems`: applied locally like a write, but not undoable. */
const COLLECTION_REPAIR_ORIGIN = Symbol('yjs-collection-repair')

const LOCAL_ORIGINS = new Set([COLLECTION_WRITE_ORIGIN, COLLECTION_REPAIR_ORIGIN])

/**
 * React Flow bookkeeping that is local UI state, not document content. Writing
 * it would broadcast every click and persist one user's selection for everyone,
 * and `measured` is recomputed on mount anyway.
 */
const VOLATILE_KEYS = ['selected', 'dragging', 'resizing', 'measured'] as const

const persistable = <T extends object>(item: T): T => {
  const copy = { ...item } as Record<string, unknown>
  for (const key of VOLATILE_KEYS) delete copy[key]
  return copy as T
}

/** Re-attach local UI state to an item that just came back from the document. */
const withVolatileFrom = <T extends object>(item: T, local: T): T => {
  const extra: Record<string, unknown> = {}
  for (const key of VOLATILE_KEYS) {
    const value = (local as Record<string, unknown>)[key]
    if (value !== undefined) extra[key] = value
  }
  return Object.keys(extra).length ? { ...item, ...extra } : item
}

/**
 * Drop-in for `useState<T[]>` backed by a Yjs `Map` keyed by `id`. Local state updates on every
 * call so dragging stays responsive; document writes are throttled to one per
 * `FLUSH_INTERVAL_MS` (leading and trailing).
 */
export const useYjsCollection = <T extends { id: string }>(name: string) => {
  const provider = useHocuspocusProvider()
  const readOnly = useDocumentReadOnly()
  const [items, setLocalItems] = useState<T[]>([])
  // Latest optimistic snapshot. Source of truth for functional updaters and
  // for what the next flush should persist (may be ahead of `items` within a
  // synchronous burst of updates).
  const pendingRef = useRef<T[]>([])
  const lastFlushRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ids whose local edits are withheld from the document (see `hold`).
  const heldRef = useRef<Set<string>>(new Set())
  const [held, setHeld] = useState(false)

  /**
   * Cancels the scheduled trailing flush and restarts the throttle window.
   * Memoized by hand: stable, because `flush` depends on it.
   */
  const markFlushed = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    lastFlushRef.current = Date.now()
  }, [])

  /**
   * Diff the pending snapshot against the document and persist the delta.
   * Memoized by hand: the effects below depend on it and the unmount cleanup calls it,
   * so a new identity would flush on every render.
   */
  const flush = useCallback(() => {
    if (readOnly) return
    markFlushed()

    // Only items whose persisted fields differ (deep JSON comparison) are set.
    // Volatile keys are stripped first: selecting or measuring a node is not a
    // document change and must not hit the wire.
    provider.document.transact(
      () => syncCollection(provider.document.getMap<T>(name), pendingRef.current, persistable),
      COLLECTION_WRITE_ORIGIN,
    )
  }, [markFlushed, name, provider, readOnly])

  // Keep local state in sync with the document. Our own writes are ignored because we
  // already applied them optimistically; remote updates and undo/redo are mirrored.
  useEffect(() => {
    const map = provider.document.getMap<T>(name)
    const sync = (_event: YMapEvent<T>, transaction: Transaction) => {
      if (LOCAL_ORIGINS.has(transaction.origin)) return
      const held = heldRef.current
      const local = new Map(pendingRef.current.map((item) => [item.id, item]))
      const values = Array.from(map.values()).map((item) => {
        const mine = local.get(item.id)
        // Held items (e.g. the node being dragged right now) keep their local
        // version — the document doesn't know about them yet.
        if (mine && held.has(item.id)) return mine
        // The document carries no volatile keys, so a peer's edit would
        // otherwise clear our own selection. Carry it over.
        return mine ? withVolatileFrom(item, mine) : item
      })
      pendingRef.current = values
      setLocalItems(values)
    }
    map.observe(sync)
    const initial = Array.from(map.values())
    pendingRef.current = initial
    setLocalItems(initial)
    return () => map.unobserve(sync)
  }, [name, provider])

  // Flush any pending changes on unmount so the last edit isn't lost.
  useEffect(() => () => flush(), [flush])

  // Reloading or closing the tab never unmounts React, so the trailing write
  // would die with its timer. Send it while the connection is still open.
  // `visibilitychange` covers mobile browsers, which may skip `pagehide`.
  useEffect(() => {
    const flushPending = () => {
      if (timerRef.current) flush()
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending()
    }
    window.addEventListener('pagehide', flushPending)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flushPending)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [flush])

  const setItems: React.Dispatch<React.SetStateAction<T[]>> = (action) => {
    if (readOnly) return

    const prev = pendingRef.current
    const next = typeof action === 'function' ? (action as (p: T[]) => T[])(prev) : action

    pendingRef.current = next
    setLocalItems(next)

    // While something is held, stay local-only; `hold([])` flushes the lot.
    if (heldRef.current.size) return

    const elapsed = Date.now() - lastFlushRef.current
    if (elapsed >= FLUSH_INTERVAL_MS) {
      flush()
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(flush, FLUSH_INTERVAL_MS - elapsed)
    }
  }

  /**
   * Withhold writes for the given ids until `hold([])` is called, which flushes
   * everything at once. Used for dragging: peers get "X is moving this" over
   * awareness instead of a stream of intermediate positions.
   */
  const hold = (ids: string[]) => {
    heldRef.current = new Set(ids)
    setHeld(ids.length > 0)
    if (!ids.length) flush()
  }

  /**
   * Replaces the backing map synchronously. The caller can wrap several collection
   * replacements in one outer Yjs transaction (origin `COLLECTION_WRITE_ORIGIN`) for atomic imports.
   * Items missing from `next` are deleted; unchanged items are skipped, so a
   * re-import doesn't overwrite a peer's concurrent edit of an untouched item.
   */
  const replaceItems = (next: T[]) => {
    if (readOnly) return
    markFlushed()
    pendingRef.current = next
    setLocalItems(next)

    provider.document.transact(
      () => syncCollection(provider.document.getMap<T>(name), next, persistable),
      COLLECTION_WRITE_ORIGIN,
    )
  }

  /**
   * Writes a derived fix (e.g. a node grown to fit its text) right away and outside the undo
   * history, so it never counts as this client's edit. Pending edits are written first and stay
   * undoable; held items change only locally until `hold([])` writes them.
   *
   * The fix takes over the item in the document, so undo/redo can no longer restore this
   * client's earlier edit of it. Use it for what this client's own edits don't cause, such as
   * a peer's change; make local edits valid as they are written (`normalizeNodes`) instead.
   */
  const repairItems = (update: (current: T[]) => T[]) => {
    if (readOnly) return
    const prev = pendingRef.current
    const next = update(prev)
    const nextIds = new Set(next.map((item) => item.id))
    const removed = prev.filter((item) => !nextIds.has(item.id))
    const prevById = new Map(prev.map((item) => [item.id, item]))
    const changed = next.filter((item) => prevById.get(item.id) !== item)
    if (!changed.length && !removed.length) return
    if (timerRef.current) flush()

    pendingRef.current = next
    setLocalItems(next)

    const held = heldRef.current
    const map = provider.document.getMap<T>(name)
    provider.document.transact(() => {
      for (const item of removed) {
        if (!held.has(item.id)) map.delete(item.id)
      }
      for (const item of changed) {
        const value = persistable(item)
        if (!held.has(item.id) && !isJsonEqual(map.get(item.id), value)) map.set(item.id, value)
      }
    }, COLLECTION_REPAIR_ORIGIN)
  }

  return { items, setItems, hold, held, replaceItems, repairItems, flush }
}
