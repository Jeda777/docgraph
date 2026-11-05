import { describe, expect, it } from 'vitest'
import { filterBySearch } from './palette-search.helpers'

const TOOLS = [
  { label: 'User Task', category: 'Activities' },
  { label: 'Exclusive', category: 'Gateways' },
  { label: 'Timer', category: 'Events' },
]

const byLabelAndCategory = (tool: (typeof TOOLS)[number]) => `${tool.label} ${tool.category}`

describe('filterBySearch', () => {
  it('keeps every item for an empty or blank search', () => {
    expect(filterBySearch(TOOLS, '', byLabelAndCategory)).toEqual(TOOLS)
    expect(filterBySearch(TOOLS, '   ', byLabelAndCategory)).toEqual(TOOLS)
  })

  it('matches ignoring case and surrounding spaces', () => {
    expect(filterBySearch(TOOLS, '  user TASK ', byLabelAndCategory)).toEqual([TOOLS[0]])
  })

  it('matches any part of the search text', () => {
    expect(filterBySearch(TOOLS, 'gateway', byLabelAndCategory)).toEqual([TOOLS[1]])
  })

  it('returns nothing when no item matches', () => {
    expect(filterBySearch(TOOLS, 'no such tool', byLabelAndCategory)).toEqual([])
  })
})
