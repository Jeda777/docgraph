import type { JSONContent } from '@tiptap/react'
import { yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import { applyUpdate, Doc, XmlElement } from 'yjs'
import { z } from 'zod'

/** TipTap document JSON; node contents are validated by TipTap on import. */
const tiptapDocumentSchema = z.object({
  type: z.literal('doc'),
  content: z.array(z.custom<JSONContent>()).default([]),
})

/** A parsed document import: a TipTap JSON document or Markdown. */
export type DocumentImport =
  | { kind: 'json'; document: z.infer<typeof tiptapDocumentSchema> }
  | { kind: 'markdown'; markdown: string }

const documentExportSchema = z.union([
  z.object({ type: z.literal('DOCUMENT'), document: tiptapDocumentSchema }),
  tiptapDocumentSchema,
])

/**
 * Reads a binary `.docgraph` export of a document item as TipTap JSON, so it replaces the editor
 * content like a JSON import. Applying the CRDT update to the live document would merge instead:
 * content gets interleaved and blocks deleted since the export stay deleted.
 */
const parseDocumentBinary = async (
  buffer: ArrayBuffer,
): Promise<{ ok: true; data: DocumentImport } | { ok: false; error: string }> => {
  const update = new Uint8Array(buffer)

  // Yjs decoding is lenient: a decodable update alone doesn't prove it is a document item.
  const scratch = new Doc()
  try {
    applyUpdate(scratch, update)
  } catch {
    return { ok: false, error: 'Not a valid .docgraph file.' }
  }

  const content = scratch.getXmlFragment('content')
  // An empty `content` means either garbage or a foreign export; importing it
  // would wipe the document, so reject it with clear feedback.
  const isTipTapDocument =
    content.length > 0 && content.toArray().every((child) => child instanceof XmlElement)
  if (!isTipTapDocument) {
    return { ok: false, error: 'Not a valid document .docgraph file.' }
  }

  const { content: blocks } = yXmlFragmentToProsemirrorJSON(content)
  return { ok: true, data: { kind: 'json', document: { type: 'doc', content: blocks } } }
}

/**
 * Parses an import file for a document item. Accepts a JSON export (the full
 * `{ type: 'DOCUMENT', … }` shape or a bare TipTap document), Markdown and
 * binary `.docgraph` CRDT exports, mirroring `parseDiagramFile`.
 */
export const parseDocumentFile = async (
  file: File,
): Promise<{ ok: true; data: DocumentImport } | { ok: false; error: string }> => {
  if (file.name.endsWith('.docgraph')) {
    return parseDocumentBinary(await file.arrayBuffer())
  }

  if (file.name.endsWith('.md')) {
    return { ok: true, data: { kind: 'markdown', markdown: await file.text() } }
  }

  if (!file.name.endsWith('.json')) {
    return { ok: false, error: 'Not a valid file type.' }
  }

  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: 'Not a valid JSON file.' }
  }

  const result = documentExportSchema.safeParse(raw)
  if (!result.success) {
    return { ok: false, error: z.prettifyError(result.error) }
  }

  const document = 'document' in result.data ? result.data.document : result.data
  return { ok: true, data: { kind: 'json', document } }
}
