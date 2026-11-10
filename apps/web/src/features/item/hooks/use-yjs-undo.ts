import { useHocuspocusProvider } from '@hocuspocus/provider-react'
import { useEffect, useRef, useState } from 'react'
import { UndoManager } from 'yjs'
import { useDocumentReadOnly } from './use-document-read-only'
import { COLLECTION_WRITE_ORIGIN } from './use-yjs-collection'

export type YjsUndoOptions = {
  /** Writes every collection's throttled changes, so the latest edit is undone too. */
  flushPending: () => void
  /**
   * Whether a collection withholds writes (a drag in progress). Undo and redo are off then: the
   * held local state would drift from the reverted document and be written back on release.
   */
  held: boolean
  /**
   * Runs after each undo/redo to repair what it restored against a peer's newer changes. Write
   * through the collection's `repairItems`, so the repair stays out of the history.
   */
  repair?: () => void
}

/**
 * Undo/redo of this client's edits to the given `useYjsCollection` maps. Writes made close
 * together, such as a node and its edges deleted at once, form one step. `names` must be a
 * stable reference: a new array recreates the history.
 */
export const useYjsUndo = (
  names: readonly string[],
  { flushPending, held, repair }: YjsUndoOptions,
) => {
  const provider = useHocuspocusProvider()
  const readOnly = useDocumentReadOnly()
  const managerRef = useRef<UndoManager | null>(null)
  const [history, setHistory] = useState({ canUndo: false, canRedo: false })

  useEffect(() => {
    const doc = provider.document
    const manager = new UndoManager(
      names.map((name) => doc.getMap(name)),
      { trackedOrigins: new Set([COLLECTION_WRITE_ORIGIN]) },
    )
    managerRef.current = manager
    const update = () => setHistory({ canUndo: manager.canUndo(), canRedo: manager.canRedo() })
    manager.on('stack-item-added', update)
    manager.on('stack-item-popped', update)
    manager.on('stack-cleared', update)
    update()
    return () => {
      managerRef.current = null
      manager.destroy()
    }
  }, [names, provider])

  const run = (action: 'undo' | 'redo') => {
    const manager = managerRef.current
    if (readOnly || held || !manager) return
    flushPending()
    manager[action]()
    repair?.()
  }

  return {
    undo: () => run('undo'),
    redo: () => run('redo'),
    canUndo: !readOnly && !held && history.canUndo,
    canRedo: !readOnly && !held && history.canRedo,
  }
}
