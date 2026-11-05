import { BASE_URL } from '../env'
import { createProject, uniqueEmail, uniqueName } from '../lib/api'
import { waitForInvitationLink, waitForOtpCode } from '../lib/mailpit'
import { expect, test } from '../lib/test'

test('an invited user signs in through the link in the invitation email', async ({
  browser,
  page,
}) => {
  const name = uniqueName('Invited')
  const email = uniqueEmail('invited')
  const project = await createProject(page.request)

  await page.goto('/')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Users' }).click()
  const usersDialog = page.getByRole('dialog', { name: 'Users' })
  await usersDialog.getByLabel('Name').fill(name)
  await usersDialog.getByLabel('Email').fill(email)

  const invitedAt = new Date()
  await usersDialog.getByRole('button', { name: 'Invite User' }).click()
  await expect(page.getByText('User invited')).toBeVisible()
  await expect(usersDialog.getByText(email)).toBeVisible()

  // A second invite to the same address is refused on the field (the form clears after a success)
  await expect(usersDialog.getByLabel('Email')).toHaveValue('')
  await usersDialog.getByLabel('Name').fill(name)
  await usersDialog.getByLabel('Email').fill(email)
  await usersDialog.getByRole('button', { name: 'Invite User' }).click()
  await expect(usersDialog.getByText(/User already exists/)).toBeVisible()

  const link = await waitForInvitationLink(email, invitedAt)
  expect(link.startsWith(`${BASE_URL}/login-otp?`)).toBe(true)

  // The invited user has no password: the link opens the email code login for their address
  const invitedContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const invited = await invitedContext.newPage()
  await invited.goto(link)
  await expect(invited.getByRole('heading', { name: 'Log in with a code' })).toBeVisible()
  await expect(invited.getByLabel('Email')).toHaveValue(email)

  const sentAt = new Date()
  await invited.getByRole('button', { name: 'Send code' }).click()
  await expect(invited.getByText(/Resend available in/)).toBeVisible()
  const code = await waitForOtpCode(email, sentAt)
  await invited.getByLabel('Verification code').fill(code)
  await invited.getByRole('button', { name: 'Log in', exact: true }).click()

  await expect(invited).toHaveURL('/')
  await expect(invited.getByRole('main').getByRole('link', { name: project.name })).toBeVisible()

  // A regular user: no project creation and no user management
  await expect(invited.getByRole('button', { name: 'New Project' })).toHaveCount(0)
  await invited.getByRole('button', { name: 'Account menu' }).click()
  await expect(invited.getByRole('menuitem', { name: 'Profile' })).toBeVisible()
  await expect(invited.getByRole('menuitem', { name: 'Users' })).toHaveCount(0)

  await invitedContext.close()
})
