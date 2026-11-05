import { QueryClient } from '@tanstack/react-query'
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ITEM_DETAIL_QUERY_KEY, PROJECT_DETAIL_QUERY_KEY, PROJECTS_QUERY_KEY } from './query-keys'
import { isCached, isInvalidated, renderHookWithQueryClient } from './test-utils'
import { useProjectCreate, useProjectDelete, useProjectUpdate } from './use-projects'

const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))

vi.mock('./api', () => ({ api }))

const LIST = PROJECTS_QUERY_KEY
const DETAIL = [...PROJECT_DETAIL_QUERY_KEY('p1'), {}]
const DETAIL_WITH_ARCHIVED = [...PROJECT_DETAIL_QUERY_KEY('p1'), { includeArchived: true }]
const OTHER_DETAIL = [...PROJECT_DETAIL_QUERY_KEY('p2'), {}]
const ITEM = ITEM_DETAIL_QUERY_KEY('i1')

let queryClient: QueryClient

/** Fills the cache with every query a project mutation could touch. */
const seedCache = () => {
  for (const key of [LIST, DETAIL, DETAIL_WITH_ARCHIVED, OTHER_DETAIL, ITEM]) {
    queryClient.setQueryData(key, { cached: true })
  }
}

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  seedCache()
})

describe('project mutations cache', () => {
  it('update refreshes the list and every params variant of that project only', async () => {
    api.patch.mockResolvedValue({ data: { id: 'p1' } })
    const result = renderHookWithQueryClient(queryClient, useProjectUpdate)

    await act(() =>
      result.current.mutateAsync({ id: 'p1', name: 'P', isForAllUsers: false, isArchived: false }),
    )

    expect(isInvalidated(queryClient, LIST)).toBe(true)
    expect(isInvalidated(queryClient, DETAIL)).toBe(true)
    expect(isInvalidated(queryClient, DETAIL_WITH_ARCHIVED)).toBe(true)
    expect(isInvalidated(queryClient, OTHER_DETAIL)).toBe(false)
    expect(isInvalidated(queryClient, ITEM)).toBe(false)
  })

  it('create refreshes only the list', async () => {
    api.post.mockResolvedValue({ data: { id: 'p3' } })
    const result = renderHookWithQueryClient(queryClient, useProjectCreate)

    await act(() => result.current.mutateAsync({ name: 'P', isForAllUsers: false }))

    expect(isInvalidated(queryClient, LIST)).toBe(true)
    expect(isInvalidated(queryClient, DETAIL)).toBe(false)
    expect(isInvalidated(queryClient, OTHER_DETAIL)).toBe(false)
  })

  it('delete drops the project and all cached items, and refreshes the list', async () => {
    api.delete.mockResolvedValue({})
    const result = renderHookWithQueryClient(queryClient, useProjectDelete)

    await act(() => result.current.mutateAsync('p1'))

    expect(isCached(queryClient, DETAIL)).toBe(false)
    expect(isCached(queryClient, DETAIL_WITH_ARCHIVED)).toBe(false)
    expect(isCached(queryClient, ITEM)).toBe(false)
    expect(isInvalidated(queryClient, LIST)).toBe(true)
    expect(isCached(queryClient, OTHER_DETAIL)).toBe(true)
    expect(isInvalidated(queryClient, OTHER_DETAIL)).toBe(false)
  })

  it('leaves the cache untouched when the request fails', async () => {
    api.delete.mockRejectedValue(new Error('failed'))
    const result = renderHookWithQueryClient(queryClient, useProjectDelete)

    await act(() => result.current.mutateAsync('p1').catch(() => {}))

    expect(isCached(queryClient, DETAIL)).toBe(true)
    expect(isCached(queryClient, ITEM)).toBe(true)
    expect(isInvalidated(queryClient, LIST)).toBe(false)
  })
})
