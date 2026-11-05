import { syncCollection } from '@docgraph/common/diagram'
import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Transaction, YMapEvent } from 'yjs'
import { useDocumentReadOnly } from './use-document-read-only'

/** How often pending local changes are flushed to the shared document. */
const FLUSH_INTERVAL_MS = 50

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
    provider.document.transact(() =>
      syncCollection(provider.document.getMap<T>(name), pendingRef.current, persistable),
    )
  }, [markFlushed, name, provider, readOnly])

  // Keep local state in sync with remote updates. Local-origin transactions
  // are ignored because we already applied them optimistically.
  useEffect(() => {
    const map = provider.document.getMap<T>(name)
    const sync = (_event: YMapEvent<T>, transaction: Transaction) => {
      if (transaction.local) return
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
    if (!ids.length) flush()
  }

  /**
   * Replaces the backing map synchronously. The caller can wrap several
   * collection replacements in one outer Yjs transaction for atomic imports.
   * Items missing from `next` are deleted; unchanged items are skipped, so a
   * re-import doesn't overwrite a peer's concurrent edit of an untouched item.
   */
  const replaceItems = (next: T[]) => {
    if (readOnly) return
    markFlushed()
    pendingRef.current = next
    setLocalItems(next)

    syncCollection(provider.document.getMap<T>(name), next, persistable)
  }

  return [items, setItems, hold, replaceItems] as const
}
