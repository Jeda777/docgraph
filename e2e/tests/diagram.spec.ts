import { uniqueName } from '../lib/api'
import { addFromPalette, canvasNode, editNodeText } from '../lib/canvas'
import { expect, test } from '../lib/test'

test('creates a project and a flowchart, then edits it', async ({ context, page }) => {
  const projectName = uniqueName('Project')
  const itemName = uniqueName('Flowchart')

  await page.goto('/')
  await page.getByRole('button', { name: 'New Project' }).click()
  const projectDialog = page.getByRole('dialog', { name: 'Create Project' })
  await projectDialog.getByLabel('Name').fill(projectName)
  await projectDialog.getByRole('button', { name: 'Save' }).click()
  await expect(projectDialog).toBeHidden()

  await page.getByRole('main').getByRole('link', { name: projectName }).click()
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

  await page.getByRole('button', { name: 'New Item' }).click()
  const itemDialog = page.getByRole('dialog', { name: 'Create Item' })
  await itemDialog.getByLabel('Name').fill(itemName)
  await itemDialog.getByText('Flowchart', { exact: true }).click()
  await itemDialog.getByRole('button', { name: 'Save' }).click()
  await expect(itemDialog).toBeHidden()

  const itemRow = page.getByRole('row').filter({ hasText: itemName })
  await expect(itemRow).toContainText('Flowchart')
  await itemRow.getByRole('link', { name: itemName }).click()
  await expect(page).toHaveURL(/\/item\//)

  // New nodes land in the middle of the viewport, so each is edited before the next covers it
  await addFromPalette(page, 'Process')
  await expect(canvasNode(page, 'Process')).toHaveCount(1)
  await editNodeText(page, 'Process', 'Validate order')
  await expect(canvasNode(page, 'Process: Validate order')).toBeVisible()

  await addFromPalette(page, 'Decision')
  await expect(canvasNode(page, 'Decision')).toHaveCount(1)

  // The edits reached the server: a fresh load of the item gets them back
  const reopened = await context.newPage()
  await reopened.goto(page.url())
  await expect(canvasNode(reopened, 'Process: Validate order')).toBeVisible()
  await expect(canvasNode(reopened, 'Decision')).toHaveCount(1)
  await reopened.close()

  // A reload must not drop the last edit. Document writes are throttled, so two shapes added in
  // one browser task leave the second one waiting to be written when the reload starts.
  const palette = page.getByRole('complementary')
  await palette.evaluate((sidebar) => {
    for (const shape of ['Terminator', 'Delay']) {
      const button = Array.from(sidebar.querySelectorAll('button')).find(
        (candidate) =>
          candidate.getAttribute('aria-label') === shape || candidate.textContent?.trim() === shape,
      )
      if (!button) throw new Error(`No palette button for ${shape}`)
      button.click()
    }
  })
  await expect(canvasNode(page, 'Terminator')).toHaveCount(1)
  await expect(canvasNode(page, 'Delay')).toHaveCount(1)

  await page.reload()
  await expect(canvasNode(page, 'Process: Validate order')).toBeVisible()
  await expect(canvasNode(page, 'Terminator')).toHaveCount(1)
  await expect(canvasNode(page, 'Delay')).toHaveCount(1)
})
