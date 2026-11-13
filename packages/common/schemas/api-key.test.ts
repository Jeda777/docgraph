import { describe, expect, it } from 'vitest'
import {
  API_KEY_MAX_EXPIRATION_DAYS,
  apiKeyCreateInputSchema,
  apiKeyDateInDays,
  apiKeyExpiresIn,
} from './api-key'

const input = (expiresOn: string) => ({
  name: 'agent',
  expiresOn,
  restrictions: { readOnly: false, projects: null },
})

const errorOf = (expiresOn: string) =>
  apiKeyCreateInputSchema.safeParse(input(expiresOn)).error?.issues[0]?.message

describe('apiKeyCreateInputSchema expiresOn', () => {
  it('accepts no date and dates from tomorrow to the maximum', () => {
    expect(errorOf('')).toBeUndefined()
    expect(errorOf(apiKeyDateInDays(1))).toBeUndefined()
    expect(errorOf(apiKeyDateInDays(API_KEY_MAX_EXPIRATION_DAYS))).toBeUndefined()
  })

  it('rejects today, later than the maximum and invalid dates', () => {
    expect(errorOf(apiKeyDateInDays(0))).toBe('Choose a date after today')
    expect(errorOf(apiKeyDateInDays(API_KEY_MAX_EXPIRATION_DAYS + 1))).toMatch(/at most/)
    expect(errorOf('2026-13-01')).toBe('Enter a valid date')
  })
})

describe('apiKeyExpiresIn', () => {
  it('counts seconds until the end of the chosen local day', () => {
    const now = new Date(2026, 0, 1, 12, 0, 0)

    expect(apiKeyExpiresIn('2026-01-02', now)).toBe(36 * 60 * 60)
    expect(apiKeyExpiresIn('', now)).toBeUndefined()
  })
})
