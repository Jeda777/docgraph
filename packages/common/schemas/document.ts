/**
 * How Markdown is written into a document: `replace` swaps the whole content,
 * `append` adds it after the current content.
 */
export const DOCUMENT_WRITE_MODES = ['replace', 'append'] as const
export type DocumentWriteMode = (typeof DOCUMENT_WRITE_MODES)[number]
