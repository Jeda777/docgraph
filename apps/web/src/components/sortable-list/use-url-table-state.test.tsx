import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useUrlTableState } from './use-url-table-state'

type SortBy = 'name' | 'createdAt'

const makeWrapper = (entry: string) => {
  // biome-ignore lint/correctness/noComponentHookFactories: renderHook needs the start URL baked into its wrapper; each test builds it once, so nothing remounts.
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  )
  return Wrapper
}

describe('useUrlTableState', () => {
  it('falls back to defaults when params are missing', () => {
    const wrapper = makeWrapper('/projects')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    expect(result.current.search).toBe('')
    expect(result.current.sort).toEqual({ by: 'createdAt', direction: 'desc' })
  })

  it('ignores a sort param outside the allowed keys but keeps the direction', () => {
    const wrapper = makeWrapper('/projects?sort=evil&direction=asc')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    expect(result.current.sort).toEqual({ by: 'createdAt', direction: 'asc' })
  })

  it('reads search and sort params from the URL', () => {
    const wrapper = makeWrapper('/projects?search=docs&sort=name&direction=asc')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    expect(result.current.search).toBe('docs')
    expect(result.current.sort).toEqual({ by: 'name', direction: 'asc' })
  })

  it('writes and clears the search param', () => {
    const wrapper = makeWrapper('/projects')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    act(() => result.current.setSearch('docs'))
    expect(result.current.search).toBe('docs')

    act(() => result.current.setSearch(''))
    expect(result.current.search).toBe('')
  })

  it('starts ascending on an unsorted column, then toggles to descending', () => {
    const wrapper = makeWrapper('/projects')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    act(() => result.current.handleSort('name'))
    expect(result.current.sort).toEqual({ by: 'name', direction: 'asc' })

    act(() => result.current.handleSort('name'))
    expect(result.current.sort).toEqual({ by: 'name', direction: 'desc' })
  })

  it('restarts ascending when switching to another column', () => {
    const wrapper = makeWrapper('/projects?sort=name&direction=desc')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    act(() => result.current.handleSort('createdAt'))
    expect(result.current.sort).toEqual({ by: 'createdAt', direction: 'asc' })
  })

  it('sets sort field and direction at once', () => {
    const wrapper = makeWrapper('/projects')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({ sortKeys: ['name', 'createdAt'], defaultSortBy: 'createdAt' }),
      { wrapper },
    )

    act(() => result.current.setSort({ by: 'name', direction: 'desc' }))
    expect(result.current.sort).toEqual({ by: 'name', direction: 'desc' })
  })

  it('uses the default view until another one is picked, ignoring unknown values', () => {
    const wrapper = makeWrapper('/projects?view=evil')
    const { result } = renderHook(
      () =>
        useUrlTableState<SortBy>({
          sortKeys: ['name', 'createdAt'],
          defaultSortBy: 'createdAt',
          defaultView: 'grid',
        }),
      { wrapper },
    )

    expect(result.current.view).toBe('grid')

    act(() => result.current.setView('table'))
    expect(result.current.view).toBe('table')

    act(() => result.current.setView('grid'))
    expect(result.current.view).toBe('grid')
  })
})
