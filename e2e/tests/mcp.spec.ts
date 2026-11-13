import type { Locator, Page } from '@playwright/test'
import { BASE_URL } from '../env'
import { createItem, createProject, uniqueName } from '../lib/api'
import { canvasTable, waitForEditor } from '../lib/canvas'
import { callTool, connectMcp } from '../lib/mcp'
import { expect, test } from '../lib/test'

/** `YYYY-MM-DD` of the local day `days` days from today, as a date input takes it. */
const dateInDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
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
  const created = page.getByRole('dialog', { name: 'API key created' })
  await expect(created.getByText('Copy the API key now')).toBeVisible()

  // The plain key is shown once, together with a ready-made Claude Code command
  const apiKey = (await created.locator('code').filter({ hasText: /^dg_/ }).textContent()) ?? ''
  expect(apiKey).toMatch(/^dg_\S+$/)
  await expect(created.locator('code').filter({ hasText: 'claude mcp add' })).toContainText(
    `--transport http docgraph ${BASE_URL}/mcp --header "x-api-key: ${apiKey}"`,
  )
  await created.getByRole('button', { name: 'Done' }).click()
  // Other specs create keys for the same user in parallel, so look at this key's row only
  const keyRow = (dialog: Locator) => dialog.getByRole('listitem').filter({ hasText: keyName })
  await expect(keyRow(profile)).toContainText('Last used never')
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
  await expect(keyRow(profile)).toBeVisible()
  await expect(keyRow(profile)).not.toContainText('Last used never')

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

test('a read-only API key limited to selected items reaches only them', async ({ page }) => {
  const keyName = uniqueName('Scoped key')
  const project = await createProject(page.request)
  const allowed = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')
  const hidden = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')
  const otherProject = await createProject(page.request)

  await page.goto('/')
  const profile = await openProfile(page)
  await profile.getByPlaceholder('Key name, e.g. laptop').fill(keyName)
  await profile.getByLabel('Expires on').fill(dateInDays(30))
  await profile.getByRole('checkbox', { name: /Read-only/ }).click()
  await profile.getByRole('radio', { name: 'Selected projects and items' }).click()
  await profile.getByRole('button', { name: `Show items of ${project.name}` }).click()
  await profile.getByRole('checkbox', { name: allowed.name }).click()
  await profile.getByRole('button', { name: 'Create API key' }).click()

  const created = page.getByRole('dialog', { name: 'API key created' })
  const apiKey = (await created.locator('code').filter({ hasText: /^dg_/ }).textContent()) ?? ''
  await created.getByRole('button', { name: 'Done' }).click()
  const keyRow = profile.getByRole('listitem').filter({ hasText: keyName })
  await expect(keyRow).toContainText(`Read-only · ${project.name} (1 item)`)
  await expect(keyRow).toContainText('Expires ')

  const client = await connectMcp(apiKey)
  try {
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_database_schema',
      'get_diagram',
      'get_document',
      'list_items',
      'list_projects',
    ])

    const projects = await callTool<{ id: string }[]>(client, 'list_projects')
    expect(projects.map(({ id }) => id)).toEqual([project.id])
    expect(projects.map(({ id }) => id)).not.toContain(otherProject.id)
    const items = await callTool<{ id: string }[]>(client, 'list_items', { projectId: project.id })
    expect(items.map(({ id }) => id)).toEqual([allowed.id])

    const read = await client.callTool({
      name: 'get_database_schema',
      arguments: { itemId: hidden.id },
    })
    expect(read.isError).toBe(true)
  } finally {
    await client.close()
  }
})
