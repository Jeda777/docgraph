import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUndoShortcuts } from './use-undo-shortcuts'

const undo = vi.fn()
const redo = vi.fn()

const press = (init: KeyboardEventInit, target: EventTarget = window) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const appendToBody = (html: string) => {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  return container.firstElementChild as HTMLElement
}

describe('useUndoShortcuts', () => {
  beforeEach(() => {
    undo.mockReset()
    redo.mockReset()
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it.each([
    ['Ctrl+Z', { key: 'z', ctrlKey: true }, undo],
    ['Ctrl+Shift+Z', { key: 'Z', ctrlKey: true, shiftKey: true }, redo],
  ])('%s runs its action and prevents the browser default', (_name, init, action) => {
    renderHook(() => useUndoShortcuts({ undo, redo }))

    const event = press(init)

    expect(action).toHaveBeenCalledOnce()
    expect(undo.mock.calls.length + redo.mock.calls.length).toBe(1)
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves Cmd+Y to the browser', () => {
    renderHook(() => useUndoShortcuts({ undo, redo }))

    const event = press({ key: 'y', metaKey: true })

    expect(redo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it.each([
    ['an input', '<input />'],
    ['a textarea', '<textarea></textarea>'],
    ['editable text', '<div contenteditable="true"><span>text</span></div>'],
    ['a dialog', '<div role="dialog"><button>OK</button></div>'],
    ['an alert dialog', '<div role="alertdialog"><button>Delete</button></div>'],
    ['a menu', '<div role="menu"><button>Item</button></div>'],
    ['a listbox', '<div role="listbox"><button>Option</button></div>'],
  ])('leaves the shortcut to %s', (_name, html) => {
    renderHook(() => useUndoShortcuts({ undo, redo }))
    const target = appendToBody(html)

    const event = press({ key: 'z', ctrlKey: true }, target.querySelector('span, button') ?? target)

    expect(undo).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does nothing when disabled', () => {
    renderHook(() => useUndoShortcuts({ undo, redo, enabled: false }))

    press({ key: 'z', ctrlKey: true })

    expect(undo).not.toHaveBeenCalled()
  })
})
