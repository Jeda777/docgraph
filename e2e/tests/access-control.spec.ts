import { createItem, createProject, createUser, signIn, updateProject } from '../lib/api'
import { expect, test } from '../lib/test'

// Missing access answers 404, never 403, so outsiders can't even tell a project exists
test('a user outside a project gets 404 for it and its items', async ({ browser, page }) => {
  const outsider = await createUser(page.request)
  const project = await createProject(page.request, { isForAllUsers: false })
  const item = await createItem(page.request, project.id, 'FLOWCHART')

  const outsiderContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  await signIn(outsiderContext.request, outsider)
  const outsiderPage = await outsiderContext.newPage()
  const api = outsiderContext.request

  expect((await api.get(`/api/projects/${project.id}`)).status()).toBe(404)
  expect((await api.get(`/api/items/${item.id}`)).status()).toBe(404)
  const created = await api.post('/api/items', {
    data: { name: 'Sneaked in', type: 'DOCUMENT', projectId: project.id },
  })
  expect(created.status()).toBe(404)
  expect(((await created.json()) as { code: string }).code).toBe('NOT_FOUND')

  const listed = (await (await api.get('/api/projects')).json()) as { id: string }[]
  expect(listed.map(({ id }) => id)).not.toContain(project.id)

  // In the app a deep link leads back to the project list instead of an error page
  await outsiderPage.goto(`/projects/${project.id}`)
  await expect(outsiderPage).toHaveURL('/')
  await expect(outsiderPage.getByRole('textbox', { name: 'Search by name' })).toBeVisible()
  await expect(outsiderPage.getByRole('link', { name: project.name })).toHaveCount(0)

  await outsiderPage.goto(`/item/${item.id}`)
  await expect(outsiderPage).toHaveURL('/')

  // Control: once the admin adds them as a members, the same requests succeed
  await updateProject(page.request, project.id, {
    name: project.name,
    isForAllUsers: false,
    memberIds: [outsider.id],
    isArchived: false,
  })
  expect((await api.get(`/api/projects/${project.id}`)).status()).toBe(200)
  await outsiderPage.goto(`/projects/${project.id}`)
  await expect(outsiderPage.getByRole('heading', { name: project.name })).toBeVisible()
  await expect(outsiderPage.getByRole('link', { name: item.name })).toBeVisible()

  await outsiderContext.close()
})
