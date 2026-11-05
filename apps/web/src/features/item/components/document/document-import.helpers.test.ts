import { describe, expect, it } from 'vitest'
import { Doc, encodeStateAsUpdate, XmlElement, XmlText } from 'yjs'
import documentFixture from './__fixtures__/document.json'
import { parseDocumentFile } from './document-import.helpers'

/**
 * Builds a `.json` import file from any serializable payload. jsdom's File
 * polyfill lacks `text()`, so a minimal File-like object is used instead —
 * `parseDocumentFile` only reads `name` and `text()`.
 */
const jsonFile = (payload: unknown, name = 'document.json') =>
  ({ name, text: async () => JSON.stringify(payload) }) as File

/** Same File-like trick for `.docgraph`, which only reads `arrayBuffer()`. */
const binaryFile = (bytes: Uint8Array, name = 'document.docgraph') =>
  ({ name, arrayBuffer: async () => bytes }) as unknown as File

/** Builds a `.docgraph` file from a seeded Yjs document, like the export path. */
const docgraphFile = (seed: (doc: Doc) => void) => {
  const doc = new Doc()
  seed(doc)
  return binaryFile(encodeStateAsUpdate(doc))
}

const seedParagraph = (doc: Doc) => {
  const paragraph = new XmlElement('paragraph')
  const text = new XmlText('Hello')
  paragraph.insert(0, [text])
  doc.getXmlFragment('content').insert(0, [paragraph])
}

describe('document import', () => {
  it('accepts the golden fixture export', async () => {
    const result = await parseDocumentFile(jsonFile(documentFixture))
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual({ kind: 'json', document: documentFixture.document })
  })

  it('accepts a bare TipTap document without the export wrapper', async () => {
    const bare = (documentFixture as { document: unknown }).document
    const result = await parseDocumentFile(jsonFile(bare))
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual({ kind: 'json', document: bare })
  })

  it('defaults missing content to an empty document', async () => {
    const result = await parseDocumentFile(jsonFile({ type: 'doc' }))
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual({ kind: 'json', document: { type: 'doc', content: [] } })
  })

  /**
   * Simulates the import -> export -> import cycle of `useDocumentIo`:
   * `parseDocumentFile` output must wrap back into the export shape and parse
   * to exactly the same document. Catches silent field loss on refactor.
   */
  it('round-trips import -> export -> import without data loss', async () => {
    const first = await parseDocumentFile(jsonFile(documentFixture))
    if (!first.ok) throw new Error(first.error)
    if (first.data.kind !== 'json') throw new Error('expected a JSON import')

    const exported = JSON.stringify({ type: 'DOCUMENT', document: first.data.document })
    const second = await parseDocumentFile(jsonFile(JSON.parse(exported)))
    if (!second.ok) throw new Error(second.error)

    expect(second.data).toEqual(first.data)
  })

  it('reads a binary export as a TipTap document', async () => {
    const result = await parseDocumentFile(docgraphFile(seedParagraph))
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual({
      kind: 'json',
      document: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
      },
    })
  })

  it('keeps nesting and marks of a binary export', async () => {
    const file = docgraphFile((doc) => {
      const text = new XmlText()
      text.insert(0, 'Bold', { bold: {} })
      const paragraph = new XmlElement('paragraph')
      paragraph.insert(0, [text])
      const quote = new XmlElement('blockquote')
      quote.insert(0, [paragraph])
      doc.getXmlFragment('content').insert(0, [quote])
    })

    const result = await parseDocumentFile(file)
    if (!result.ok) throw new Error(result.error)
    expect(result.data).toEqual({
      kind: 'json',
      document: {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }],
              },
            ],
          },
        ],
      },
    })
  })

  it('rejects a .docgraph export of another item type (diagram shape)', async () => {
    const file = docgraphFile((doc) => {
      doc.getMap('nodes').set('a', { id: 'a' })
      doc.getMap('edges').set('b', { id: 'b' })
    })
    const result = await parseDocumentFile(file)
    expect(result).toEqual({ ok: false, error: 'Not a valid document .docgraph file.' })
  })

  it('rejects a .docgraph file that does not decode', async () => {
    const result = await parseDocumentFile(binaryFile(new Uint8Array([1, 2, 3])))
    expect(result.ok).toBe(false)
  })

  it('rejects a non-JSON file', async () => {
    const result = await parseDocumentFile(jsonFile({ nope: true }, 'document.txt'))
    expect(result).toEqual({ ok: false, error: 'Not a valid file type.' })
  })

  it('rejects invalid JSON', async () => {
    const result = await parseDocumentFile({
      name: 'document.json',
      text: async () => '{ nope',
    } as File)
    expect(result).toEqual({ ok: false, error: 'Not a valid JSON file.' })
  })

  it('rejects an export with a missing document', async () => {
    const result = await parseDocumentFile(jsonFile({ type: 'DOCUMENT' }))
    expect(result.ok).toBe(false)
  })

  it('rejects a document with an unexpected root node', async () => {
    const invalid = { type: 'paragraph', content: [] }
    const result = await parseDocumentFile(jsonFile({ type: 'DOCUMENT', document: invalid }))
    expect(result.ok).toBe(false)
  })
})
