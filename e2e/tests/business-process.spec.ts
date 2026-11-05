import { createItem, createProject } from '../lib/api'
import { addFromPalette, canvasNode, editNodeText, waitForEditor } from '../lib/canvas'
import { expect, test } from '../lib/test'

test('adds and labels business process elements', async ({ page }) => {
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'BUSINESS_PROCESS')

  await page.goto(`/item/${item.id}`)
  await waitForEditor(page)
  const sidebar = page.getByRole('complementary')
  await expect(sidebar.getByRole('tab', { name: 'Elements', selected: true })).toBeVisible()

  // The palette search narrows the elements down
  await sidebar.getByLabel('Search business process elements').fill('user task')
  await expect(sidebar.getByRole('button', { name: 'User Task', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Task', exact: true })).toHaveCount(0)
  await sidebar.getByLabel('Search business process elements').clear()

  // New elements land in the middle of the viewport and cover each other, so each one is labelled
  // (and the activity duplicated) before the next is added
  await addFromPalette(page, 'Task')
  await expect(canvasNode(page, 'Activity')).toHaveCount(1)
  await editNodeText(page, 'Activity', 'Approve order')
  await expect(canvasNode(page, 'Activity: Approve order')).toBeVisible()

  // Duplicating the selected element copies its label
  await canvasNode(page, 'Activity: Approve order').click()
  await sidebar.getByRole('button', { name: 'Duplicate selected element' }).click()
  await expect(canvasNode(page, 'Activity: Approve order')).toHaveCount(2)

  await addFromPalette(page, 'Start: none')
  await expect(canvasNode(page, 'Event')).toHaveCount(1)
  await editNodeText(page, 'Event', 'Order received')
  await expect(canvasNode(page, 'Event: Order received')).toBeVisible()

  await page.reload()
  await waitForEditor(page)
  await expect(canvasNode(page, 'Activity: Approve order')).toHaveCount(2)
  await expect(canvasNode(page, 'Event: Order received')).toBeVisible()
})
