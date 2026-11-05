import type { ApiErrorCode } from '@docgraph/common/schemas'
import { type QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { AxiosError } from 'axios'
import { createElement, type ReactNode } from 'react'

/** An AxiosError carrying the server's JSON error body, as the API sends it. */
export const apiAxiosError = (status: number, code: ApiErrorCode, message: string) =>
  new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    data: { code, message },
  } as AxiosError['response'])

/** Renders a hook inside `queryClient`; returns its live result. */
export const renderHookWithQueryClient = <T>(queryClient: QueryClient, useHook: () => T) =>
  renderHook(useHook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  }).result

export const isInvalidated = (queryClient: QueryClient, key: QueryKey) =>
  queryClient.getQueryState(key)?.isInvalidated

export const isCached = (queryClient: QueryClient, key: QueryKey) =>
  queryClient.getQueryData(key) !== undefined
