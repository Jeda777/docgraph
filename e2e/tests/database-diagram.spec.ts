import { createItem, createProject } from '../lib/api'
import { canvasTable, waitForEditor } from '../lib/canvas'
import { expect, test } from '../lib/test'

test('edits tables and columns of a database diagram', async ({ page }) => {
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')

  await page.goto(`/item/${item.id}`)
  await waitForEditor(page)
  const sidebar = page.getByRole('complementary')
  await expect(sidebar.getByRole('tab', { name: 'Tables', selected: true })).toBeVisible()

  // A new table starts as `new_table` with an `id` primary key
  await sidebar.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(canvasTable(page, 'new_table')).toBeVisible()
  await expect(canvasTable(page, 'new_table')).toContainText('id: int')

  await sidebar.getByLabel('Table name').fill('invoices')
  await expect(canvasTable(page, 'invoices')).toBeVisible()
  await sidebar.getByPlaceholder('Description').fill('Issued invoices')

  await sidebar.getByRole('button', { name: 'Add column' }).click()
  const columnNames = sidebar.getByLabel('Column name')
  const columnTypes = sidebar.getByLabel('Column type')
  await expect(columnNames).toHaveCount(2)
  await columnNames.nth(1).fill('total')
  await columnTypes.nth(1).fill('decimal(10,2)')
  await columnTypes.nth(1).press('Escape')

  const invoices = canvasTable(page, 'invoices')
  await expect(invoices).toContainText('Issued invoices')
  await expect(invoices).toContainText('total: decimal(10,2)')

  // A copy keeps the columns under a new name, and deleting it leaves the original alone
  await sidebar.getByRole('button', { name: 'Duplicate table' }).click()
  await expect(canvasTable(page, 'invoices_copy')).toContainText('total: decimal(10,2)')
  await sidebar.getByRole('button', { name: 'Delete table' }).nth(1).click()
  await expect(canvasTable(page, 'invoices_copy')).toHaveCount(0)

  // Everything reached the server: a reload brings back the same diagram
  await page.reload()
  await waitForEditor(page)
  await expect(canvasTable(page, 'invoices')).toContainText('total: decimal(10,2)')
  await expect(canvasTable(page, 'invoices')).toContainText('Issued invoices')
  await expect(page.locator('.react-flow__node')).toHaveCount(1)
  await expect(page.getByRole('complementary').getByLabel('Table name')).toHaveValue('invoices')
})
