import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Page } from '@playwright/test'
import { createItem, createProject } from '../../lib/api'
import {
  addFromPalette,
  canvasNode,
  canvasNodeFrame,
  editNodeText,
  fitView,
  openItem,
  waitForEditor,
} from '../../lib/canvas'
import { callTool, type DiagramGraph } from '../../lib/mcp'
import { expect, test } from '../../lib/test'

/** A pool with two lanes and one activity in each, as an agent would write it. */
const ORDER_PROCESS = [
  { id: 'pool', type: 'participant', text: 'Order handling', data: { participantType: 'pool' } },
  {
    id: 'sales',
    type: 'participant',
    text: 'Sales',
    parentId: 'pool',
    data: { participantType: 'lane' },
  },
  {
    id: 'warehouse',
    type: 'participant',
    text: 'Warehouse',
    parentId: 'pool',
    data: { participantType: 'lane' },
  },
  { id: 'take-order', type: 'activity', text: 'Take order', parentId: 'sales' },
  { id: 'check-stock', type: 'activity', text: 'Check stock', parentId: 'warehouse' },
]

/** Pools and lanes are both named `Participant` on the canvas. */
const participants = (page: Page) =>
  page.locator('.react-flow__node').getByRole('button', { name: /^Participant/ })

/** Checks that the node named `inner` is drawn within the bounds of the node named `outer`. */
const expectInside = async (page: Page, inner: string, outer: string) => {
  const [innerBox, outerBox] = await Promise.all([
    canvasNodeFrame(page, inner).boundingBox(),
    canvasNodeFrame(page, outer).boundingBox(),
  ])
  if (!innerBox || !outerBox) throw new Error(`${inner} or ${outer} is not on the canvas`)
  expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x)
  expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y)
  expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width)
  expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height)
}

const createOrderProcess = async (page: Page, agent: Client) => {
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'BUSINESS_PROCESS')
  await callTool(agent, 'update_diagram', {
    itemId: item.id,
    mode: 'replace',
    nodes: ORDER_PROCESS,
  })
  return item
}

test('a lane added while another user edits an element inside a lane keeps both changes', async ({
  page: admin,
  collaborator,
  agent,
}) => {
  const item = await createOrderProcess(admin, agent)
  await Promise.all([openItem(admin, item.id), openItem(collaborator, item.id)])
  await expect(participants(collaborator)).toHaveCount(3)

  // The second user starts editing the activity in the Warehouse lane...
  await canvasNode(collaborator, 'Activity: Check stock').dblclick()
  const text = collaborator
    .locator('.react-flow__node')
    .getByRole('textbox', { name: 'Activity: Check stock' })
  await expect(text).toBeVisible()

  // ...while the admin adds a lane, which lays out every lane of the pool again
  await addFromPalette(admin, 'Lane')
  await expect(participants(admin)).toHaveCount(4)
  await expect(participants(collaborator)).toHaveCount(4)

  // The edit in progress survives the new layout and reaches the admin
  await text.fill('Check stock levels')
  await text.press('Control+Enter')
  await expect(canvasNode(admin, 'Activity: Check stock levels')).toBeVisible()

  for (const user of [admin, collaborator]) {
    await fitView(user)
    await expectInside(user, 'Activity: Check stock levels', 'Participant: Warehouse')
    await expectInside(user, 'Activity: Take order', 'Participant: Sales')
  }

  // Stored as one consistent diagram: the activity stays in its lane, the new lane in the pool
  const { nodes } = await callTool<DiagramGraph>(agent, 'get_diagram', { itemId: item.id })
  expect(nodes.find((node) => node.id === 'check-stock')).toMatchObject({
    text: 'Check stock levels',
    parentId: 'warehouse',
  })
  expect(nodes.filter((node) => node.parentId === 'pool')).toHaveLength(3)
})

test('an MCP agent changes a business process while a user edits it', async ({ page, agent }) => {
  const item = await createOrderProcess(page, agent)
  await openItem(page, item.id)
  await editNodeText(page, 'Activity: Take order', 'Take phone order')
  await expect(canvasNode(page, 'Activity: Take phone order')).toBeVisible()

  // The agent adds an activity to a lane and renames the other lane, leaving the user's
  // activity out of its update
  await callTool(agent, 'update_diagram', {
    itemId: item.id,
    mode: 'merge',
    nodes: [
      { id: 'ship-order', type: 'activity', text: 'Ship order', parentId: 'warehouse' },
      { id: 'sales', text: 'Customer service' },
    ],
  })

  // The editor shows it live, inside the lane, and the user's edit is still there
  await expect(canvasNode(page, 'Participant: Customer service')).toBeVisible()
  await fitView(page)
  await expect(canvasNode(page, 'Activity: Ship order')).toBeVisible()
  await expectInside(page, 'Activity: Ship order', 'Participant: Warehouse')
  await expect(canvasNode(page, 'Activity: Take phone order')).toBeVisible()

  // The user keeps working on what the agent added
  await editNodeText(page, 'Activity: Ship order', 'Ship order by courier')
  await expect
    .poll(async () => {
      const { nodes } = await callTool<DiagramGraph>(agent, 'get_diagram', { itemId: item.id })
      return nodes.find((node) => node.id === 'ship-order')?.text
    })
    .toBe('Ship order by courier')

  await page.reload()
  await waitForEditor(page)
  await expect(canvasNode(page, 'Activity: Ship order by courier')).toBeVisible()
  await expect(canvasNode(page, 'Activity: Take phone order')).toBeVisible()
  await expect(canvasNode(page, 'Participant: Customer service')).toBeVisible()
})
