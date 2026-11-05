import type { DocumentWriteMode } from '@docgraph/common/schemas'
import { getSchema, type JSONContent } from '@tiptap/core'
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { updateYFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap'
import type { Doc } from 'yjs'
import { BadRequestException } from '../../errors'

/**
 * Conversion between a document item's CRDT state and Markdown. The extensions
 * must define the same nodes and marks as the web editor (`document-editor.tsx`),
 * whose other extensions add behavior only.
 */
const EXTENSIONS = [StarterKit]

/** The Yjs fragment the web editor's Collaboration extension binds to. */
const CONTENT_FIELD = 'content'

const schema = getSchema(EXTENSIONS)
const markdown = new MarkdownManager({ extensions: EXTENSIONS })

const contentOf = (doc: Doc) => yXmlFragmentToProsemirrorJSON(doc.getXmlFragment(CONTENT_FIELD))

const isEmptyParagraph = (block: JSONContent) =>
  block.type === 'paragraph' && !block.content?.length

/** Current blocks without the blank paragraphs at the end, e.g. the one a new document starts with. */
const withoutTrailingEmptyParagraphs = (doc: Doc) => {
  const blocks = [...((contentOf(doc).content as JSONContent[] | undefined) ?? [])]
  while (blocks.length && isEmptyParagraph(blocks[blocks.length - 1])) blocks.pop()
  return blocks
}

export const toMarkdown = (doc: Doc): string => markdown.serialize(contentOf(doc) as JSONContent)

/**
 * Writes Markdown into the document. The new content is diffed against the
 * current one, so blocks that did not change keep their identity for editors
 * that have the document open.
 */
export const writeMarkdown = (doc: Doc, text: string, mode: DocumentWriteMode) => {
  let node: ReturnType<typeof schema.nodeFromJSON>
  try {
    const parsed = (markdown.parse(text).content ?? []).filter((block) => !isEmptyParagraph(block))
    const content = mode === 'append' ? [...withoutTrailingEmptyParagraphs(doc), ...parsed] : parsed
    // A document holds at least one block; the editor shows an empty one as a blank paragraph.
    if (!content.length) content.push({ type: 'paragraph' })
    node = schema.nodeFromJSON({ type: 'doc', content })
    node.check()
  } catch (error) {
    throw new BadRequestException(
      'BAD_REQUEST',
      `The Markdown could not be converted: ${(error as Error).message}`,
    )
  }

  updateYFragment(doc, doc.getXmlFragment(CONTENT_FIELD), node, {
    mapping: new Map(),
    isOMark: new Map(),
  })
}
