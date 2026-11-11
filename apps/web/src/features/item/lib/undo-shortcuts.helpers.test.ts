import { describe, expect, it } from 'vitest'
import { getUndoShortcut, getUndoShortcutLabels } from './undo-shortcuts.helpers'

const keydown = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init)

describe('getUndoShortcut', () => {
  it.each([
    ['Ctrl+Z', { key: 'z', ctrlKey: true }, 'undo'],
    ['Cmd+Z', { key: 'z', metaKey: true }, 'undo'],
    ['Ctrl+Shift+Z', { key: 'Z', ctrlKey: true, shiftKey: true }, 'redo'],
    ['Cmd+Shift+Z', { key: 'Z', metaKey: true, shiftKey: true }, 'redo'],
    ['Ctrl+Y', { key: 'y', ctrlKey: true }, 'redo'],
    ['Ctrl+Z on a Cyrillic layout', { key: 'я', code: 'KeyZ', ctrlKey: true }, 'undo'],
    ['Ctrl+Y on a Cyrillic layout', { key: 'н', code: 'KeyY', ctrlKey: true }, 'redo'],
  ])('maps %s', (_name, init, expected) => {
    expect(getUndoShortcut(keydown(init))).toBe(expected)
  })

  it.each([
    ['Z without a modifier', { key: 'z' }],
    ['Ctrl+Alt+Z', { key: 'z', ctrlKey: true, altKey: true }],
    ['Cmd+Y, left to the browser', { key: 'y', metaKey: true }],
    ['Ctrl+Shift+Y', { key: 'Y', ctrlKey: true, shiftKey: true }],
    ['another letter', { key: 'x', ctrlKey: true }],
  ])('ignores %s', (_name, init) => {
    expect(getUndoShortcut(keydown(init))).toBeNull()
  })
})

describe('getUndoShortcutLabels', () => {
  it('labels the shortcuts in the notation of the platform', () => {
    expect(getUndoShortcutLabels('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toEqual({
      undo: '⌘Z',
      redo: '⇧⌘Z',
    })
    expect(getUndoShortcutLabels('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toEqual({
      undo: 'Ctrl+Z',
      redo: 'Ctrl+Shift+Z',
    })
  })
})
