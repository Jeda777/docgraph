import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Session = {
  data: { user: { id: string; name: string; email: string; isAdmin: boolean } } | null
  isPending: boolean
}

const session = vi.hoisted(() => ({ current: { data: null, isPending: true } as Session }))

vi.mock('./auth', () => ({ authClient: { useSession: () => session.current } }))

// `hasLoadedOnce` is module state, so every test imports a fresh copy of the module.
const loadUseMe = async () => {
  vi.resetModules()
  return (await import('./use-me')).useMe
}

const USER = { id: 'u1', name: 'Jane', email: 'jane@example.com', isAdmin: true }

afterEach(cleanup)

describe('useMe', () => {
  beforeEach(() => {
    session.current = { data: null, isPending: true }
  })

  it('is pending until the first session fetch settles', async () => {
    const useMe = await loadUseMe()
    const { result, rerender } = renderHook(() => useMe())
    expect(result.current.isPending).toBe(true)

    session.current = { data: null, isPending: false }
    rerender()
    expect(result.current.isPending).toBe(false)
  })

  it('stays settled when a refetch without a session goes pending again', async () => {
    const useMe = await loadUseMe()
    const { result, rerender } = renderHook(() => useMe())
    session.current = { data: null, isPending: false }
    rerender()

    session.current = { data: null, isPending: true }
    rerender()

    expect(result.current.isPending).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('keeps the first load for components mounted later', async () => {
    const useMe = await loadUseMe()
    session.current = { data: null, isPending: false }
    renderHook(() => useMe()).unmount()

    session.current = { data: null, isPending: true }
    const { result } = renderHook(() => useMe())

    expect(result.current.isPending).toBe(false)
  })

  it('exposes the user fields of the session', async () => {
    const useMe = await loadUseMe()
    session.current = { data: { user: USER }, isPending: false }
    const { result } = renderHook(() => useMe())

    expect(result.current).toMatchObject({
      id: 'u1',
      name: 'Jane',
      email: 'jane@example.com',
      isAdmin: true,
      data: { user: USER },
    })
  })

  it('falls back to empty user fields without a session', async () => {
    const useMe = await loadUseMe()
    session.current = { data: null, isPending: false }
    const { result } = renderHook(() => useMe())

    expect(result.current).toMatchObject({ id: null, name: null, email: null, isAdmin: false })
  })
})
