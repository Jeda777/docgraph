import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Page } from '@playwright/test'
import { BASE_URL } from '../env'
import { createItem, createProject, uniqueName } from '../lib/api'
import { canvasTable, waitForEditor } from '../lib/canvas'
import { expect, test } from '../lib/test'

type TextContent = { type: 'text'; text: string }

/** Connects the official MCP client to `/mcp`, the way Claude Code or Cursor would. */
const connectMcp = async (apiKey: string) => {
  const client = new Client({ name: 'docgraph-e2e', version: '0.0.1' })
  const transport = new StreamableHTTPClientTransport(new URL('/mcp', BASE_URL), {
    requestInit: { headers: { 'x-api-key': apiKey } },
  })
  await client.connect(transport)
  return client
}

/** Calls a tool and parses the JSON text every DocGraph tool answers with. */
const callTool = async <T>(client: Client, name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args })
  const [content] = result.content as (TextContent | undefined)[]
  expect(result.isError, content?.text).toBeFalsy()
  expect(content?.text, `${name} answered without text content`).toEqual(expect.any(String))
  return JSON.parse(content?.text ?? '') as T
}

const openProfile = async (page: Page) => {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Profile' }).click()
  return page.getByRole('dialog', { name: 'Profile' })
}

test('an API key created in the app lets an MCP client read and edit diagrams', async ({
  page,
}) => {
  const keyName = uniqueName('Agent key')
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')

  await page.goto('/')
  let profile = await openProfile(page)
  await profile.getByPlaceholder('Key name, e.g. laptop').fill(keyName)
  await profile.getByRole('button', { name: 'Create API key' }).click()
  await expect(profile.getByText('Copy the API key now')).toBeVisible()

  // The plain key is shown once, together with a ready-made Claude Code command
  const apiKey = (await profile.locator('code').filter({ hasText: /^dg_/ }).textContent()) ?? ''
  expect(apiKey).toMatch(/^dg_\S+$/)
  await expect(profile.locator('code').filter({ hasText: 'claude mcp add' })).toContainText(
    `--transport http docgraph ${BASE_URL}/mcp --header "x-api-key: ${apiKey}"`,
  )
  await profile.getByRole('button', { name: 'Done' }).click()
  await expect(profile.getByText(keyName)).toBeVisible()
  await expect(profile.getByText('Last used never')).toBeVisible()
  await page.keyboard.press('Escape')

  const client = await connectMcp(apiKey)
  try {
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'list_projects',
        'list_items',
        'get_database_schema',
        'update_database_schema',
        'get_diagram',
        'get_document',
      ]),
    )

    const projects = await callTool<{ id: string; name: string }[]>(client, 'list_projects')
    expect(projects).toContainEqual(expect.objectContaining({ id: project.id, name: project.name }))
    const items = await callTool<{ id: string; type: string }[]>(client, 'list_items', {
      projectId: project.id,
    })
    expect(items).toEqual([expect.objectContaining({ id: item.id, type: 'DATABASE_DIAGRAM' })])

    // Code -> diagram: an agent writes a schema into the diagram
    await callTool(client, 'update_database_schema', {
      itemId: item.id,
      mode: 'replace',
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'email', type: 'varchar(255)', unique: true },
          ],
        },
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'uuid', primaryKey: true },
            { name: 'author_id', type: 'uuid' },
          ],
        },
      ],
      relations: [
        { from: { table: 'users', column: 'id' }, to: { table: 'posts', column: 'author_id' } },
      ],
    })

    // ...and the user sees it in the editor, laid out and connected
    await page.goto(`/item/${item.id}`)
    await waitForEditor(page)
    await expect(canvasTable(page, 'users')).toContainText('email: varchar(255)')
    await expect(canvasTable(page, 'posts')).toContainText('author_id: uuid')
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)

    // Diagram -> code: the agent reads back what is in the diagram
    const schema = await callTool<{
      tables: { name: string; columns: { name: string; foreignKey?: boolean }[] }[]
      relations: unknown[]
    }>(client, 'get_database_schema', { itemId: item.id })
    expect(schema.tables.map((table) => table.name).sort()).toEqual(['posts', 'users'])
    expect(schema.relations).toHaveLength(1)
  } finally {
    await client.close()
  }

  await page.goto('/')
  profile = await openProfile(page)
  await expect(profile.getByText(keyName)).toBeVisible()
  await expect(profile.getByText('Last used never')).toHaveCount(0)

  // A revoked key stops working right away
  await profile.getByRole('button', { name: `Revoke ${keyName}` }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('API key revoked')).toBeVisible()
  await expect(profile.getByText(keyName)).toHaveCount(0)

  const rejected = await page.request.post('/mcp', {
    headers: { 'x-api-key': apiKey, accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  })
  expect(rejected.status()).toBe(401)
})
