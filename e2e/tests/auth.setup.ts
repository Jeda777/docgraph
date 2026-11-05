import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STORAGE_STATE } from '../env'
import { expect, test as setup } from '../lib/test'

// Password login keeps the setup fast and clear of the OTP send limit; the OTP flow itself is
// covered by `otp-login.spec.ts`.
setup('sign in as the seeded admin', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByRole('button', { name: 'New Project' })).toBeVisible()

  await page.context().storageState({ path: ADMIN_STORAGE_STATE })
})
