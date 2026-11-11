import type { Page } from '@playwright/test'
import { createItem, createProject } from '../../lib/api'
import { canvasTable, fitView, openItem, waitForEditor } from '../../lib/canvas'
import { callTool } from '../../lib/mcp'
import { expect, test } from '../../lib/test'

type DatabaseSchema = {
  tables: { name: string; description?: string; columns: { name: string; type: string }[] }[]
  relations: unknown[]
}

const relationsTab = async (page: Page) => {
  const sidebar = page.getByRole('complementary')
  await sidebar.getByRole('tab', { name: 'Relations' }).click()
  return sidebar
}

// The admin and a second user, each with their own session and connection, edit one item.
// Every step waits until the other user sees it, so the order of edits is the one written here.
test.describe('two users editing a database diagram', () => {
  test('edit the same table and both see every change', async ({ page: admin, collaborator }) => {
    const project = await createProject(admin.request)
    const item = await createItem(admin.request, project.id, 'DATABASE_DIAGRAM')
    await Promise.all([openItem(admin, item.id), openItem(collaborator, item.id)])
    const adminSidebar = admin.getByRole('complementary')
    const collaboratorSidebar = collaborator.getByRole('complementary')

    await adminSidebar.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(canvasTable(collaborator, 'new_table')).toContainText('id: int')

    await collaboratorSidebar.getByLabel('Table name').fill('orders')
    await expect(canvasTable(admin, 'orders')).toBeVisible()
    await expect(adminSidebar.getByLabel('Table name')).toHaveValue('orders')

    await adminSidebar.getByRole('button', { name: 'Add column' }).click()
    await adminSidebar.getByLabel('Column name').nth(1).fill('total')
    await adminSidebar.getByLabel('Column type').nth(1).fill('decimal(10,2)')
    await adminSidebar.getByLabel('Column type').nth(1).press('Escape')
    await expect(canvasTable(collaborator, 'orders')).toContainText('total: decimal(10,2)')

    // The second user renames the column the admin just added, and describes the table
    await collaboratorSidebar.getByLabel('Column name').nth(1).fill('amount')
    await collaboratorSidebar.getByPlaceholder('Description').fill('Placed orders')
    await expect(canvasTable(admin, 'orders')).toContainText('amount: decimal(10,2)')
    await expect(canvasTable(admin, 'orders')).toContainText('Placed orders')
    await expect(adminSidebar.getByLabel('Column name').nth(1)).toHaveValue('amount')

    // Both editors ended up with the same table, and so did the server
    for (const user of [admin, collaborator]) {
      await user.reload()
      await waitForEditor(user)
      const orders = canvasTable(user, 'orders')
      await expect(orders).toContainText('id: int')
      await expect(orders).toContainText('amount: decimal(10,2)')
      await expect(orders).toContainText('Placed orders')
      await expect(orders).not.toContainText('total')
      await expect(user.locator('.react-flow__node')).toHaveCount(1)
    }
  })

  test('a relation deleted while the other user edits it stays deleted', async ({
    page: admin,
    collaborator,
    agent,
  }) => {
    const project = await createProject(admin.request)
    const item = await createItem(admin.request, project.id, 'DATABASE_DIAGRAM')
    await callTool(agent, 'update_database_schema', {
      itemId: item.id,
      mode: 'replace',
      tables: [
        { name: 'users', columns: [{ name: 'id', type: 'uuid', primaryKey: true }] },
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

    await Promise.all([openItem(admin, item.id), openItem(collaborator, item.id)])
    const adminRelations = await relationsTab(admin)
    const collaboratorRelations = await relationsTab(collaborator)
    await expect(admin.locator('.react-flow__edge')).toHaveCount(1)

    // The second user edits the relation, and the admin sees the edit
    await collaboratorRelations.getByRole('checkbox', { name: 'Nullable' }).click()
    await expect(adminRelations.getByRole('checkbox', { name: 'Nullable' })).toBeChecked()

    // ...and still has its card open, with a select open, when the admin deletes it
    await collaboratorRelations.getByLabel('On delete').click()
    await expect(collaborator.getByRole('listbox')).toBeVisible()
    await adminRelations.getByRole('button', { name: 'Delete relation' }).click()

    const emptyHint = 'Drag between columns to create a relation.'
    for (const user of [admin, collaborator]) {
      await expect(user.locator('.react-flow__edge')).toHaveCount(0)
      await expect(user.getByRole('complementary').getByText(emptyHint)).toBeVisible()
    }
    await expect(collaborator.getByRole('listbox')).toHaveCount(0)

    // The open card did not bring the relation back, and the tables are untouched. An edit not
    // written yet when the delete arrives is covered by the `useYjsCollection` unit tests.
    for (const user of [admin, collaborator]) {
      await user.reload()
      await waitForEditor(user)
      await expect(canvasTable(user, 'posts')).toContainText('author_id: uuid')
      await expect(canvasTable(user, 'users')).toBeVisible()
      await expect(user.locator('.react-flow__edge')).toHaveCount(0)
    }
  })
})

test('an MCP agent changes a database diagram while it is open in the editor', async ({
  page,
  agent,
}) => {
  const project = await createProject(page.request)
  const item = await createItem(page.request, project.id, 'DATABASE_DIAGRAM')
  await callTool(agent, 'update_database_schema', {
    itemId: item.id,
    mode: 'replace',
    tables: [{ name: 'users', columns: [{ name: 'id', type: 'uuid', primaryKey: true }] }],
  })
  await openItem(page, item.id)
  await expect(canvasTable(page, 'users')).toContainText('id: uuid')

  // The user describes the table; the agent reads the description from the server
  await page.getByRole('complementary').getByPlaceholder('Description').fill('Registered accounts')
  await expect
    .poll(async () => {
      const schema = await callTool<DatabaseSchema>(agent, 'get_database_schema', {
        itemId: item.id,
      })
      return schema.tables.find((table) => table.name === 'users')?.description
    })
    .toBe('Registered accounts')

  // The agent redefines that table and adds another one, while the editor stays open
  await callTool(agent, 'update_database_schema', {
    itemId: item.id,
    mode: 'merge',
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

  // The editor shows it without a reload, and keeps the user's description. The first check
  // waits for the update; the new table may be off-screen until the view is fitted.
  await expect(canvasTable(page, 'users')).toContainText('email: varchar(255)')
  await fitView(page)
  await expect(canvasTable(page, 'users')).toContainText('email: varchar(255)')
  await expect(canvasTable(page, 'users')).toContainText('Registered accounts')
  await expect(canvasTable(page, 'posts')).toContainText('author_id: uuid')
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)

  // An edit made in the editor afterwards reaches the agent too
  const postsName = page.getByRole('complementary').getByLabel('Table name').nth(1)
  await expect(postsName).toHaveValue('posts')
  await postsName.fill('articles')
  await expect(canvasTable(page, 'articles')).toBeVisible()
  await expect
    .poll(async () => {
      const schema = await callTool<DatabaseSchema>(agent, 'get_database_schema', {
        itemId: item.id,
      })
      return schema.tables.map((table) => table.name).sort()
    })
    .toEqual(['articles', 'users'])
})
