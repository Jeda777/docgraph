/** Shortcut hints for tooltips, in the notation of the user's platform. */
export const getUndoShortcutLabels = (userAgent = navigator.userAgent) =>
  /Mac|iPhone|iPad/.test(userAgent)
    ? { undo: '⌘Z', redo: '⇧⌘Z' }
    : { undo: 'Ctrl+Z', redo: 'Ctrl+Shift+Z' }

/**
 * The letter of a shortcut key. Non-Latin layouts (e.g. Cyrillic) report their own letter in
 * `key`, so they fall back to the physical key in `code`.
 */
const shortcutLetter = (event: KeyboardEvent) =>
  /^[a-z]$/i.test(event.key)
    ? event.key.toLowerCase()
    : event.code.replace(/^Key/, '').toLowerCase()

/**
 * Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Cmd+Y stays with the browser, where it
 * opens the history on macOS.
 */
export const getUndoShortcut = (event: KeyboardEvent): 'undo' | 'redo' | null => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const letter = shortcutLetter(event)
  if (letter === 'z') return event.shiftKey ? 'redo' : 'undo'
  if (letter === 'y' && event.ctrlKey && !event.shiftKey) return 'redo'
  return null
}
