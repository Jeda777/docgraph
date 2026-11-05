import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDocumentReadOnly } from './use-document-read-only'

type Listener = () => void

// A minimal provider: the hook only reads `authorizedScope` and listens to `authenticated`.
const provider = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>()
  return {
    authorizedScope: undefined as string | undefined,
    listeners,
    on: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)?.add(listener)
    },
    off: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener)
    },
  }
})

vi.mock('@hocuspocus/provider-react', () => ({ useHocuspocusProvider: () => provider }))

/** Mimics the provider: the scope changes together with the `authenticated` event. */
const authenticate = (scope: string | undefined) =>
  act(() => {
    provider.authorizedScope = scope
    for (const listener of provider.listeners.get('authenticated') ?? new Set<Listener>()) {
      listener()
    }
  })

const listenerCount = () => provider.listeners.get('authenticated')?.size ?? 0

describe('useDocumentReadOnly', () => {
  beforeEach(() => {
    provider.authorizedScope = undefined
    provider.listeners.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('is false before the connection is authenticated', () => {
    const { result } = renderHook(() => useDocumentReadOnly())
    expect(result.current).toBe(false)
  })

  it('is false for a read-write scope', () => {
    provider.authorizedScope = 'read-write'
    const { result } = renderHook(() => useDocumentReadOnly())
    expect(result.current).toBe(false)
  })

  it('is true when the connection already has the readonly scope', () => {
    provider.authorizedScope = 'readonly'
    const { result } = renderHook(() => useDocumentReadOnly())
    expect(result.current).toBe(true)
  })

  it('follows the scope of every authentication, including reconnects', () => {
    const { result } = renderHook(() => useDocumentReadOnly())

    authenticate('readonly')
    expect(result.current).toBe(true)

    authenticate('read-write')
    expect(result.current).toBe(false)
  })

  it('subscribes once and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useDocumentReadOnly())
    expect(listenerCount()).toBe(1)

    unmount()

    expect(listenerCount()).toBe(0)
  })
})
