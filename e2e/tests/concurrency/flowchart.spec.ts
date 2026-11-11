import { createItem, createProject } from '../../lib/api'
import { canvasNode, editNodeText, fitView, openItem, waitForEditor } from '../../lib/canvas'
import { callTool, type DiagramGraph } from '../../lib/mcp'
import { expect, test } from '../../lib/test'

test('an MCP agent changes a flowchart while a user edits it', async ({ page, agent }) => {
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'FLOWCHART')
  await callTool(agent, 'update_diagram', {
    itemId: item.id,
    mode: 'replace',
    nodes: [{ id: 'receive', type: 'process', text: 'Receive order' }],
  })
  await openItem(page, item.id)
  await editNodeText(page, 'Process: Receive order', 'Receive online order')
  await expect(canvasNode(page, 'Process: Receive online order')).toBeVisible()

  // The agent adds the next steps and connects them, without touching the user's node
  await callTool(agent, 'update_diagram', {
    itemId: item.id,
    mode: 'merge',
    nodes: [
      { id: 'in-stock', type: 'decision', text: 'In stock?' },
      { id: 'restock', type: 'process', text: 'Restock' },
    ],
    edges: [
      { source: 'receive', target: 'in-stock' },
      { source: 'in-stock', target: 'restock', text: 'no' },
    ],
  })
  // Fit the view until the new nodes arrive: they land outside the zoomed-in viewport
  await expect(async () => {
    await fitView(page)
    await expect(canvasNode(page, 'Decision: In stock?')).toBeVisible({ timeout: 1000 })
  }).toPass()
  await expect(canvasNode(page, 'Process: Restock')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  await expect(canvasNode(page, 'Process: Receive online order')).toBeVisible()

  // The agent removes a node the user has selected; it disappears with its edge
  await canvasNode(page, 'Process: Restock').click()
  await callTool(agent, 'update_diagram', {
    itemId: item.id,
    mode: 'merge',
    removeNodeIds: ['restock'],
  })
  await expect(canvasNode(page, 'Process: Restock')).toHaveCount(0)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)

  const graph = await callTool<DiagramGraph>(agent, 'get_diagram', { itemId: item.id })
  expect(graph.nodes.map((node) => node.text).sort()).toEqual(['In stock?', 'Receive online order'])
  expect(graph.edges).toHaveLength(1)

  await page.reload()
  await waitForEditor(page)
  await expect(canvasNode(page, 'Process: Receive online order')).toBeVisible()
  await expect(canvasNode(page, 'Decision: In stock?')).toBeVisible()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})
