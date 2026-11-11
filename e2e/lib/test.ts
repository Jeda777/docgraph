import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { type BrowserContext, test as base, expect, type Page } from '@playwright/test'
import { createApiKey, createUser, revokeApiKey, signIn } from './api'
import { connectMcp } from './mcp'

export { expect }

/** Chromium reports blocked loads, connections and scripts as console errors naming the CSP. */
const isCspViolation = (text: string) => text.includes('Content Security Policy')

/**
 * Playwright's `test`, failing every test whose pages broke the server's Content-Security-Policy.
 * A blocked request often fails quietly (e.g. an image export that never downloads), so the
 * console is the only place it shows up. Also watches contexts opened with `browser.newContext`.
 */
export const test = base.extend<{
  failOnCspViolations: undefined
  collaborator: Page
  agent: Client
}>({
  failOnCspViolations: [
    async ({ context, browser }, use) => {
      const violations: string[] = []
      const watch = (watched: BrowserContext) =>
        watched.on('console', (message) => {
          if (message.type() === 'error' && isCspViolation(message.text())) {
            violations.push(message.text())
          }
        })

      watch(context)
      // `browser` is shared by the worker, while this fixture is per test. Patching it is safe
      // only because a worker runs its tests one at a time and `finally` restores the original.
      const newContext = browser.newContext.bind(browser)
      browser.newContext = async (options) => {
        const created = await newContext(options)
        watch(created)
        return created
      }

      try {
        await use(undefined)
      } finally {
        browser.newContext = newContext
      }
      expect(violations, 'Content Security Policy violations').toEqual([])
    },
    { auto: true },
  ],
  /**
   * A page of a second, regular user with their own session and browser context, so they join
   * an item as a separate participant. The user is created on first use, which takes a moment.
   */
  collaborator: async ({ browser, page, failOnCspViolations }, use) => {
    void failOnCspViolations // set up first, so it watches the new context too
    const user = await createUser(page.request)
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    await signIn(context.request, user)
    await use(await context.newPage())
    await context.close()
  },
  /**
   * An MCP client connected with a new API key of the user behind `page`. The key is revoked
   * after the test, even when it failed, so keys don't pile up in that user's Profile.
   */
  agent: async ({ page }, use) => {
    const { id, key } = await createApiKey(page.request)
    try {
      const client = await connectMcp(key)
      try {
        await use(client)
      } finally {
        await client.close()
      }
    } finally {
      await revokeApiKey(page.request, id)
    }
  },
})
