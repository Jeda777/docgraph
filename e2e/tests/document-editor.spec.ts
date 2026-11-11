import type { Page } from '@playwright/test'
import { createItem, createProject } from '../lib/api'
import { waitForEditor } from '../lib/canvas'
import { expect, test } from '../lib/test'

const openDocument = async (page: Page) => {
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'DOCUMENT')
  await page.goto(`/item/${item.id}`)
  await waitForEditor(page)
  const editor = page.locator('.ProseMirror[contenteditable="true"]')
  await expect(editor).toBeVisible()
  return editor
}

const toolbarButton = (page: Page, name: string) =>
  page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name, exact: true })

const reloadDocument = async (page: Page) => {
  await page.reload()
  await waitForEditor(page)
}

test('formats text from the toolbar', async ({ page }) => {
  const editor = await openDocument(page)

  // Each line gets one format: select it, click its button, the button shows the format as active
  const formats = [
    {
      text: 'Quarterly report',
      button: 'Heading 1',
      element: editor.getByRole('heading', { level: 1 }),
    },
    { text: 'Revenue', button: 'Heading 3', element: editor.getByRole('heading', { level: 3 }) },
    { text: 'Bold line', button: 'Bold', element: editor.locator('strong') },
    { text: 'Italic line', button: 'Italic', element: editor.locator('em') },
    { text: 'Underlined line', button: 'Underline', element: editor.locator('u') },
    { text: 'Struck line', button: 'Strikethrough', element: editor.locator('s') },
    { text: 'Code line', button: 'Inline code', element: editor.locator('p > code') },
    { text: 'Bullet line', button: 'Bullet list', element: editor.locator('ul > li') },
    { text: 'Ordered line', button: 'Ordered list', element: editor.locator('ol > li') },
    { text: 'Quoted line', button: 'Blockquote', element: editor.locator('blockquote') },
    { text: 'Snippet line', button: 'Code block', element: editor.locator('pre') },
  ]
  await editor.click()
  await page.keyboard.type(formats.map(({ text }) => text).join('\n'))
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+Home')

  for (const { text, button, element } of formats) {
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await toolbarButton(page, button).click()
    await expect(element).toHaveText(text)
    await expect(toolbarButton(page, button)).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('ArrowDown')
  }

  // The cursor ends on the empty last line, which the rule replaces
  await toolbarButton(page, 'Horizontal rule').click()
  await expect(editor.locator('hr')).toHaveCount(1)

  // Back on the heading, the paragraph button is off; clicking it turns the heading into text
  await editor.getByRole('heading', { level: 3 }).click()
  await expect(toolbarButton(page, 'Heading 3')).toHaveAttribute('aria-pressed', 'true')
  await expect(toolbarButton(page, 'Paragraph')).toHaveAttribute('aria-pressed', 'false')
  await toolbarButton(page, 'Paragraph').click()
  await expect(editor.getByRole('heading', { level: 3 })).toHaveCount(0)
  await expect(editor.locator('p', { hasText: 'Revenue' })).toBeVisible()

  // Clicking an active mark removes it again
  await editor.locator('strong').click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  await toolbarButton(page, 'Bold').click()
  await expect(editor.locator('strong')).toHaveCount(0)
  await expect(toolbarButton(page, 'Bold')).toHaveAttribute('aria-pressed', 'false')

  await reloadDocument(page)
  await expect(editor.getByRole('heading', { level: 3 })).toHaveCount(0)
  await expect(editor.locator('p', { hasText: 'Revenue' })).toBeVisible()
  await expect(editor.locator('strong')).toHaveCount(0)
  await expect(editor.locator('p', { hasText: 'Bold line' })).toBeVisible()
  // Heading 3 and Bold were turned off above; every other format came back from the server
  const removed = ['Heading 3', 'Bold']
  for (const { text, button, element } of formats) {
    if (!removed.includes(button)) await expect(element).toHaveText(text)
  }
  await expect(editor.locator('hr')).toHaveCount(1)
})

test('inserts blocks from the slash menu', async ({ page }) => {
  const editor = await openDocument(page)
  const menu = page.getByRole('listbox', { name: 'Slash commands' })
  const options = menu.getByRole('option')

  await editor.click()
  await page.keyboard.type('/')
  await expect(options).toHaveCount(9)

  // Typing filters by title; the arrow keys move the highlight and Enter picks it
  await page.keyboard.type('head')
  await expect(options).toHaveCount(3)
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Enter')
  await expect(menu).toBeHidden()
  await page.keyboard.type('Roadmap')
  await expect(editor.getByRole('heading', { level: 2 })).toHaveText('Roadmap')
  await expect(editor).not.toContainText('/head')

  // Keywords match too: `ol` finds the numbered list
  await page.keyboard.press('Enter')
  await page.keyboard.type('/ol')
  await expect(options).toHaveText([/^Numbered list/])
  await page.keyboard.press('Enter')
  await page.keyboard.type('Plan the release')
  await expect(editor.locator('ol > li')).toHaveText('Plan the release')

  // Leave the list with a second Enter, then pick the divider with the mouse
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/div')
  await options.filter({ hasText: 'Divider' }).click()
  await expect(editor.locator('hr')).toHaveCount(1)

  // No match shows an empty state, and Escape closes the menu leaving the text as typed
  await page.keyboard.type('/zzz')
  await expect(menu).toContainText('No results')
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(editor.locator('p', { hasText: '/zzz' })).toBeVisible()

  await reloadDocument(page)
  await expect(editor.getByRole('heading', { level: 2 })).toHaveText('Roadmap')
  await expect(editor.locator('ol > li')).toHaveText('Plan the release')
  await expect(editor.locator('hr')).toHaveCount(1)
  await expect(editor.locator('p', { hasText: '/zzz' })).toBeVisible()
})

test('applies Markdown and keyboard shortcuts while typing', async ({ page }) => {
  const editor = await openDocument(page)

  await editor.click()
  await page.keyboard.type('# Meeting notes\n')
  await page.keyboard.type('Decisions are **final** for now\n')
  await page.keyboard.press('ControlOrMeta+i')
  await page.keyboard.type('tentative')
  await page.keyboard.press('ControlOrMeta+i')
  await page.keyboard.type(' items follow\n')
  await page.keyboard.type('- First item')

  await expect(editor.getByRole('heading', { level: 1 })).toHaveText('Meeting notes')
  await expect(editor.locator('strong')).toHaveText('final')
  await expect(editor).not.toContainText('**')
  await expect(editor.locator('em')).toHaveText('tentative')
  await expect(editor.locator('ul > li')).toHaveText('First item')
})

test('undoes and redoes edits from the toolbar', async ({ page }) => {
  const editor = await openDocument(page)
  const undo = toolbarButton(page, 'Undo')
  const redo = toolbarButton(page, 'Redo')
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()

  // `fill` inserts the text in one step, so a single undo takes all of it back
  await editor.fill('A sentence to take back')
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(editor).not.toContainText('A sentence to take back')
  await expect(undo).toBeDisabled()

  await redo.click()
  await expect(editor).toContainText('A sentence to take back')
  await expect(redo).toBeDisabled()

  await reloadDocument(page)
  await expect(editor).toContainText('A sentence to take back')
})
