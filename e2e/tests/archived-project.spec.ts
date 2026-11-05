import { createItem, createProject } from '../lib/api'
import { addFromPalette, canvasNode, editNodeText, waitForEditor } from '../lib/canvas'
import { expect, test } from '../lib/test'

test('an archived project stays readable but refuses every edit', async ({ page }) => {
  const project = await createProject(page.request)
  const flowchart = await createItem(page.request, project.id, 'FLOWCHART')
  const document = await createItem(page.request, project.id, 'DOCUMENT')

  // Content written while the project is still active
  await page.goto(`/item/${flowchart.id}`)
  await addFromPalette(page, 'Process')
  await editNodeText(page, 'Process', 'Before archiving')
  await expect(canvasNode(page, 'Process: Before archiving')).toBeVisible()

  await page.goto('/')
  await page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: project.name })
    .getByLabel('Settings')
    .click()
  const settings = page.getByRole('dialog', { name: 'Project Settings' })
  await settings.getByRole('checkbox', { name: 'Is Archived' }).check()
  await settings.getByRole('button', { name: 'Save' }).click()
  await expect(settings).toBeHidden()
  await expect(
    page.getByRole('main').getByRole('link', { name: `${project.name} (archived)` }),
  ).toBeVisible()

  // The project page lists the items, but nothing new can be added
  await page
    .getByRole('main')
    .getByRole('link', { name: `${project.name} (archived)` })
    .click()
  await expect(page.getByRole('heading', { name: `${project.name} (archived)` })).toBeVisible()
  await expect(page.getByRole('link', { name: flowchart.name })).toBeVisible()
  await expect(page.getByRole('button', { name: 'New Item' })).toHaveCount(0)
  const created = await page.request.post('/api/items', {
    data: { name: 'Too late', type: 'DOCUMENT', projectId: project.id },
  })
  expect(created.status()).toBe(404)

  // The diagram opens read-only: content visible, palette and text editing disabled
  await page.goto(`/item/${flowchart.id}`)
  await waitForEditor(page)
  await expect(page.getByText('Read-only')).toBeVisible()
  await expect(canvasNode(page, 'Process: Before archiving')).toBeVisible()
  await expect(
    page.getByRole('complementary').getByRole('button', { name: 'Process', exact: true }),
  ).toBeDisabled()
  await canvasNode(page, 'Process: Before archiving').dblclick()
  await expect(page.locator('.react-flow__node').getByRole('textbox')).toHaveCount(0)

  // Export still works, import is gone
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Export' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Import' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // The document editor doesn't take input either
  await page.goto(`/item/${document.id}`)
  await waitForEditor(page)
  await expect(page.getByText('Read-only')).toBeVisible()
  const editor = page.locator('.ProseMirror')
  await expect(editor).toHaveAttribute('contenteditable', 'false')
  await editor.click()
  await page.keyboard.type('Should not land')
  await expect(editor).not.toContainText('Should not land')
})
