import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import type { SetStateAction } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DiagramMutationContext } from './diagram-canvas'
import {
  type EditableNodeAutoSize,
  EditableNodeText,
  type EditableNodeTextProps,
  getAutoSize,
} from './editable-node-text'

const provider = vi.hoisted(() => ({
  authorizedScope: undefined as string | undefined,
  awareness: { setLocalStateField: vi.fn() },
  on: () => {},
  off: () => {},
}))

vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))

const AUTO_SIZE: EditableNodeAutoSize = {
  defaultWidth: 100,
  defaultHeight: 50,
  minWidth: 80,
  minHeight: 40,
}

const NODES: Node[] = [
  { id: 'n1', position: { x: 0, y: 0 }, data: { text: 'Hello', color: 'red' }, style: { left: 1 } },
  { id: 'n2', position: { x: 0, y: 0 }, data: { text: 'Other' } },
]

let nodes: Node[]
const setNodes = vi.fn((update: SetStateAction<Node[]>) => {
  nodes = typeof update === 'function' ? update(nodes) : update
})
const onCommit = vi.fn()

const ui = (props: Partial<EditableNodeTextProps> = {}) => (
  <DiagramMutationContext.Provider value={{ setNodes, setEdges: vi.fn() }}>
    <EditableNodeText nodeId='n1' value='Hello' label='Node text' onCommit={onCommit} {...props} />
  </DiagramMutationContext.Provider>
)

const renderText = (props: Partial<EditableNodeTextProps> = {}) => {
  const view = render(ui(props))
  return { ...view, rerender: (next: Partial<EditableNodeTextProps>) => view.rerender(ui(next)) }
}

const textarea = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Node text' })
const display = () => screen.getByRole('button', { name: 'Node text' })

const startEditing = () => fireEvent.doubleClick(display())

const type = (text: string) => fireEvent.change(textarea(), { target: { value: text } })

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  nodes = structuredClone(NODES)
  provider.authorizedScope = undefined
})

describe('getAutoSize', () => {
  it('never goes below the default size', () => {
    expect(getAutoSize('a', AUTO_SIZE)).toEqual({ width: 100, height: 50 })
  })

  it('grows with the longest line and the line count', () => {
    expect(getAutoSize(`${'x'.repeat(20)}\nshort\nshort`, AUTO_SIZE)).toEqual({
      width: 20 * 8 + 32,
      height: 3 * 22 + 24,
    })
  })

  it('caps both dimensions', () => {
    expect(getAutoSize(`${'x'.repeat(500)}${'\n'.repeat(100)}`, AUTO_SIZE)).toEqual({
      width: 1200,
      height: 1200,
    })
  })

  it('keeps a square shape when the aspect ratio is preserved', () => {
    const size = getAutoSize('x'.repeat(20), { ...AUTO_SIZE, preserveAspectRatio: true })
    expect(size).toEqual({ width: 192, height: 192 })
  })
})

