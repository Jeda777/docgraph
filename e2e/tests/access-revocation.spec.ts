import { createItem, createProject, createUser, signIn } from '../lib/api'
import { addFromPalette, canvasNode, editNodeText, waitForEditor } from '../lib/canvas'
import { expect, test } from '../lib/test'

// Removing a member must cut off an editor they already have open: the server closes its
// connection, the reconnect fails authentication, and the app takes them out of the editor.
test('removing a member takes them out of their open editor', async ({
  browser,
  context,
  page,
}) => {
  const member = await createUser(page.request)
  const project = await createProject(page.request, {
    isForAllUsers: false,
    memberIds: [member.id],
  })
  const item = await createItem(page.request, project.id, 'FLOWCHART')

  const memberContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  await signIn(memberContext.request, member)
  const memberEditor = await memberContext.newPage()
  const adminEditor = await context.newPage()
  await Promise.all([memberEditor.goto(`/item/${item.id}`), adminEditor.goto(`/item/${item.id}`)])
  await Promise.all([waitForEditor(memberEditor), waitForEditor(adminEditor)])

  // Control: while still a member, their edits reach the admin live
  await addFromPalette(memberEditor, 'Process')
  await editNodeText(memberEditor, 'Process', 'Written as a member')
  await expect(canvasNode(adminEditor, 'Process: Written as a member')).toBeVisible()

  // The admin removes them in the project settings, without touching the open editors
  await page.goto('/')
  await page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: project.name })
    .getByLabel('Settings')
    .click()
  const settings = page.getByRole('dialog', { name: 'Project Settings' })
  // Found by data-slot: the vendored combobox chip has no role and its remove button no name
  const memberChip = settings
    .locator('[data-slot="combobox-chip"]')
    .filter({ hasText: member.name })
  await memberChip.getByRole('button').click()
  await expect(memberChip).toHaveCount(0)
  await settings.getByRole('button', { name: 'Save' }).click()
  await expect(settings).toBeHidden()

  // Without a reload, the member is taken out of the editor to the project list and told why
  await expect(memberEditor).toHaveURL('/')
  await expect(
    memberEditor.getByText('This item was deleted or you no longer have access to it.'),
  ).toBeVisible()
  await expect(
    memberEditor.getByRole('main').getByRole('link', { name: project.name }),
  ).toHaveCount(0)

  // The admin is not a member but keeps access, so their editor stays connected and writable
  await addFromPalette(adminEditor, 'Process')
  await expect(canvasNode(adminEditor, 'Process')).toHaveCount(1)
  await adminEditor.reload()
  await waitForEditor(adminEditor)
  await expect(canvasNode(adminEditor, 'Process')).toHaveCount(1)
  await expect(canvasNode(adminEditor, 'Process: Written as a member')).toBeVisible()

  // A deep link to the item sends the member away too
  await memberEditor.goto(`/item/${item.id}`)
  await expect(memberEditor).toHaveURL('/')

  await memberContext.close()
})
