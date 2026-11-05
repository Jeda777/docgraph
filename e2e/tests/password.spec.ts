import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STORAGE_STATE } from '../env'
import { inviteUser, TEST_PASSWORD } from '../lib/api'
import { waitForOtpCode } from '../lib/mailpit'
import { expect, test } from '../lib/test'

test.describe('password login and reset', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('signs in with a password, rejects a wrong one and signs out', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password', { exact: true }).fill(`${ADMIN_PASSWORD}-wrong`)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByText('Invalid email or password. Please try again.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()

    await page.getByRole('button', { name: 'Account menu' }).click()
    await page.getByRole('menuitem', { name: 'Logout' }).click()
    await expect(page).toHaveURL(/\/login/)

    // The session is gone on the server too, not only in the page
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('sets a new password with a code from the email', async ({ browser, page }) => {
    // An invited account has no password yet; the reset flow is how its owner sets one
    const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    const user = await inviteUser(adminContext.request)
    await adminContext.close()

    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page).toHaveURL(/\/reset/)
    await expect(page.getByLabel('Email')).toHaveValue(user.email)

    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)

    const sentAt = new Date()
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page.getByText(/Resend available in/)).toBeVisible()
    const code = await waitForOtpCode(user.email, sentAt)

    await page.getByLabel('Verification code').fill(code)
    await page.getByRole('button', { name: 'Reset', exact: true }).click()

    // Back on the login page with the address filled in
    await expect(page).toHaveURL('/login')
    await expect(page.getByLabel('Email')).toHaveValue(user.email)

    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page).toHaveURL('/')
    // A regular user may not create projects
    await expect(page.getByRole('textbox', { name: 'Search by name' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Project' })).toHaveCount(0)
  })
})
