import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'

/**
 * The menu in the top left corner of every item editor: back, export and import. Diagrams and
 * documents share its labels.
 */
const openMenu = async (page: Page) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
}

/** Picks `format` under Export and returns the downloaded file's name and content. */
export const exportItem = async (page: Page, format: string) => {
  await openMenu(page)
  await page.getByRole('menuitem', { name: 'Export' }).hover()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: format, exact: true }).click(),
  ])
  const path = await download.path()
  return { fileName: download.suggestedFilename(), content: await readFile(path) }
}

/** Imports a file through the menu, the way a user picks it in the file chooser. */
export const importFile = async (page: Page, filePath: string) => {
  await openMenu(page)
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Import' }).click(),
  ])
  await chooser.setFiles(filePath)
}
