import { ADMIN_EMAIL, ADMIN_STORAGE_STATE } from '../env'
import { createProject } from '../lib/api'
import { waitForOtpCode } from '../lib/mailpit'
import { expect, test } from '../lib/test'

test.describe('login with a one-time code', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('signs in with the code from the email and returns to the requested page', async ({
    browser,
    page,
  }) => {
    // A page behind the login, created with the admin session from the setup project
    const adminContext = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    const project = await createProject(adminContext.request)
    await adminContext.close()

    await page.goto(`/projects/${project.id}`)
    await expect(page).toHaveURL(`/login?redirect=${encodeURIComponent(`/projects/${project.id}`)}`)

    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByRole('button', { name: 'Log in with a code' }).click()
    await expect(page.getByRole('heading', { name: 'Log in with a code' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue(ADMIN_EMAIL)

    const sentAt = new Date()
    await page.getByRole('button', { name: 'Send code' }).click()
    await expect(page.getByText(/Resend available in/)).toBeVisible()
    const code = await waitForOtpCode(ADMIN_EMAIL, sentAt)

    // A wrong code is rejected on the field and doesn't burn the valid one
    const wrongCode = code.replace(/\d$/, (digit) => String((Number(digit) + 1) % 10))
    const codeInput = page.getByLabel('Verification code')
    await codeInput.fill(wrongCode)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page.getByText('Invalid or expired verification code')).toBeVisible()

    // The slots input ignores a full replacement, so the wrong code is cleared first
    await codeInput.clear()
    await codeInput.fill(code)
    await expect(codeInput).toHaveValue(code)
    await page.getByRole('button', { name: 'Log in', exact: true }).click()

    await expect(page).toHaveURL(`/projects/${project.id}`)
    await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
  })

  test('does not reveal whether an address has an account', async ({ page }) => {
    await page.goto('/login-otp?email=nobody@e2e.test')
    await page.getByRole('button', { name: 'Send code' }).click()

    // Same answer as for a real account: the form moves on to the resend countdown
    await expect(page.getByText(/Resend available in/)).toBeVisible()
    await expect(page).toHaveURL(/\/login-otp/)
  })
})
