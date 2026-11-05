import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentToolbar } from './document-toolbar'

const io = vi.hoisted(() => ({
  handleImport: vi.fn(),
  handleDownloadJson: vi.fn(),
  handleDownloadMarkdown: vi.fn(),
  handleDownloadBinary: vi.fn(),
}))

const provider = vi.hoisted(() => ({
  authorizedScope: 'read-write' as 'read-write' | 'readonly',
  on: () => {},
  off: () => {},
}))

vi.mock('../../hooks/use-document-io', () => ({ useDocumentIo: () => io }))
vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))
// The top bar's profile menu reads the session; it is not under test here.
vi.mock('@/components/account-menu', () => ({ AccountMenu: () => null }))

let editor: Editor

/**
 * Renders the toolbar on `/doc`. With `fromProject`, the user got there from a project page, so
 * the history has an entry to go back to; otherwise `/doc` was opened directly.
 */
const renderToolbar = ({ fromProject = false } = {}) =>
  render(
    <MemoryRouter
      initialEntries={fromProject ? ['/project', '/doc'] : ['/doc']}
      initialIndex={fromProject ? 1 : 0}
    >
      <Routes>
        <Route path='/' element={<p>Home page</p>} />
        <Route path='/project' element={<p>Project page</p>} />
        <Route path='/doc' element={<DocumentToolbar editor={editor} itemName='Architecture' />} />
      </Routes>
    </MemoryRouter>,
  )

const button = (name: string) => screen.getByRole('button', { name })

/** Runs an editor command outside the toolbar, as typing in the document would. */
const edit = (command: (editor: Editor) => void) => act(() => command(editor))

const openMenu = () => fireEvent.click(button('Menu'))

beforeEach(() => {
  vi.clearAllMocks()
  provider.authorizedScope = 'read-write'
  // No trailing empty paragraph, so the HTML assertions show exactly what a button changed.
  editor = new Editor({
    extensions: [StarterKit.configure({ trailingNode: false })],
    content: '<p>Hello world</p>',
  })
})

afterEach(() => {
  cleanup()
  editor.destroy()
})

describe('DocumentToolbar', () => {
  it('shows the item name without a read-only badge', () => {
    renderToolbar()

    expect(screen.getByText('Architecture')).toBeInTheDocument()
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()
  })

  describe('formatting', () => {
    it('toggles a mark on the selection and reflects it as pressed', () => {
      renderToolbar()
      edit((e) => e.commands.selectAll())

      expect(button('Bold')).toHaveAttribute('aria-pressed', 'false')
      fireEvent.click(button('Bold'))

      expect(editor.getHTML()).toBe('<p><strong>Hello world</strong></p>')
      expect(button('Bold')).toHaveAttribute('aria-pressed', 'true')

      fireEvent.click(button('Bold'))
      expect(editor.getHTML()).toBe('<p>Hello world</p>')
    })

    it.each([
      ['Italic', '<p><em>Hello world</em></p>'],
      ['Underline', '<p><u>Hello world</u></p>'],
      ['Strikethrough', '<p><s>Hello world</s></p>'],
      ['Inline code', '<p><code>Hello world</code></p>'],
    ])('applies %s', (label, html) => {
      renderToolbar()
      edit((e) => e.commands.selectAll())

      fireEvent.click(button(label))

      expect(editor.getHTML()).toBe(html)
    })

    it('switches block types and marks only the active one', () => {
      renderToolbar()
      expect(button('Paragraph')).toHaveAttribute('aria-pressed', 'true')

      fireEvent.click(button('Heading 2'))

      expect(editor.getHTML()).toBe('<h2>Hello world</h2>')
      expect(button('Heading 2')).toHaveAttribute('aria-pressed', 'true')
      expect(button('Paragraph')).toHaveAttribute('aria-pressed', 'false')

      fireEvent.click(button('Paragraph'))
      expect(editor.getHTML()).toBe('<p>Hello world</p>')
    })

    it.each([
      ['Bullet list', '<ul><li><p>Hello world</p></li></ul>'],
      ['Ordered list', '<ol><li><p>Hello world</p></li></ol>'],
      ['Blockquote', '<blockquote><p>Hello world</p></blockquote>'],
      ['Code block', '<pre><code>Hello world</code></pre>'],
    ])('wraps the block in a %s', (label, html) => {
      renderToolbar()

      fireEvent.click(button(label))

      expect(editor.getHTML()).toBe(html)
      expect(button(label)).toHaveAttribute('aria-pressed', 'true')
    })

    it('inserts a horizontal rule', () => {
      renderToolbar()

      fireEvent.click(button('Horizontal rule'))

      expect(editor.getHTML()).toContain('<hr>')
    })
  })

  describe('history', () => {
    it('enables undo and redo only when there is something to step through', () => {
      renderToolbar()
      expect(button('Undo')).toBeDisabled()
      expect(button('Redo')).toBeDisabled()

      edit((e) => e.commands.insertContent('!'))
      expect(button('Undo')).toBeEnabled()

      fireEvent.click(button('Undo'))
      expect(editor.getText()).toBe('Hello world')
      expect(button('Undo')).toBeDisabled()
      expect(button('Redo')).toBeEnabled()

      fireEvent.click(button('Redo'))
      expect(editor.getText()).toContain('!')
    })
  })

  describe('menu', () => {
    it('goes back in history when the document was opened from the app', () => {
      renderToolbar({ fromProject: true })

      fireEvent.click(button('Back'))

      expect(screen.getByText('Project page')).toBeInTheDocument()
    })

    it('goes to the home page when the document was opened directly', () => {
      renderToolbar()

      fireEvent.click(button('Back'))

      expect(screen.getByText('Home page')).toBeInTheDocument()
    })

    it.each([
      ['DocGraph', 'handleDownloadBinary'],
      ['Markdown', 'handleDownloadMarkdown'],
      ['JSON', 'handleDownloadJson'],
    ] as const)('exports as %s', (format, handler) => {
      renderToolbar()
      openMenu()

      fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }))
      fireEvent.click(screen.getByRole('menuitem', { name: format }))

      expect(io[handler]).toHaveBeenCalledOnce()
    })

    it('opens the file picker from Import and hands the file to the importer', () => {
      const { container } = renderToolbar()
      const input = container.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input) throw new Error('The toolbar should render a hidden file input')
      const pick = vi.spyOn(input, 'click').mockImplementation(() => {})
      openMenu()

      fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }))
      expect(pick).toHaveBeenCalledOnce()

      fireEvent.change(input, { target: { files: [new File(['# Hi'], 'notes.md')] } })
      expect(io.handleImport).toHaveBeenCalledOnce()
    })
  })

  describe('read-only', () => {
    beforeEach(() => {
      provider.authorizedScope = 'readonly'
    })

    it('shows a badge and disables every formatting button', () => {
      renderToolbar()

      expect(screen.getByText('Read-only')).toBeInTheDocument()
      const toolbar = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))
      expect(toolbar.length).toBeGreaterThan(0)
      for (const control of toolbar) expect(control).toBeDisabled()
    })

    it('still offers export but not import', () => {
      renderToolbar()
      openMenu()

      expect(screen.getByRole('menuitem', { name: 'Export' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Import' })).not.toBeInTheDocument()
    })
  })
})
