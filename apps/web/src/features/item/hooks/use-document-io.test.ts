import { cleanup, renderHook } from '@testing-library/react'
import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { Doc, encodeStateAsUpdate, XmlElement, XmlText } from 'yjs'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
const showErrorToast = vi.hoisted(() => vi.fn())
const download = vi.hoisted(() => ({ downloadFile: vi.fn(), downloadDocgraph: vi.fn() }))
const provider = vi.hoisted(() => ({ document: undefined as unknown }))

vi.mock('@/components/ui/toast', () => ({ toast }))
vi.mock('@/lib/error-toast', () => ({ showErrorToast }))
vi.mock('../lib/download.helpers', () => download)
vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))

const { useDocumentIo } = await import('./use-document-io')

const DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
}

/** The slice of a TipTap editor the hook touches. */
const createEditor = () => ({
  getJSON: vi.fn(() => DOCUMENT),
  getMarkdown: vi.fn(() => '# Hello'),
  commands: { setContent: vi.fn() },
})

type FakeFile = {
  name: string
  text?: () => Promise<string>
  arrayBuffer?: () => Promise<Uint8Array>
}

const changeEvent = (file?: FakeFile) => {
  const target = { files: file ? [file] : [], value: 'C:\\fakepath\\document' }
  return { event: { target } as unknown as React.ChangeEvent<HTMLInputElement>, target }
}

const textFile = (name: string, text: string): FakeFile => ({ name, text: async () => text })

const paragraph = (text: string) => {
  const element = new XmlElement('paragraph')
  element.insert(0, [new XmlText(text)])
  return element
}

/** A `.docgraph` export of a document holding one paragraph. */
const docgraphFile = (): FakeFile => {
  const doc = new Doc()
  doc.getXmlFragment('content').insert(0, [paragraph('Imported')])
  const bytes = encodeStateAsUpdate(doc)
  return { name: 'document.docgraph', arrayBuffer: async () => bytes }
}

let editor: ReturnType<typeof createEditor>

const renderIo = () =>
  renderHook(() => useDocumentIo({ editor: editor as unknown as Editor, itemName: 'Spec' })).result
    .current

beforeEach(() => {
  vi.clearAllMocks()
  editor = createEditor()
  provider.document = new Doc()
})

afterEach(cleanup)

describe('useDocumentIo', () => {
  describe('exports', () => {
    it('downloads the editor content as typed JSON', () => {
      renderIo().handleDownloadJson()

      const [content, fileName, format] = download.downloadFile.mock.calls[0]
      expect(JSON.parse(content)).toEqual({ type: 'DOCUMENT', document: DOCUMENT })
      expect(fileName).toBe('Spec.json')
      expect(format).toBe('json')
    })

    it('downloads the editor content as Markdown', () => {
      renderIo().handleDownloadMarkdown()

      expect(download.downloadFile).toHaveBeenCalledWith('# Hello', 'Spec.md', 'markdown')
    })

    it('downloads the shared CRDT document as .docgraph', () => {
      renderIo().handleDownloadBinary()

      expect(download.downloadDocgraph).toHaveBeenCalledWith(provider.document, 'Spec')
    })
  })

  describe('handleImport', () => {
    it('sets a JSON import as the editor content and clears the input', async () => {
      const { event, target } = changeEvent(
        textFile('document.json', JSON.stringify({ type: 'DOCUMENT', document: DOCUMENT })),
      )

      await renderIo().handleImport(event)

      expect(editor.commands.setContent).toHaveBeenCalledWith(DOCUMENT, {
        errorOnInvalidContent: true,
      })
      expect(target.value).toBe('')
    })

    it('sets a Markdown import as Markdown content', async () => {
      await renderIo().handleImport(changeEvent(textFile('notes.md', '# Notes')).event)

      expect(editor.commands.setContent).toHaveBeenCalledWith('# Notes', {
        contentType: 'markdown',
      })
    })

    it('replaces non-empty content with a .docgraph import instead of merging', async () => {
      const shared = provider.document as Doc
      shared.getXmlFragment('content').insert(0, [paragraph('Existing')])
      const before = encodeStateAsUpdate(shared)

      await renderIo().handleImport(changeEvent(docgraphFile()).event)

      expect(editor.commands.setContent).toHaveBeenCalledExactlyOnceWith(
        {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Imported' }] }],
        },
        { errorOnInvalidContent: true },
      )
      expect(encodeStateAsUpdate(shared)).toEqual(before)
    })

    it('reports an invalid file and leaves the content alone', async () => {
      const { event, target } = changeEvent(textFile('document.json', '{ nope'))

      await renderIo().handleImport(event)

      expect(toast.add).toHaveBeenCalledWith({
        type: 'error',
        title: 'Import failed',
        description: 'Not a valid JSON file.',
      })
      expect(editor.commands.setContent).not.toHaveBeenCalled()
      expect(target.value).toBe('')
    })

    it('keeps the document and reports a JSON import the schema rejects', async () => {
      const realEditor = new Editor({ extensions: [StarterKit], content: '<p>Keep me</p>' })
      onTestFinished(() => realEditor.destroy())
      const unknownNode = { type: 'doc', content: [{ type: 'unknownBlock' }] }
      const io = renderHook(() => useDocumentIo({ editor: realEditor, itemName: 'Spec' })).result
        .current

      await io.handleImport(
        changeEvent(textFile('document.json', JSON.stringify(unknownNode))).event,
      )

      expect(showErrorToast).toHaveBeenCalledWith(
        'Could not apply the imported file',
        expect.any(Error),
      )
      expect(realEditor.getText()).toBe('Keep me')
    })

    it('reports content the editor refuses', async () => {
      const error = new Error('Invalid content')
      editor.commands.setContent.mockImplementation(() => {
        throw error
      })

      await renderIo().handleImport(changeEvent(textFile('notes.md', '# Notes')).event)

      expect(showErrorToast).toHaveBeenCalledWith('Could not apply the imported file', error)
    })

    it('does nothing when no file was picked', async () => {
      await renderIo().handleImport(changeEvent().event)

      expect(editor.commands.setContent).not.toHaveBeenCalled()
      expect(toast.add).not.toHaveBeenCalled()
    })
  })
})
