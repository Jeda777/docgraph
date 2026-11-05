import type { ItemOutput } from '@docgraph/common/schemas'
import { QueryClient } from '@tanstack/react-query'
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ITEM_DETAIL_QUERY_KEY, PROJECT_DETAIL_QUERY_KEY, PROJECTS_QUERY_KEY } from './query-keys'
import { isCached, isInvalidated, renderHookWithQueryClient } from './test-utils'
import { useItemCreate, useItemDelete, useItemUpdate } from './use-items'

const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))

vi.mock('./api', () => ({ api }))

const LIST = PROJECTS_QUERY_KEY
const PROJECT = [...PROJECT_DETAIL_QUERY_KEY('p1'), {}]
const PROJECT_WITH_ARCHIVED = [...PROJECT_DETAIL_QUERY_KEY('p1'), { includeArchived: true }]
const OTHER_PROJECT = [...PROJECT_DETAIL_QUERY_KEY('p2'), {}]
const ITEM = ITEM_DETAIL_QUERY_KEY('i1')
const OTHER_ITEM = ITEM_DETAIL_QUERY_KEY('i2')

const item = (overrides: Partial<ItemOutput> = {}): ItemOutput => ({
  id: 'i1',
  projectId: 'p1',
  name: 'Item',
  type: 'DOCUMENT',
  isArchived: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
})

let queryClient: QueryClient

/** Fills the cache with every query an item mutation could touch. */
const seedCache = () => {
  for (const key of [LIST, PROJECT, PROJECT_WITH_ARCHIVED, OTHER_PROJECT, OTHER_ITEM]) {
    queryClient.setQueryData(key, { cached: true })
  }
  queryClient.setQueryData(ITEM, item())
}

const expectOnlyProjectP1Refreshed = () => {
  expect(isInvalidated(queryClient, PROJECT)).toBe(true)
  expect(isInvalidated(queryClient, PROJECT_WITH_ARCHIVED)).toBe(true)
  expect(isInvalidated(queryClient, OTHER_PROJECT)).toBe(false)
  // Items appear only in project details, so the list stays valid.
  expect(isInvalidated(queryClient, LIST)).toBe(false)
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  seedCache()
})

describe('item mutations cache', () => {
  it('create refreshes the details of the new item project', async () => {
    api.post.mockResolvedValue({ data: item({ id: 'i3' }) })
    const result = renderHookWithQueryClient(queryClient, useItemCreate)

    await act(() => result.current.mutateAsync({ name: 'Item', type: 'DOCUMENT', projectId: 'p1' }))

    expectOnlyProjectP1Refreshed()
  })

  it('update stores the response as the item details and refreshes its project', async () => {
    const updated = item({ name: 'Renamed' })
    api.patch.mockResolvedValue({ data: updated })
    const result = renderHookWithQueryClient(queryClient, useItemUpdate)

    await act(() => result.current.mutateAsync({ id: 'i1', name: 'Renamed', isArchived: false }))

    expect(queryClient.getQueryData(ITEM)).toEqual(updated)
    expect(isInvalidated(queryClient, ITEM)).toBe(false)
    expectOnlyProjectP1Refreshed()
  })

  it('delete drops the item details and refreshes its project', async () => {
    api.delete.mockResolvedValue({})
    const result = renderHookWithQueryClient(queryClient, useItemDelete)

    await act(() => result.current.mutateAsync({ id: 'i1', projectId: 'p1' }))

    expect(isCached(queryClient, ITEM)).toBe(false)
    expect(isCached(queryClient, OTHER_ITEM)).toBe(true)
    expectOnlyProjectP1Refreshed()
  })
})
