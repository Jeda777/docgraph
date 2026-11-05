import { describe, expect, it } from 'vitest'
import { Doc } from 'yjs'
import { toMarkdown, writeMarkdown } from './document.mapper'

describe('writeMarkdown', () => {
  it('clears the document with empty Markdown', () => {
    const doc = new Doc()
    writeMarkdown(doc, '# Title\n\nText', 'replace')

    writeMarkdown(doc, '', 'replace')

    expect(toMarkdown(doc)).toBe('')
    expect(doc.getXmlFragment('content').length).toBe(1)
  })

  it('appends after the content without the blank paragraph a new document starts with', () => {
    const doc = new Doc()
    // A document created in the editor holds one empty paragraph.
    writeMarkdown(doc, '', 'replace')

    writeMarkdown(doc, '# Title', 'append')
    writeMarkdown(doc, 'Text', 'append')

    expect(toMarkdown(doc)).toBe('# Title\n\nText')
  })
})
