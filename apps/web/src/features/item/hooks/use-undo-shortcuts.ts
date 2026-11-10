import { useEffect, useEffectEvent } from 'react'
import { getUndoShortcut } from '../lib/undo-shortcuts.helpers'

/**
 * Typing targets keep their native undo; open dialogs, menus and listboxes (portaled outside
 * the canvas) shouldn't change the canvas behind them.
 */
const OWN_UNDO_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
].join(', ')

/** Window-wide undo/redo shortcuts, skipped while the focus is in a text field or dialog. */
export const useUndoShortcuts = ({
  undo,
  redo,
  enabled = true,
}: {
  undo: () => void
  redo: () => void
  enabled?: boolean
}) => {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    const shortcut = getUndoShortcut(event)
    if (!shortcut) return
    if (event.target instanceof Element && event.target.closest(OWN_UNDO_SELECTOR)) return
    event.preventDefault()
    if (shortcut === 'undo') undo()
    else redo()
  })

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
