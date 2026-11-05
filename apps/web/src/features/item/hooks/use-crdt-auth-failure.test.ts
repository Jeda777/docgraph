import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'
import { useCrdtAuthFailure } from './use-crdt-auth-failure'

const mocks = vi.hoisted(() => ({
  onAuthenticationFailed: undefined as (() => Promise<void>) | undefined,
  refetchSession: vi.fn(),
  toast: { add: vi.fn() },
}))

vi.mock('@hocuspocus/provider-react', () => ({
  useHocuspocusEvent: (event: string, handler: () => Promise<void>) => {
    if (event === 'authenticationFailed') mocks.onAuthenticationFailed = handler
  },
}))

vi.mock('@/components/ui/toast', () => ({ toast: mocks.toast }))

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  useMe: () => ({ refetch: mocks.refetchSession }),
}))

const CONNECTION_FAILED = {
  type: 'error',
  title: 'Connection failed',
  description: 'Could not authenticate with the collaboration server.',
}

const failAuthentication = async (itemError: unknown = null) => {
  const refetchItem = vi.fn().mockResolvedValue({ error: itemError })
  renderHook(() => useCrdtAuthFailure(refetchItem))
  await mocks.onAuthenticationFailed?.()
  return refetchItem
}

describe('useCrdtAuthFailure', () => {
  beforeEach(() => {
    mocks.onAuthenticationFailed = undefined
    mocks.refetchSession.mockReset().mockResolvedValue({})
    mocks.toast.add.mockReset()
  })

  it('reloads the session and the item when the server refuses the connection', async () => {
    const refetchItem = await failAuthentication()

    expect(mocks.refetchSession).toHaveBeenCalledOnce()
    expect(refetchItem).toHaveBeenCalledOnce()
  })

  it('only tells the user the item is closed when it is gone for them', async () => {
    await failAuthentication(apiAxiosError(404, 'NOT_FOUND', 'Not found'))

    expect(mocks.toast.add).toHaveBeenCalledOnce()
    expect(mocks.toast.add).toHaveBeenCalledWith({
      type: 'error',
      title: 'Item closed',
      description: 'This item was deleted or you no longer have access to it.',
    })
  })

  it('reports a failed connection when the item is still accessible', async () => {
    await failAuthentication()

    expect(mocks.toast.add).toHaveBeenCalledOnce()
    expect(mocks.toast.add).toHaveBeenCalledWith(CONNECTION_FAILED)
  })

  it('reports a failed connection when reloading the item fails for another reason', async () => {
    await failAuthentication(apiAxiosError(500, 'INTERNAL_SERVER_ERROR', 'Server error'))

    expect(mocks.toast.add).toHaveBeenCalledOnce()
    expect(mocks.toast.add).toHaveBeenCalledWith(CONNECTION_FAILED)
  })
})
