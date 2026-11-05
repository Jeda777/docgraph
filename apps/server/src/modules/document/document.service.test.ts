import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyUpdate, Doc } from 'yjs'
import { db } from '../../db'
import { items } from '../../db/schema'
import { BadRequestException } from '../../errors'
import {
  actorOf,
  createItem,
  createProject,
  createUser,
  migrateTestDb,
  resetTestDb,
} from '../../test/db'
import { loadItemDocument } from '../item/document-store'
import { toMarkdown, writeMarkdown } from './document.mapper'
import { createDocument, getDocumentMarkdown, updateDocumentMarkdown } from './document.service'

// Wraps the real conversion so a test can make one call fail.
vi.mock('./document.mapper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./document.mapper')>()
  return { ...actual, writeMarkdown: vi.fn(actual.writeMarkdown) }
})

const setup = async () => {
  const user = await createUser()
  const project = await createProject({ isForAllUsers: true })
  return { actor: actorOf(user), project }
}

const itemsOf = (projectId: string) => db.select().from(items).where(eq(items.projectId, projectId))

beforeEach(async () => {
  await migrateTestDb()
  await resetTestDb()
})

describe('getDocumentMarkdown', () => {
  it('returns empty Markdown for a document that was never edited', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'DOCUMENT' })

    const { item: read, markdown } = await getDocumentMarkdown(item.id, actor)

    expect(read).toMatchObject({ id: item.id, type: 'DOCUMENT' })
    expect(markdown).toBe('')
  })

  it('refuses items that are not documents', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'FLOWCHART' })

    await expect(getDocumentMarkdown(item.id, actor)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/not a DOCUMENT/),
    })
  })

  it('hides documents of projects the actor cannot access', async () => {
    const user = await createUser()
    const project = await createProject()
    const item = await createItem(project.id, { type: 'DOCUMENT' })

    await expect(getDocumentMarkdown(item.id, actorOf(user))).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('updateDocumentMarkdown', () => {
  it('replaces the content and persists it', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'DOCUMENT' })
    await updateDocumentMarkdown(item.id, '# Old', 'replace', actor)

    await updateDocumentMarkdown(item.id, '# New\n\nText', 'replace', actor)

    expect((await getDocumentMarkdown(item.id, actor)).markdown).toBe('# New\n\nText')
    // `getDocumentMarkdown` may read the live Hocuspocus document, so check storage too.
    const stored = await loadItemDocument(item.id)
    if (!stored) throw new Error('Document not stored')
    const doc = new Doc()
    applyUpdate(doc, stored)
    expect(toMarkdown(doc)).toBe('# New\n\nText')
  })

  it('appends after the existing content', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'DOCUMENT' })
    await updateDocumentMarkdown(item.id, '# Title', 'replace', actor)

    await updateDocumentMarkdown(item.id, 'Text', 'append', actor)

    expect((await getDocumentMarkdown(item.id, actor)).markdown).toBe('# Title\n\nText')
  })

  it('refuses to write into archived documents', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'DOCUMENT', isArchived: true })

    await expect(updateDocumentMarkdown(item.id, 'Text', 'replace', actor)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/read-only/),
    })
    expect(await loadItemDocument(item.id)).toBeNull()
  })

  it('refuses items that are not documents', async () => {
    const { actor, project } = await setup()
    const item = await createItem(project.id, { type: 'DATABASE_DIAGRAM' })

    await expect(updateDocumentMarkdown(item.id, 'Text', 'replace', actor)).rejects.toMatchObject({
      status: 400,
    })
    expect(await loadItemDocument(item.id)).toBeNull()
  })
})

describe('createDocument', () => {
  it('creates an empty document without writing content', async () => {
    const { actor, project } = await setup()

    const { item } = await createDocument({ projectId: project.id, name: 'Notes' }, actor)

    expect(item).toMatchObject({ name: 'Notes', type: 'DOCUMENT', projectId: project.id })
    expect(await loadItemDocument(item.id)).toBeNull()
  })

  it('treats blank Markdown as no content', async () => {
    const { actor, project } = await setup()

    const { item } = await createDocument(
      { projectId: project.id, name: 'Notes', markdown: '  \n' },
      actor,
    )

    expect(await loadItemDocument(item.id)).toBeNull()
  })

  it('creates a document with its initial Markdown', async () => {
    const { actor, project } = await setup()

    const { item } = await createDocument(
      { projectId: project.id, name: 'Notes', markdown: '# Title\n\n- one\n- two' },
      actor,
    )

    expect((await getDocumentMarkdown(item.id, actor)).markdown).toBe('# Title\n\n- one\n- two')
  })

  it('creates no item when the Markdown cannot be converted', async () => {
    const { actor, project } = await setup()
    vi.mocked(writeMarkdown).mockImplementationOnce(() => {
      throw new BadRequestException('BAD_REQUEST', 'The Markdown could not be converted')
    })

    await expect(
      createDocument({ projectId: project.id, name: 'Notes', markdown: '# Title' }, actor),
    ).rejects.toMatchObject({ status: 400 })
    expect(await itemsOf(project.id)).toEqual([])
  })
})
