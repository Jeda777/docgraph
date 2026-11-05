import { type BrowserContext, test as base, expect } from '@playwright/test'

export { expect }

/** Chromium reports blocked loads, connections and scripts as console errors naming the CSP. */
const isCspViolation = (text: string) => text.includes('Content Security Policy')

/**
 * Playwright's `test`, failing every test whose pages broke the server's Content-Security-Policy.
 * A blocked request often fails quietly (e.g. an image export that never downloads), so the
 * console is the only place it shows up. Also watches contexts opened with `browser.newContext`.
 */
export const test = base.extend<{ failOnCspViolations: undefined }>({
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
})
