import { idSchema } from '@docgraph/common/schemas'

export { cn } from 'cn'

export const formatDate = (date: Date | string) => {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(date))
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  // An average month, so 360-364 days still read as months short of a year, not "12 months".
  ['month', (365 / 12) * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

/**
 * How long ago (or until) a date is, in the largest fitting unit: "3 days ago", "just now".
 * English like the rest of the UI copy, so it never mixes languages in one sentence.
 */
export const formatRelativeDate = (date: Date | string, now: Date = new Date()) => {
  const seconds = (new Date(date).getTime() - now.getTime()) / 1000
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    // Truncate rather than round, so 59.6 minutes stays "59 minutes ago" instead of "60 minutes ago".
    if (Math.abs(seconds) >= unitSeconds)
      return format.format(Math.trunc(seconds / unitSeconds), unit)
  }
  return 'just now'
}

const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Orders names the way people read them, wherever a list of names is sorted: ignoring case
 * ("alpha" before "Zeta") and with numbers by value ("Project 2" before "Project 10").
 */
export const compareNames = (a: string, b: string) => NAME_COLLATOR.compare(a, b)

export const getUserInitials = (name: string) => {
  const [first = '', second = ''] = name.split(' ')
  return `${first.charAt(0)}${second ? second.charAt(0) : first.charAt(1)}`.toUpperCase()
}

/** A route param as a database id, or `null` when it is not a ULID (`/projects/abc`). */
export const parseRouteId = (value: string | undefined) => {
  const result = idSchema.safeParse(value)
  return result.success ? result.data : null
}
