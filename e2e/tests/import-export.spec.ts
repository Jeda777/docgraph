import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createItem, createProject } from '../lib/api'
import { canvasTable, openItem, waitForEditor } from '../lib/canvas'
import { exportItem, importFile } from '../lib/item-menu'
import { expect, test } from '../lib/test'

const FIXTURES = join(import.meta.dirname, '../../packages/common/fixtures')

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

type DiagramExport = {
  type: string
  nodes: { type: string; data: { name: string } }[]
  edges: unknown[]
  areas: unknown[]
}

test('a database diagram round-trips through JSON, DocGraph and image exports', async ({
  page,
}, testInfo) => {
  const project = await createProject(page.request)
  const source = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')
  const target = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')

  await openItem(page, source.id)
  await importFile(page, join(FIXTURES, 'database-diagram.json'))
  await expect(canvasTable(page, 'orders')).toBeVisible()
  await expect(canvasTable(page, 'customers')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)

  // A file of another diagram type is rejected and leaves the diagram as it was
  await importFile(page, join(FIXTURES, 'flowchart.json'))
  await expect(page.getByText('Import failed')).toBeVisible()
  await expect(canvasTable(page, 'orders')).toBeVisible()

  const json = await exportItem(page, 'JSON')
  expect(json.fileName).toBe(`${source.name}.json`)
  const exported = JSON.parse(json.content.toString('utf8')) as DiagramExport
  expect(exported.type).toBe('DATABASE_DIAGRAM')
  expect(exported.nodes.map((node) => node.data.name).sort()).toEqual(['customers', 'orders'])
  expect(exported.edges).toHaveLength(2)
  expect(exported.areas).toHaveLength(1)

  const image = await exportItem(page, 'PNG')
  expect(image.fileName).toBe(`${source.name}.png`)
  expect(image.content.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE)

  // The binary DocGraph export restores the whole diagram in another item
  const docgraph = await exportItem(page, 'DocGraph')
  expect(docgraph.fileName).toBe(`${source.name}.docgraph`)
  const docgraphPath = testInfo.outputPath(docgraph.fileName)
  await writeFile(docgraphPath, docgraph.content)

  await openItem(page, target.id)
  await expect(page.locator('.react-flow__node')).toHaveCount(0)
  await importFile(page, docgraphPath)
  await expect(canvasTable(page, 'orders')).toBeVisible()
  await expect(canvasTable(page, 'customers')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)

  // The imported content is saved like any other edit
  await page.reload()
  await waitForEditor(page)
  await expect(canvasTable(page, 'orders')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
})

test('a document imports Markdown and exports it back', async ({ page }, testInfo) => {
  const project = await createProject(page.request)
  const source = await createItem(page.request, project.id, 'DOCUMENT')
  const target = await createItem(page.request, project.id, 'DOCUMENT')

  const markdownPath = testInfo.outputPath('release-notes.md')
  await writeFile(
    markdownPath,
    '# Release notes\n\nShips the **import** feature.\n\n- First change\n- Second change\n',
  )

  await openItem(page, source.id)
  await importFile(page, markdownPath)
  const editor = page.locator('.ProseMirror')
  await expect(editor.getByRole('heading', { name: 'Release notes', level: 1 })).toBeVisible()
  await expect(editor.locator('strong')).toHaveText('import')
  await expect(editor.getByRole('listitem')).toHaveText(['First change', 'Second change'])

  const markdown = await exportItem(page, 'Markdown')
  expect(markdown.fileName).toBe(`${source.name}.md`)
  const text = markdown.content.toString('utf8')
  expect(text).toContain('# Release notes')
  expect(text).toContain('**import**')
  expect(text).toMatch(/^[-*] First change$/m)

  const json = await exportItem(page, 'JSON')
  expect(JSON.parse(json.content.toString('utf8'))).toMatchObject({
    type: 'DOCUMENT',
    document: { type: 'doc' },
  })

  // The DocGraph export carries the document into another item
  const docgraph = await exportItem(page, 'DocGraph')
  const docgraphPath = testInfo.outputPath(docgraph.fileName)
  await writeFile(docgraphPath, docgraph.content)

  await openItem(page, target.id)
  await importFile(page, docgraphPath)
  await expect(
    page.locator('.ProseMirror').getByRole('heading', { name: 'Release notes' }),
  ).toBeVisible()
  await page.reload()
  await waitForEditor(page)
  await expect(page.locator('.ProseMirror').getByRole('listitem')).toHaveCount(2)
})

test('a DocGraph import replaces the content of a non-empty document', async ({
  page,
}, testInfo) => {
  const project = await createProject(page.request)
  const source = await createItem(page.request, project.id, 'DOCUMENT')
  const target = await createItem(page.request, project.id, 'DOCUMENT')
  const editor = page.locator('.ProseMirror')

  const writeMarkdown = async (name: string, markdown: string) => {
    const path = testInfo.outputPath(name)
    await writeFile(path, markdown)
    return path
  }
  const snapshotPath = await writeMarkdown('snapshot.md', '# Snapshot\n\nOriginal text.\n')
  const changedPath = await writeMarkdown('changed.md', '# Changed\n\nNewer text.\n')

  await openItem(page, source.id)
  await importFile(page, snapshotPath)
  await expect(editor.getByRole('heading')).toHaveText(['Snapshot'])
  const docgraph = await exportItem(page, 'DocGraph')
  const docgraphPath = testInfo.outputPath(docgraph.fileName)
  await writeFile(docgraphPath, docgraph.content)

  // Restoring an older copy of the same document brings back the content deleted since
  await importFile(page, changedPath)
  await expect(editor.getByRole('heading')).toHaveText(['Changed'])
  await importFile(page, docgraphPath)
  await expect(editor.getByRole('heading')).toHaveText(['Snapshot'])
  await expect(editor.locator('p')).toHaveText(['Original text.'])

  // Importing into another non-empty document replaces its content instead of merging
  await openItem(page, target.id)
  await importFile(page, changedPath)
  await expect(editor.getByRole('heading')).toHaveText(['Changed'])
  await importFile(page, docgraphPath)
  await expect(editor.getByRole('heading')).toHaveText(['Snapshot'])
  await expect(editor.locator('p')).toHaveText(['Original text.'])

  await page.reload()
  await waitForEditor(page)
  await expect(editor.getByRole('heading')).toHaveText(['Snapshot'])
  await expect(editor.locator('p')).toHaveText(['Original text.'])
})
