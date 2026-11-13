import { describe, expect, it } from 'vitest'
import { describeApiKeyAccess, describeApiKeyExpiry } from './api-keys.helpers'

const NAMES = new Map([['p1', 'Billing']])

describe('describeApiKeyAccess', () => {
  it('describes unrestricted and read-only keys', () => {
    expect(describeApiKeyAccess({ readOnly: false, projects: null }, NAMES)).toBe(
      'Read and write · All projects',
    )
    expect(describeApiKeyAccess({ readOnly: true, projects: null }, NAMES)).toBe(
      'Read-only · All projects',
    )
  })

  it('names projects and counts selected items', () => {
    const projects = [{ projectId: 'p1', itemIds: ['i1', 'i2'] }, { projectId: 'gone' }]

    expect(describeApiKeyAccess({ readOnly: false, projects }, NAMES)).toBe(
      'Read and write · Billing (2 items), Unavailable project',
    )
  })
})

describe('describeApiKeyExpiry', () => {
  const now = new Date(2026, 5, 1)

  it('tells keys that never expire, will expire and have expired apart', () => {
    expect(describeApiKeyExpiry(null, now)).toBe('Never expires')
    expect(describeApiKeyExpiry(new Date(2026, 6, 1), now)).toMatch(/^Expires /)
    expect(describeApiKeyExpiry(new Date(2026, 4, 1), now)).toMatch(/^Expired /)
  })
})
