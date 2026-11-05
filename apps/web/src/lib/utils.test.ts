import { describe, expect, it } from 'vitest'
import { compareNames, formatRelativeDate, getUserInitials, parseRouteId } from './utils'

describe('getUserInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getUserInitials('jane doe')).toBe('JD')
  })

  it('falls back to the second letter for single-word names', () => {
    expect(getUserInitials('jane')).toBe('JA')
  })

  it('uppercases the result', () => {
    expect(getUserInitials('x y')).toBe('XY')
  })
})

describe('parseRouteId', () => {
  it('accepts ULIDs', () => {
    expect(parseRouteId('01M5S4ZH32Z5GYGA9088FH7WC7')).toBe('01M5S4ZH32Z5GYGA9088FH7WC7')
  })

  it.each([undefined, '', 'abc', '42', '01M5S4ZH32Z5GYGA9088FH7WC'])('rejects %j', (value) => {
    expect(parseRouteId(value)).toBeNull()
  })
})

describe('compareNames', () => {
  const sorted = (names: string[]) => [...names].sort(compareNames)

  it('ignores case', () => {
    expect(sorted(['Zeta', 'alpha', 'Beta'])).toEqual(['alpha', 'Beta', 'Zeta'])
  })

  it('orders numbers by value', () => {
    expect(sorted(['Project 10', 'Project 2', 'Project 1'])).toEqual([
      'Project 1',
      'Project 2',
      'Project 10',
    ])
  })
})

describe('formatRelativeDate', () => {
  const now = new Date('2026-10-30T12:00:00.000Z')

  it('calls the last minute "just now"', () => {
    expect(formatRelativeDate('2026-10-30T11:59:30.000Z', now)).toBe('just now')
  })

  it('picks the largest unit that fits', () => {
    expect(formatRelativeDate('2026-10-30T09:00:00.000Z', now)).toMatch(/3 hours ago/)
    expect(formatRelativeDate('2026-10-27T12:00:00.000Z', now)).toMatch(/3 days ago/)
    expect(formatRelativeDate('2026-08-30T12:00:00.000Z', now)).toMatch(/2 months ago/)
  })

  it('never shows twelve months', () => {
    expect(formatRelativeDate('2025-11-04T12:00:00.000Z', now)).toBe('11 months ago')
    expect(formatRelativeDate('2025-10-30T12:00:00.000Z', now)).toBe('last year')
  })

  it('describes future dates too', () => {
    expect(formatRelativeDate('2026-11-02T12:00:00.000Z', now)).toBe('in 3 days')
    expect(formatRelativeDate('2026-10-31T12:00:00.000Z', now)).toBe('tomorrow')
  })

  it('never rounds up to the size of the next unit', () => {
    expect(formatRelativeDate('2026-10-30T11:00:24.000Z', now)).toBe('59 minutes ago')
  })
})
