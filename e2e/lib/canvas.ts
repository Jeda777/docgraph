import type { Page } from '@playwright/test'

/**
 * A node on the React Flow canvas of a flowchart or business process. Nodes are named `<shape>`
 * when empty and `<shape>: <text>` once they have text; the palette buttons on the sidebar carry
 * the bare shape name too, so the lookup is scoped to the canvas.
 */
export const canvasNode = (page: Page, name: string) =>
  page.locator('.react-flow__node').getByRole('button', { name, exact: true })

/** A table of a database diagram on the canvas, found by its name in the header. */
export const canvasTable = (page: Page, name: string) =>
  page
    .locator('.react-flow__node')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })

/** Clicks a shape in the sidebar palette, which drops a node in the middle of the viewport. */
export const addFromPalette = (page: Page, shape: string) =>
  page.getByRole('complementary').getByRole('button', { name: shape, exact: true }).click()

/** Edits a node's text the way a user does: double-click, type, Ctrl+Enter to commit. */
export const editNodeText = async (page: Page, nodeName: string, text: string) => {
  await canvasNode(page, nodeName).dblclick()
  const editor = page.locator('.react-flow__node').getByRole('textbox', { name: nodeName })
  await editor.fill(text)
  await editor.press('Control+Enter')
}

/** Waits until the editor of an item is connected and rendered. */
export const waitForEditor = async (page: Page) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).waitFor()
}

/**
 * The React Flow wrapper of a canvas node, with the node's full size and position. Pools and
 * lanes are not nested in the DOM, so the frame of a pool holds only the pool itself.
 */
export const canvasNodeFrame = (page: Page, name: string) =>
  page.locator('.react-flow__node').filter({ has: page.getByRole('button', { name, exact: true }) })

/**
 * Fits the whole diagram into the viewport, as a user does to find nodes added elsewhere. The
 * canvas renders only the nodes in view, so nodes a peer or an agent added off-screen are not
 * on the page until then.
 */
export const fitView = (page: Page) => page.getByRole('button', { name: 'Fit View' }).click()
