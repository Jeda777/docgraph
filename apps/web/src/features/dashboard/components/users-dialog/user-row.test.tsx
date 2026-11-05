import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAxiosError } from '@/lib/api/test-utils'

const update = vi.hoisted(() => ({ isPending: false, mutate: vi.fn() }))

vi.mock('@/lib/api', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors')),
  useUserUpdate: () => update,
}))

const showErrorToast = vi.hoisted(() => vi.fn())

vi.mock('@/lib/error-toast', () => ({ showErrorToast }))

const { UserRow } = await import('./user-row')

const user = {
  id: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
  name: 'john',
  email: 'john@example.com',
  isAdmin: false,
}

const openMenu = () => fireEvent.click(screen.getByRole('button', { name: 'Manage john' }))

beforeEach(() => {
  update.mutate.mockReset()
  showErrorToast.mockReset()
})

afterEach(cleanup)

describe('UserRow', () => {
  it('shows no actions for the signed-in admin', () => {
    render(<UserRow user={{ ...user, isAdmin: true }} isSelf onDelete={vi.fn()} />)

    expect(screen.getByText('(you)')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('makes a user an admin', async () => {
    render(<UserRow user={user} isSelf={false} onDelete={vi.fn()} />)
    openMenu()

    fireEvent.click(await screen.findByText('Make admin'))

    expect(update.mutate).toHaveBeenCalledWith({ id: user.id, isAdmin: true }, expect.anything())
  })

  it('removes admin rights and reports a failure in a toast', async () => {
    render(<UserRow user={{ ...user, isAdmin: true }} isSelf={false} onDelete={vi.fn()} />)
    openMenu()
    fireEvent.click(await screen.findByText('Remove admin rights'))

    expect(update.mutate).toHaveBeenCalledWith({ id: user.id, isAdmin: false }, expect.anything())
    const error = apiAxiosError(403, 'FORBIDDEN', 'Forbidden')
    const options = update.mutate.mock.calls.at(-1)?.[1] as { onError: (error: unknown) => void }
    act(() => options.onError(error))

    expect(showErrorToast).toHaveBeenCalledWith('Could not change the role', error)
  })

  it('asks the dialog to confirm a delete', async () => {
    const onDelete = vi.fn()
    render(<UserRow user={user} isSelf={false} onDelete={onDelete} />)
    openMenu()

    fireEvent.click(await screen.findByText('Delete'))

    expect(onDelete).toHaveBeenCalledWith(user)
  })
})
