import type { DocumentWriteMode } from '@docgraph/common/schemas'
import { Doc } from 'yjs'
import type { Actor } from '../auth/actor'
import { readItemDocument, requireItemOfType, writeItemDocument } from '../item/item-document'
import { createItem } from '../item/service'
import { toMarkdown, writeMarkdown } from './document.mapper'

/** Content of a document item as Markdown. */
export const getDocumentMarkdown = async (itemId: string, actor: Actor) => {
  const item = await requireItemOfType(itemId, 'DOCUMENT', actor)
  const markdown = await readItemDocument(itemId, toMarkdown)
  return { item, markdown }
}

/** Writes Markdown through Hocuspocus, so open editors see it live. */
export const updateDocumentMarkdown = async (
  itemId: string,
  markdown: string,
  mode: DocumentWriteMode,
  actor: Actor,
) => {
  const { item } = await writeItemDocument(itemId, 'DOCUMENT', actor, (doc) =>
    writeMarkdown(doc, markdown, mode),
  )
  return { item }
}

export const createDocument = async (
  { projectId, name, markdown }: { projectId: string; name: string; markdown?: string },
  actor: Actor,
) => {
  const content = markdown?.trim() ? markdown : undefined
  // Convert on a scratch document first, so Markdown that cannot be converted
  // leaves no empty document behind.
  if (content) writeMarkdown(new Doc(), content, 'replace')

  const item = await createItem({ projectId, name, type: 'DOCUMENT' }, actor)
  if (content) await updateDocumentMarkdown(item.id, content, 'replace', actor)
  return { item }
}
