import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

const signOut = vi.hoisted(() => vi.fn<() => Promise<unknown>>())

vi.mock('./auth', () => ({ authClient: { signOut } }))

/** An adapter that answers every request with `status`, so the real interceptors run. */
const respondWith = (status: number) => async (config: InternalAxiosRequestConfig) => {
  const response = { status, data: {}, headers: {}, config, statusText: '' } as AxiosResponse
  if (status < 400) return response
  throw new AxiosError('Request failed', undefined, config, undefined, response)
}

const request = (status: number) => api.get('/test', { adapter: respondWith(status) })

/** Lets in-flight requests run through the adapter and interceptors. */
const flushRequests = () => new Promise((resolve) => setTimeout(resolve))

const deferred = () => {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('api 401 interceptor', () => {
  beforeEach(() => {
    signOut.mockReset()
    signOut.mockResolvedValue(undefined)
  })

  it('signs out once when parallel requests get a 401', async () => {
    const results = await Promise.allSettled([request(401), request(401), request(401)])

    expect(signOut).toHaveBeenCalledTimes(1)
    for (const result of results) {
      expect(result.status).toBe('rejected')
      expect(result.status === 'rejected' && result.reason.response.status).toBe(401)
    }
  })

  it('joins a 401 that arrives while the sign-out is still running', async () => {
    const signOutDone = deferred()
    signOut.mockReturnValue(signOutDone.promise)

    const first = request(401).catch((error) => error)
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    const second = request(401).catch((error) => error)
    await flushRequests()

    signOutDone.resolve()
    await Promise.all([first, second])

    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('rejects only after the sign-out finishes', async () => {
    const signOutDone = deferred()
    signOut.mockReturnValue(signOutDone.promise)
    let settled = false
    const pending = request(401).catch(() => {
      settled = true
    })

    await vi.waitFor(() => expect(signOut).toHaveBeenCalled())
    expect(settled).toBe(false)

    signOutDone.resolve()
    await pending
    expect(settled).toBe(true)
  })

  it('signs out again for a 401 after the previous sign-out finished', async () => {
    await request(401).catch(() => {})
    await request(401).catch(() => {})

    expect(signOut).toHaveBeenCalledTimes(2)
  })

  it('rejects with the original error when the sign-out fails', async () => {
    signOut.mockRejectedValue(new Error('network down'))

    await expect(request(401)).rejects.toMatchObject({ response: { status: 401 } })
    // The failed sign-out still releases the lock.
    await request(401).catch(() => {})
    expect(signOut).toHaveBeenCalledTimes(2)
  })

  it.each([403, 404, 500])('does not sign out on %i', async (status) => {
    await expect(request(status)).rejects.toMatchObject({ response: { status } })
    expect(signOut).not.toHaveBeenCalled()
  })

  it('passes successful responses through', async () => {
    await expect(request(200)).resolves.toMatchObject({ status: 200 })
    expect(signOut).not.toHaveBeenCalled()
  })
})
