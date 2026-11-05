import type { APIRequestContext, Page } from '@playwright/test'
import { BASE_URL } from '../env'
import { createUser, signIn } from '../lib/api'
import { expect, test } from '../lib/test'

const callMcp = (request: APIRequestContext, apiKey: string) =>
  request.post('/mcp', {
    headers: { 'x-api-key': apiKey, accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  })

const openUsers = async (page: Page) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Users' }).click()
  return page.getByRole('dialog', { name: 'Users' })
}

const manage = async (page: Page, name: string, action: string) => {
  await page.getByRole('button', { name: `Manage ${name}` }).click()
  await page.getByRole('menuitem', { name: action }).click()
}

test('the admin promotes, demotes and deletes a user', async ({ browser, page }) => {
  const user = await createUser(page.request)
  const userContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const userPage = await userContext.newPage()
  await signIn(userContext.request, user)
  const created = await userContext.request.post('/api/auth/api-key/create', {
    data: { name: 'agent' },
    headers: { origin: BASE_URL },
  })
  expect(created.ok()).toBe(true)
  const { key: apiKey } = (await created.json()) as { key: string }
  expect((await callMcp(page.request, apiKey)).status()).not.toBe(401)

  const usersDialog = await openUsers(page)
  // The admin can't lock themselves out: their own row has no actions
  await expect(usersDialog.getByText('(you)')).toBeVisible()

  await userPage.goto('/')
  await expect(userPage).toHaveURL('/')

  // A promoted user gets the admin features
  await manage(page, user.name, 'Make admin')
  await expect(page.getByText('User is now an admin')).toBeVisible()
  await userPage.reload()
  await userPage.getByRole('button', { name: 'Account menu' }).click()
  await expect(userPage.getByRole('menuitem', { name: 'Users' })).toBeVisible()
  await userPage.keyboard.press('Escape')

  await manage(page, user.name, 'Remove admin rights')
  await expect(page.getByText('Admin rights removed')).toBeVisible()
  await userPage.reload()
  await userPage.getByRole('button', { name: 'Account menu' }).click()
  await expect(userPage.getByRole('menuitem', { name: 'Profile' })).toBeVisible()
  await expect(userPage.getByRole('menuitem', { name: 'Users' })).toHaveCount(0)
  await userPage.keyboard.press('Escape')

  // Deleting removes the account and its API keys for good
  await manage(page, user.name, 'Delete')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('User deleted')).toBeVisible()
  await expect(usersDialog.getByText(user.email)).toHaveCount(0)
  expect((await callMcp(page.request, apiKey)).status()).toBe(401)
  await userPage.reload()
  await expect(userPage).toHaveURL(/\/login/)

  await userContext.close()
})