describe('EditableNodeText', () => {
  it('shows the value until edited', () => {
    renderText()

    expect(display()).toHaveTextContent('Hello')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it.each([
    ['double click', () => startEditing()],
    ['Enter', () => fireEvent.keyDown(display(), { key: 'Enter' })],
    ['Space', () => fireEvent.keyDown(display(), { key: ' ' })],
  ])('opens a focused editor on %s', (_, open) => {
    renderText()
    open()

    expect(textarea()).toHaveValue('Hello')
    expect(textarea()).toHaveFocus()
  })

  it('writes the edited text to its node on blur', () => {
    const otherNode = nodes[1]
    renderText()
    startEditing()
    type('Changed')
    fireEvent.blur(textarea())

    expect(onCommit).toHaveBeenCalledWith('Changed')
    expect(nodes[0]).toMatchObject({ data: { text: 'Changed', color: 'red' }, style: { left: 1 } })
    expect(nodes[1]).toBe(otherNode)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('commits on Ctrl+Enter and Cmd+Enter', () => {
    renderText()
    startEditing()
    type('Ctrl')
    fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true })
    expect(onCommit).toHaveBeenLastCalledWith('Ctrl')

    startEditing()
    type('Cmd')
    fireEvent.keyDown(textarea(), { key: 'Enter', metaKey: true })
    expect(onCommit).toHaveBeenLastCalledWith('Cmd')
  })

  it('keeps a plain Enter as a new line', () => {
    renderText()
    startEditing()
    fireEvent.keyDown(textarea(), { key: 'Enter' })

    expect(textarea()).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('resizes the node to fit the text when auto-sized', () => {
    renderText({ autoSize: AUTO_SIZE })
    startEditing()
    type('x'.repeat(20))
    fireEvent.blur(textarea())

    expect(nodes[0].style).toEqual({ left: 1, width: 192, height: 50 })
  })

  it('does not write anything when the text is unchanged', () => {
    renderText()
    startEditing()
    fireEvent.blur(textarea())

    expect(onCommit).not.toHaveBeenCalled()
    expect(setNodes).not.toHaveBeenCalled()
  })

  it('discards the draft on Escape', () => {
    renderText()
    startEditing()
    type('Discarded')
    fireEvent.keyDown(textarea(), { key: 'Escape' })

    expect(display()).toHaveTextContent('Hello')
    expect(onCommit).not.toHaveBeenCalled()
    expect(setNodes).not.toHaveBeenCalled()
  })

  it('commits the next edit after an Escape', () => {
    renderText()
    startEditing()
    type('Discarded')
    fireEvent.keyDown(textarea(), { key: 'Escape' })

    startEditing()
    type('Kept')
    fireEvent.blur(textarea())

    expect(onCommit).toHaveBeenCalledWith('Kept')
  })

  it('broadcasts editing presence while the editor is focused', () => {
    renderText()
    startEditing()
    fireEvent.focus(textarea())
    expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith('editing', {
      nodeId: 'n1',
      field: 'text',
    })

    fireEvent.blur(textarea())
    expect(provider.awareness.setLocalStateField).toHaveBeenLastCalledWith('editing', null)
  })

  it('follows remote value changes while not editing', () => {
    const { rerender } = renderText()
    rerender({ value: 'Remote' })

    expect(display()).toHaveTextContent('Remote')
  })

  it('keeps the local draft when the value changes during editing', () => {
    const { rerender } = renderText()
    startEditing()
    type('Local')
    rerender({ value: 'Remote' })

    expect(textarea()).toHaveValue('Local')
  })

  describe('activateRequest', () => {
    it('does not open the editor for its initial value', () => {
      renderText({ activateRequest: 1 })

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('opens the editor when it changes', () => {
      const { rerender } = renderText({ activateRequest: 1 })
      rerender({ activateRequest: 2 })

      expect(textarea()).toHaveValue('Hello')
    })

    it('does not reopen the editor on a rerender with the same request', () => {
      const { rerender } = renderText({ activateRequest: 1 })
      rerender({ activateRequest: 2 })
      fireEvent.keyDown(textarea(), { key: 'Escape' })
      rerender({ activateRequest: 2, value: 'Remote' })

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('is ignored when read-only', () => {
      const { rerender } = renderText({ activateRequest: 1, readOnly: true })
      rerender({ activateRequest: 2, readOnly: true })

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('read-only', () => {
    it('does not open the editor when the prop is set', () => {
      renderText({ readOnly: true })
      startEditing()

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(display()).toHaveAttribute('tabindex', '-1')
    })

    it('follows the document scope when the prop is not set', () => {
      provider.authorizedScope = 'readonly'
      renderText()
      startEditing()

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('lets the prop override a read-only document', () => {
      provider.authorizedScope = 'readonly'
      renderText({ readOnly: false })
      startEditing()

      expect(textarea()).toBeInTheDocument()
    })
  })
})
