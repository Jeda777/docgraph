import { useSearchParams } from 'react-router'

export type SortDirection = 'asc' | 'desc'

export type ListView = 'grid' | 'table'

export type SortState<By extends string> = {
  by: By
  direction: SortDirection
}

export type UrlTableState<By extends string> = {
  search: string
  setSearch: (value: string) => void
  sort: SortState<By>
  handleSort: (by: By) => void
  setSort: (sort: SortState<By>) => void
  view: ListView
  setView: (view: ListView) => void
}

export type UseUrlTableStateOptions<By extends string> = {
  sortKeys: readonly By[]
  defaultSortBy: By
  defaultView?: ListView
}

/**
 * Keeps list search, sort and view state in URL query params
 * (`?search=…&sort=…&direction=…&view=…`) so views stay deep-linkable and survive reloads.
 */
export const useUrlTableState = <By extends string>({
  sortKeys,
  defaultSortBy,
  defaultView = 'table',
}: UseUrlTableStateOptions<By>): UrlTableState<By> => {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') ?? ''

  const byParam = searchParams.get('sort')
  const by = sortKeys.includes(byParam as By) ? (byParam as By) : defaultSortBy
  const direction: SortDirection = searchParams.get('direction') === 'asc' ? 'asc' : 'desc'

  const viewParam = searchParams.get('view')
  const view: ListView = viewParam === 'grid' || viewParam === 'table' ? viewParam : defaultView

  const setSearch = (value: string) => {
    setSearchParams(
      (prev) => {
        if (value) {
          prev.set('search', value)
        } else {
          prev.delete('search')
        }
        return prev
      },
      { replace: true },
    )
  }

  const handleSort = (nextBy: By) => {
    setSearchParams(
      (prev) => {
        const nextDirection = by === nextBy && direction === 'asc' ? 'desc' : 'asc'
        prev.set('sort', nextBy)
        prev.set('direction', nextDirection)
        return prev
      },
      { replace: true },
    )
  }

  const setSort = (next: SortState<By>) => {
    setSearchParams(
      (prev) => {
        prev.set('sort', next.by)
        prev.set('direction', next.direction)
        return prev
      },
      { replace: true },
    )
  }

  const setView = (next: ListView) => {
    setSearchParams(
      (prev) => {
        // The default view stays out of the URL, so plain links keep their clean form.
        if (next === defaultView) {
          prev.delete('view')
        } else {
          prev.set('view', next)
        }
        return prev
      },
      { replace: true },
    )
  }

  return { search, setSearch, sort: { by, direction }, handleSort, setSort, view, setView }
}
