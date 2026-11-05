import { createItem, createProject } from '../lib/api'
import { addFromPalette, canvasNode, editNodeText } from '../lib/canvas'
import { expect, test } from '../lib/test'

// Two tabs of the same browser context = the same user with two open editors, each its own
// Hocuspocus connection. Every change must reach the other tab without a reload.
test.describe('live collaboration in two tabs', () => {
  test('syncs flowchart nodes and their text both ways', async ({ context, page: first }) => {
    const project = await createProject(first.request)
    const item = await createItem(first.request, project.id, 'FLOWCHART')

    const second = await context.newPage()
    await Promise.all([first.goto(`/item/${item.id}`), second.goto(`/item/${item.id}`)])
    await expect(first.getByRole('complementary')).toBeVisible()
    await expect(second.getByRole('complementary')).toBeVisible()

    await addFromPalette(first, 'Process')
    await expect(canvasNode(second, 'Process')).toHaveCount(1)

    await editNodeText(second, 'Process', 'Written in tab two')
    await expect(canvasNode(first, 'Process: Written in tab two')).toBeVisible()

    await addFromPalette(second, 'Decision')
    await expect(canvasNode(first, 'Decision')).toHaveCount(1)

    // Deleting is a change like any other
    await canvasNode(first, 'Decision').click()
    await first.keyboard.press('Delete')
    await expect(canvasNode(second, 'Decision')).toHaveCount(0)
    await expect(canvasNode(second, 'Process: Written in tab two')).toBeVisible()
  })

  test('syncs document text as it is typed', async ({ context, page: first }) => {
    const project = await createProject(first.request)
    const item = await createItem(first.request, project.id, 'DOCUMENT')

    const second = await context.newPage()
    await Promise.all([first.goto(`/item/${item.id}`), second.goto(`/item/${item.id}`)])
    const firstEditor = first.locator('.ProseMirror[contenteditable="true"]')
    const secondEditor = second.locator('.ProseMirror[contenteditable="true"]')
    await expect(firstEditor).toBeVisible()
    await expect(secondEditor).toBeVisible()

    await firstEditor.click()
    await first.keyboard.type('Hello from tab one')
    await expect(secondEditor).toContainText('Hello from tab one')

    await secondEditor.click()
    await second.keyboard.press('Control+End')
    await second.keyboard.press('Enter')
    await second.keyboard.type('And a reply from tab two')
    await expect(firstEditor).toContainText('Hello from tab one')
    await expect(firstEditor).toContainText('And a reply from tab two')
  })
})
